/**
 * Performance Landscape — D3.js 기반 GP 곡선 시각화
 *
 * 레이어: ±2σ/±1σ 신뢰대역, GP 평균 곡선, 시나리오 오버레이,
 *         관측점, 이봉 피크 마커, 선택 감도 수직선
 * 인터랙션: 호버 툴팁, 클릭-선택, 줌/팬, Tab 토글
 */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

/** GP 곡선 데이터 포인트 */
interface GpCurvePoint {
  x: number;
  mean: number;
  variance: number;
}

/** 관측점 */
interface ObservationPoint {
  cm360: number;
  score: number;
}

/** 이봉 피크 */
interface Peak {
  cm360: number;
  score: number;
  variance: number;
  is_primary: boolean;
}

/** 시나리오 오버레이 데이터 */
interface ScenarioOverlay {
  [scenarioType: string]: { x: number; score: number }[];
}

interface PerformanceLandscapeProps {
  /** GP 곡선 데이터 */
  gpCurve: GpCurvePoint[];
  /** 관측점 */
  observations: ObservationPoint[];
  /** 이봉 피크 */
  peaks?: Peak[];
  /** 시나리오 오버레이 */
  scenarioOverlays?: ScenarioOverlay;
  /** 현재 선택된 감도 */
  selectedSens?: number;
  /** 감도 선택 콜백 */
  onSensSelect?: (cm360: number) => void;
  /** 수렴 모드 (디스플레이 수준 제어) */
  convergenceMode?: 'quick' | 'deep' | 'obsessive';
  /** 차트 너비 */
  width?: number;
  /** 차트 높이 */
  height?: number;
}

/** 시나리오별 색상 */
const SCENARIO_COLORS: Record<string, string> = {
  flick: '#f97316',           // 주황
  tracking: '#3b82f6',        // 파랑
  circular_tracking: '#8b5cf6', // 보라
  stochastic: '#ec4899',      // 분홍
  counter_strafe: '#14b8a6',  // 청록
  micro_flick: '#eab308',     // 노랑
  zoom_composite: '#a855f7',  // 자주
};

