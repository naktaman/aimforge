/**
 * Multiplier Curve — D3.js 배율 곡선 시각화
 *
 * 측정점 (●), 피팅 곡선 (—), 보간점 (○), 방식 오버레이 (---), K 슬라이더
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { KFitResult, PredictedMultiplier } from '../stores/zoomCalibrationStore';
import { UI_COLORS } from '../config/theme';

interface MultiplierCurveProps {
  /** K 피팅 결과 */
  kFit: KFitResult;
  /** 예측 배율 목록 */
  predictions: PredictedMultiplier[];
  /** 힙파이어 hFOV */
  hipfireFov: number;
  /** K 조정 콜백 */
  onAdjustK?: (delta: number) => void;
  /** 너비 */
  width?: number;
  /** 높이 */
  height?: number;
}

export function MultiplierCurve({
  kFit,
  predictions,
  hipfireFov,
  onAdjustK,
  width = 550,
  height = 300,
}: MultiplierCurveProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || predictions.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 45, left: 55 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    // 데이터 범위
    const ratios = predictions.map((p) => p.zoomRatio);
    const mults = predictions.map((p) => p.multiplier);
    const xExtent = [Math.min(...ratios) * 0.8, Math.max(...ratios) * 1.1];
    const yExtent = [Math.min(...mults) * 0.8, Math.max(...mults) * 1.2];

    const xScale = d3.scaleLinear().domain(xExtent).range([0, plotW]);
    const yScale = d3.scaleLinear().domain(yExtent).range([plotH, 0]);

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // ── 피팅 곡선 생성 (연속) ──
    const curvePoints: { ratio: number; mult: number }[] = [];
    for (let r = xExtent[0]; r <= xExtent[1]; r += 0.1) {
      // scope_fov 근사: 2 * atan(tan(hip/2) / r)
      const hipHalf = Math.tan((hipfireFov * Math.PI / 180) / 2);
      const scopeHalf = hipHalf / r;
      const mult = Math.pow(hipHalf / scopeHalf, kFit.kValue);
      curvePoints.push({ ratio: r, mult });
    }

    const curveLine = d3.line<{ ratio: number; mult: number }>()
      .x((d) => xScale(d.ratio))
      .y((d) => yScale(d.mult))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(curvePoints)
      .attr('d', curveLine)
      .attr('fill', 'none')
      .attr('stroke', UI_COLORS.successGreen)
      .attr('stroke-width', 2.5);

    // ── 측정점 (●) ──
    const measured = predictions.filter((p) => p.isMeasured);
    g.selectAll('.measured-point')
      .data(measured)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.zoomRatio))
      .attr('cy', (d) => yScale(d.multiplier))
      .attr('r', 6)
      .attr('fill', UI_COLORS.infoBlue)
      .attr('stroke', UI_COLORS.chartSubGrid) /* 차트 서브그리드 토큰 (어두운 파랑) */
      .attr('stroke-width', 2);

    // ── 보간점 (○) ──
    const interpolated = predictions.filter((p) => !p.isMeasured);
    g.selectAll('.interp-point')
      .data(interpolated)
      .enter()
      .append('circle')
      .attr('cx', (d) => xScale(d.zoomRatio))
      .attr('cy', (d) => yScale(d.multiplier))
      .attr('r', 5)
      .attr('fill', 'none')
      .attr('stroke', UI_COLORS.textSecondary)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '3,2');

    // ── 포인트 라벨 ──
    g.selectAll('.point-label')
      .data(predictions)
      .enter()
      .append('text')
      .attr('x', (d) => xScale(d.zoomRatio))
      .attr('y', (d) => yScale(d.multiplier) - 10)
      .attr('text-anchor', 'middle')
      .attr('fill', UI_COLORS.textPrimary)
      .attr('font-size', '9px')
      .text((d) => d.scopeName);

    // ── 축 ──
    g.append('g')
      .attr('transform', `translate(0,${plotH})`)
      .call(d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${d}x`));

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5));

    // 축 스타일
    svg.selectAll('.domain, .tick line').attr('stroke', UI_COLORS.chartAxisLine);
    svg.selectAll('.tick text').attr('fill', UI_COLORS.chartLabel).attr('font-size', '10px');

    // X축 라벨
    svg.append('text')
      .attr('x', margin.left + plotW / 2)
      .attr('y', height - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', UI_COLORS.chartAxisText)
      .attr('font-size', '11px')
      .text('Zoom Ratio');

    // Y축 라벨
    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -(margin.top + plotH / 2))
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('fill', UI_COLORS.chartAxisText)
      .attr('font-size', '11px')
      .text('Multiplier');

  }, [kFit, predictions, hipfireFov, width, height]);

  /** K 품질 한글 라벨 */
  const qualityLabel = kFit.quality === 'Low' ? '안정적' : kFit.quality === 'Medium' ? '수용 가능' : '불안정 (piecewise 사용)';
  const qualityColor = kFit.quality === 'Low' ? 'var(--color-hit)' : kFit.quality === 'Medium' ? 'var(--warning)' : 'var(--danger)';

  return (
    <div className="multiplier-curve">
      {/* K 정보 */}
      <div className="k-info">
        <span className="k-value">k = {kFit.kValue.toFixed(3)}</span>
        <span className="k-variance"> (분산: {kFit.kVariance.toFixed(4)})</span>
        <span className="k-quality" style={{ color: qualityColor }}>
          {qualityLabel}
        </span>
      </div>

      {/* D3 차트 */}
      <svg ref={svgRef} width={width} height={height} className="multiplier-svg" />

      {/* K 조정 슬라이더 */}
      {onAdjustK && (
        <div className="k-adjust">
          <span className="adjust-label">K 미세 조정:</span>
          <button className="btn-small" onClick={() => onAdjustK(-0.05)}>-0.05</button>
          <button className="btn-small" onClick={() => onAdjustK(-0.01)}>-0.01</button>
          <span className="k-display">{kFit.kValue.toFixed(3)}</span>
          <button className="btn-small" onClick={() => onAdjustK(+0.01)}>+0.01</button>
          <button className="btn-small" onClick={() => onAdjustK(+0.05)}>+0.05</button>
        </div>
      )}

      {/* 범례 */}
      <div className="curve-legend">
        <span className="legend-item"><span style={{ color: 'var(--info)' }}>{'\u25CF'}</span> 측정</span>
        <span className="legend-item"><span style={{ color: 'var(--text-secondary)' }}>{'\u25CB'}</span> 보간</span>
        <span className="legend-item"><span style={{ color: 'var(--color-hit)' }}>{'\u2014'}</span> 피팅 곡선</span>
      </div>
    </div>
  );
}
