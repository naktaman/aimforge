/**
 * Aim DNA 결과 화면
 * D3.js 레이더 차트 (5축) + 상세 분류표 + type_label 배지
 * + 데이터 충족도 표시 + 추세 배너 + 크로스게임 비교 진입
 * + 기어 선택기 + 그립/자세 가이드 + 인사이트 엔진
 */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslation } from '../i18n';
import { useAimDnaStore } from '../stores/aimDnaStore';
import { useEngineStore } from '../stores/engineStore';
import { computeRadarAxes } from '../utils/radarUtils';
import { useTabKeyboard } from '../utils/useTabKeyboard';
import type { AimDnaProfile, RadarAxis, FeatureSufficiency } from '../utils/types';
import { AimDnaSensitivitySelector } from './AimDnaSensitivitySelector';
import { AimDnaGripGuide } from './AimDnaGripGuide';
import { AimDnaPostureGuide } from './AimDnaPostureGuide';
import { AimDnaInsights } from './AimDnaInsights';
import { AimDnaHistory } from './AimDnaHistory';
import { UI_COLORS } from '../config/theme';
import { EmptyState } from './EmptyState';
import type { GearSelection } from './AimDnaSensitivitySelector';

/** 탭 목록 */
type DnaTab = 'overview' | 'gear' | 'grip' | 'posture' | 'insights' | 'history';

interface Props {
  onBack: () => void;
}

/** type_label i18n 키 매핑 */
const TYPE_DESC_KEYS: Record<string, string> = {
  'wrist-flicker': 'dna.typeDesc.wrist-flicker',
  'arm-tracker': 'dna.typeDesc.arm-tracker',
  'precision': 'dna.typeDesc.precision',
  'reactive': 'dna.typeDesc.reactive',
  'hybrid': 'dna.typeDesc.hybrid',
};

/** 추세 방향 i18n 키 매핑 */
const DIRECTION_KEYS: Record<string, string> = {
  improved: 'dna.improved',
  degraded: 'dna.degraded',
  stable: 'dna.stable',
};

/** D3 레이더 차트 */
function RadarChart({ axes }: { axes: RadarAxis[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || axes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 360;
    const height = 360;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = 140;
    const levels = 5;
    const n = axes.length;
    const angleSlice = (2 * Math.PI) / n;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    // 동심원 그리드
    for (let level = 1; level <= levels; level++) {
      const r = (maxR / levels) * level;
      g.append('circle')
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', UI_COLORS.chartDomain)
        .attr('stroke-width', 0.5);
    }

    // 축 라인
    axes.forEach((_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', maxR * Math.cos(angle))
        .attr('y2', maxR * Math.sin(angle))
        .attr('stroke', UI_COLORS.chartAxisLine)
        .attr('stroke-width', 0.5);
    });

    // 데이터 폴리곤 — 중심→실제값 600ms 애니메이션
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, maxR]);
    const points = axes.map((axis, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = rScale(axis.value);
      return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number];
    });
    // 시작 상태: 중심(0,0)
    const zeroPoints = axes.map(() => [0, 0] as [number, number]);

    const polygon = g.append('polygon')
      .attr('points', zeroPoints.map(p => p.join(',')).join(' '))
      .attr('fill', UI_COLORS.accentGold)
      .attr('fill-opacity', 0.25)
      .attr('stroke', UI_COLORS.accentGold)
      .attr('stroke-width', 2);

    // 중심→실제값 트랜지션 (600ms, easeOutCubic)
    polygon.transition()
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr('points', points.map(p => p.join(',')).join(' '));

    // 데이터 포인트 + 라벨 (포인트도 애니메이션)
    points.forEach((p, i) => {
      g.append('circle')
        .attr('cx', 0).attr('cy', 0)
        .attr('r', 4)
        .attr('fill', UI_COLORS.accentGold)
        .attr('opacity', 0)
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr('cx', p[0]).attr('cy', p[1])
        .attr('opacity', 1);

      const angle = angleSlice * i - Math.PI / 2;
      const labelR = maxR + 25;
      g.append('text')
        .attr('x', labelR * Math.cos(angle))
        .attr('y', labelR * Math.sin(angle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', UI_COLORS.chartLabel)
        .attr('font-size', '12px')
        .text(`${axes[i].label}`);

      g.append('text')
        .attr('x', labelR * Math.cos(angle))
        .attr('y', labelR * Math.sin(angle) + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', UI_COLORS.accentGold)
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .text(`${axes[i].value.toFixed(0)}`);
    });
  }, [axes]);

  return <svg ref={svgRef} className="radar-chart" />;
}