export function PerformanceLandscape({
  gpCurve,
  observations,
  peaks,
  scenarioOverlays,
  selectedSens,
  onSensSelect,
  convergenceMode = 'quick',
  width = 600,
  height = 320,
}: PerformanceLandscapeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [showOverlays, setShowOverlays] = useState(convergenceMode !== 'quick');

  // Tab 키로 오버레이 토글
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && svgRef.current?.closest(':hover')) {
        e.preventDefault();
        setShowOverlays((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // D3 렌더링
  useEffect(() => {
    if (!svgRef.current || gpCurve.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 55 };
    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;

    // 데이터 범위
    const xExtent = d3.extent(gpCurve, (d) => d.x) as [number, number];
    const allY = [
      ...gpCurve.map((d) => d.mean + 2 * Math.sqrt(d.variance)),
      ...gpCurve.map((d) => d.mean - 2 * Math.sqrt(d.variance)),
      ...observations.map((o) => o.score),
    ];
    const yExtent = [Math.min(...allY) - 0.02, Math.max(...allY) + 0.02];

    // 스케일
    const xScale = d3.scaleLinear().domain(xExtent).range([0, plotW]);
    const yScale = d3.scaleLinear().domain(yExtent).range([plotH, 0]);

    // 줌 동작
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 10])
      .translateExtent([[-50, -50], [plotW + 50, plotH + 50]])
      .on('zoom', (event) => {
        const transform = event.transform;
        plotGroup.attr('transform', `translate(${margin.left + transform.x},${margin.top + transform.y}) scale(${transform.k})`);
        // 축 업데이트
        const newXScale = transform.rescaleX(xScale);
        const newYScale = transform.rescaleY(yScale);
        xAxisGroup.call(d3.axisBottom(newXScale).ticks(8) as any);
        yAxisGroup.call(d3.axisLeft(newYScale).ticks(6) as any);
      });

    svg.call(zoomBehavior);

    // 클립 영역
    svg.append('defs')
      .append('clipPath')
      .attr('id', 'plot-clip')
      .append('rect')
      .attr('width', plotW)
      .attr('height', plotH);

    // 메인 그룹
    const plotGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .attr('clip-path', 'url(#plot-clip)');

    // ──── 레이어 1: ±2σ 신뢰대역 ────
    const area2sigma = d3.area<GpCurvePoint>()
      .x((d) => xScale(d.x))
      .y0((d) => yScale(d.mean - 2 * Math.sqrt(d.variance)))
      .y1((d) => yScale(d.mean + 2 * Math.sqrt(d.variance)))
      .curve(d3.curveBasis);

    plotGroup.append('path')
      .datum(gpCurve)
      .attr('d', area2sigma)
      .attr('fill', 'rgba(74, 222, 128, 0.08)')
      .attr('stroke', 'none');

    // ±1σ 신뢰대역
    const area1sigma = d3.area<GpCurvePoint>()
      .x((d) => xScale(d.x))
      .y0((d) => yScale(d.mean - Math.sqrt(d.variance)))
      .y1((d) => yScale(d.mean + Math.sqrt(d.variance)))
      .curve(d3.curveBasis);

    plotGroup.append('path')
      .datum(gpCurve)
      .attr('d', area1sigma)
      .attr('fill', 'rgba(74, 222, 128, 0.15)')
      .attr('stroke', 'none');

    // ──── 레이어 2: GP 평균 곡선 ────
    const meanLine = d3.line<GpCurvePoint>()
      .x((d) => xScale(d.x))
      .y((d) => yScale(d.mean))
      .curve(d3.curveBasis);

    plotGroup.append('path')
      .datum(gpCurve)
      .attr('d', meanLine)
      .attr('fill', 'none')
      .attr('stroke', '#4ade80')
      .attr('stroke-width', 2.5);

    // ──── 레이어 3: 시나리오 오버레이 ────
    if (showOverlays && scenarioOverlays) {
      Object.entries(scenarioOverlays).forEach(([scenario, data]) => {
        if (data.length === 0) return;
        const color = SCENARIO_COLORS[scenario] || '#888';
        const line = d3.line<{ x: number; score: number }>()
          .x((d) => xScale(d.x))
          .y((d) => yScale(d.score))
          .curve(d3.curveBasis);

        plotGroup.append('path')
          .datum(data)
          .attr('d', line)
          .attr('fill', 'none')
          .attr('stroke', color)
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '4,3')
          .attr('opacity', 0.7);
      });
    }

    // ──── 레이어 4: 관측점 ────
    plotGroup.selectAll('.obs-point')
      .data(observations)
      .enter()
      .append('circle')
      .attr('class', 'obs-point')
      .attr('cx', (d) => xScale(d.cm360))
      .attr('cy', (d) => yScale(d.score))
      .attr('r', 4)
      .attr('fill', '#60a5fa')
      .attr('stroke', '#1e3a5f')
      .attr('stroke-width', 1.5);

    // ──── 레이어 5: 이봉 피크 마커 ────
    if (peaks && peaks.length > 0) {
      const peakGroup = plotGroup.selectAll('.peak-marker')
        .data(peaks)
        .enter()
        .append('g')
        .attr('class', 'peak-marker')
        .attr('transform', (d) => `translate(${xScale(d.cm360)},${yScale(d.score)})`);

      // 다이아몬드 마커
      peakGroup.append('path')
        .attr('d', d3.symbol().type(d3.symbolDiamond).size(80)())
        .attr('fill', (d) => d.is_primary ? '#f59e0b' : '#94a3b8')
        .attr('stroke', '#000')
        .attr('stroke-width', 1);

      // 라벨
      peakGroup.append('text')
        .attr('dy', -12)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e2e8f0')
        .attr('font-size', '10px')
        .text((d) => d.is_primary ? '주 피크' : '부 피크');
    }

    // ──── 레이어 6: 선택 감도 수직선 ────
    if (selectedSens !== undefined) {
      plotGroup.append('line')
        .attr('x1', xScale(selectedSens))
        .attr('x2', xScale(selectedSens))
        .attr('y1', 0)
        .attr('y2', plotH)
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '6,3');

      plotGroup.append('text')
        .attr('x', xScale(selectedSens))
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f59e0b')
        .attr('font-size', '11px')
        .text(`${selectedSens.toFixed(1)}`);
    }

    // ──── 호버 툴팁 + 클릭 ────
    const overlay = plotGroup.append('rect')
      .attr('width', plotW)
      .attr('height', plotH)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair');

    overlay.on('mousemove', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const cm360 = xScale.invert(mx);
      // 가장 가까운 GP 점 찾기
      const closest = gpCurve.reduce((prev, curr) =>
        Math.abs(curr.x - cm360) < Math.abs(prev.x - cm360) ? curr : prev
      );

      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'block';
        tooltipRef.current.style.left = `${event.offsetX + 15}px`;
        tooltipRef.current.style.top = `${event.offsetY - 10}px`;
        tooltipRef.current.innerHTML = `
          <strong>${closest.x.toFixed(1)} cm/360</strong><br/>
          score: ${closest.mean.toFixed(3)}<br/>
          σ: ${Math.sqrt(closest.variance).toFixed(3)}
        `;
      }
    });

    overlay.on('mouseleave', () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.display = 'none';
      }
    });

    overlay.on('click', (event: MouseEvent) => {
      const [mx] = d3.pointer(event);
      const cm360 = xScale.invert(mx);
      onSensSelect?.(Math.round(cm360 * 10) / 10);
    });

    // ──── 축 ────
    const xAxisGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top + plotH})`)
      .call(d3.axisBottom(xScale).ticks(8));

    const yAxisGroup = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .call(d3.axisLeft(yScale).ticks(6));

    // 축 스타일
    svg.selectAll('.domain, .tick line').attr('stroke', '#444');
    svg.selectAll('.tick text').attr('fill', '#aaa').attr('font-size', '10px');

    // X축 라벨
    svg.append('text')
      .attr('x', margin.left + plotW / 2)
      .attr('y', height - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#888')
      .attr('font-size', '11px')
      .text('cm/360');

    // Y축 라벨
    svg.append('text')
      .attr('transform', `rotate(-90)`)
      .attr('x', -(margin.top + plotH / 2))
      .attr('y', 15)
      .attr('text-anchor', 'middle')
      .attr('fill', '#888')
      .attr('font-size', '11px')
      .text('score');

  }, [gpCurve, observations, peaks, scenarioOverlays, selectedSens, showOverlays, width, height, convergenceMode, onSensSelect]);

  if (gpCurve.length === 0) {
    return <div className="landscape-empty">GP 데이터 대기 중...</div>;
  }

  return (
    <div className="performance-landscape" style={{ position: 'relative' }}>
      {/* 오버레이 토글 */}
      {scenarioOverlays && Object.keys(scenarioOverlays).length > 0 && (
        <div className="overlay-toggle">
          <label>
            <input
              type="checkbox"
              checked={showOverlays}
              onChange={(e) => setShowOverlays(e.target.checked)}
            />
            시나리오 오버레이
          </label>
          {showOverlays && (
            <div className="overlay-legend">
              {Object.entries(SCENARIO_COLORS).map(([name, color]) => (
                scenarioOverlays[name] && (
                  <span key={name} className="legend-item">
                    <span style={{ color }}>{'\u25CF'}</span> {name}
                  </span>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* D3 SVG */}
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="landscape-svg"
      />

      {/* 호버 툴팁 */}
      <div
        ref={tooltipRef}
        className="landscape-tooltip"
        style={{
          display: 'none',
          position: 'absolute',
          background: 'rgba(15,23,42,0.95)',
          border: '1px solid #334155',
          borderRadius: '6px',
          padding: '6px 10px',
          fontSize: '11px',
          color: '#e2e8f0',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      {/* 수렴 모드 뱃지 */}
      {convergenceMode !== 'quick' && (
        <div className="convergence-badge" style={{
          position: 'absolute', top: 4, right: 8,
          background: convergenceMode === 'obsessive' ? '#7c3aed' : '#2563eb',
          color: '#fff', borderRadius: '4px', padding: '2px 8px',
          fontSize: '10px', fontWeight: 600,
        }}>
          {convergenceMode === 'obsessive' ? 'Obsessive' : 'Deep'}
          <span style={{ marginLeft: 6, opacity: 0.8 }}>
            {observations.length} obs
          </span>
        </div>
      )}

      {/* 이봉 경고 */}
      {peaks && peaks.length >= 2 && (
        <div className="bimodal-warning">
          두 최적 영역 발견 — 주 피크 근처 추천
        </div>
      )}
    </div>
  );
}
