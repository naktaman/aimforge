/**
 * 리더보드 — 스테이지별 순위 표시
 * 서버 연결 시 /v1/leaderboard/{stage_type} API 호출
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from '../i18n';

/** 리더보드 항목 */
interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  createdAt: string;
}

/** 리더보드 표시 가능 스테이지 */
const STAGE_TYPES = [
  { value: 'flick', label: 'Flick' },
  { value: 'tracking', label: 'Tracking' },
  { value: 'circular_tracking', label: 'Circular Tracking' },
  { value: 'micro_flick', label: 'Micro Flick' },
  { value: 'counter_strafe_flick', label: 'Counter-Strafe' },
];

interface LeaderboardProps {
  onBack: () => void;
}

export function Leaderboard({ onBack }: LeaderboardProps) {
  const { isOnline } = useAuthStore();
  const { t } = useTranslation();
  const [stageType, setStageType] = useState('flick');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  /** 리더보드 데이터 로드 */
  const loadLeaderboard = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const result = await apiClient.get<{ entries: LeaderboardEntry[] }>(`/leaderboard/${stageType}`);
      if (result) {
        setEntries(result.entries);
      }
    } catch (e) {
      console.warn('[Leaderboard] 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [stageType, isOnline]);

  useEffect(() => { loadLeaderboard(); }, [loadLeaderboard]);

  return (
    <div className="leaderboard">
      <div className="section-header">
        <h2>{t('leaderboard.title')}</h2>
        <button className="btn-secondary" onClick={onBack}>{t('common.back')}</button>
      </div>

      {!isOnline && (
        <p className="text-secondary">{t('leaderboard.offlineMsg')}</p>
      )}

      {/* 스테이지 선택 */}
      <div className="leaderboard-filter">
        {STAGE_TYPES.map(s => (
          <button
            key={s.value}
            className={`btn-sm ${stageType === s.value ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setStageType(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-secondary">{t('common.loading')}</p>}

      {/* 순위 테이블 */}
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>{t('leaderboard.player')}</th>
            <th>{t('leaderboard.score')}</th>
            <th>{t('leaderboard.date')}</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, idx) => (
            <tr key={idx}>
              <td className={`rank rank-${entry.rank <= 3 ? entry.rank : 'default'}`}>{entry.rank}</td>
              <td>{entry.displayName}</td>
              <td>{entry.score.toFixed(1)}</td>
              <td>{new Date(entry.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {entries.length === 0 && !loading && isOnline && (
            <tr><td colSpan={4} className="text-secondary">{t('leaderboard.empty')}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
