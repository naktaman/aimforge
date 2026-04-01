/**
 * 궤적 분석 화면
 * 클릭 벡터 산점도 + GMM 히스토그램 + 감도 진단 패널
 */
import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useProgressStore } from '../stores/progressStore';
import type { ClickVector, GmmClusterResult } from '../utils/types';

interface Props {
  onBack: () => void;
  /** 분석할 트라이얼 ID (없으면 입력 필드 표시) */
  trialId?: number;
}

/** 모터 영역 색상 */
const MOTOR_COLORS: Record<string, string> = {
  finger: '#60a5fa',
  wrist: '#4ade80',
  arm: '#f5a623',
};

/** 클릭 벡터 산점도 */
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

    // 스케일
    const maxVal = d3.max(vectors, v => Math.max(Math.abs(v.dx_deg), Math.abs(v.dy_deg))) ?? 20;
    const range = maxVal * 1.2;

    const xScale = d3.scaleLinear().domain([-range, range]).range([0, w]);
    const yScale = d3.scaleLinear().domain([-range, range]).range([h, 0]);

    // 축
    g.append('g')
      .attr('transform', `translate(0, ${h})`)
      .call(d3.axisBottom(xScale).ticks(5))
      .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', '#444'));

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', '#444'));

    // 원점 십자선
    g.append('line').attr('x1', xScale(0)).attr('x2', xScale(0)).attr('y1', 0).attr('y2', h)
      .attr('stroke', '#555').attr('stroke-dasharray', '4,4');
    g.append('line').attr('x1', 0).attr('x2', w).attr('y1', yScale(0)).attr('y2', yScale(0))
      .attr('stroke', '#555').attr('stroke-dasharray', '4,4');

    // 포인트
    g.selectAll('.click-dot')
      .data(vectors)
      .enter()
      .append('circle')
      .attr('cx', d => xScale(d.dx_deg))
      .attr('cy', d => yScale(d.dy_deg))
      .attr('r', 4)
      .attr('fill', d => MOTOR_COLORS[d.motor_region] || '#888')
      .attr('opacity', 0.7)
      .attr('stroke', d => d.overshoot ? '#e94560' : 'none')
      .attr('stroke-width', d => d.overshoot ? 2 : 0);

    // 축 라벨
    g.append('text').attr('x', w / 2).attr('y', h + 32).attr('text-anchor', 'middle')
      .attr('fill', '#aaa').attr('font-size', 11).text('X 이동 (°)');
    g.append('text').attr('x', -h / 2).attr('y', -35).attr('text-anchor', 'middle')
      .attr('fill', '#aaa').attr('font-size', 11).attr('transform', 'rotate(-90)')
      .text('Y 이동 (°)');
  }, [vectors]);

  return <svg ref={svgRef} style={{ width: '100%', maxWidth: 400, height: 400 }} />;
}

/** GMM 히스토그램 + 가우시안 오버레이 */
function GmmHistogram({ vectors, gmm }: { vectors: ClickVector[]; gmm: GmmClusterResult | null }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || vectors.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const magnitudes = vectors.map(v => v.magnitude_deg);
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

    // 축
    g.append('g').attr('transform', `translate(0, ${h})`)
      .call(d3.axisBottom(xScale).ticks(6))
      .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', '#444'));

    g.append('g')
      .call(d3.axisLeft(yScale).ticks(4))
      .call(g => g.selectAll('text').attr('fill', '#888').attr('font-size', 10))
      .call(g => g.selectAll('line, path').attr('stroke', '#444'));

    // 바
    g.selectAll('.bar')
      .data(bins)
      .enter()
      .append('rect')
      .attr('x', d => xScale(d.x0 ?? 0))
      .attr('y', d => yScale(d.length))
      .attr('width', d => Math.max(0, xScale(d.x1 ?? 0) - xScale(d.x0 ?? 0) - 1))
      .attr('height', d => h - yScale(d.length))
      .attr('fill', '#60a5fa44')
      .attr('stroke', '#60a5fa');

    // GMM 가우시안 오버레이
    if (gmm) {
      const n = magnitudes.length;
      const binWidth = bins[0] ? (xScale(bins[0].x1 ?? 0) - xScale(bins[0].x0 ?? 0)) / (bins[0].x1! - bins[0].x0!) : 1;

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

      drawGaussian(gmm.cluster_a.mean, gmm.cluster_a.std_dev, gmm.cluster_a.weight, '#4ade80');
      drawGaussian(gmm.cluster_b.mean, gmm.cluster_b.std_dev, gmm.cluster_b.weight, '#f5a623');
    }

    // 라벨
    g.append('text').attr('x', w / 2).attr('y', h + 32).attr('text-anchor', 'middle')
      .attr('fill', '#aaa').attr('font-size', 11).text('이동 크기 (°)');
  }, [vectors, gmm]);

  return <svg ref={svgRef} style={{ width: '100%', maxWidth: 400, height: 250 }} />;
}

