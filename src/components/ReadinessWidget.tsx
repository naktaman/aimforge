/**
 * Game Readiness Score 게이지 위젯
 * D3 arc로 0~100 게이지 렌더링 + 카테고리/어드바이스 표시
 */
import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { ReadinessResult } from '../utils/types';

interface Props {
  result: ReadinessResult | null;
  /** 측정 시작 콜백 */
  onMeasure?: () => void;
}

/** 카테고리별 색상 */
const CATEGORY_COLORS: Record<string, string> = {
  peak: '#4ade80',
  ready: '#60a5fa',
  moderate: '#f5a623',
  rest: '#e94560',
};

const CATEGORY_LABELS: Record<string, string> = {
  peak: '최상',
  ready: '양호',
  moderate: '보통',
  rest: '휴식 권장',
};

export default function ReadinessWidget({ result, onMeasure }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 200;
    const height = 140;
    const outerRadius = 80;
    const innerRadius = 60;
    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.75;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height - 20})`);

    // 배경 arc
    const bgArc = d3.arc<unknown>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle)
      .endAngle(endAngle);

    g.append('path')
      .attr('d', bgArc({}) as string)
      .attr('fill', '#2a2a3e');

    // 값 arc
    const score = result?.score ?? 0;
    const scoreAngle = startAngle + (endAngle - startAngle) * (score / 100);
    const color = result ? (CATEGORY_COLORS[result.category] || '#888') : '#888';

    const valueArc = d3.arc<unknown>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle)
      .endAngle(scoreAngle)
      .cornerRadius(4);

    g.append('path')
      .attr('d', valueArc({}) as string)
      .attr('fill', color);

    // 점수 텍스트
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', -20)
      .attr('fill', color)
      .attr('font-size', 32)
      .attr('font-weight', 700)
      .text(Math.round(score));

    // 카테고리 라벨
    if (result) {
      g.append('text')
        .attr('text-anchor', 'middle')
        .attr('y', 5)
        .attr('fill', '#aaa')
        .attr('font-size', 12)
        .text(CATEGORY_LABELS[result.category] || '');
    }
  }, [result]);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg ref={svgRef} style={{ width: 200, height: 140 }} />
      {result && (
        <p style={{ color: '#ccc', fontSize: 13, margin: '8px 0', maxWidth: 220 }}>
          {result.dailyAdvice}
        </p>
      )}
      {onMeasure && (
        <button
          onClick={onMeasure}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 20px', cursor: 'pointer',
            fontSize: 13, fontWeight: 500, marginTop: 8,
          }}
        >
          2분 측정하기
        </button>
      )}
    </div>
  );
}
