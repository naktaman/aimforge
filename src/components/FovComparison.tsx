/**
 * FOV 비교 화면
 * FOV별 테스트 결과 테이블 + peripheral/center 점수 비교 + 추천
 */
import { useState, useEffect } from 'react';
import { useFovStore } from '../stores/fovStore';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** FOV별 색상 */
const FOV_COLORS: Record<number, string> = {
  90: '#4ade80',
  100: '#38bdf8',
  110: '#f5a623',
  120: '#e94560',
};

export default function FovComparison({ onBack, profileId }: Props) {
  const { results, recommendation, isLoading, loadResults, compare } = useFovStore();
  const [hasCompared, setHasCompared] = useState(false);

  useEffect(() => {
    loadResults(profileId);
  }, [profileId, loadResults]);

  const handleCompare = async () => {
    await compare(profileId);
    setHasCompared(true);
  };

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>FOV 비교 분석</h2>
        <button onClick={onBack}>← 돌아가기</button>
      </div>

      {/* 테스트 결과 테이블 */}
      <div style={{ background: '#1a1a2e', padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>테스트 결과 ({results.length}건)</h3>
        {results.length === 0 ? (
          <p style={{ opacity: 0.6 }}>FOV 테스트 결과가 없습니다. 동일 감도로 FOV 90/100/110/120을 각각 테스트하세요.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #333' }}>
                <th style={{ textAlign: 'left', padding: 6 }}>FOV</th>
                <th>시나리오</th>
                <th>Peripheral</th>
                <th>Center</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #222' }}>
                  <td style={{ padding: 6, color: FOV_COLORS[r.fov_tested] ?? '#fff' }}>
                    {r.fov_tested}°
                  </td>
                  <td style={{ textAlign: 'center' }}>{r.scenario_type}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.peripheral_score != null ? r.peripheral_score.toFixed(1) : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {r.center_score != null ? r.center_score.toFixed(1) : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>{r.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {results.length > 0 && (
          <button
            onClick={handleCompare}
            disabled={isLoading}
            style={{ marginTop: 12, padding: '8px 20px' }}
          >
            {isLoading ? '분석 중...' : 'FOV 비교 분석'}
          </button>
        )}
      </div>

      {/* 비교 결과 */}
      {hasCompared && recommendation && (
        <div style={{ background: '#16213e', padding: 20, borderRadius: 8, marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>추천 결과</h3>

          {/* 추천 FOV */}
          <div style={{ background: '#0f3460', padding: 16, borderRadius: 6, marginBottom: 16 }}>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#e94560' }}>
              추천 FOV: {recommendation.recommended_fov}°
            </div>
            <div style={{ marginTop: 8, opacity: 0.9, lineHeight: 1.6 }}>
              {recommendation.reason}
            </div>
          </div>

          {/* FOV별 비교 바 */}
          <h4>FOV별 비교</h4>
          {recommendation.comparisons.map((comp) => {
            const isRecommended = Math.abs(comp.fov - recommendation.recommended_fov) < 0.1;
            const color = FOV_COLORS[comp.fov] ?? '#888';
            return (
              <div key={comp.fov} style={{
                display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8,
                padding: '8px 12px', borderRadius: 6,
                background: isRecommended ? '#0f3460' : 'transparent',
                border: isRecommended ? '1px solid #e94560' : '1px solid #333',
              }}>
                <span style={{ width: 50, color, fontWeight: 'bold' }}>{comp.fov}°</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span>Peripheral: {comp.avg_peripheral.toFixed(1)}
                      {comp.peripheral_delta_pct !== 0 && (
                        <span style={{ color: comp.peripheral_delta_pct > 0 ? '#4ade80' : '#e94560' }}>
                          {' '}({comp.peripheral_delta_pct > 0 ? '+' : ''}{comp.peripheral_delta_pct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                    <span>Center: {comp.avg_center.toFixed(1)}
                      {comp.center_delta_pct !== 0 && (
                        <span style={{ color: comp.center_delta_pct > -5 ? '#4ade80' : '#e94560' }}>
                          {' '}({comp.center_delta_pct > 0 ? '+' : ''}{comp.center_delta_pct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  {/* Composite 바 */}
                  <div style={{ background: '#333', height: 6, borderRadius: 3, marginTop: 4 }}>
                    <div style={{
                      width: `${Math.min(100, comp.composite)}%`,
                      height: '100%', borderRadius: 3, background: color,
                    }} />
                  </div>
                </div>
                <span style={{ width: 60, textAlign: 'right', fontWeight: 'bold' }}>
                  {comp.composite.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {hasCompared && !recommendation && (
        <div style={{ background: '#1a1a2e', padding: 20, borderRadius: 8, textAlign: 'center', opacity: 0.6 }}>
          분석할 FOV 데이터가 부족합니다.
        </div>
      )}
    </div>
  );
}
