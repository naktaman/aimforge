/**
 * 하드웨어 콤보 비교 화면
 * 두 콤보 선택 → DNA 오버레이 + cm/360 이동 + 메트릭 델타
 */
import { useState, useEffect } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { BackButton } from './BackButton';

interface Props {
  onBack: () => void;
}

/** 피처 한국어 라벨 맵 */
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
};

/** 상태에 따른 뱃지 클래스 반환 */
function statusBadgeClass(status: string): string {
  switch (status) {
    case 'improved': return 'badge badge--success';
    case 'degraded': return 'badge badge--danger';
    default: return 'badge';
  }
}

/** 상태에 따른 텍스트 CSS 클래스 반환 */
function statusTextClass(status: string): string {
  switch (status) {
    case 'improved': return 'text-success';
    case 'degraded': return 'text-danger';
    default: return 'text-muted';
  }
}

/** 상태 한국어 라벨 */
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

  /* 마운트 시 콤보 목록 로드 */
  useEffect(() => {
    loadCombos();
  }, [loadCombos]);

  /** 비교 실행 핸들러 */
  const handleCompare = () => {
    compare(profileA, profileB);
  };

  return (
    <div className="page">
      {/* 헤더: 제목 + 뒤로가기 */}
      <div className="page-header">
        <BackButton onBack={onBack} />
        <h2>하드웨어 비교</h2>
      </div>

      {/* 비교 대상 선택 섹션 */}
      <div className="page-section">
        <div className="glass-card">
          <h3 className="page-section__title">비교 대상 선택</h3>
          <div className="hw-compare__controls">
            {/* 프로필 A 입력 */}
            <div className="form-group">
              <label className="form-label">프로필 A (ID)</label>
              <input
                className="input-field hw-compare__id-input"
                type="number"
                value={profileA}
                onChange={(e) => setProfileA(Number(e.target.value))}
              />
            </div>
            {/* 프로필 B 입력 */}
            <div className="form-group">
              <label className="form-label">프로필 B (ID)</label>
              <input
                className="input-field hw-compare__id-input"
                type="number"
                value={profileB}
                onChange={(e) => setProfileB(Number(e.target.value))}
              />
            </div>
            {/* 비교 실행 버튼 */}
            <button
              className="btn btn--primary"
              onClick={handleCompare}
              disabled={isLoading}
            >
              {isLoading ? '비교 중...' : '비교 실행'}
            </button>
          </div>

          {/* 등록된 콤보 목록 */}
          {combos.length > 0 && (
            <div className="hw-compare__combo-list">
              <h4 className="text-sm font-semibold">
                등록된 하드웨어 ({combos.length}개)
              </h4>
              <div className="hw-compare__combo-chips">
                {combos.map((c) => (
                  <span key={c.id} className="glass-card--compact hw-compare__chip">
                    {c.mouseModel} / {c.mousepadModel ?? '미지정'} / {c.dpi} DPI
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 비교 결과 영역 */}
      {comparison && (
        <>
          {/* cm/360 이동 요약 카드 */}
          <div className="page-section">
            <div className="glass-card glass-card--glow hw-compare__shift-card">
              <div className="stat-label">최적 cm/360 이동</div>
              <div className="stat-value stat-value--big">
                {comparison.optimalShift > 0 ? '+' : ''}{comparison.optimalShift.toFixed(1)} cm
                <span className="stat-unit">
                  ({comparison.shiftPct > 0 ? '+' : ''}{comparison.shiftPct.toFixed(1)}%)
                </span>
              </div>
              <p className="text-sm text-muted">{comparison.shiftDescription}</p>
            </div>
          </div>

          {/* DNA 피처 델타 테이블 */}
          <div className="page-section">
            <div className="glass-card">
              <h3 className="page-section__title">
                DNA 피처 비교
                {' '}
                <span className="text-sm text-muted">
                  개선 {comparison.improvedCount} / 악화 {comparison.degradedCount}
                </span>
              </h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>피처</th>
                    <th>A</th>
                    <th>B</th>
                    <th>변화율</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.dnaDeltas
                    .filter((d) => d.status !== 'unchanged')
                    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
                    .map((d) => (
                      <tr key={d.feature}>
                        <td>{FEATURE_LABELS[d.feature] ?? d.feature}</td>
                        <td className="text-mono">{d.valueA.toFixed(2)}</td>
                        <td className="text-mono">{d.valueB.toFixed(2)}</td>
                        <td className={statusTextClass(d.status)}>
                          {d.deltaPct > 0 ? '+' : ''}{d.deltaPct.toFixed(1)}%
                        </td>
                        <td>
                          <span className={statusBadgeClass(d.status)}>
                            {statusLabel(d.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 요약 텍스트 */}
          <div className="page-section">
            <div className="glass-card--compact">
              <p className="text-sm">{comparison.summary}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
