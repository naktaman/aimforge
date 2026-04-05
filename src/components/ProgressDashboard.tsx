/**
 * Progress Dashboard
 * Readiness 게이지 + DNA 시계열 D3 라인차트 + 스킬 진행 그리드 + 일별 통계
 */
import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useProgressStore } from '../stores/progressStore';
import { useTrainingStore } from '../stores/trainingStore';
import { useTranslation } from '../i18n';
import { useTabKeyboard } from '../utils/useTabKeyboard';
import ReadinessWidget from './ReadinessWidget';
import { EmptyState } from './EmptyState';
import type { AimDnaHistoryEntry, SkillProgressRow } from '../utils/types';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** DNA 시계열에 표시할 핵심 6피처 — i18n 키 기반 */
const KEY_FEATURES = [
  { key: 'flick_peak_velocity', labelKey: 'progress.flickSpeed', unit: '°/s' },
  { key: 'tracking_mad', labelKey: 'progress.trackingMad', unit: '°', invert: true },
  { key: 'overshoot_avg', labelKey: 'progress.overshoot', unit: '°', invert: true },
  { key: 'smoothness', labelKey: 'progress.smoothness', unit: '' },
  { key: 'direction_bias', labelKey: 'progress.dirBias', unit: '', invert: true },
  { key: 'effective_range', labelKey: 'progress.effectiveRange', unit: '°' },
] as const;

/** 시간 범위 옵션 — i18n 키 기반 */
const TIME_RANGES = [
  { key: '7d', labelKey: 'progress.7d', days: 7 },
  { key: '30d', labelKey: 'progress.30d', days: 30 },
  { key: '90d', labelKey: 'progress.90d', days: 90 },
] as const;

/** DNA 시계열 D3 라인차트 — D3 렌더링 내부 색상은 인라인 유지 */
function DnaLineChart({ data, label, unit, noDataLabel }: { data: AimDnaHistoryEntry[]; label: string; unit: string; noDataLabel: string }) {
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
    return <div className="chart-empty">{noDataLabel}</div>;
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
  const { t } = useTranslation();
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
        <span>{t('common.average')} {skill.rollingAvgScore.toFixed(1)}</span>
        <span>{t('progress.best')} {skill.bestScore.toFixed(1)}</span>
        <span>{skill.totalSessions} {t('progress.sessions')}</span>
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
  const { t } = useTranslation();
  const { dailyStats, skillProgress, dnaTimeSeries, loadDailyStats, loadSkillProgress, loadDnaTimeSeries } = useProgressStore();
  const { readiness, loadReadinessHistory } = useTrainingStore();
  const [selectedFeature, setSelectedFeature] = useState<string>(KEY_FEATURES[0].key);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  /** 시간 범위 탭 키보드 네비게이션 */
  const TIME_KEYS = ['7d', '30d', '90d'] as const;
  const { containerRef: timeTabRef, onKeyDown: timeTabKeyDown } = useTabKeyboard(TIME_KEYS, (k) => setTimeRange(k as typeof timeRange));
  /** 피처 탭 키보드 네비게이션 */
  const FEATURE_KEYS = KEY_FEATURES.map(f => f.key);
  const { containerRef: featureTabRef, onKeyDown: featureTabKeyDown } = useTabKeyboard(FEATURE_KEYS, setSelectedFeature);

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
        <button onClick={onBack} className="btn btn--ghost btn--sm">← {t('common.back')}</button>
        <h2>{t('progress.title')}</h2>
      </div>

      {/* 상단: Readiness + 요약 통계 */}
      <div className="progress-top">
        <div className="glass-card progress-top__readiness">
          <h3>{t('progress.todayCondition')}</h3>
          <ReadinessWidget result={readiness} />
        </div>
        <div className="progress-top__stats">
          <StatCard label={t('progress.totalSessions')} value={`${totalSessions} ${t('progress.sessions')}`} />
          <StatCard label={t('progress.totalTime')} value={`${totalTimeMin.toFixed(0)} ${t('prescription.min')}`} />
          <StatCard label={t('progress.avgScore')} value={
            dailyStats.length > 0
              ? `${(dailyStats.reduce((a, s) => a + s.avgScore, 0) / dailyStats.length).toFixed(1)}`
              : '-'
          } />
        </div>
      </div>

      {/* DNA 시계열 차트 */}
      <div className="glass-card page-section">
        <div className="chart-section__header">
          <h3>{t('progress.dnaChangeTrend')}</h3>
          <div className="tab-group" role="tablist" aria-label={t('progress.dnaChangeTrend')} ref={timeTabRef} onKeyDown={timeTabKeyDown}>
            {TIME_RANGES.map(r => (
              <button
                key={r.key}
                role="tab"
                aria-selected={timeRange === r.key}
                tabIndex={timeRange === r.key ? 0 : -1}
                onClick={() => setTimeRange(r.key as typeof timeRange)}
                className={`tab-item${timeRange === r.key ? ' active' : ''}`}
              >
                {t(r.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* 피처 선택 탭 */}
        <div className="feature-tabs" role="tablist" aria-label="Feature" ref={featureTabRef} onKeyDown={featureTabKeyDown}>
          {KEY_FEATURES.map(f => (
            <button
              key={f.key}
              role="tab"
              aria-selected={selectedFeature === f.key}
              tabIndex={selectedFeature === f.key ? 0 : -1}
              onClick={() => setSelectedFeature(f.key)}
              className={`feature-tab${selectedFeature === f.key ? ' active' : ''}`}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        <DnaLineChart
          data={dnaTimeSeries}
          label={t(KEY_FEATURES.find(f => f.key === selectedFeature)?.labelKey ?? '')}
          unit={KEY_FEATURES.find(f => f.key === selectedFeature)?.unit ?? ''}
          noDataLabel={t('common.noData')}
        />
      </div>

      {/* 스킬 진행도 그리드 */}
      <div className="page-section">
        <h3 className="page-section__title">{t('progress.skillProgress')}</h3>
        {skillProgress.length === 0 ? (
          <EmptyState
            icon={
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <polyline points="8,36 18,24 28,30 40,12" />
                <polyline points="32,12 40,12 40,20" />
              </svg>
            }
            title={t('empty.progressTitle')}
            description={t('empty.progressDesc')}
          />
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
