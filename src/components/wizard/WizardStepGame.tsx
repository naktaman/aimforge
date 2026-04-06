/**
 * 위저드 Step 2: 게임 세팅
 * 메인 게임 선택 + 감도 입력 + cm/360 미리보기
 */
import { GAME_SENS_FIELDS } from '../../stores/profileWizardStore';
import { gameSensToCm360 } from '../../utils/physics';
import type { GamePreset } from '../../utils/types';

/** 게임 세팅 단계 Props */
export interface WizardStepGameProps {
  t: (key: string) => string;
  /** 게임 검색어 */
  gameSearch: string;
  setGameSearch: (v: string) => void;
  /** 카테고리 필터 */
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  /** 필터링된 게임 목록 */
  filteredGames: GamePreset[];
  /** 선택된 게임 */
  selectedGame: GamePreset | null;
  setSelectedGame: (g: GamePreset) => void;
  /** 게임별 감도 값 */
  gameSensValues: Record<string, number>;
  setGameSensValue: (key: string, value: number) => void;
  /** 마우스 DPI */
  dpi: number;
  /** 게임 카테고리 조회 헬퍼 */
  getGameCategory: (game: GamePreset) => string;
  /** 게임 이니셜 추출 헬퍼 */
  getGameInitials: (name: string) => string;
  /** 카테고리별 색상 매핑 */
  CATEGORY_COLORS: Record<string, string>;
  /** 필터 카테고리 목록 */
  FILTER_CATEGORIES: readonly string[];
  /** 카테고리 라벨 i18n 키 매핑 */
  CATEGORY_LABEL_KEYS: Record<string, string>;
}

/** 게임 세팅 단계 — 게임 선택 + 감도 입력 */
export function WizardStepGame({
  t, gameSearch, setGameSearch, categoryFilter, setCategoryFilter,
  filteredGames, selectedGame, setSelectedGame,
  gameSensValues, setGameSensValue, dpi,
  getGameCategory, getGameInitials,
  CATEGORY_COLORS, FILTER_CATEGORIES, CATEGORY_LABEL_KEYS,
}: WizardStepGameProps) {
  return (
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
          const color = cat === 'all' ? 'var(--accent)' : CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.default;
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

      {/* 게임 그리드 */}
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
  );
}
