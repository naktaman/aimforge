/**
 * 세션 히스토리 화면
 * 과거 세션 목록 + 트라이얼 상세 인라인 확장
 */
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../i18n';
import { EmptyState } from './EmptyState';
import type { SessionSummary, SessionDetail } from '../utils/types';

interface Props {
  onBack: () => void;
}

export function SessionHistory({ onBack }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { t, locale } = useTranslation();

  // 세션 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const list = await invoke<SessionSummary[]>('get_sessions_history', {
          params: { profile_id: 1, /* 단일 사용자 — user profiles.id */ limit: 50 },
        });
        setSessions(list);
      } catch (e) {
        console.error('세션 히스토리 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** 세션 상세 토글 */
  const toggleDetail = useCallback(async (sessionId: number) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    try {
      const d = await invoke<SessionDetail>('get_session_detail', {
        params: { session_id: sessionId },
      });
      setDetail(d);
      setExpandedId(sessionId);
    } catch (e) {
      console.error('세션 상세 로드 실패:', e);
    }
  }, [expandedId]);

  /** 날짜 포맷 */
  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso + 'Z');
      return d.toLocaleDateString(locale === 'ko' ? 'ko-KR' : 'en-US', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <main className="app-main">
      <div className="session-history">
        <h2>{t('tool.history')}</h2>

        {loading ? (
          <p>{t('common.loading')}</p>
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <rect x="8" y="6" width="32" height="36" rx="3" />
                <line x1="16" y1="16" x2="32" y2="16" />
                <line x1="16" y1="24" x2="28" y2="24" />
                <line x1="16" y1="32" x2="24" y2="32" />
              </svg>
            }
            title={t('empty.historyTitle')}
            description={t('empty.historyDesc')}
            action={
              <button className="btn-primary" onClick={onBack}>
                {t('empty.historyAction')}
              </button>
            }
          />
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>{t('history.date')}</th>
                <th>{t('history.type')}</th>
                <th>{t('history.mode')}</th>
                <th>{t('history.trials')}</th>
                <th>FPS</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <>
                  <tr
                    key={s.id}
                    className={`session-row ${expandedId === s.id ? 'expanded' : ''}`}
                    onClick={() => toggleDetail(s.id)}
                  >
                    <td>{formatDate(s.startedAt)}</td>
                    <td>{s.sessionType}</td>
                    <td>{s.mode}</td>
                    <td>{s.totalTrials}</td>
                    <td>{s.avgFps?.toFixed(0) ?? '—'}</td>
                  </tr>
                  {/* 인라인 상세 */}
                  {expandedId === s.id && detail && (
                    <tr key={`${s.id}-detail`} className="detail-row">
                      <td colSpan={5}>
                        <div className="trial-list">
                          {detail.trials.length === 0 ? (
                            <p>{t('history.noTrials')}</p>
                          ) : (
                            detail.trials.map((t) => (
                              <div key={t.id} className="trial-item">
                                <span>{t.scenarioType}</span>
                                <span>{t.cm360Tested.toFixed(1)} cm/360</span>
                                <span className="trial-score">{t.compositeScore.toFixed(1)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}

        <div className="result-actions">
          <button className="btn-secondary" onClick={onBack}>{t('common.back')}</button>
        </div>
      </div>
    </main>
  );
}
