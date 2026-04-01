/**
 * 프로파일 생성 가이드 위저드
 * 8단계 플로우: Welcome → 게임 세팅 → 하드웨어 → 캘리브레이션 → 전체 점검 → 분석 → 재테스트 → 완료
 * 상단 진행률 바, 이전/다음 네비게이션, 중간 저장 지원
 */
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
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

/** 단계 한글 레이블 */
const STEP_LABELS: Record<WizardStep, string> = {
  'welcome': '환영',
  'game-settings': '게임 세팅',
  'hardware': '하드웨어',
  'calibration': '캘리브레이션',
  'full-assessment': '전체 점검',
  'analysis': '결과 분석',
  'retest': '재테스트',
  'complete': '완료',
};

export function ProfileWizard({ onClose, onStartCalibration, onStartTraining }: ProfileWizardProps) {
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
      store.setCalibrationResult(calibrationStore.result.recommended_cm360);
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
          fov: store.selectedGame.default_fov,
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
          Step {store.currentStepIndex + 1}/{WIZARD_STEPS.length} — {STEP_LABELS[store.currentStep]}
        </span>
      </div>

      {/* 단계 인디케이터 */}
      <div className="pw-step-indicators">
        {WIZARD_STEPS.map((step, i) => (
          <div
            key={step}
            className={`pw-step-dot ${i === store.currentStepIndex ? 'active' : ''} ${i < store.currentStepIndex ? 'done' : ''}`}
            title={STEP_LABELS[step]}
          />
        ))}
      </div>

      <div className="pw-content">
        {/* ============ Step 1: Welcome ============ */}
        {store.currentStep === 'welcome' && (
          <div className="pw-step">
            <h2>에임 프로파일 생성</h2>
            <p className="pw-description">
              전체 에임 점검을 수행하고, GP Bayesian Optimization으로 최적 감도를 찾아드립니다.
            </p>
            <div className="pw-flow-preview">
              <div className="pw-flow-item">
                <span className="pw-flow-num">1</span>
                <span>게임 & 감도 입력</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">2</span>
                <span>하드웨어 확인</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">3</span>
                <span>감도 캘리브레이션</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">4</span>
                <span>8종 시나리오 전체 점검</span>
              </div>
              <div className="pw-flow-item">
                <span className="pw-flow-num">5</span>
                <span>Aim DNA 분석 + 감도 최적화</span>
              </div>
            </div>
            <p className="pw-note">
              약 15~20분이 소요됩니다. 중간에 나가도 진행 상태가 저장됩니다.
            </p>
          </div>
        )}

        {/* ============ Step 2: 게임 세팅 ============ */}
        {store.currentStep === 'game-settings' && (
          <div className="pw-step">
            <h2>주력 게임 선택</h2>
            <p className="pw-description">가장 많이 플레이하는 게임을 선택하고 현재 감도를 입력하세요.</p>

            {/* 게임 검색 */}
            <input
              type="text"
              className="input-field"
              placeholder="게임 이름으로 검색..."
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
                <h3>{store.selectedGame.name} 감도 설정</h3>
                {(GAME_SENS_FIELDS[store.selectedGame.name] ?? [
                  { key: 'sensitivity', label: '감도', min: 0.01, max: 100, step: 0.01, defaultValue: 1.0 },
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
            <h2>하드웨어 설정</h2>
            <p className="pw-description">마우스와 모니터 정보를 확인하세요.</p>

            <div className="pw-hardware-grid">
              <div className="pw-field">
                <label>마우스 DPI</label>
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
                <label>모니터 해상도 (가로)</label>
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
                <label>모니터 해상도 (세로)</label>
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
                <label>주사율 (Hz)</label>
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
            <h2>감도 캘리브레이션</h2>
            <p className="pw-description">
              GP Bayesian Optimization으로 최적 감도를 탐색합니다.
            </p>
            {store.calibratedCm360 ? (
              <div className="pw-calibration-done">
                <div className="pw-result-badge">
                  <span className="pw-result-value">{store.calibratedCm360.toFixed(1)}</span>
                  <span className="pw-result-unit">cm/360</span>
                </div>
                <p>캘리브레이션 완료! 다음 단계로 진행하세요.</p>
              </div>
            ) : (
              <div className="pw-calibration-start">
                <p>아직 캘리브레이션을 수행하지 않았습니다.</p>
                <button className="btn-primary" onClick={onStartCalibration}>
                  캘리브레이션 시작
                </button>
                <button
                  className="btn-secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => {
                    /** 캘리브레이션 건너뛰기 — 현재 감도 사용 */
                    store.setCalibrationResult(settingsStore.cmPer360);
                  }}
                >
                  건너뛰기 (현재 감도 사용)
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============ Step 5: 전체 점검 ============ */}
        {store.currentStep === 'full-assessment' && (
          <div className="pw-step">
            <h2>전체 에임 점검</h2>
            <p className="pw-description">
              8종 시나리오를 순서대로 수행합니다. 각 시나리오 완료 후 자동으로 다음으로 넘어갑니다.
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
                      <span className="pw-assessment-score">{result.score.toFixed(0)}점</span>
                    )}
                    {isCurrent && !result && (
                      <span className="pw-assessment-badge">진행 중</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 점검 컨트롤 */}
            {!store.assessmentRunning && store.assessmentResults.length === 0 && (
              <button className="btn-primary" onClick={handleStartAssessment}>
                점검 시작
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
                  시나리오 시작
                </button>
              </div>
            )}

            {/* 전체 완료 */}
            {!store.assessmentRunning && store.assessmentResults.length >= ASSESSMENT_STAGES.length && (
              <div className="pw-assessment-done">
                <p>전체 점검이 완료되었습니다! 다음 단계에서 결과를 분석합니다.</p>
              </div>
            )}
          </div>
        )}

        {/* ============ Step 6: 결과 분석 ============ */}
        {store.currentStep === 'analysis' && (
          <div className="pw-step">
            <h2>Aim DNA 분석</h2>
            <p className="pw-description">
              전체 점검 결과를 바탕으로 에임 특성을 분석합니다.
            </p>

            {!store.aimDna ? (
              <div className="pw-analysis-start">
                <button className="btn-primary" onClick={handleAnalyze}>
                  분석 시작
                </button>
              </div>
            ) : (
              <div className="pw-analysis-result">
                {/* 레이더 차트 간소화 — 5축 점수 표시 */}
                <div className="pw-radar-summary">
                  <h3>에임 특성 요약</h3>
                  {store.aimDna.type_label && (
                    <div className="pw-type-badge">{store.aimDna.type_label}</div>
                  )}
                  <div className="pw-radar-grid">
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">플릭 속도</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.min((store.aimDna.flick_peak_velocity ?? 0) / 10 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">트래킹 정확도</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.max(100 - (store.aimDna.tracking_mad ?? 5) * 20, 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">매끄러움</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${(store.aimDna.smoothness ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">오버슈트 억제</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.max(100 - (store.aimDna.overshoot_avg ?? 5) * 10, 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">속도 매칭</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${(store.aimDna.velocity_match ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 감도 제안 */}
                {store.suggestedCm360 && (
                  <div className="pw-sens-suggestion">
                    <h3>감도 제안</h3>
                    <div className="pw-result-badge">
                      <span className="pw-result-value">{store.suggestedCm360.toFixed(1)}</span>
                      <span className="pw-result-unit">cm/360</span>
                    </div>
                  </div>
                )}

                {/* 점검 점수 요약 */}
                <div className="pw-scores-summary">
                  <h3>시나리오별 점수</h3>
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
            <h2>약한 영역 재테스트</h2>
            <p className="pw-description">
              조정된 감도로 약한 영역만 재테스트하여 성능 변화를 확인합니다.
            </p>

            {store.weakStages.length === 0 ? (
              <div className="pw-retest-start">
                <p>약한 영역을 분석 중입니다...</p>
                <button className="btn-primary" onClick={handleStartRetest}>
                  약한 영역 판별 + 재테스트
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
                  건너뛰기
                </button>
              </div>
            ) : (
              <div className="pw-retest-progress">
                <p>재테스트 라운드 {store.retestRound} — {store.weakStages.length}개 영역</p>
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
                          <span className="pw-assessment-score">{result.score.toFixed(0)}점</span>
                        )}
                        {isCurrent && (
                          <button
                            className="btn-primary btn-sm"
                            onClick={() => onStartTraining(stage)}
                          >
                            시작
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {store.retestResults.length >= store.weakStages.length && (
                  <div className="pw-retest-done">
                    <p>재테스트 완료!</p>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const finalCm = store.suggestedCm360 ?? store.calibratedCm360 ?? settingsStore.cmPer360;
                        store.finalize(finalCm, computeConversions(finalCm));
                        store.goToStep('complete');
                      }}
                    >
                      결과 확인
                    </button>
                    <button
                      className="btn-secondary"
                      style={{ marginLeft: 8 }}
                      onClick={handleStartRetest}
                    >
                      한 번 더 테스트
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
            <h2>프로파일 완성!</h2>

            {/* 최종 감도 */}
            <div className="pw-final-result">
              <div className="pw-result-badge large">
                <span className="pw-result-value">{store.finalCm360?.toFixed(1) ?? '—'}</span>
                <span className="pw-result-unit">cm/360</span>
              </div>
            </div>

            {/* Aim DNA 타입 */}
            {store.aimDna?.type_label && (
              <div className="pw-type-badge large">{store.aimDna.type_label}</div>
            )}

            {/* 게임별 감도 변환 */}
            <div className="pw-conversions">
              <h3>게임별 감도 변환</h3>
              <div className="pw-conversion-table">
                <div className="pw-conversion-header">
                  <span>게임</span>
                  <span>변환 감도</span>
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
                프로파일 저장 & 완료
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
            {store.currentStepIndex === 0 ? '취소' : '이전'}
          </button>
          <button
            className="btn-primary"
            onClick={handleNext}
            disabled={!canNext()}
          >
            {store.currentStep === 'analysis' ? '재테스트로' : '다음'}
          </button>
        </div>
      )}
    </div>
  );
}