/** 상세 피처 카드 — 데이터 부족 표시 포함 */
function FeatureCard({ title, items, dataMissingLabel }: {
  title: string;
  items: { label: string; value: string; sufficiency?: FeatureSufficiency }[];
  dataMissingLabel: string;
}) {
  return (
    <div className="feature-card">
      <h4>{title}</h4>
      <div className="feature-list">
        {items.map(({ label, value, sufficiency }) => {
          const insufficient = sufficiency && !sufficiency.sufficient;
          return (
            <div key={label} className={`feature-row ${insufficient ? 'insufficient' : ''}`}>
              <span className="feature-label">{label}</span>
              <span className="feature-value">
                {insufficient
                  ? `${dataMissingLabel} (${sufficiency!.currentCount}/${sufficiency!.requiredCount})`
                  : value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 숫자 포맷 헬퍼 */
const fmt = (v: number | null, decimals = 2, suffix = '') =>
  v !== null ? `${v.toFixed(decimals)}${suffix}` : '—';

const pct = (v: number | null) => fmt(v !== null ? v * 100 : null, 1, '%');

/** 데이터 충족도 조회 헬퍼 */
const getSuff = (dna: AimDnaProfile, key: string): FeatureSufficiency | undefined =>
  dna.dataSufficiency?.[key];

export function AimDnaResult({ onBack }: Props) {
  const { t } = useTranslation();
  const { currentDna, trend, loadTrend } = useAimDnaStore();
  const { setScreen } = useEngineStore();

  /** 현재 활성 탭 */
  const [tab, setTab] = useState<DnaTab>('overview');
  /** 기어 선택 상태 — 인사이트와 공유 */
  const [gear, setGear] = useState<GearSelection>({ mouse: null, mousepad: null });

  /** 탭 키보드 네비게이션 */
  const DNA_TAB_KEYS = ['overview', 'gear', 'grip', 'posture', 'insights', 'history'] as const;
  const { containerRef: dnaTabRef, onKeyDown: dnaTabKeyDown } = useTabKeyboard<DnaTab>(DNA_TAB_KEYS, setTab);

  // 추세 분석 로드
  useEffect(() => {
    if (currentDna) {
      loadTrend(currentDna.profileId);
    }
  }, [currentDna?.profileId]);

  if (!currentDna) {
    return (
      <main className="app-main">
        <EmptyState
          icon={
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="24" cy="24" r="16" />
              <path d="M18 18 L30 30 M30 18 L18 30" />
            </svg>
          }
          title={t('empty.dnaTitle')}
          description={t('empty.dnaDesc')}
          action={
            <button className="btn-secondary" onClick={onBack}>{t('common.back')}</button>
          }
        />
      </main>
    );
  }

  const axes = computeRadarAxes(currentDna);

  return (
    <main className="app-main">
      <div className="aim-dna-result">
        <h2>Aim DNA</h2>

        {/* 탭 네비게이션 */}
        <div className="dna-tabs" role="tablist" aria-label="Aim DNA" ref={dnaTabRef} onKeyDown={dnaTabKeyDown}>
          {([
            { id: 'overview',  labelKey: 'dna.analysisResult' },
            { id: 'gear',      labelKey: 'dna.gearSelect' },
            { id: 'grip',      labelKey: 'dna.gripGuide' },
            { id: 'posture',   labelKey: 'dna.postureGuide' },
            { id: 'insights',  labelKey: 'dna.insights' },
            { id: 'history',   labelKey: 'dna.historyTab' },
          ] as { id: DnaTab; labelKey: string }[]).map(item => (
            <button
              key={item.id}
              role="tab"
              aria-selected={tab === item.id}
              tabIndex={tab === item.id ? 0 : -1}
              className={`dna-tab ${tab === item.id ? 'active' : ''}`}
              onClick={() => setTab(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        {/* ── 탭 콘텐츠 (fade 전환) ── */}
        <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          role="tabpanel"
          aria-label={tab}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >

        {/* 분석 결과 탭 */}
        {tab === 'overview' && (
          <>
            {/* 재교정 추천 배너 */}
            {trend?.recalibrationRecommended && (
              <div className="trend-banner" style={{
                background: UI_COLORS.referenceBgDark, border: '1px solid var(--color-amber)', borderRadius: 8,
                padding: '12px 16px', marginBottom: 16,
              }}>
                <strong style={{ color: 'var(--color-amber)' }}>{t('dna.recalibrationNotice')}</strong>
                <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text-primary)' }}>
                  {trend.changedFeatures.slice(0, 5).map(f => (
                    <span key={f.feature} style={{ marginRight: 12 }}>
                      {f.feature}: {f.changePct > 0 ? '+' : ''}{f.changePct.toFixed(1)}%
                      ({t(DIRECTION_KEYS[f.direction] ?? f.direction)})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* type_label 배지 */}
            {currentDna.typeLabel && (
              <div className="type-badge">
                <span className="type-name">{currentDna.typeLabel}</span>
                <span className="type-desc">
                  {TYPE_DESC_KEYS[currentDna.typeLabel] ? t(TYPE_DESC_KEYS[currentDna.typeLabel]) : ''}
                </span>
              </div>
            )}

            {/* 레이더 차트 */}
            <RadarChart axes={axes} />

            {/* 상세 분류표 — 데이터 부족 표시 포함 */}
            <div className="feature-cards">
              <FeatureCard
                title={t('dna.flickDynamics')}
                dataMissingLabel={t('dna.dataMissing')}
                items={[
                  { label: 'Peak Velocity', value: fmt(currentDna.flickPeakVelocity, 0, '°/s') },
                  { label: 'Avg Overshoot', value: fmt(currentDna.overshootAvg, 3, ' rad'), sufficiency: getSuff(currentDna, 'overshoot_avg') },
                  { label: 'Effective Range', value: fmt(currentDna.effectiveRange, 0, '°') },
                  { label: 'Direction Bias', value: fmt(currentDna.directionBias, 3), sufficiency: getSuff(currentDna, 'direction_bias') },
                  { label: 'Pre-Aim Ratio', value: pct(currentDna.preAimRatio) },
                  { label: 'Pre-Fire Ratio', value: pct(currentDna.preFireRatio) },
                  { label: 'V/H Ratio', value: fmt(currentDna.vHRatio), sufficiency: getSuff(currentDna, 'v_h_ratio') },
                ]}
              />
              <FeatureCard
                title={t('dna.trackingDynamics')}
                dataMissingLabel={t('dna.dataMissing')}
                items={[
                  { label: 'MAD', value: fmt(currentDna.trackingMad, 4, ' rad'), sufficiency: getSuff(currentDna, 'tracking') },
                  { label: 'Phase Lag', value: fmt(currentDna.phaseLag, 1, ' ms'), sufficiency: getSuff(currentDna, 'phase_lag') },
                  { label: 'Smoothness', value: fmt(currentDna.smoothness, 1) },
                  { label: 'Velocity Match', value: pct(currentDna.velocityMatch) },
                ]}
              />
              <FeatureCard
                title={t('dna.motorSystem')}
                dataMissingLabel={t('dna.dataMissing')}
                items={[
                  { label: 'Wrist/Arm Ratio', value: fmt(currentDna.wristArmRatio) },
                  { label: 'Finger Accuracy', value: pct(currentDna.fingerAccuracy) },
                  { label: 'Wrist Accuracy', value: pct(currentDna.wristAccuracy) },
                  { label: 'Arm Accuracy', value: pct(currentDna.armAccuracy) },
                  { label: 'Transition Angle', value: fmt(currentDna.motorTransitionAngle, 0, '°'), sufficiency: getSuff(currentDna, 'motor_transition_angle') },
                ]}
              />
              <FeatureCard
                title={t('dna.timeDynamics')}
                dataMissingLabel={t('dna.dataMissing')}
                items={[
                  { label: "Fitts' a (intercept)", value: fmt(currentDna.fittsA, 1, ' ms'), sufficiency: getSuff(currentDna, 'fitts') },
                  { label: "Fitts' b (slope)", value: fmt(currentDna.fittsB, 1, ' ms/bit'), sufficiency: getSuff(currentDna, 'fitts') },
                  { label: 'Fatigue Decay', value: fmt(currentDna.fatigueDecay, 3) },
                  { label: 'Sens Overshoot Corr', value: fmt(currentDna.sensAttributedOvershoot, 3) },
                ]}
              />
            </div>

            <div className="result-actions">
              <button className="btn-primary" onClick={() => setScreen('cross-game-comparison')}>
                {t('dna.crossGameCompare')}
              </button>
            </div>
          </>
        )}

        {/* 기어 선택 탭 */}
        {tab === 'gear' && (
          <AimDnaSensitivitySelector value={gear} onChange={setGear} />
        )}

        {/* 그립 가이드 탭 */}
        {tab === 'grip' && (
          <AimDnaGripGuide dna={currentDna} />
        )}

        {/* 자세 가이드 탭 */}
        {tab === 'posture' && (
          <AimDnaPostureGuide dna={currentDna} />
        )}

        {/* 인사이트 탭 */}
        {tab === 'insights' && (
          <AimDnaInsights dna={currentDna} gear={gear} />
        )}

        {/* 히스토리 탭 */}
        {tab === 'history' && (
          <AimDnaHistory profileId={currentDna.profileId} />
        )}

        </motion.div>
        </AnimatePresence>

        {/* 하단 공통 액션 */}
        <div className="result-actions" style={{ marginTop: 24 }}>
          <button className="btn-secondary" onClick={onBack}>{t('common.back')}</button>
        </div>
      </div>
    </main>
  );
}
