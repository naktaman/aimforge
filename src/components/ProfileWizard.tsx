/**
 * 프로파일 생성 가이드 위저드
 * 8단계 플로우: Welcome → 게임 세팅 → 하드웨어 → 캘리브레이션 → 전체 점검 → 분석 → 재테스트 → 완료
 * 상단 진행률 바, 이전/다음 네비게이션, 중간 저장 지원
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../i18n';
import { safeInvoke } from '../utils/ipc';
import { GAME_DATABASE, type GameCategory } from '../data/gameDatabase';
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
import { UI_COLORS, GAME_CATEGORY_COLORS } from '../config/theme'; /* 게임 카테고리 색상 토큰 추가 */
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
  /** Zustand 개별 셀렉터 — 전체 스토어 구독 방지 */
  const {
    currentStep, currentStepIndex, selectedGame, gameSensValues, dpi,
    calibratedCm360, assessmentRunning, assessmentResults, assessmentIndex,
    aimDna, suggestedCm360, weakStages, retestRound, retestResults,
    monitorWidth, monitorHeight, refreshRate, sensConversions, finalCm360,
    setCalibrationResult, nextStep, setSelectedGame, setGameSensValue,
    setDpi: setWizardDpi, setHardware, startAssessment, startRetest,
    setAnalysisResult, finalize, goToStep, prevStep,
  } = useProfileWizardStore(s => ({
    currentStep: s.currentStep, currentStepIndex: s.currentStepIndex,
    selectedGame: s.selectedGame, gameSensValues: s.gameSensValues,
    dpi: s.dpi, calibratedCm360: s.calibratedCm360,
    assessmentRunning: s.assessmentRunning, assessmentResults: s.assessmentResults,
    assessmentIndex: s.assessmentIndex, aimDna: s.aimDna,
    suggestedCm360: s.suggestedCm360, weakStages: s.weakStages,
    retestRound: s.retestRound, retestResults: s.retestResults,
    monitorWidth: s.monitorWidth, monitorHeight: s.monitorHeight,
    refreshRate: s.refreshRate, sensConversions: s.sensConversions,
    finalCm360: s.finalCm360,
    setCalibrationResult: s.setCalibrationResult, nextStep: s.nextStep,
    setSelectedGame: s.setSelectedGame, setGameSensValue: s.setGameSensValue,
    setDpi: s.setDpi, setHardware: s.setHardware,
    startAssessment: s.startAssessment, startRetest: s.startRetest,
    setAnalysisResult: s.setAnalysisResult, finalize: s.finalize,
    goToStep: s.goToStep, prevStep: s.prevStep,
  }));
  const { selectGame: settingsSelectGame, setSensitivity: settingsSetSensitivity,
    setDpi: settingsSetDpi, cmPer360 } = useSettingsStore(s => ({
    selectGame: s.selectGame, setSensitivity: s.setSensitivity,
    setDpi: s.setDpi, cmPer360: s.cmPer360,
  }));
  const calibrationResult = useCalibrationStore(s => s.result);

  const [games, setGames] = useState<GamePreset[]>([]);
  const [gameSearch, setGameSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  /** 게임 목록 로드 */
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games')
      .then(setGames)
      .catch((e) => console.error('게임 목록 로드 실패:', e));
  }, []);

  /** 카테고리 → 아바타 배경색 — GAME_CATEGORY_COLORS 토큰 사용 */
  const CATEGORY_COLORS: Record<string, string> = {
    fps: UI_COLORS.infoBlue,
    tactical: GAME_CATEGORY_COLORS.tactical,
    'battle-royale': GAME_CATEGORY_COLORS['battle-royale'],
    tps: UI_COLORS.accentGold,
    arena: GAME_CATEGORY_COLORS.arena,
    default: GAME_CATEGORY_COLORS.default,
  };
  const FILTER_CATEGORIES = ['all', 'fps', 'tactical', 'battle-royale', 'tps', 'arena'] as const;
  const CATEGORY_LABEL_KEYS: Record<string, string> = {
    all: 'gameFilter.all', fps: 'gameFilter.fps', tactical: 'gameFilter.tactical',
    'battle-royale': 'gameFilter.battleRoyale', tps: 'gameFilter.tps', arena: 'gameFilter.other',
  };

  /** GamePreset → 카테고리 조회 */
  const getGameCategory = (game: GamePreset): GameCategory | 'default' => {
    const entry = GAME_DATABASE.find(g => g.id === game.id || g.name === game.name);
    return entry?.category ?? 'default';
  };

  /** 게임 이니셜 추출 */
  const getGameInitials = (name: string): string => {
    const words = name.split(/[\s:]+/).filter(Boolean);
    return words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
  };

  /** 검색 + 카테고리 필터링 */
  const filteredGames = useMemo(() => {
    let result = games;
    if (categoryFilter !== 'all') {
      result = result.filter(g => getGameCategory(g) === categoryFilter);
    }
    if (gameSearch.trim()) {
      const q = gameSearch.toLowerCase();
      result = result.filter(g => {
        const entry = GAME_DATABASE.find(e => e.id === g.id || e.name === g.name);
        return g.name.toLowerCase().includes(q) || g.id.toLowerCase().includes(q) || (entry?.nameKo && entry.nameKo.includes(q));
      });
    }
    return result;
  }, [games, categoryFilter, gameSearch]);

  /** 캘리브레이션 완료 감지 */
  useEffect(() => {
    if (currentStep === 'calibration' && calibrationResult) {
      setCalibrationResult(calibrationResult.recommendedCm360);
    }
  }, [calibrationResult, currentStep]);

  /** 전체 진행률 (%) */
  const progressPercent = ((currentStepIndex + 1) / WIZARD_STEPS.length) * 100;

  /** 다음 버튼 활성 여부 */
  const canNext = (): boolean => {
    switch (currentStep) {
      case 'game-settings':
        return selectedGame !== null && Object.keys(gameSensValues).length > 0;
      case 'hardware':
        return dpi > 0;
      case 'calibration':
        return calibratedCm360 !== null;
      case 'full-assessment':
        return !assessmentRunning && assessmentResults.length >= ASSESSMENT_STAGES.length;
      case 'analysis':
        return aimDna !== null;
      default:
        return true;
    }
  };

  /** 다음 단계 진행 시 부가 처리 */
  const handleNext = () => {
    if (currentStep === 'game-settings' && selectedGame) {
      /** 게임 세팅 → settingsStore 동기화 */
      settingsSelectGame(selectedGame);
      const mainSens = gameSensValues['sensitivity'] ?? 1.0;
      settingsSetSensitivity(mainSens);
    }
    if (currentStep === 'hardware') {
      /** 하드웨어 → settingsStore DPI 동기화 */
      settingsSetDpi(dpi);
    }
    nextStep();
  };

  /** 감도 변환 계산 — 프로파일 완료 시 */
  const computeConversions = useCallback((aimforgeCm360: number): SensConversion[] => {
    /** aimforge 내부 감도 = cm360ToSens(cm360, dpi, AIMFORGE_YAW) */
    const aimforgeSens = cm360ToSens(aimforgeCm360, dpi, AIMFORGE_YAW);

    return Object.entries(GAME_YAW_VALUES).map(([gameName, targetYaw]) => ({
      gameName,
      yaw: targetYaw,
      convertedSens: aimforgeSens * (AIMFORGE_YAW / targetYaw),
    }));
  }, [dpi]);

  /** 전체 점검 시작 */
  const handleStartAssessment = () => {
    startAssessment();
  };

  /** 분석 수행 */
  const handleAnalyze = async () => {
    try {
      const dna = await safeInvoke<AimDnaProfile>('compute_aim_dna_cmd', {
        params: { profile_id: 1, session_id: null },
      });
      if (dna) {
        /** GP 기반 감도 제안 — 캘리브레이션 결과가 있으면 그것 사용 */
        const suggested = calibratedCm360;
        setAnalysisResult(dna, suggested);
      }
    } catch (e) {
      console.error('[ProfileWizard] DNA 분석 실패:', e);
    }
  };

  /** 약한 영역 판별 (하위 30% 점수) */
  const identifyWeakStages = (): StageType[] => {
    const results = assessmentResults;
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
      const finalCm = calibratedCm360 ?? cmPer360;
      finalize(finalCm, computeConversions(finalCm));
      goToStep('complete');
      return;
    }
    startRetest(weak);
  };

  /** 완료 처리 */
  const handleComplete = async () => {
    const finalCm = suggestedCm360 ?? calibratedCm360 ?? cmPer360;
    const conversions = computeConversions(finalCm);
    finalize(finalCm, conversions);

    /** 프로필 DB 저장 */
    if (selectedGame) {
      try {
        await invoke('create_game_profile', {
          gameName: selectedGame.name,
          dpi: dpi,
          sensitivity: gameSensValues['sensitivity'] ?? 1.0,
          fov: selectedGame.defaultFov,
          scopeMultiplier: 1.0,
        });
      } catch (e) {
        console.error('[ProfileWizard] 프로필 저장 실패:', e);
      }
    }
  };

  /** 현재 점검 시나리오 정보 */
  const currentAssessmentStage = assessmentRunning && assessmentIndex < ASSESSMENT_STAGES.length
    ? ASSESSMENT_STAGES[assessmentIndex]
    : null;

  return (
    <div className="profile-wizard">
      {/* 상단 진행률 바 */}
      <div className="pw-progress-bar">
        <div className="pw-progress-fill" style={{ width: `${progressPercent}%` }} />
        <span className="pw-progress-label">
          Step {currentStepIndex + 1}/{WIZARD_STEPS.length} — {t(STEP_LABEL_KEYS[currentStep])}
        </span>
      </div>

      {/* 단계 인디케이터 */}
      <div className="pw-step-indicators">
        {WIZARD_STEPS.map((step, i) => (
          <div
            key={step}
            className={`pw-step-dot ${i === currentStepIndex ? 'active' : ''} ${i < currentStepIndex ? 'done' : ''}`}
            title={t(STEP_LABEL_KEYS[step])}
          />
        ))}
      </div>

      <div className="pw-content">
        {/* ============ Step 1: Welcome ============ */}
        {currentStep === 'welcome' && (
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
        {currentStep === 'game-settings' && (
          <div className="pw-step">
            <h2>{t('wizard.selectMainGame')}</h2>
            <p className="pw-description">{t('wizard.selectMainGameDesc')}</p>

            {/* 게임 검색 */}
            <div className="game-search-field">
              <input
                type="text"
                placeholder={t('wizard.searchGame')}
                value={gameSearch}
                onChange={e => setGameSearch(e.target.value)}
              />
            </div>

            {/* 카테고리 필터 칩 */}
            <div className="game-filter-chips">
              {FILTER_CATEGORIES.map((cat) => {
                const isActive = categoryFilter === cat;
                const color = cat === 'all' ? 'var(--accent)' : CATEGORY_COLORS[cat as GameCategory] ?? CATEGORY_COLORS.default;
                return (
                  <button
                    key={cat}
                    className={`filter-chip ${isActive ? 'active' : ''}`}
                    style={isActive ? { background: color, borderColor: color } : undefined}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat !== 'all' && <span className="chip-dot" style={{ background: color }} />}
                    {t(CATEGORY_LABEL_KEYS[cat])}
                  </button>
                );
              })}
            </div>

            <div className="pw-game-grid">
              {filteredGames.map(g => {
                const cat = getGameCategory(g);
                const color = CATEGORY_COLORS[cat];
                return (
                  <div
                    key={g.name}
                    className={`pw-game-card ${selectedGame?.name === g.name ? 'selected' : ''}`}
                    onClick={() => setSelectedGame(g)}
                  >
                    <div className="game-avatar" style={{ background: color }}>
                      {getGameInitials(g.name)}
                    </div>
                    <span className="pw-game-name">{g.name}</span>
                    <span className="pw-game-yaw">yaw: {g.yaw}</span>
                  </div>
                );
              })}
            </div>

            {/* 게임별 전용 감도 필드 */}
            {selectedGame && (
              <div className="pw-sens-form">
                <h3>{selectedGame.name} {t('wizard.sensSettings')}</h3>
                {(GAME_SENS_FIELDS[selectedGame.name] ?? [
                  { key: 'sensitivity', label: t('settings.sensitivity'), min: 0.01, max: 100, step: 0.01, defaultValue: 1.0 },
                ]).map(field => (
                  <div key={field.key} className="pw-field">
                    <label>{field.label}</label>
                    <input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      value={gameSensValues[field.key] ?? field.defaultValue}
                      onChange={e => setGameSensValue(field.key, Number(e.target.value) || field.defaultValue)}
                    />
                  </div>
                ))}
                {/* cm/360 미리보기 */}
                {selectedGame && gameSensValues['sensitivity'] && (
                  <div className="pw-cm360-preview">
                    {gameSensToCm360(
                      gameSensValues['sensitivity'],
                      dpi,
                      selectedGame.yaw,
                    ).toFixed(1)} cm/360
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ Step 3: 하드웨어 ============ */}
        {currentStep === 'hardware' && (
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
                  value={dpi}
                  onChange={e => setWizardDpi(Number(e.target.value) || 800)}
                />
              </div>
              <div className="pw-field">
                <label>{t('wizard.monitorWidth')}</label>
                <input
                  type="number"
                  min={800}
                  max={7680}
                  value={monitorWidth}
                  onChange={e => setHardware(
                    dpi,
                    Number(e.target.value) || 1920,
                    monitorHeight,
                    refreshRate,
                  )}
                />
              </div>
              <div className="pw-field">
                <label>{t('wizard.monitorHeight')}</label>
                <input
                  type="number"
                  min={600}
                  max={4320}
                  value={monitorHeight}
                  onChange={e => setHardware(
                    dpi,
                    monitorWidth,
                    Number(e.target.value) || 1080,
                    refreshRate,
                  )}
                />
              </div>
              <div className="pw-field">
                <label>{t('wizard.refreshRate')}</label>
                <select
                  value={refreshRate}
                  onChange={e => setHardware(
                    dpi,
                    monitorWidth,
                    monitorHeight,
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
        {currentStep === 'calibration' && (
          <div className="pw-step">
            <h2>{t('wizard.sensCalibration')}</h2>
            <p className="pw-description">
              {t('wizard.sensCalDesc')}
            </p>
            {calibratedCm360 ? (
              <div className="pw-calibration-done">
                <div className="pw-result-badge">
                  <span className="pw-result-value">{calibratedCm360.toFixed(1)}</span>
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
                    setCalibrationResult(cmPer360);
                  }}
                >
                  {t('wizard.skipCal')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============ Step 5: 전체 점검 ============ */}
        {currentStep === 'full-assessment' && (
          <div className="pw-step">
            <h2>{t('wizard.fullAssessment')}</h2>
            <p className="pw-description">
              {t('wizard.fullAssessmentDesc')}
            </p>

            {/* 시나리오 목록 */}
            <div className="pw-assessment-list">
              {ASSESSMENT_STAGES.map((stage, i) => {
                const info = STAGE_DESCRIPTIONS[stage];
                const result = assessmentResults.find(r => r.stageType === stage);
                const isCurrent = assessmentRunning && i === assessmentIndex;
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
            {!assessmentRunning && assessmentResults.length === 0 && (
              <button className="btn-primary" onClick={handleStartAssessment}>
                {t('wizard.startAssessment')}
              </button>
            )}

            {/* 현재 시나리오 시작 프롬프트 */}
            {assessmentRunning && currentAssessmentStage && (
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
            {!assessmentRunning && assessmentResults.length >= ASSESSMENT_STAGES.length && (
              <div className="pw-assessment-done">
                <p>{t('wizard.assessmentDone')}</p>
              </div>
            )}
          </div>
        )}

        {/* ============ Step 6: 결과 분석 ============ */}
        {currentStep === 'analysis' && (
          <div className="pw-step">
            <h2>{t('wizard.dnaAnalysis')}</h2>
            <p className="pw-description">
              {t('wizard.dnaAnalysisDesc')}
            </p>

            {!aimDna ? (
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
                  {aimDna.typeLabel && (
                    <div className="pw-type-badge">{aimDna.typeLabel}</div>
                  )}
                  <div className="pw-radar-grid">
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.flickSpeed')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.min((aimDna.flickPeakVelocity ?? 0) / 10 * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.trackingAccuracy')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.max(100 - (aimDna.trackingMad ?? 5) * 20, 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.smoothnessLabel')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${(aimDna.smoothness ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.overshootSuppression')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${Math.max(100 - (aimDna.overshootAvg ?? 5) * 10, 0)}%` }}
                        />
                      </div>
                    </div>
                    <div className="pw-radar-axis">
                      <span className="pw-radar-label">{t('wizard.velocityMatching')}</span>
                      <div className="pw-radar-bar">
                        <div
                          className="pw-radar-fill"
                          style={{ width: `${(aimDna.velocityMatch ?? 0) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 감도 제안 */}
                {suggestedCm360 && (
                  <div className="pw-sens-suggestion">
                    <h3>{t('wizard.sensSuggestion')}</h3>
                    <div className="pw-result-badge">
                      <span className="pw-result-value">{suggestedCm360.toFixed(1)}</span>
                      <span className="pw-result-unit">cm/360</span>
                    </div>
                  </div>
                )}

                {/* 점검 점수 요약 */}
                <div className="pw-scores-summary">
                  <h3>{t('wizard.scenarioScores')}</h3>
                  <div className="pw-scores-grid">
                    {assessmentResults.map(r => (
                      <div key={r.stageType} className="pw-score-item">
                        <span className="pw-score-name">
                          {STAGE_DESCRIPTIONS[r.stageType]?.name ?? r.stageType}
                        </span>
                        <span className={`pw-score-value ${r.score < (Math.max(...assessmentResults.map(x => x.score)) * 0.7) ? 'weak' : ''}`}>
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
        {currentStep === 'retest' && (
          <div className="pw-step">
            <h2>{t('wizard.weakRetest')}</h2>
            <p className="pw-description">
              {t('wizard.weakRetestDesc')}
            </p>

            {weakStages.length === 0 ? (
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
                    const finalCm = suggestedCm360 ?? calibratedCm360 ?? cmPer360;
                    finalize(finalCm, computeConversions(finalCm));
                    goToStep('complete');
                  }}
                >
                  {t('common.skip')}
                </button>
              </div>
            ) : (
              <div className="pw-retest-progress">
                <p>{t('style.retestRound')} {retestRound} — {weakStages.length} {t('style.areas')}</p>
                <div className="pw-assessment-list">
                  {weakStages.map((stage, i) => {
                    const result = retestResults.find(r => r.stageType === stage);
                    const isCurrent = !result && retestResults.length === i;
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

                {retestResults.length >= weakStages.length && (
                  <div className="pw-retest-done">
                    <p>{t('wizard.retestDone')}</p>
                    <button
                      className="btn-primary"
                      onClick={() => {
                        const finalCm = suggestedCm360 ?? calibratedCm360 ?? cmPer360;
                        finalize(finalCm, computeConversions(finalCm));
                        goToStep('complete');
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
        {currentStep === 'complete' && (
          <div className="pw-step">
            <h2>{t('wizard.profileComplete')}</h2>

            {/* 최종 감도 */}
            <div className="pw-final-result">
              <div className="pw-result-badge large">
                <span className="pw-result-value">{finalCm360?.toFixed(1) ?? '—'}</span>
                <span className="pw-result-unit">cm/360</span>
              </div>
            </div>

            {/* Aim DNA 타입 */}
            {aimDna?.typeLabel && (
              <div className="pw-type-badge large">{aimDna.typeLabel}</div>
            )}

            {/* 게임별 감도 변환 */}
            <div className="pw-conversions">
              <h3>{t('wizard.gameConversions')}</h3>
              <div className="pw-conversion-table">
                <div className="pw-conversion-header">
                  <span>{t('wizard.game')}</span>
                  <span>{t('wizard.convertedSens')}</span>
                </div>
                {sensConversions.map(c => (
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
      {currentStep !== 'complete' && (
        <div className="pw-nav">
          <button
            className="btn-secondary"
            onClick={() => {
              if (currentStepIndex === 0) {
                onClose();
              } else {
                prevStep();
              }
            }}
          >
            {currentStepIndex === 0 ? t('common.cancel') : t('common.prev')}
          </button>
          <button
            className="btn-primary"
            onClick={handleNext}
            disabled={!canNext()}
          >
            {currentStep === 'analysis' ? t('wizard.toRetest') : t('common.next')}
          </button>
        </div>
      )}
    </div>
  );
}
