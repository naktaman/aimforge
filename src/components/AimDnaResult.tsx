/**
 * Aim DNA 결과 화면
 * D3.js 레이더 차트 (5축) + 상세 분류표 + type_label 배지
 * + 데이터 충족도 표시 + 추세 배너 + 크로스게임 비교 진입
 * + 기어 선택기 + 그립/자세 가이드 + 인사이트 엔진
 */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAimDnaStore } from '../stores/aimDnaStore';
import { useEngineStore } from '../stores/engineStore';
import { computeRadarAxes } from '../utils/radarUtils';
import type { AimDnaProfile, RadarAxis, FeatureSufficiency } from '../utils/types';
import { AimDnaSensitivitySelector } from './AimDnaSensitivitySelector';
import { AimDnaGripGuide } from './AimDnaGripGuide';
import { AimDnaPostureGuide } from './AimDnaPostureGuide';
import { AimDnaInsights } from './AimDnaInsights';
import { AimDnaHistory } from './AimDnaHistory';
import type { GearSelection } from './AimDnaSensitivitySelector';

/** 탭 목록 */
type DnaTab = 'overview' | 'gear' | 'grip' | 'posture' | 'insights' | 'history';

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

/** 추세 방향 한글 */
const DIRECTION_LABELS: Record<string, string> = {
  improved: '개선',
  degraded: '하락',
  stable: '안정',
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

    g.append('polygon')
      .attr('points', points.map(p => p.join(',')).join(' '))
      .attr('fill', '#e94560')
      .attr('fill-opacity', 0.25)
      .attr('stroke', '#e94560')
      .attr('stroke-width', 2);

    // 데이터 포인트 + 라벨
    points.forEach((p, i) => {
      g.append('circle')
        .attr('cx', p[0]).attr('cy', p[1])
        .attr('r', 4)
        .attr('fill', '#e94560');

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

/** 상세 피처 카드 — 데이터 부족 표시 포함 */
function FeatureCard({ title, items }: {
  title: string;
  items: { label: string; value: string; sufficiency?: FeatureSufficiency }[];
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
                  ? `데이터 부족 (${sufficiency!.current_count}/${sufficiency!.required_count})`
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
  dna.data_sufficiency?.[key];

export function AimDnaResult({ onBack }: Props) {
  const { currentDna, trend, loadTrend } = useAimDnaStore();
  const { setScreen } = useEngineStore();

  /** 현재 활성 탭 */
  const [tab, setTab] = useState<DnaTab>('overview');
  /** 기어 선택 상태 — 인사이트와 공유 */
  const [gear, setGear] = useState<GearSelection>({ mouse: null, mousepad: null });

  // 추세 분석 로드
  useEffect(() => {
    if (currentDna) {
      loadTrend(currentDna.profile_id);
    }
  }, [currentDna?.profile_id]);

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

        {/* 탭 네비게이션 */}
        <div className="dna-tabs">
          {([
            { id: 'overview',  label: '분석 결과' },
            { id: 'gear',      label: '기어 선택' },
            { id: 'grip',      label: '그립 가이드' },
            { id: 'posture',   label: '자세 가이드' },
            { id: 'insights',  label: '인사이트' },
            { id: 'history',   label: '히스토리' },
          ] as { id: DnaTab; label: string }[]).map(t => (
            <button
              key={t.id}
              className={`dna-tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 탭 콘텐츠 ─────────────────────────────────────────── */}

        {/* 분석 결과 탭 */}
        {tab === 'overview' && (
          <>
            {/* 재교정 추천 배너 */}
            {trend?.recalibration_recommended && (
              <div className="trend-banner" style={{
                background: '#3d3520', border: '1px solid #f5a623', borderRadius: 8,
                padding: '12px 16px', marginBottom: 16,
              }}>
                <strong style={{ color: '#f5a623' }}>DNA 변화 감지 — 재교정을 추천합니다</strong>
                <div style={{ marginTop: 8, fontSize: 13, color: '#ccc' }}>
                  {trend.changed_features.slice(0, 5).map(f => (
                    <span key={f.feature} style={{ marginRight: 12 }}>
                      {f.feature}: {f.change_pct > 0 ? '+' : ''}{f.change_pct.toFixed(1)}%
                      ({DIRECTION_LABELS[f.direction] ?? f.direction})
                    </span>
                  ))}
                </div>
              </div>
            )}

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

            {/* 상세 분류표 — 데이터 부족 표시 포함 */}
            <div className="feature-cards">
              <FeatureCard
                title="Flick 역학"
                items={[
                  { label: 'Peak Velocity', value: fmt(currentDna.flick_peak_velocity, 0, '°/s') },
                  { label: 'Avg Overshoot', value: fmt(currentDna.overshoot_avg, 3, ' rad'), sufficiency: getSuff(currentDna, 'overshoot_avg') },
                  { label: 'Effective Range', value: fmt(currentDna.effective_range, 0, '°') },
                  { label: 'Direction Bias', value: fmt(currentDna.direction_bias, 3), sufficiency: getSuff(currentDna, 'direction_bias') },
                  { label: 'Pre-Aim Ratio', value: pct(currentDna.pre_aim_ratio) },
                  { label: 'Pre-Fire Ratio', value: pct(currentDna.pre_fire_ratio) },
                  { label: 'V/H Ratio', value: fmt(currentDna.v_h_ratio), sufficiency: getSuff(currentDna, 'v_h_ratio') },
                ]}
              />
              <FeatureCard
                title="Tracking 역학"
                items={[
                  { label: 'MAD', value: fmt(currentDna.tracking_mad, 4, ' rad'), sufficiency: getSuff(currentDna, 'tracking') },
                  { label: 'Phase Lag', value: fmt(currentDna.phase_lag, 1, ' ms'), sufficiency: getSuff(currentDna, 'phase_lag') },
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
                  { label: 'Transition Angle', value: fmt(currentDna.motor_transition_angle, 0, '°'), sufficiency: getSuff(currentDna, 'motor_transition_angle') },
                ]}
              />
              <FeatureCard
                title="시간 역학"
                items={[
                  { label: "Fitts' a (intercept)", value: fmt(currentDna.fitts_a, 1, ' ms'), sufficiency: getSuff(currentDna, 'fitts') },
                  { label: "Fitts' b (slope)", value: fmt(currentDna.fitts_b, 1, ' ms/bit'), sufficiency: getSuff(currentDna, 'fitts') },
                  { label: 'Fatigue Decay', value: fmt(currentDna.fatigue_decay, 3) },
                  { label: 'Sens Overshoot Corr', value: fmt(currentDna.sens_attributed_overshoot, 3) },
                ]}
              />
            </div>

            <div className="result-actions">
              <button className="btn-primary" onClick={() => setScreen('cross-game-comparison')}>
                크로스게임 비교
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
          <AimDnaHistory profileId={currentDna.profile_id} />
        )}

        {/* 하단 공통 액션 */}
        <div className="result-actions" style={{ marginTop: 24 }}>
          <button className="btn-secondary" onClick={onBack}>돌아가기</button>
        </div>
      </div>
    </main>
  );
}
