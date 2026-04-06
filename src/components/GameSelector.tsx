/**
 * 게임 선택 컴포넌트 — 게임 DB에서 검색/필터 후 선택
 * Onboarding.tsx의 게임 그리드 패턴 재활용
 */
import { useState, useMemo, useCallback } from 'react';
import { GAME_DATABASE, type GameEntry, type GameCategory } from '../data/gameDatabase';

/** 카테고리 → 아바타 배경색 매핑 (CSS 변수 사용) */
const CATEGORY_COLORS: Record<GameCategory | 'default', string> = {
  fps: 'var(--color-cat-fps)',
  tactical: 'var(--color-cat-tactical)',
  'battle-royale': 'var(--color-cat-br)',
  tps: 'var(--color-cat-tps)',
  arena: 'var(--color-cat-arena)',
  trainer: 'var(--color-cat-trainer)',
  default: 'var(--color-cat-arena)',
};

/** 카테고리 라벨 (한국어) */
const CATEGORY_LABELS: Record<string, string> = {
  all: '전체',
  fps: 'FPS',
  tactical: '택티컬',
  'battle-royale': '배틀로얄',
  tps: 'TPS',
  arena: '아레나',
  trainer: '트레이너',
};

/** 필터 카테고리 순서 */
const FILTER_CATEGORIES = ['all', 'fps', 'tactical', 'battle-royale', 'tps', 'arena', 'trainer'] as const;

/** 게임 이니셜 (첫 2글자) 추출 */
export function getGameInitials(name: string): string {
  const words = name.split(/[\s:]+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** 게임 카테고리 색상 조회 */
export function getCategoryColor(category: GameCategory): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

interface GameSelectorProps {
  onSelect: (game: GameEntry) => void;
  selectedGameId: string | null;
}

export function GameSelector({ onSelect, selectedGameId }: GameSelectorProps): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  /** 검색 + 카테고리 필터링 */
  const filteredGames = useMemo((): GameEntry[] => {
    let result = GAME_DATABASE;

    // 카테고리 필터
    if (categoryFilter !== 'all') {
      result = result.filter(g => g.category === categoryFilter);
    }

    // 검색 필터 (영문 이름 + 한국어 이름 + id)
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.name.toLowerCase().includes(q) ||
        g.id.toLowerCase().includes(q) ||
        g.nameKo.includes(q)
      );
    }

    return result;
  }, [categoryFilter, search]);

  /** 게임 카드 클릭 */
  const handleSelect = useCallback((game: GameEntry): void => {
    onSelect(game);
  }, [onSelect]);

  return (
    <div className="game-selector">
      {/* 검색 필드 */}
      <div className="game-search-field">
        <input
          type="text"
          placeholder="게임 검색 (영문/한국어)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* 카테고리 필터 칩 */}
      <div className="game-filter-chips">
        {FILTER_CATEGORIES.map((cat) => {
          const isActive = categoryFilter === cat;
          const color = cat === 'all'
            ? 'var(--accent)'
            : CATEGORY_COLORS[cat as GameCategory] ?? CATEGORY_COLORS.default;
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
              {CATEGORY_LABELS[cat] ?? cat}
            </button>
          );
        })}
      </div>

      {/* 게임 그리드 */}
      <div className="game-grid">
        {filteredGames.map((g) => {
          const color = getCategoryColor(g.category);
          return (
            <div
              key={g.id}
              className={`game-card ${selectedGameId === g.id ? 'selected' : ''}`}
              onClick={() => handleSelect(g)}
            >
              <div className="game-avatar" style={{ background: color }}>
                {getGameInitials(g.name)}
              </div>
              <span className="game-card-name">{g.name}</span>
            </div>
          );
        })}
        {filteredGames.length === 0 && (
          <p className="text-secondary" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
            검색 결과가 없습니다
          </p>
        )}
      </div>
    </div>
  );
}
