/**
 * 프로파일 생성 가이드 위저드
 * 8단계 플로우: Welcome → 게임 세팅 → 하드웨어 → 캘리브레이션 → 전체 점검 → 분석 → 재테스트 → 완료
 * 상단 진행률 바, 이전/다음 네비게이션, 중간 저장 지원
 */
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../i18n';
import { safeInvoke } from '../utils/ipc';
import {
  useProfileWizardStore,
  WIZARD_STEPS,
  ASSESSMENT_STAGES,
  STAGE_DESCRIPTIONS,
  GAME_SENS_FIELDS,
  GAME_YAW_VALUES,
  AIMFORGE_YAW,
  type WizardStep,
  type SensConversion,
} from '../stores/profileWizardStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useCalibrationStore } from '../stores/calibrationStore';
import { gameSensToCm360, cm360ToSens } from '../utils/physics';
import type { GamePreset, StageType, AimDnaProfile } from '../utils/types';

interface ProfileWizardProps {
  /** 위저드 닫기 */
  onClose: () => void;
  /** 캘리브레이션 시작 요청 (App.tsx의 핸들러 재사용) */
  onStartCalibration: () => void;
  /** 훈련 시나리오 시작 요청 */
  onStartTraining: (stageType: StageType) => void;
}

/** 단계 i18n 키 매핑 */
const STEP_LABEL_KEYS: Record<WizardStep, string> = {
  'welcome': 'wizard.welcome',
  'game-settings': 'wizard.gameSettings',
  'hardware': 'wizard.hardware',
  'calibration': 'wizard.calibration',
  'full-assessment': 'wizard.assessment',
  'analysis': 'wizard.analysis',
  'retest': 'wizard.retest',
  'complete': 'wizard.complete',
};

