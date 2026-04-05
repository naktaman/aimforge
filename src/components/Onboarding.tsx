/**
 * 온보딩 위자드 (첫 실행 시 표시)
 * 5단계: 환영 → DPI → 게임 선택 → 감도 → 완료
 * P0-1: 게임 이니셜 아바타 + 검색 + 카테고리 필터
 * P0-2: 단계 전환 애니메이션 + 입력 유효성 피드백
 */
import { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'motion/react';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore, type AppMode } from '../stores/uiStore';
import { useTranslation } from '../i18n';
import { gameSensToCm360 } from '../utils/physics';
import { GAME_DATABASE, type GameCategory } from '../data/gameDatabase';
import type { GamePreset } from '../utils/types';

const TOTAL_STEPS = 5;

/** 카테고리 → 아바타 배경색 매핑 */
const CATEGORY_COLORS: Record<GameCategory | 'default', string> = {
  fps: '#60a5fa',
  tactical: '#34d399',
  'battle-royale': '#fbbf24',
  tps: '#FFB81C',
  arena: '#a78bfa',
  trainer: '#22d3ee',
  default: '#a78bfa',
};

/** 카테고리 → i18n 키 매핑 */
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  all: 'gameFilter.all',
  fps: 'gameFilter.fps',
  tactical: 'gameFilter.tactical',
  'battle-royale': 'gameFilter.battleRoyale',
  tps: 'gameFilter.tps',
  arena: 'gameFilter.other',
};

/** 카테고리 목록 (필터 칩 순서) */
const FILTER_CATEGORIES = ['all', 'fps', 'tactical', 'battle-royale', 'tps', 'arena'] as const;

/** GamePreset → 카테고리 조회 (GAME_DATABASE에서 매칭) */
function getGameCategory(game: GamePreset): GameCategory | 'default' {
  const entry = GAME_DATABASE.find(g => g.id === game.id || g.name === game.name);
  return entry?.category ?? 'default';
}

