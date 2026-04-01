/**
 * 하드웨어 콤보 비교 화면
 * 두 콤보 선택 → DNA 오버레이 + cm/360 이동 + 메트릭 델타
 */
import { useState, useEffect } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';

interface Props {
  onBack: () => void;
}

/** 피처 한국어 라벨 */
const FEATURE_LABELS: Record<string, string> = {
  flick_peak_velocity: '플릭 최고 속도',
  overshoot_avg: '오버슈팅',
  direction_bias: '방향 편향',
  effective_range: '유효 사거리',
  tracking_mad: '트래킹 MAD',
  phase_lag: '페이즈 래그',
  smoothness: '스무드니스',
  velocity_match: '속도 매칭',
  micro_freq: '마이크로 보정',
  wrist_arm_ratio: '손목/팔 비율',
  fitts_a: 'Fitts 절편',
  fitts_b: 'Fitts 기울기',
  fatigue_decay: '피로 감쇄',
  pre_aim_ratio: '프리에임 비율',
  pre_fire_ratio: '프리파이어 비율',
  sens_attributed_overshoot: '감도 기인 오버슈팅',
  v_h_ratio: '수직/수평 비율',
  finger_accuracy: '손가락 정확도',
  wrist_accuracy: '손목 정확도',
  arm_accuracy: '팔 정확도',
  motor_transition_angle: '운동체계 전환각',
  adaptation_rate: '적응 속도',
};

/** 상태 색상 */
function statusColor(status: string): string {
  switch (status) {
    case 'improved': return '#4ade80';
    case 'degraded': return '#e94560';
    default: return '#666';
  }
}

/** 상태 한국어 */
function statusLabel(status: string): string {
  switch (status) {
    case 'improved': return '개선';
    case 'degraded': return '악화';
    default: return '-';
  }
}

export default function HardwareCompare({ onBack }: Props) {
  const { combos, comparison, isLoading, loadCombos, compare } = useHardwareStore();
  const [profileA, setProfileA] = useState<number>(1);
  const [profileB, setProfileB] = useState<number>(2);

  useEffect(() => {
    loadCombos();
  }, [loadCombos]);

  const handleCompare = () => {
    compare(profileA, profileB);
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>하드웨어 비교</h2>
        <button onClick={onBack}>← 돌아가기</button>
      </div>

      {/* 비교 설정 */}
      <div style={{ background: '#1a1a2e', padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>비교 대상 선택</h3>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
          <label>
            프로필 A (ID):
            <input type="number" value={profileA} onChange={(e) => setProfileA(Number(e.target.value))}
              style={{ width: 80, marginLeft: 8 }} />
          </label>
          <label>
            프로필 B (ID):
            <input type="number" value={profileB} onChange={(e) => setProfileB(Number(e.target.value))}
              style={{ width: 80, marginLeft: 8 }} />
          </label>
          <button onClick={handleCompare} disabled={isLoading} style={{ padding: '8px 20px' }}>
            {isLoading ? '비교 중...' : '비교 실행'}
          </button>
        </div>

        {/* 등록된 콤보 목록 */}
        {combos.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h4 style={{ margin: '0 0 8px' }}>등록된 하드웨어 ({combos.length}개)</h4>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {combos.map((c) => (
                <div key={c.id} style={{
                  padding: '6px 12px', borderRadius: 4, background: '#16213e',
                  fontSize: 12, border: '1px solid #333',
                }}>
                  {c.mouse_model} / {c.mousepad_model ?? '미지정'} / {c.dpi} DPI
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 비교 결과 */}
      {comparison && (
        <>
          {/* cm/360 이동 요약 */}
          <div style={{ background: '#0f3460', padding: 20, borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontSize: 14, opacity: 0.8 }}>최적 cm/360 이동</div>
            <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 4 }}>
              {comparison.optimal_shift > 0 ? '+' : ''}{comparison.optimal_shift.toFixed(1)} cm
              <span style={{ fontSize: 16, opacity: 0.7, marginLeft: 8 }}>
                ({comparison.shift_pct > 0 ? '+' : ''}{comparison.shift_pct.toFixed(1)}%)
              </span>
            </div>
            <div style={{ marginTop: 8, opacity: 0.8 }}>{comparison.shift_description}</div>
          </div>

          {/* DNA 피처 델타 테이블 */}
          <div style={{ background: '#1a1a2e', padding: 20, borderRadius: 8, marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>
              DNA 피처 비교
              <span style={{ fontSize: 14, fontWeight: 'normal', marginLeft: 12, opacity: 0.7 }}>
                개선 {comparison.improved_count} / 악화 {comparison.degraded_count}
              </span>
            </h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #333' }}>
                  <th style={{ textAlign: 'left', padding: 6 }}>피처</th>
                  <th>A</th>
                  <th>B</th>
                  <th>변화율</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {comparison.dna_deltas
                  .filter((d) => d.status !== 'unchanged')
                  .sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct))
                  .map((d) => (
                    <tr key={d.feature} style={{ borderBottom: '1px solid #222' }}>
                      <td style={{ padding: 6 }}>
                        {FEATURE_LABELS[d.feature] ?? d.feature}
                      </td>
                      <td style={{ textAlign: 'center' }}>{d.value_a.toFixed(2)}</td>
                      <td style={{ textAlign: 'center' }}>{d.value_b.toFixed(2)}</td>
                      <td style={{ textAlign: 'center', color: statusColor(d.status) }}>
                        {d.delta_pct > 0 ? '+' : ''}{d.delta_pct.toFixed(1)}%
                      </td>
                      <td style={{ textAlign: 'center', color: statusColor(d.status), fontWeight: 'bold' }}>
                        {statusLabel(d.status)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* 요약 */}
          <div style={{ background: '#16213e', padding: 16, borderRadius: 8, fontSize: 14, lineHeight: 1.6 }}>
            {comparison.summary}
          </div>
        </>
      )}
    </div>
  );
}
