/**
 * 세션 히스토리 화면
 * 과거 세션 목록 + 트라이얼 상세 인라인 확장
 */
import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { SessionSummary, SessionDetail } from '../utils/types';

interface Props {
  onBack: () => void;
}

export function SessionHistory({ onBack }: Props) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // 세션 목록 로드
  useEffect(() => {
    (async () => {
      try {
        const list = await invoke<SessionSummary[]>('get_sessions_history', {
          params: { profile_id: 1, limit: 50 },
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
      return d.toLocaleDateString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <main className="app-main">
      <div className="session-history">
        <h2>세션 히스토리</h2>

        {loading ? (
          <p>로딩 중...</p>
        ) : sessions.length === 0 ? (
          <p>세션 기록이 없습니다.</p>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>날짜</th>
                <th>타입</th>
                <th>모드</th>
                <th>트라이얼</th>
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
                    <td>{formatDate(s.started_at)}</td>
                    <td>{s.session_type}</td>
                    <td>{s.mode}</td>
                    <td>{s.total_trials}</td>
                    <td>{s.avg_fps?.toFixed(0) ?? '—'}</td>
                  </tr>
                  {/* 인라인 상세 */}
                  {expandedId === s.id && detail && (
                    <tr key={`${s.id}-detail`} className="detail-row">
                      <td colSpan={5}>
                        <div className="trial-list">
                          {detail.trials.length === 0 ? (
                            <p>트라이얼 없음</p>
                          ) : (
                            detail.trials.map((t) => (
                              <div key={t.id} className="trial-item">
                                <span>{t.scenario_type}</span>
                                <span>{t.cm360_tested.toFixed(1)} cm/360</span>
                                <span className="trial-score">{t.composite_score.toFixed(1)}</span>
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
          <button className="btn-secondary" onClick={onBack}>돌아가기</button>
        </div>
      </div>
    </main>
  );
}
