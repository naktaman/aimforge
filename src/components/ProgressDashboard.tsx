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

/** DNA 시계열 D3 라인차트 */
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
      date: new Date(d.measured_at),
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

  if (data.length === 0) {
    return (
      <div style={{ width: 520, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        데이터 없음
      </div>
    );
  }

  return <svg ref={svgRef} style={{ width: '100%', maxWidth: 520, height: 200 }} />;
}

/** 스킬 진행 카드 */
function SkillCard({ skill }: { skill: SkillProgressRow }) {
  const pct = Math.min(100, skill.rolling_avg_score);
  return (
    <div style={{
      background: '#1e1e30', borderRadius: 8, padding: 12,
      border: '1px solid #333',
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 6 }}>
        {skill.stage_type.replace(/_/g, ' ')}
      </div>
      <div style={{ background: '#2a2a3e', borderRadius: 4, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 4,
          background: pct > 70 ? '#4ade80' : pct > 40 ? '#f5a623' : '#e94560',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 11, color: '#888' }}>
        <span>평균 {skill.rolling_avg_score.toFixed(1)}</span>
        <span>최고 {skill.best_score.toFixed(1)}</span>
        <span>{skill.total_sessions}회</span>
      </div>
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
  const totalTimeMin = dailyStats.reduce((acc, s) => acc + s.total_time_ms, 0) / 60000;
  const totalSessions = dailyStats.reduce((acc, s) => acc + s.sessions_count, 0);

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto', color: '#e0e0e0' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={btnStyle}>← 뒤로</button>
        <h2 style={{ margin: 0, fontSize: 22 }}>진행 대시보드</h2>
      </div>

      {/* 상단: Readiness + 요약 통계 */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div style={{ background: '#1e1e30', borderRadius: 12, padding: 20, flex: '0 0 240px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: 15 }}>오늘의 컨디션</h3>
          <ReadinessWidget result={readiness} />
        </div>
        <div style={{ display: 'flex', gap: 16, flex: 1, flexWrap: 'wrap' }}>
          <StatCard label="총 세션" value={`${totalSessions}회`} />
          <StatCard label="총 연습 시간" value={`${totalTimeMin.toFixed(0)}분`} />
          <StatCard label="평균 점수" value={
            dailyStats.length > 0
              ? `${(dailyStats.reduce((a, s) => a + s.avg_score, 0) / dailyStats.length).toFixed(1)}`
              : '-'
          } />
        </div>
      </div>

      {/* DNA 시계열 차트 */}
      <div style={{ background: '#1e1e30', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>DNA 변화 추이</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key as typeof timeRange)}
                style={{
                  ...tabStyle,
                  background: timeRange === r.key ? '#3b82f6' : '#2a2a3e',
                  color: timeRange === r.key ? '#fff' : '#aaa',
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 피처 선택 탭 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {KEY_FEATURES.map(f => (
            <button
              key={f.key}
              onClick={() => setSelectedFeature(f.key)}
              style={{
                ...tabStyle,
                background: selectedFeature === f.key ? '#60a5fa22' : 'transparent',
                color: selectedFeature === f.key ? '#60a5fa' : '#888',
                border: selectedFeature === f.key ? '1px solid #60a5fa44' : '1px solid transparent',
              }}
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
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>스킬 진행도</h3>
        {skillProgress.length === 0 ? (
          <div style={{ color: '#666', padding: 20, textAlign: 'center' }}>아직 훈련 데이터가 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {skillProgress.map(s => (
              <SkillCard key={s.id} skill={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** 간단한 통계 카드 */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#1e1e30', borderRadius: 8, padding: 16,
      minWidth: 120, flex: '1 1 120px',
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#2a2a3e', color: '#e0e0e0', border: 'none',
  borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};

const tabStyle: React.CSSProperties = {
  background: 'transparent', color: '#aaa', border: 'none',
  borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12,
};
