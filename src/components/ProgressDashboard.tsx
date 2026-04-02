/**
 * Progress Dashboard
 * Readiness 게이지 + DNA 시계열 D3 라인차트 + 스킬 진행 그리드 + 일별 통계
 */
import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useProgressStore } from '../stores/progressStore';
import { useTrainingStore } from '../stores/trainingStore';
import ReadinessWidget from './ReadinessWidget';
import type { AimDnaHistoryEntry, SkillProgressRow } from '../utils/types';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** DNA 시계열에 표시할 핵심 6피처 */
const KEY_FEATURES = [
  { key: 'flick_peak_velocity', label: '플릭 속도', unit: '°/s' },
  { key: 'tracking_mad', label: '트래킹 MAD', unit: '°', invert: true },
  { key: 'overshoot_avg', label: '오버슈팅', unit: '°', invert: true },
  { key: 'smoothness', label: '스무드니스', unit: '' },
  { key: 'direction_bias', label: '방향 편향', unit: '', invert: true },
  { key: 'effective_range', label: '유효 사거리', unit: '°' },
] as const;

/** 시간 범위 옵션 */
const TIME_RANGES = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: '90d', label: '90일', days: 90 },
] as const;

/** DNA 시계열 D3 라인차트 — D3 렌더링 내부 색상은 인라인 유지 */
function DnaLineChart({ data, label, unit }: { data: AimDnaHistoryEntry[]; label: string; unit: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 520;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 데이터 파싱
    const parsed = data.map(d => ({
      date: new Date(d.measuredAt),
      value: d.value,
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    // 스케일
    const xScale = d3.scaleTime()
      .domain(d3.extent(parsed, d => d.date) as [Date, Date])
      .range([0, w]);

    const yExtent = d3.extent(parsed, d => d.value) as [number, number];
    const yPad = (yExtent[1] - yExtent[0]) * 0.1 || 1;
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - yPad, yExtent[1] + yPad])
      .range([h, 0]);

    // 축
    g.append('g')
      .attr('transform', `translate(0, ${h})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d3.timeFormat('%m/%d') as unknown as (v: d3.NumberValue) => string))
      .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', '#444'));

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', '#444'));

    // 라인
    const line = d3.line<typeof parsed[0]>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(parsed)
      .attr('fill', 'none')
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 2)
      .attr('d', line);

    // 포인트
    g.selectAll('.dot')
      .data(parsed)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.date))
      .attr('cy', d => yScale(d.value))
      .attr('r', 3)
      .attr('fill', '#60a5fa');

    // 라벨
    g.append('text')
      .attr('x', w / 2)
      .attr('y', -6)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ccc')
      .attr('font-size', 12)
      .attr('font-weight', 500)
      .text(`${label} (${unit})`);
  }, [data, label, unit]);

  // 데이터 없을 때 빈 상태
  if (data.length === 0) {
    return <div className="chart-empty">데이터 없음</div>;
  }

  return <svg ref={svgRef} className="chart-svg" />;
}

/** 스킬 진행률 등급 판별 */
function skillBarClass(pct: number): string {
  if (pct > 70) return 'skill-bar__fill skill-bar__fill--high';
  if (pct > 40) return 'skill-bar__fill skill-bar__fill--mid';
  return 'skill-bar__fill skill-bar__fill--low';
}

/** 스킬 진행 카드 */
function SkillCard({ skill }: { skill: SkillProgressRow }) {
  const pct = Math.min(100, skill.rollingAvgScore);
  return (
    <div className="glass-card--compact">
      <div className="skill-card__name">
        {skill.stageType.replace(/_/g, ' ')}
      </div>
      <div className="skill-bar">
        <div className={skillBarClass(pct)} style={{ width: `${pct}%` }} />
      </div>
      <div className="skill-card__meta text-sm text-muted">
        <span>평균 {skill.rollingAvgScore.toFixed(1)}</span>
        <span>최고 {skill.bestScore.toFixed(1)}</span>
        <span>{skill.totalSessions}회</span>
      </div>
    </div>
  );
}

/** 간단한 통계 카드 */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card--compact stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

export default function ProgressDashboard({ onBack, profileId }: Props) {
  const { dailyStats, skillProgress, dnaTimeSeries, loadDailyStats, loadSkillProgress, loadDnaTimeSeries } = useProgressStore();
  const { readiness, loadReadinessHistory } = useTrainingStore();
  const [selectedFeature, setSelectedFeature] = useState<string>(KEY_FEATURES[0].key);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  // 초기 데이터 로드
  useEffect(() => {
    const days = TIME_RANGES.find(r => r.key === timeRange)?.days ?? 30;
    loadDailyStats(profileId, days);
    loadSkillProgress(profileId);
    loadDnaTimeSeries(profileId, selectedFeature);
    loadReadinessHistory(profileId);
  }, [profileId, timeRange, selectedFeature, loadDailyStats, loadSkillProgress, loadDnaTimeSeries, loadReadinessHistory]);

  // 일별 통계 — 총 연습 시간
  const totalTimeMin = dailyStats.reduce((acc, s) => acc + s.totalTimeMs, 0) / 60000;
  const totalSessions = dailyStats.reduce((acc, s) => acc + s.sessionsCount, 0);

  return (
    <div className="page page--wide">
      {/* 헤더 */}
      <div className="page-header">
        <button onClick={onBack} className="btn btn--ghost btn--sm">← 뒤로</button>
        <h2>진행 대시보드</h2>
      </div>

      {/* 상단: Readiness + 요약 통계 */}
      <div className="progress-top">
        <div className="glass-card progress-top__readiness">
          <h3>오늘의 컨디션</h3>
          <ReadinessWidget result={readiness} />
        </div>
        <div className="progress-top__stats">
          <StatCard label="총 세션" value={`${totalSessions}회`} />
          <StatCard label="총 연습 시간" value={`${totalTimeMin.toFixed(0)}분`} />
          <StatCard label="평균 점수" value={
            dailyStats.length > 0
              ? `${(dailyStats.reduce((a, s) => a + s.avgScore, 0) / dailyStats.length).toFixed(1)}`
              : '-'
          } />
        </div>
      </div>

      {/* DNA 시계열 차트 */}
      <div className="glass-card page-section">
        <div className="chart-section__header">
          <h3>DNA 변화 추이</h3>
          <div className="tab-group">
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key as typeof timeRange)}
                className={`tab-item${timeRange === r.key ? ' active' : ''}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 피처 선택 탭 */}
        <div className="feature-tabs">
          {KEY_FEATURES.map(f => (
            <button
              key={f.key}
              onClick={() => setSelectedFeature(f.key)}
              className={`feature-tab${selectedFeature === f.key ? ' active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <DnaLineChart
          data={dnaTimeSeries}
          label={KEY_FEATURES.find(f => f.key === selectedFeature)?.label ?? ''}
          unit={KEY_FEATURES.find(f => f.key === selectedFeature)?.unit ?? ''}
        />
      </div>

      {/* 스킬 진행도 그리드 */}
      <div className="page-section">
        <h3 className="page-section__title">스킬 진행도</h3>
        {skillProgress.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__text">아직 훈련 데이터가 없습니다.</div>
          </div>
        ) : (
          <div className="skill-grid">
            {skillProgress.map(s => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