export default function TrajectoryAnalysis({ onBack, trialId: initialTrialId }: Props) {
  const { trajectoryAnalysis, isLoading, analyzeTrajectory } = useProgressStore();
  const [trialId, setTrialId] = useState(initialTrialId?.toString() ?? '');

  const handleAnalyze = () => {
    const id = parseInt(trialId, 10);
    if (!isNaN(id)) analyzeTrajectory(id);
  };

  const result = trajectoryAnalysis;

  return (
    <div style={{ padding: 32, maxWidth: 1000, margin: '0 auto', color: '#e0e0e0' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={btnStyle}>← 뒤로</button>
        <h2 style={{ margin: 0, fontSize: 22 }}>궤적 분석</h2>
      </div>

      {/* 트라이얼 ID 입력 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: '#aaa' }}>Trial ID:</label>
        <input
          type="number"
          value={trialId}
          onChange={e => setTrialId(e.target.value)}
          style={{
            background: '#2a2a3e', color: '#e0e0e0', border: '1px solid #444',
            borderRadius: 6, padding: '6px 12px', width: 100, fontSize: 13,
          }}
        />
        <button onClick={handleAnalyze} style={{ ...btnStyle, background: '#3b82f6' }} disabled={isLoading}>
          {isLoading ? '분석 중...' : '분석 실행'}
        </button>
        {result && (
          <span style={{ fontSize: 12, color: '#888' }}>
            총 {result.total_clicks}개 클릭 분석됨
          </span>
        )}
      </div>

      {result && (
        <>
          {/* 차트 영역 */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
            {/* 산점도 */}
            <div style={{ background: '#1e1e30', borderRadius: 12, padding: 16 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>클릭 벡터 분포</h3>
              <ClickVectorScatter vectors={result.click_vectors} />
              {/* 범례 */}
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
                {Object.entries(MOTOR_COLORS).map(([region, color]) => (
                  <span key={region} style={{ fontSize: 11, color: '#aaa' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: color, marginRight: 4 }} />
                    {region}
                  </span>
                ))}
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid #e94560', marginRight: 4 }} />
                  overshoot
                </span>
              </div>
            </div>

            {/* GMM 히스토그램 */}
            <div style={{ background: '#1e1e30', borderRadius: 12, padding: 16, flex: 1 }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>이동 크기 분포 (GMM)</h3>
              <GmmHistogram vectors={result.click_vectors} gmm={result.gmm} />
              {result.gmm && (
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 8, textAlign: 'center' }}>
                  분리도: {(result.gmm.separation_score * 100).toFixed(0)}%
                  {result.gmm.bimodal_detected && (
                    <span style={{ color: '#f5a623', marginLeft: 12 }}>이봉 분포 감지</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 감도 진단 */}
          <div style={{ background: '#1e1e30', borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 15, marginBottom: 12 }}>감도 진단</h3>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              <DiagCard
                label="행동 유형"
                value={
                  result.diagnosis.current_behavior === 'overshoot_dominant' ? '오버슈팅 우세' :
                  result.diagnosis.current_behavior === 'undershoot_dominant' ? '언더슈팅 우세' :
                  result.diagnosis.current_behavior === 'balanced' ? '균형' : '데이터 부족'
                }
                color={
                  result.diagnosis.current_behavior === 'balanced' ? '#4ade80' :
                  result.diagnosis.current_behavior === 'insufficient_data' ? '#888' : '#f5a623'
                }
              />
              <DiagCard
                label="일관성"
                value={`${result.diagnosis.consistency_score.toFixed(0)}점`}
                color={result.diagnosis.consistency_score > 70 ? '#4ade80' : '#f5a623'}
              />
              <DiagCard
                label="신뢰도"
                value={`${(result.diagnosis.confidence * 100).toFixed(0)}%`}
                color="#60a5fa"
              />
              {result.diagnosis.recommended_adjustment !== 0 && (
                <DiagCard
                  label="권장 조정"
                  value={`${result.diagnosis.recommended_adjustment > 0 ? '+' : ''}${result.diagnosis.recommended_adjustment.toFixed(1)} cm/360`}
                  color={result.diagnosis.recommended_adjustment > 0 ? '#f5a623' : '#60a5fa'}
                />
              )}
            </div>
            <p style={{ fontSize: 13, color: '#ccc', marginTop: 12, lineHeight: 1.6 }}>
              {result.diagnosis.details}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function DiagCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ flex: '1 1 140px', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#2a2a3e', color: '#e0e0e0', border: 'none',
  borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};
