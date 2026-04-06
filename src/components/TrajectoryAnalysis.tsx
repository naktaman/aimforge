/**
 * 궤적 분석 화면
 * 클릭 벡터 산점도 + GMM 히스토그램 + 감도 진단 패널
 */
import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useProgressStore } from '../stores/progressStore';
import { BackButton } from './BackButton';
import { UI_COLORS } from '../config/theme';
import type { ClickVector, GmmClusterResult } from '../utils/types';

interface Props {
  onBack: () => void;
  /** 분석할 트라이얼 ID (없으면 입력 필드 표시) */
  trialId?: number;
}

/** 모터 영역 색상 (D3 차트용) */
const MOTOR_COLORS: Record<string, string> = {
  finger: '#60a5fa',
  wrist: '#4ade80',
  arm: '#8A9AB5',
};

/** 클릭 벡터 산점도 — D3로 렌더링 */
function ClickVectorScatter({ vectors }: { vectors: ClickVector[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || vectors.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 400;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // 스케일 계산
    const maxVal = d3.max(vectors, v => Math.max(Math.abs(v.dxDeg), Math.abs(v.dyDeg))) ?? 20;
    const range = maxVal * 1.2;

    const xScale = d3.scaleLinear().domain([-range, range]).range([0, w]);
    const yScale = d3.scaleLinear().domain([-range, range]).range([h, 0]);

    // X축
    g.append('g')
      .attr('transform', `translate(0, ${h})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .call(g => g.selectAll('text').attr('fill', UI_COLORS.chartAxisText).attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', UI_COLORS.chartAxisLine));

    // Y축
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .call(g => g.selectAll('text').attr('fill', UI_COLORS.chartAxisText).attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', UI_COLORS.chartAxisLine));

    // 원점 십자선
    g.append('line').attr('x1', xScale(0)).attr('x2', xScale(0)).attr('y1', 0).attr('y2', h)
      .attr('stroke', UI_COLORS.chartGrid).attr('stroke-dasharray', '4,4');
    g.append('line').attr('x1', 0).attr('x2', w).attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', UI_COLORS.chartGrid).attr('stroke-dasharray', '4,4');

    // 데이터 포인트
    g.selectAll('.click-dot')
      .data(vectors)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.dxDeg))
      .attr('cy', d => yScale(d.dyDeg))
      .attr('r', 4)
      .attr('fill', d => MOTOR_COLORS[d.motorRegion] || '#888')
      .attr('opacity', 0.7)
      .attr('stroke', d => d.overshoot ? UI_COLORS.dangerRed : 'none')
      .attr('stroke-width', d => d.overshoot ? 2 : 0);

    // 축 라벨
    g.append('text').attr('x', w / 2).attr('y', h + 32).attr('text-anchor', 'middle')
      .attr('fill', UI_COLORS.chartLabel).attr('font-size', 11).text('X 이동 (°)');
    g.append('text').attr('x', -h / 2).attr('y', -35).attr('text-anchor', 'middle')
      .attr('fill', UI_COLORS.chartLabel).attr('font-size', 11).attr('transform', 'rotate(-90)')
      .text('Y 이동 (°)');
  }, [vectors]);

  return <svg ref={svgRef} style={{ width: '100%', maxWidth: 400, height: 400 }} />;
}

/** GMM 히스토그램 + 가우시안 오버레이 — D3로 렌더링 */
function GmmHistogram({ vectors, gmm }: { vectors: ClickVector[]; gmm: GmmClusterResult | null }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || vectors.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const magnitudes = vectors.map(v => v.magnitudeDeg);
    const width = 400;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const maxMag = d3.max(magnitudes) ?? 30;
    const xScale = d3.scaleLinear().domain([0, maxMag * 1.1]).range([0, w]);

    // 히스토그램 빈
    const bins = d3.bin().domain(xScale.domain() as [number, number]).thresholds(20)(magnitudes);
    const yMax = d3.max(bins, b => b.length) ?? 1;
    const yScale = d3.scaleLinear().domain([0, yMax]).range([h, 0]);

    // X축
    g.append('g').attr('transform', `translate(0, ${h})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .call(g => g.selectAll('text').attr('fill', UI_COLORS.chartAxisText).attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', UI_COLORS.chartAxisLine));

    // Y축
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .call(g => g.selectAll('text').attr('fill', UI_COLORS.chartAxisText).attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', UI_COLORS.chartAxisLine));

    // 히스토그램 바
    g.selectAll('.bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.x0 ?? 0))
      .attr('y', d => yScale(d.length))
      .attr('width', d => Math.max(0, xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) - 1))
      .attr('height', d => h - yScale(d.length))
      .attr('fill', `${UI_COLORS.infoBlue}44`)
      .attr('stroke', UI_COLORS.infoBlue);

    // GMM 가우시안 오버레이
    if (gmm) {
      const n = magnitudes.length;
      const binWidth = bins[0] ? (xScale(bins[0].x1 ?? 0) - xScale(bins[0].x0 ?? 0)) / (bins[0].x1! - bins[0].x0!) : 1;

      /** 가우시안 곡선 그리기 */
      const drawGaussian = (mean: number, std: number, weight: number, color: string) => {
        const points: [number, number][] = [];
        for (let x = 0; x <= maxMag * 1.1; x += 0.2) {
          const z = (x - mean) / std;
          const pdf = Math.exp(-0.5 * z * z) / (std * Math.sqrt(2 * Math.PI));
          const y = pdf * n * weight * binWidth;
          points.push([xScale(x), yScale(y)]);
        }
        const line = d3.line<[number, number]>().x(d => d[0]).y(d => d[1]).curve(d3.curveBasis);
        g.append('path').datum(points).attr('d', line).attr('fill', 'none')
          .attr('stroke', color).attr('stroke-width', 2).attr('stroke-dasharray', '4,2');
      };

      drawGaussian(gmm.clusterA.mean, gmm.clusterA.stdDev, gmm.clusterA.weight, UI_COLORS.successGreen);
      drawGaussian(gmm.clusterB.mean, gmm.clusterB.stdDev, gmm.clusterB.weight, UI_COLORS.metalChrome);
    }

    // X축 라벨
    g.append('text').attr('x', w / 2).attr('y', h + 32).attr('text-anchor', 'middle')
      .attr('fill', UI_COLORS.chartLabel).attr('font-size', 11).text('이동 크기 (°)');
  }, [vectors, gmm]);

  return <svg ref={svgRef} style={{ width: '100%', maxWidth: 400, height: 250 }} />;
}

/** 진단 카드 — stat-value/stat-label 디자인 시스템 사용 */
function DiagCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="traj-diag-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ color }}>{value}</div>
    </div>
  );
}

export default function TrajectoryAnalysis({ onBack, trialId: initialTrialId }: Props) {
  const { trajectoryAnalysis, isLoading, analyzeTrajectory } = useProgressStore();
  const [trialId, setTrialId] = useState(initialTrialId?.toString() ?? '');

  /** 분석 실행 핸들러 */
  const handleAnalyze = () => {
    const id = parseInt(trialId, 10);
    if (!isNaN(id)) analyzeTrajectory(id);
  };

  const result = trajectoryAnalysis;

  return (
    <div className="page page--wide">
      {/* 헤더 */}
      <div className="page-header">
        <BackButton onBack={onBack} />
        <h2>궤적 분석</h2>
      </div>

      {/* 트라이얼 ID 입력 */}
      <div className="traj-input-row">
        <label className="form-label">Trial ID:</label>
        <input
          type="number"
          className="input-field"
          value={trialId}
          onChange={e => setTrialId(e.target.value)}
        />
        <button className="btn btn--primary btn--sm" onClick={handleAnalyze} disabled={isLoading}>
          {isLoading ? '분석 중...' : '분석 실행'}
        </button>
        {result && (
          <span className="text-sm text-muted">
            총 {result.totalClicks}개 클릭 분석됨
          </span>
        )}
      </div>

      {result && (
        <>
          {/* 차트 영역 */}
          <div className="traj-chart-row">
            {/* 산점도 카드 */}
            <div className="glass-card glass-card--compact">
              <h3 className="page-section__title">클릭 벡터 분포</h3>
              <ClickVectorScatter vectors={result.clickVectors} />
              {/* 범례 */}
              <div className="traj-legend">
                {Object.entries(MOTOR_COLORS).map(([region, color]) => (
                  <span key={region} className="text-sm text-muted">
                    <span className="traj-legend__dot" style={{ background: color }} />
                    {region}
                  </span>
                ))}
                <span className="text-sm text-muted">
                  <span className="traj-legend__dot--overshoot" />
                  overshoot
                </span>
              </div>
            </div>

            {/* GMM 히스토그램 카드 */}
            <div className="glass-card glass-card--compact">
              <h3 className="page-section__title">이동 크기 분포 (GMM)</h3>
              <GmmHistogram vectors={result.clickVectors} gmm={result.gmm} />
              {result.gmm && (
                <div className="text-sm text-muted" style={{ textAlign: 'center', marginTop: 8 }}>
                  분리도: {(result.gmm.separationScore * 100).toFixed(0)}%
                  {result.gmm.bimodalDetected && (
                    <span className="badge--warning" style={{ marginLeft: 12 }}>이봉 분포 감지</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 감도 진단 */}
          <div className="glass-card page-section">
            <h3 className="page-section__title">감도 진단</h3>
            <div className="traj-diag-grid">
              <DiagCard
                label="행동 유형"
                value={
                  result.diagnosis.currentBehavior === 'overshoot_dominant' ? '오버슈팅 우세' :
                  result.diagnosis.currentBehavior === 'undershoot_dominant' ? '언더슈팅 우세' :
                  result.diagnosis.currentBehavior === 'balanced' ? '균형' : '데이터 부족'
                }
                color={
                  result.diagnosis.currentBehavior === 'balanced' ? 'var(--color-hit)' :
                  result.diagnosis.currentBehavior === 'insufficient_data' ? 'var(--text-secondary)' : 'var(--color-amber)'
                }
              />
              <DiagCard
                label="일관성"
                value={`${result.diagnosis.consistencyScore.toFixed(0)}점`}
                color={result.diagnosis.consistencyScore > 70 ? 'var(--color-hit)' : 'var(--color-amber)'}
              />
              <DiagCard
                label="신뢰도"
                value={`${(result.diagnosis.confidence * 100).toFixed(0)}%`}
                color="var(--info)"
              />
              {result.diagnosis.recommendedAdjustment !== 0 && (
                <DiagCard
                  label="권장 조정"
                  value={`${result.diagnosis.recommendedAdjustment > 0 ? '+' : ''}${result.diagnosis.recommendedAdjustment.toFixed(1)} cm/360`}
                  color={result.diagnosis.recommendedAdjustment > 0 ? UI_COLORS.metalChrome : UI_COLORS.infoBlue}
                />
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-primary)', marginTop: 12, lineHeight: 1.6 }}>
              {result.diagnosis.details}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
