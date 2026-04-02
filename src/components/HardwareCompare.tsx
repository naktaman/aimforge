/**
 * 하드웨어 콤보 비교 화면
 * 두 콤보 선택 → DNA 오버레이 + cm/360 이동 + 메트릭 델타
 */
import { useState, useEffect } from 'react';
import { useHardwareStore } from '../stores/hardwareStore';
import { BackButton } from './BackButton';
import { useTranslation } from '../i18n';

interface Props {
  onBack: () => void;
}

/** 피처 i18n 키 맵 */
const FEATURE_KEYS: Record<string, string> = {
  flick_peak_velocity: 'hardware.feature.flick_peak_velocity',
  overshoot_avg: 'hardware.feature.overshoot_avg',
  direction_bias: 'hardware.feature.direction_bias',
  effective_range: 'hardware.feature.effective_range',
  tracking_mad: 'hardware.feature.tracking_mad',
  phase_lag: 'hardware.feature.phase_lag',
  smoothness: 'hardware.feature.smoothness',
  velocity_match: 'hardware.feature.velocity_match',
  micro_freq: 'hardware.feature.micro_freq',
  wrist_arm_ratio: 'hardware.feature.wrist_arm_ratio',
  fitts_a: 'hardware.feature.fitts_a',
  fitts_b: 'hardware.feature.fitts_b',
  fatigue_decay: 'hardware.feature.fatigue_decay',
  pre_aim_ratio: 'hardware.feature.pre_aim_ratio',
  pre_fire_ratio: 'hardware.feature.pre_fire_ratio',
  sens_attributed_overshoot: 'hardware.feature.sens_attributed_overshoot',
  v_h_ratio: 'hardware.feature.v_h_ratio',
  finger_accuracy: 'hardware.feature.finger_accuracy',
  wrist_accuracy: 'hardware.feature.wrist_accuracy',
  arm_accuracy: 'hardware.feature.arm_accuracy',
  motor_transition_angle: 'hardware.feature.motor_transition_angle',
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

/** 상태 라벨 — i18n 키 기반 */
function statusLabelKey(status: string): string {
  switch (status) {
    case 'improved': return 'hardware.improved';
    case 'degraded': return 'hardware.degraded';
    default: return '';
  }
}

export default function HardwareCompare({ onBack }: Props) {
  const { t } = useTranslation();
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
        <h2>{t('hardware.title')}</h2>
      </div>

      {/* 비교 대상 선택 섹션 */}
      <div className="page-section">
        <div className="glass-card">
          <h3 className="page-section__title">{t('hardware.selectComparison')}</h3>
          <div className="hw-compare__controls">
            {/* 프로필 A 입력 */}
            <div className="form-group">
              <label className="form-label">{t('hardware.profileA')}</label>
              <input
                className="input-field hw-compare__id-input"
                type="number"
                value={profileA}
                onChange={(e) => setProfileA(Number(e.target.value))}
              />
            </div>
            {/* 프로필 B 입력 */}
            <div className="form-group">
              <label className="form-label">{t('hardware.profileB')}</label>
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
              {isLoading ? t('hardware.comparing') : t('hardware.runCompare')}
            </button>
          </div>

          {/* 등록된 콤보 목록 */}
          {combos.length > 0 && (
            <div className="hw-compare__combo-list">
              <h4 className="text-sm font-semibold">
                {t('hardware.registeredHardware')} ({combos.length})
              </h4>
              <div className="hw-compare__combo-chips">
                {combos.map((c) => (
                  <span key={c.id} className="glass-card--compact hw-compare__chip">
                    {c.mouseModel} / {c.mousepadModel ?? t('hardware.unassigned')} / {c.dpi} DPI
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
              <div className="stat-label">{t('hardware.optimalShift')}</div>
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
                {t('hardware.dnaFeatureCompare')}
                {' '}
                <span className="text-sm text-muted">
                  {t('hardware.improved')} {comparison.improvedCount} / {t('hardware.degraded')} {comparison.degradedCount}
                </span>
              </h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('hardware.feature')}</th>
                    <th>A</th>
                    <th>B</th>
                    <th>{t('hardware.changePct')}</th>
                    <th>{t('hardware.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.dnaDeltas
                    .filter((d) => d.status !== 'unchanged')
                    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
                    .map((d) => (
                      <tr key={d.feature}>
                        <td>{FEATURE_KEYS[d.feature] ? t(FEATURE_KEYS[d.feature]) : d.feature}</td>
                        <td className="text-mono">{d.valueA.toFixed(2)}</td>
                        <td className="text-mono">{d.valueB.toFixed(2)}</td>
                        <td className={statusTextClass(d.status)}>
                          {d.deltaPct > 0 ? '+' : ''}{d.deltaPct.toFixed(1)}%
                        </td>
                        <td>
                          <span className={statusBadgeClass(d.status)}>
                            {statusLabelKey(d.status) ? t(statusLabelKey(d.status)) : '-'}
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
