/**
 * Aim DNA 결과 화면
 * D3.js 레이더 차트 (5축) + 상세 분류표 + type_label 배지
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useAimDnaStore } from '../stores/aimDnaStore';
import type { AimDnaProfile, RadarAxis } from '../utils/types';

interface Props {
  onBack: () => void;
}

/** type_label 한글 설명 */
const TYPE_DESCRIPTIONS: Record<string, string> = {
  'wrist-flicker': '손목 중심 플릭 — 빠른 반응, 근거리 정확도 높음',
  'arm-tracker': '팔 중심 트래커 — 넓은 범위 추적에 강함',
  'precision': '정밀형 — 사전 조준 후 클릭, 오버슈트 최소',
  'reactive': '반응형 — 빠른 사격, Pre-Fire 비율 높음',
  'hybrid': '하이브리드 — 균형 잡힌 멀티 스타일',
};

/** Aim DNA 프로파일 → 5축 레이더 데이터 (0~100 정규화) */
function computeRadarAxes(dna: AimDnaProfile): RadarAxis[] {
  // Flick Power: peak_velocity(0~2000°/s) + effective_range(0~180°) 평균
  const velNorm = Math.min((dna.flick_peak_velocity ?? 0) / 2000 * 100, 100);
  const rangeNorm = Math.min((dna.effective_range ?? 0) / 180 * 100, 100);
  const flickPower = (velNorm + rangeNorm) / 2;

  // Tracking Precision: MAD 역수(0.3→0, 0→100) + velocity_match(0~1→0~100)
  const madNorm = Math.max(0, 100 - (dna.tracking_mad ?? 0.3) * 333);
  const vmNorm = (dna.velocity_match ?? 0) * 100;
  const trackingPrecision = (madNorm + vmNorm) / 2;

  // Motor Control: 영역별 정확도 균형 + wrist_arm_ratio 적절성
  const fAcc = (dna.finger_accuracy ?? 0) * 100;
  const wAcc = (dna.wrist_accuracy ?? 0) * 100;
  const aAcc = (dna.arm_accuracy ?? 0) * 100;
  const avgAcc = (fAcc + wAcc + aAcc) / 3;
  // wrist_arm_ratio 0.5에 가까울수록 균형 → 보너스
  const balanceBonus = (1 - Math.abs((dna.wrist_arm_ratio ?? 0.5) - 0.5) * 2) * 20;
  const motorControl = Math.min(avgAcc + balanceBonus, 100);

  // Speed: fitts_b 역수 (낮을수록 빠름, 50~300 범위 가정)
  const fittsB = dna.fitts_b ?? 200;
  const speedNorm = Math.max(0, Math.min(100, (300 - fittsB) / 250 * 100));

  // Consistency: direction_bias 역수 + v_h_ratio→1 근접도 + fatigue 역수
  const biasNorm = (1 - (dna.direction_bias ?? 0)) * 100;
  const vhNorm = Math.max(0, 100 - Math.abs((dna.v_h_ratio ?? 1) - 1) * 100);
  const fatigueNorm = Math.max(0, 100 - Math.abs(dna.fatigue_decay ?? 0) * 200);
  const consistency = (biasNorm + vhNorm + fatigueNorm) / 3;

  return [
    { label: 'Flick Power', key: 'flick_power', value: flickPower },
    { label: 'Tracking', key: 'tracking_precision', value: trackingPrecision },
    { label: 'Motor Control', key: 'motor_control', value: motorControl },
    { label: 'Speed', key: 'speed', value: speedNorm },
    { label: 'Consistency', key: 'consistency', value: consistency },
  ];
}

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
    const levels = 5; // 동심원 수
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
        .attr('stroke', '#333')
        .attr('stroke-width', 0.5);
    }

    // 축 라인
    axes.forEach((_, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', maxR * Math.cos(angle))
        .attr('y2', maxR * Math.sin(angle))
        .attr('stroke', '#444')
        .attr('stroke-width', 0.5);
    });

    // 데이터 폴리곤
    const rScale = d3.scaleLinear().domain([0, 100]).range([0, maxR]);
    const points = axes.map((axis, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const r = rScale(axis.value);
      return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number];
    });

    // 채워진 영역
    g.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', '#e94560')
      .attr('fill-opacity', 0.25)
      .attr('stroke', '#e94560')
      .attr('stroke-width', 2);

    // 데이터 포인트
    points.forEach((p, i) => {
      g.append('circle')
        .attr('cx', p[0]).attr('cy', p[1])
        .attr('r', 4)
        .attr('fill', '#e94560');

      // 값 라벨
      const angle = angleSlice * i - Math.PI / 2;
      const labelR = maxR + 25;
      g.append('text')
        .attr('x', labelR * Math.cos(angle))
        .attr('y', labelR * Math.sin(angle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#ccc')
        .attr('font-size', '12px')
        .text(`${axes[i].label}`);

      // 점수 값
      g.append('text')
        .attr('x', labelR * Math.cos(angle))
        .attr('y', labelR * Math.sin(angle) + 14)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e94560')
        .attr('font-size', '11px')
        .attr('font-weight', 'bold')
        .text(`${axes[i].value.toFixed(0)}`);
    });
  }, [axes]);

  return <svg ref={svgRef} className="radar-chart" />;
}