export function ProfileWizard({ onClose, onStartCalibration, onStartTraining }: ProfileWizardProps) {
  const { t } = useTranslation();
  const store = useProfileWizardStore();
  const settingsStore = useSettingsStore();
  const calibrationStore = useCalibrationStore();

  const [games, setGames] = useState<GamePreset[]>([]);
  const [gameSearch, setGameSearch] = useState('');

  /** 게임 목록 로드 */
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games')
      .then(setGames)
      .catch(() => {});
  }, []);

  /** 검색 필터링된 게임 목록 */
  const filteredGames = gameSearch.trim()
    ? games.filter(g =>
        g.name.toLowerCase().includes(gameSearch.toLowerCase()) ||
        g.id.toLowerCase().includes(gameSearch.toLowerCase())
      )
    : games;

  /** 캘리브레이션 완료 감지 */
  useEffect(() => {
    if (store.currentStep === 'calibration' && calibrationStore.result) {
      store.setCalibrationResult(calibrationStore.result.recommendedCm360);
    }
  }, [calibrationStore.result, store.currentStep]);

  /** 전체 진행률 (%) */
  const progressPercent = ((store.currentStepIndex + 1) / WIZARD_STEPS.length) * 100;

  /** 다음 버튼 활성 여부 */
  const canNext = (): boolean => {
    switch (store.currentStep) {
      case 'game-settings':
        return store.selectedGame !== null && Object.keys(store.gameSensValues).length > 0;
      case 'hardware':
        return store.dpi > 0;
      case 'calibration':
        return store.calibratedCm360 !== null;
      case 'full-assessment':
        return !store.assessmentRunning && store.assessmentResults.length >= ASSESSMENT_STAGES.length;
      case 'analysis':
        return store.aimDna !== null;
      default:
        return true;
    }
  };

  /** 다음 단계 진행 시 부가 처리 */
  const handleNext = () => {
    if (store.currentStep === 'game-settings' && store.selectedGame) {
      /** 게임 세팅 → settingsStore 동기화 */
      settingsStore.selectGame(store.selectedGame);
      const mainSens = store.gameSensValues['sensitivity'] ?? 1.0;
      settingsStore.setSensitivity(mainSens);
    }
    if (store.currentStep === 'hardware') {
      /** 하드웨어 → settingsStore DPI 동기화 */
      settingsStore.setDpi(store.dpi);
    }
    store.nextStep();
  };

  /** 감도 변환 계산 — 프로파일 완료 시 */
  const computeConversions = useCallback((aimforgeCm360: number): SensConversion[] => {
    /** aimforge 내부 감도 = cm360ToSens(cm360, dpi, AIMFORGE_YAW) */
    const aimforgeSens = cm360ToSens(aimforgeCm360, store.dpi, AIMFORGE_YAW);

    return Object.entries(GAME_YAW_VALUES).map(([gameName, targetYaw]) => ({
      gameName,
      yaw: targetYaw,
      convertedSens: aimforgeSens * (AIMFORGE_YAW / targetYaw),
    }));
  }, [store.dpi]);

  /** 전체 점검 시작 */
  const handleStartAssessment = () => {
    store.startAssessment();
  };

  /** 분석 수행 */
  const handleAnalyze = async () => {
    try {
      const dna = await safeInvoke<AimDnaProfile>('compute_aim_dna_cmd', {
        params: { profile_id: 1, session_id: null },
      });
      if (dna) {
        /** GP 기반 감도 제안 — 캘리브레이션 결과가 있으면 그것 사용 */
        const suggested = store.calibratedCm360;
        store.setAnalysisResult(dna, suggested);
      }
    } catch (e) {
      console.error('[ProfileWizard] DNA 분석 실패:', e);
    }
  };

  /** 약한 영역 판별 (하위 30% 점수) */
  const identifyWeakStages = (): StageType[] => {
    const results = store.assessmentResults;
    if (results.length === 0) return [];
    const scores = results.map(r => r.score);
    const threshold = Math.max(...scores) * 0.7;
    return results
      .filter(r => r.score < threshold)
      .map(r => r.stageType);
  };

  /** 재테스트 시작 */
  const handleStartRetest = () => {
    const weak = identifyWeakStages();
    if (weak.length === 0) {
      /** 약한 영역 없음 → 완료로 진행 */
      const finalCm = store.calibratedCm360 ?? settingsStore.cmPer360;
      store.finalize(finalCm, computeConversions(finalCm));
      store.goToStep('complete');
      return;
    }
    store.startRetest(weak);
  };

  /** 완료 처리 */
  const handleComplete = async () => {
    const finalCm = store.suggestedCm360 ?? store.calibratedCm360 ?? settingsStore.cmPer360;
    const conversions = computeConversions(finalCm);
    store.finalize(finalCm, conversions);

    /** 프로필 DB 저장 */
    if (store.selectedGame) {
      try {
        await invoke('create_game_profile', {
          gameName: store.selectedGame.name,
          dpi: store.dpi,
          sensitivity: store.gameSensValues['sensitivity'] ?? 1.0,
          fov: store.selectedGame.defaultFov,
          scopeMultiplier: 1.0,
        });
      } catch (e) {
        console.error('[ProfileWizard] 프로필 저장 실패:', e);
      }
    }
  };

  /** 현재 점검 시나리오 정보 */
  const currentAssessmentStage = store.assessmentRunning && store.assessmentIndex < ASSESSMENT_STAGES.length
    ? ASSESSMENT_STAGES[store.assessmentIndex]
    : null;

  return (
    <div className="profile-wizard">
      {/* 상단 진행률 바 */}
      <div className="pw-progress-bar">
        <div className="pw-progress-fill" style={{ width: `${progressPercent}%` }} />
        <span className="pw-progress-label">
          Step {store.currentStepIndex + 1}/{WIZARD_STEPS.length} — {t(STEP_LABEL_KEYS[store.currentStep])}
        </span>
      </div>

      {/* 단계 인디케이터 */}
      <div className="pw-step-indicators">
        {WIZARD_STEPS.map((step, i) => (
          <div
            key={step}
            className={`pw-step-dot ${i === store.currentStepIndex ? 'active' : ''} ${i < store.currentStepIndex ? 'done' : ''}`}
            title={t(STEP_LABEL_KEYS[step])}
          />
        ))}
      </div>

      <div className="pw-content">
        {/* ============ Step 1: Welcome ============ */}
        {store.currentStep === 'welcome' && (
          <div className="pw-step">
            <h2>{t('wizard.createProfile')}</h2>
            <p className="pw-description">
              {t('wizard.profileDesc')}
            </p>
            <div className="pw-flow-preview">
              <div className="pw-flow-item">
                <span className="pw-flow-num">1</span>
                <span>{t('wizard.step1')}</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">2</span>
                <span>{t('wizard.step2')}</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">3</span>
                <span>{t('wizard.step3')}</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">4</span>
                <span>{t('wizard.step4')}</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">5</span>
                <span>{t('wizard.step5')}</span>
              </div>
            </div>
            <p className="pw-note">
              {t('wizard.timeEstimate')}
            </p>
          </div>
        )}

        {/* ============ Step 2: 게임 세팅 ============ */}
        {store.currentStep === 'game-settings' && (
          <div className="pw-step">
            <h2>{t('wizard.selectMainGame')}</h2>
            <p className="pw-description">{t('wizard.selectMainGameDesc')}</p>

            {/* 게임 검색 */}
            <input
              type="text"
              className="input-field"
              placeholder={t('wizard.searchGame')}
              value={gameSearch}
              onChange={e => setGameSearch(e.target.value)}
              style={{ marginBottom: 12, maxWidth: 400 }}
            />

            <div className="pw-game-grid">
              {filteredGames.map(g => (
                <div
                  key={g.name}
                  className={`pw-game-card ${store.selectedGame?.name === g.name ? 'selected' : ''}`}
                  onClick={() => store.setSelectedGame(g)}
                >
                  <span className="pw-game-name">{g.name}</span>
                  <span className="pw-game-yaw">yaw: {g.yaw}</span>
                </div>
              ))}
            </div>

            {/* 게임별 전용 감도 필드 */}
            {store.selectedGame && (
              <div className="pw-sens-form">
                <h3>{store.selectedGame.name} {t('wizard.sensSettings')}</h3>
                {(GAME_SENS_FIELDS[store.selectedGame.name] ?? [
                  { key: 'sensitivity', label: t('settings.sensitivity'), min: 0.01, max: 100, step: 0.01, defaultValue: 1.0 },
                ]).map(field => (
                  <div key={field.key} className="pw-field">
                    <label>{field.label}</label>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={store.gameSensValues[field.key] ?? field.defaultValue}
                      onChange={e => store.setGameSensValue(field.key, Number(e.target.value) || field.defaultValue)}
                    />
                  </div>
                ))}
                {/* cm/360 미리보기 */}
                {store.selectedGame && store.gameSensValues['sensitivity'] && (
                  <div className="pw-cm360-preview">
                    {gameSensToCm360(
                      store.gameSensValues['sensitivity'],
                      store.dpi,
                      store.selectedGame.yaw,
                    ).toFixed(1)} cm/360
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ Step 3: 하드웨어 ============ */}
        {store.currentStep === 'hardware' && (
          <div className="pw-step">
            <h2>{t('wizard.hardwareSettings')}</h2>
            <p className="pw-description">{t('wizard.hardwareDesc')}</p>

            <div className="pw-hardware-grid">
              <div className="pw-field">
                <label>{t('wizard.mouseDpi')}</label>
                <input
                  type="number"
                  min={100}
                  max={32000}
                  step={50}
                  value={store.dpi}
                  onChange={e => store.setDpi(Number(e.target.value) || 800)}
                />
              </div>
              <div className="pw-field">
                <label>{t('wizard.monitorWidth')}</label>
                <input
                  type="number"
                  min={800}
                  max={7680}
                  value={store.monitorWidth}
                  onChange={e => store.setHardware(
                    store.dpi,
                    Number(e.target.value) || 1920,
                    store.monitorHeight,
                    store.refreshRate,
                  )}
                />
              </div>
              <div className="pw-field">
                <label>{t('wizard.monitorHeight')}</label>
                <input
                  type="number"
                  min={600}
                  max={4320}
                  value={store.monitorHeight}
                  onChange={e => store.setHardware(
                    store.dpi,
                    store.monitorWidth,
                    Number(e.target.value) || 1080,
                    store.refreshRate,
                  )}
                />
              </div>
              <div className="pw-field">
                <label>{t('wizard.refreshRate')}</label>
                <select
                  value={store.refreshRate}
                  onChange={e => store.setHardware(
                    store.dpi,
                    store.monitorWidth,
                    store.monitorHeight,
                    Number(e.target.value),
                  )}
                >
                  <option value={60}>60 Hz</option>
                  <option value={75}>75 Hz</option>
                  <option value={120}>120 Hz</option>
                  <option value={144}>144 Hz</option>
                  <option value={165}>165 Hz</option>
                  <option value={240}>240 Hz</option>
                  <option value={360}>360 Hz</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ============ Step 4: 캘리브레이션 ============ */}
        {store.currentStep === 'calibration' && (
          <div className="pw-step">
            <h2>{t('wizard.sensCalibration')}</h2>
            <p className="pw-description">
              {t('wizard.sensCalDesc')}
            </p>
            {store.calibratedCm360 ? (
              <div className="pw-calibration-done">
                <div className="pw-result-badge">
                  <span className="pw-result-value">{store.calibratedCm360.toFixed(1)}</span>
                  <span className="pw-result-unit">cm/360</span>
                </div>
                <p>{t('wizard.calDone')}</p>
              </div>
            ) : (
              <div className="pw-calibration-start">
                <p>{t('wizard.notCalibrated')}</p>
                <button className="btn-primary" onClick={onStartCalibration}>
                  {t('wizard.startCal')}
                </button>
                <button
                  className="btn-secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    /** 캘리브레이션 건너뛰기 — 현재 감도 사용 */
                    store.setCalibrationResult(settingsStore.cmPer360);
                  }}
                >
                  {t('wizard.skipCal')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============ Step 5: 전체 점검 ============ */}
        {store.currentStep === 'full-assessment' && (
          <div className="pw-step">
            <h2>{t('wizard.fullAssessment')}</h2>
            <p className="pw-description">
              {t('wizard.fullAssessmentDesc')}
            </p>

            {/* 시나리오 목록 */}
            <div className="pw-assessment-list">
              {ASSESSMENT_STAGES.map((stage, i) => {
                const info = STAGE_DESCRIPTIONS[stage];
                const result = store.assessmentResults.find(r => r.stageType === stage);
                const isCurrent = store.assessmentRunning && i === store.assessmentIndex;
                return (
                  <div
                    key={stage}
                    className={`pw-assessment-item ${result ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                  >
                    <div className="pw-assessment-num">{i + 1}</div>
                    <div className="pw-assessment-info">
                      <span className="pw-assessment-name">{info?.name ?? stage}</span>
                      <span className="pw-assessment-desc">{info?.description ?? ''}</span>
                    </div>
                    {result && (
                      <span className="pw-assessment-score">{result.score.toFixed(0)}pts</span>
                    )}
                    {isCurrent && !result && (
                      <span className="pw-assessment-badge">{t('common.inProgress')}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 점검 컨트롤 */}
            {!store.assessmentRunning && store.assessmentResults.length === 0 && (
              <button className="btn-primary" onClick={handleStartAssessment}>
                {t('wizard.startAssessment')}
              </button>
            )}

            {/* 현재 시나리오 시작 프롬프트 */}
            {store.assessmentRunning && currentAssessmentStage && (
              <div className="pw-current-scenario">
                <h3>{STAGE_DESCRIPTIONS[currentAssessmentStage]?.name}</h3>
                <p>{STAGE_DESCRIPTIONS[currentAssessmentStage]?.description}</p>
                <button
                  className="btn-primary"
                  onClick={() => onStartTraining(currentAssessmentStage)}
                >
                  {t('wizard.startScenario')}
                </button>
              </div>
            )}

            {/* 전체 완료 */}
            {!store.assessmentRunning && store.assessmentResults.length >= ASSESSMENT_STAGES.length && (
              <div className="pw-assessment-done">
                <p>{t('wizard.assessmentDone')}</p>
              </div>
            )}
          </div>
        )}

        {/* ============ Step 6: 결과 분석 ============ */}
        {store.currentStep === 'analysis' && (
          <div className="pw-step">
            <h2>{t('wizard.dnaAnalysis')}</h2>
            <p className="pw-description">
              {t('wizard.dnaAnalysisDesc')}
            </p>

            {!store.aimDna ? (
              <div className="pw-analysis-start">
                <button className="btn-primary" onClick={handleAnalyze}>
                  {t('wizard.startAnalysis')}
                </button>
              </div>
            ) : (
              <div className="pw-analysis-result">
                {/* 레이더 차트 간소화 — 5축 점수 표시 */}
                <div className="pw-radar-summary">
                  <h3>{t('wizard.aimSummary')}</h3>
                  {store.aimDna.typeLabel && (
                    <div className="pw-type-badge">{store.aimDna.typeLabel}</div>
                  )}
                  <div className="pw-radar-grid">
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.flickSpeed')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.min((store.aimDna.flickPeakVelocity ?? 0) / 10 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.trackingAccuracy')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.max(100 - (store.aimDna.trackingMad ?? 5) * 20, 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.smoothnessLabel')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${(store.aimDna.smoothness ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.overshootSuppression')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.max(100 - (store.aimDna.overshootAvg ?? 5) * 10, 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.velocityMatching')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${(store.aimDna.velocityMatch ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 감도 제안 */}
                {store.suggestedCm360 && (
                  <div className="pw-sens-suggestion">
                    <h3>{t('wizard.sensSuggestion')}</h3>
                    <div className="pw-result-badge">
                      <span className="pw-result-value">{store.suggestedCm360.toFixed(1)}</span>
                      <span className="pw-result-unit">cm/360</span>
                    </div>
                  </div>
                )}

                {/* 점검 점수 요약 */}
                <div className="pw-scores-summary">
                  <h3>{t('wizard.scenarioScores')}</h3>
                  <div className="pw-scores-grid">
                    {store.assessmentResults.map(r => (
                      <div key={r.stageType} className="pw-score-item">
                        <span className="pw-score-name">
                          {STAGE_DESCRIPTIONS[r.stageType]?.name ?? r.stageType}
                        </span>
                        <span className={`pw-score-value ${r.score < (Math.max(...store.assessmentResults.map(x => x.score)) * 0.7) ? 'weak' : ''}`}>
                          {r.score.toFixed(0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============ Step 7: 재테스트 ============ */}
        {store.currentStep === 'retest' && (
          <div className="pw-step">
            <h2>{t('wizard.weakRetest')}</h2>
            <p className="pw-description">
              {t('wizard.weakRetestDesc')}
            </p>

            {store.weakStages.length === 0 ? (
              <div className="pw-retest-start">
                <p>{t('wizard.analyzingWeak')}</p>
                <button className="btn-primary" onClick={handleStartRetest}>
                  {t('wizard.identifyWeak')}
                </button>
                <button
                  className="btn-secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    /** 재테스트 건너뛰기 */
                    const finalCm = store.suggestedCm360 ?? store.calibratedCm360 ?? settingsStore.cmPer360;
                    store.finalize(finalCm, computeConversions(finalCm));
                    store.goToStep('complete');
                  }}
                >
                  {t('common.skip')}
                </button>
              </div>
            ) : (
              <div className="pw-retest-progress">
                <p>{t('style.retestRound')} {store.retestRound} — {store.weakStages.length} {t('style.areas')}</p>
                <div className="pw-assessment-list">
                  {store.weakStages.map((stage, i) => {
                    const result = store.retestResults.find(r => r.stageType === stage);
                    const isCurrent = !result && store.retestResults.length === i;
                    return (
                      <div
                        key={stage}
                        className={`pw-assessment-item ${result ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                      >
                        <div className="pw-assessment-num">{i + 1}</div>
                        <div className="pw-assessment-info">
                          <span className="pw-assessment-name">
                            {STAGE_DESCRIPTIONS[stage]?.name ?? stage}
                          </span>
                        </div>
                        {result && (
                          <span className="pw-assessment-score">{result.score.toFixed(0)}pts</span>
                        )}
                        {isCurrent && (
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => onStartTraining(stage)}
                          >
                            {t('common.start')}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {store.retestResults.length >= store.weakStages.length && (
                  <div className="pw-retest-done">
                    <p>{t('wizard.retestDone')}</p>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const finalCm = store.suggestedCm360 ?? store.calibratedCm360 ?? settingsStore.cmPer360;
                        store.finalize(finalCm, computeConversions(finalCm));
                        store.goToStep('complete');
                      }}
                    >
                      {t('wizard.viewResult')}
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ marginLeft: 8 }}
                      onClick={handleStartRetest}
                    >
                      {t('wizard.oneMoreTest')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ Step 8: 완료 ============ */}
        {store.currentStep === 'complete' && (
          <div className="pw-step">
            <h2>{t('wizard.profileComplete')}</h2>

            {/* 최종 감도 */}
            <div className="pw-final-result">
              <div className="pw-result-badge large">
                <span className="pw-result-value">{store.finalCm360?.toFixed(1) ?? '—'}</span>
                <span className="pw-result-unit">cm/360</span>
              </div>
            </div>

            {/* Aim DNA 타입 */}
            {store.aimDna?.typeLabel && (
              <div className="pw-type-badge large">{store.aimDna.typeLabel}</div>
            )}

            {/* 게임별 감도 변환 */}
            <div className="pw-conversions">
              <h3>{t('wizard.gameConversions')}</h3>
              <div className="pw-conversion-table">
                <div className="pw-conversion-header">
                  <span>{t('wizard.game')}</span>
                  <span>{t('wizard.convertedSens')}</span>
                </div>
                {store.sensConversions.map(c => (
                  <div key={c.gameName} className="pw-conversion-row">
                    <span className="pw-conversion-game">{c.gameName}</span>
                    <span className="pw-conversion-sens">{c.convertedSens.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pw-actions" style={{ marginTop: 24 }}>
              <button className="btn-primary" onClick={async () => {
                await handleComplete();
                onClose();
              }}>
                {t('wizard.saveAndComplete')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      {store.currentStep !== 'complete' && (
        <div className="pw-nav">
          <button
            className="btn-secondary"
            onClick={() => {
              if (store.currentStepIndex === 0) {
                onClose();
              } else {
                store.prevStep();
              }
            }}
          >
            {store.currentStepIndex === 0 ? t('common.cancel') : t('common.prev')}
          </button>
          <button
            className="btn-primary"
            onClick={handleNext}
            disabled={!canNext()}
          >
            {store.currentStep === 'analysis' ? t('wizard.toRetest') : t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