/** 게임 이니셜 (첫 2글자) 추출 */
function getGameInitials(name: string): string {
  const words = name.split(/[\s:]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** 슬라이드 애니메이션 variants */
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

export function Onboarding() {
  const [step, setStep] = useState(0);
  /** 애니메이션 방향: 1 = 앞으로, -1 = 뒤로 */
  const [direction, setDirection] = useState(1);
  const [dpi, setDpi] = useState(800);
  const [games, setGames] = useState<GamePreset[]>([]);
  const [selectedGame, setSelectedGame] = useState<GamePreset | null>(null);
  /* 감도 입력 — string으로 관리해야 타이핑 도중 빈 값 허용 */
  const [sensText, setSensText] = useState('1.0');
  const sensitivity = parseFloat(sensText) || 0;
  const [mode, setMode] = useState<AppMode>('simple');

  /** P0-1: 검색 + 필터 상태 */
  const [gameSearch, setGameSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  /** P0-2B: 유효성 에러 표시 */
  const [dpiError, setDpiError] = useState('');
  const [sensError, setSensError] = useState('');
  const [gameError, setGameError] = useState('');

  const settingsStore = useSettingsStore();
  const uiStore = useUiStore();
  const { t } = useTranslation();

  /** 게임 목록 로드 */
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games')
      .then(setGames)
      .catch((e) => console.error('게임 목록 로드 실패:', e));
  }, []);

  /** 검색 + 카테고리 필터링된 게임 목록 */
  const filteredGames = useMemo(() => {
    let result = games;

    // 카테고리 필터
    if (categoryFilter !== 'all') {
      result = result.filter(g => getGameCategory(g) === categoryFilter);
    }

    // 검색 필터 (이름 + id, 한국어 포함)
    if (gameSearch.trim()) {
      const q = gameSearch.toLowerCase();
      result = result.filter(g => {
        const entry = GAME_DATABASE.find(e => e.id === g.id || e.name === g.name);
        return (
          g.name.toLowerCase().includes(q) ||
          g.id.toLowerCase().includes(q) ||
          (entry?.nameKo && entry.nameKo.includes(q))
        );
      });
    }

    return result;
  }, [games, categoryFilter, gameSearch]);

  /** cm/360 실시간 계산 */
  const cm360 = selectedGame
    ? gameSensToCm360(sensitivity, dpi, selectedGame.yaw)
    : null;

  /** 완료 처리 — 설정 저장 후 메인 화면 전환 */
  const handleComplete = () => {
    settingsStore.setDpi(dpi);
    if (selectedGame) {
      settingsStore.selectGame(selectedGame);
      settingsStore.setSensitivity(sensitivity);
    }
    uiStore.setMode(mode);
    uiStore.completeOnboarding();
  };

  /** DPI 유효성 체크 */
  const validateDpi = (val: number): boolean => {
    if (val < 100 || val > 32000) {
      setDpiError(t('onboarding.dpiError'));
      return false;
    }
    setDpiError('');
    return true;
  };

  /** 감도 유효성 체크 */
  const validateSens = (val: number): boolean => {
    if (val <= 0) {
      setSensError(t('onboarding.sensError'));
      return false;
    }
    setSensError('');
    return true;
  };

  /** 다음 단계로 이동 (유효성 체크 포함) */
  const next = () => {
    // DPI 단계 유효성
    if (step === 1 && !validateDpi(dpi)) return;
    // 게임 선택 단계에서 게임 미선택 시 차단
    if (step === 2 && !selectedGame) {
      setGameError(t('onboarding.gameError'));
      return;
    }
    // 감도 단계 유효성
    if (step === 3 && !validateSens(sensitivity)) return;

    setGameError('');
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const prev = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* 진행 도트 */}
        <div className="onboarding-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            />
          ))}
        </div>

        {/* 애니메이션 래퍼 */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {/* Step 0: 환영 */}
            {step === 0 && (
              <>
                <h2>{t('onboarding.welcome')}</h2>
                <p>{t('onboarding.welcomeDesc')}</p>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {t('onboarding.quickSetupHint')}
                </p>
                <div className="onboarding-actions">
                  <button className="btn-primary" onClick={next}>{t('onboarding.getStarted')}</button>
                </div>
              </>
            )}

            {/* Step 1: DPI */}
            {step === 1 && (
              <>
                <h2>{t('onboarding.mouseSetup')}</h2>
                <p>{t('onboarding.mouseSetupDesc')}</p>
                <div className="onboarding-field">
                  <label>DPI</label>
                  <input
                    type="number"
                    min={100}
                    max={32000}
                    value={dpi}
                    className={dpiError ? 'input-error' : ''}
                    onChange={(e) => {
                      const v = Number(e.target.value) || 800;
                      setDpi(v);
                      validateDpi(v);
                    }}
                  />
                  {dpiError && <div className="field-error">{dpiError}</div>}
                </div>
                <div className="onboarding-actions">
                  <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
                  <button className="btn-primary" onClick={next}>{t('common.next')}</button>
                </div>
              </>
            )}

            {/* Step 2: 게임 선택 (P0-1 개선) */}
            {step === 2 && (
              <>
                <h2>{t('onboarding.gameSelect')}</h2>
                <p>{t('onboarding.gameSelectDesc')}</p>

                {/* B. 검색 필드 */}
                <div className="game-search-field">
                  <input
                    type="text"
                    placeholder={t('onboarding.searchGame')}
                    value={gameSearch}
                    onChange={(e) => setGameSearch(e.target.value)}
                  />
                </div>

                {/* C. 카테고리 필터 칩 */}
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
                        {cat !== 'all' && (
                          <span className="chip-dot" style={{ background: color }} />
                        )}
                        {t(CATEGORY_LABEL_KEYS[cat])}
                      </button>
                    );
                  })}
                </div>

                {/* A. 게임 그리드 (이니셜 아바타) */}
                <div className="game-grid">
                  {filteredGames.map((g) => {
                    const cat = getGameCategory(g);
                    const color = CATEGORY_COLORS[cat];
                    return (
                      <div
                        key={g.name}
                        className={`game-card ${selectedGame?.name === g.name ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedGame(g);
                          setGameError('');
                        }}
                      >
                        <div className="game-avatar" style={{ background: color }}>
                          {getGameInitials(g.name)}
                        </div>
                        <span className="game-card-name">{g.name}</span>
                      </div>
                    );
                  })}
                </div>
                {gameError && <div className="field-error" style={{ textAlign: 'center' }}>{gameError}</div>}
                <div className="onboarding-actions">
                  <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
                  <button className="btn-primary" onClick={next} disabled={!selectedGame}>{t('common.next')}</button>
                </div>
              </>
            )}

            {/* Step 3: 감도 */}
            {step === 3 && (
              <>
                <h2>{t('onboarding.sensSetup')}</h2>
                <p>{t('onboarding.sensSetupDesc').replace('{game}', selectedGame?.name ?? '')}</p>
                <div className="onboarding-field">
                  <label>{t('onboarding.sensLabel')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0.01}
                    max={100}
                    value={sensText}
                    className={sensError ? 'input-error' : ''}
                    onChange={(e) => {
                      /* 타이핑 도중 빈 문자열/소수점 입력 허용 */
                      setSensText(e.target.value);
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v)) validateSens(v);
                    }}
                  />
                  {sensError && <div className="field-error">{sensError}</div>}
                  {cm360 !== null && (
                    <div className="cm360-preview">
                      {cm360.toFixed(1)} cm/360
                    </div>
                  )}
                </div>
                <div className="onboarding-actions">
                  <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
                  <button className="btn-primary" onClick={next}>{t('common.next')}</button>
                </div>
              </>
            )}

            {/* Step 4: 완료 + 모드 선택 */}
            {step === 4 && (
              <>
                <h2>{t('onboarding.done')}</h2>
                <dl className="onboarding-summary">
                  <dt>DPI</dt>
                  <dd>{dpi}</dd>
                  <dt>{t('settings.game')}</dt>
                  <dd>{selectedGame?.name ?? t('onboarding.notSelected')}</dd>
                  <dt>{t('settings.sensitivity')}</dt>
                  <dd>{sensitivity} {cm360 ? `(${cm360.toFixed(1)} cm/360)` : ''}</dd>
                </dl>
                <div className="onboarding-field">
                  <label>{t('onboarding.uiMode')}</label>
                  <div className="mode-pill" style={{ justifyContent: 'center', marginTop: 8 }}>
                    <button
                      className={mode === 'simple' ? 'active' : ''}
                      onClick={() => setMode('simple')}
                    >
                      Simple
                    </button>
                    <button
                      className={mode === 'advanced' ? 'active' : ''}
                      onClick={() => setMode('advanced')}
                    >
                      Advanced
                    </button>
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                    {t('onboarding.simpleDesc')}
                  </p>
                </div>
                <div className="onboarding-actions">
                  <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
                  <button className="btn-primary" onClick={handleComplete}>{t('common.start')}</button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
