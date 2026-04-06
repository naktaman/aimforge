/**
 * 프로파일 생성 가이드 위저드
 * 8단계 플로우: Welcome → 게임 세팅 → 하드웨어 → 캘리브레이션 → 전체 점검 → 분석 → 재테스트 → 완료
 * 상단 진행률 바, 이전/다음 네비게이션, 중간 저장 지원
 *
 * 각 단계 JSX는 src/components/wizard/ 하위 컴포넌트로 분리
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
  GAME_YAW_VALUES,
  AIMFORGE_YAW,
  type WizardStep,
  type SensConversion,
} from '../stores/profileWizardStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useCalibrationStore } from '../stores/calibrationStore';
import { UI_COLORS, GAME_CATEGORY_COLORS } from '../config/theme';
import { cm360ToSens } from '../utils/physics';
import type { GamePreset, StageType, AimDnaProfile } from '../utils/types';

/* 위저드 단계 컴포넌트 */
import { WizardStepWelcome } from './wizard/WizardStepWelcome';
import { WizardStepGame } from './wizard/WizardStepGame';
import { WizardStepHardware } from './wizard/WizardStepHardware';
import { WizardStepCalibration } from './wizard/WizardStepCalibration';
import { WizardStepAssessment } from './wizard/WizardStepAssessment';
import { WizardStepAnalysis } from './wizard/WizardStepAnalysis';
import { WizardStepRetest } from './wizard/WizardStepRetest';
import { WizardStepComplete } from './wizard/WizardStepComplete';

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
        params: { profile_id: 1, /* 단일 사용자 — user profiles.id */ session_id: null },
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
        {/* 각 단계 컴포넌트 렌더링 */}
        {currentStep === 'welcome' && (
          <WizardStepWelcome t={t} />
        )}

        {currentStep === 'game-settings' && (
          <WizardStepGame
            t={t}
            gameSearch={gameSearch}
            setGameSearch={setGameSearch}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            filteredGames={filteredGames}
            selectedGame={selectedGame}
            setSelectedGame={setSelectedGame}
            gameSensValues={gameSensValues}
            setGameSensValue={setGameSensValue}
            dpi={dpi}
            getGameCategory={getGameCategory}
            getGameInitials={getGameInitials}
            CATEGORY_COLORS={CATEGORY_COLORS}
            FILTER_CATEGORIES={FILTER_CATEGORIES}
            CATEGORY_LABEL_KEYS={CATEGORY_LABEL_KEYS}
          />
        )}

        {currentStep === 'hardware' && (
          <WizardStepHardware
            t={t}
            dpi={dpi}
            setWizardDpi={setWizardDpi}
            monitorWidth={monitorWidth}
            monitorHeight={monitorHeight}
            refreshRate={refreshRate}
            setHardware={setHardware}
          />
        )}

        {currentStep === 'calibration' && (
          <WizardStepCalibration
            t={t}
            calibratedCm360={calibratedCm360}
            cmPer360={cmPer360}
            onStartCalibration={onStartCalibration}
            setCalibrationResult={setCalibrationResult}
          />
        )}

        {currentStep === 'full-assessment' && (
          <WizardStepAssessment
            t={t}
            assessmentRunning={assessmentRunning}
            assessmentResults={assessmentResults}
            assessmentIndex={assessmentIndex}
            currentAssessmentStage={currentAssessmentStage}
            handleStartAssessment={handleStartAssessment}
            onStartTraining={onStartTraining}
          />
        )}

        {currentStep === 'analysis' && (
          <WizardStepAnalysis
            t={t}
            aimDna={aimDna}
            suggestedCm360={suggestedCm360}
            assessmentResults={assessmentResults}
            handleAnalyze={handleAnalyze}
          />
        )}

        {currentStep === 'retest' && (
          <WizardStepRetest
            t={t}
            weakStages={weakStages}
            retestRound={retestRound}
            retestResults={retestResults}
            handleStartRetest={handleStartRetest}
            onStartTraining={onStartTraining}
            suggestedCm360={suggestedCm360}
            calibratedCm360={calibratedCm360}
            cmPer360={cmPer360}
            finalize={finalize}
            computeConversions={computeConversions}
            goToStep={goToStep}
          />
        )}

        {currentStep === 'complete' && (
          <WizardStepComplete
            t={t}
            finalCm360={finalCm360}
            aimDna={aimDna}
            sensConversions={sensConversions}
            handleComplete={handleComplete}
            onClose={onClose}
          />
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