/** 상세 피처 카드 */
function FeatureCard({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="feature-card">
      <h4>{title}</h4>
      <div className="feature-list">
        {items.map(({ label, value }) => (
          <div key={label} className="feature-row">
            <span className="feature-label">{label}</span>
            <span className="feature-value">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 숫자 포맷 헬퍼 */
const fmt = (v: number | null, decimals = 2, suffix = '') =>
  v !== null ? `${v.toFixed(decimals)}${suffix}` : '—';

const pct = (v: number | null) => fmt(v !== null ? v * 100 : null, 1, '%');

export function AimDnaResult({ onBack }: Props) {
  const { currentDna } = useAimDnaStore();

  if (!currentDna) {
    return (
      <main className="app-main">
        <p>Aim DNA 데이터 없음</p>
        <button className="btn-secondary" onClick={onBack}>돌아가기</button>
      </main>
    );
  }

  const axes = computeRadarAxes(currentDna);

  return (
    <main className="app-main">
      <div className="aim-dna-result">
        <h2>Aim DNA</h2>

        {/* type_label 배지 */}
        {currentDna.type_label && (
          <div className="type-badge">
            <span className="type-name">{currentDna.type_label}</span>
            <span className="type-desc">
              {TYPE_DESCRIPTIONS[currentDna.type_label] ?? ''}
            </span>
          </div>
        )}

        {/* 레이더 차트 */}
        <RadarChart axes={axes} />

        {/* 상세 분류표 */}
        <div className="feature-cards">
          <FeatureCard
            title="Flick 역학"
            items={[
              { label: 'Peak Velocity', value: fmt(currentDna.flick_peak_velocity, 0, '°/s') },
              { label: 'Avg Overshoot', value: fmt(currentDna.overshoot_avg, 3, ' rad') },
              { label: 'Effective Range', value: fmt(currentDna.effective_range, 0, '°') },
              { label: 'Direction Bias', value: fmt(currentDna.direction_bias, 3) },
              { label: 'Pre-Aim Ratio', value: pct(currentDna.pre_aim_ratio) },
              { label: 'Pre-Fire Ratio', value: pct(currentDna.pre_fire_ratio) },
              { label: 'V/H Ratio', value: fmt(currentDna.v_h_ratio) },
            ]}
          />
          <FeatureCard
            title="Tracking 역학"
            items={[
              { label: 'MAD', value: fmt(currentDna.tracking_mad, 4, ' rad') },
              { label: 'Phase Lag', value: fmt(currentDna.phase_lag, 1, ' ms') },
              { label: 'Smoothness', value: fmt(currentDna.smoothness, 1) },
              { label: 'Velocity Match', value: pct(currentDna.velocity_match) },
            ]}
          />
          <FeatureCard
            title="Motor 시스템"
            items={[
              { label: 'Wrist/Arm Ratio', value: fmt(currentDna.wrist_arm_ratio) },
              { label: 'Finger Accuracy', value: pct(currentDna.finger_accuracy) },
              { label: 'Wrist Accuracy', value: pct(currentDna.wrist_accuracy) },
              { label: 'Arm Accuracy', value: pct(currentDna.arm_accuracy) },
              { label: 'Transition Angle', value: fmt(currentDna.motor_transition_angle, 0, '°') },
            ]}
          />
          <FeatureCard
            title="시간 역학"
            items={[
              { label: "Fitts' a (intercept)", value: fmt(currentDna.fitts_a, 1, ' ms') },
              { label: "Fitts' b (slope)", value: fmt(currentDna.fitts_b, 1, ' ms/bit') },
              { label: 'Fatigue Decay', value: fmt(currentDna.fatigue_decay, 3) },
              { label: 'Adaptation Rate', value: fmt(currentDna.adaptation_rate, 3) },
              { label: 'Sens Overshoot Corr', value: fmt(currentDna.sens_attributed_overshoot, 3) },
            ]}
          />
        </div>

        <div className="result-actions">
          <button className="btn-secondary" onClick={onBack}>돌아가기</button>
        </div>
      </div>
    </main>
  );
}
