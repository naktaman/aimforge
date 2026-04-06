/**
 * ZoomProfileChart — 배율 vs k값 프로파일 차트
 * GPChart.tsx 패턴을 따르는 SVG 기반 시각화
 * X축: 줌 배율, Y축: k값
 */
import { useMemo } from 'react';
import { motion } from 'motion/react';
import { UI_COLORS } from '../config/theme';

/** 데이터 포인트 (측정 또는 보간) */
interface ZoomKPoint {
  zoomRatio: number;
  kValue: number;
  isMeasured: boolean;
  label?: string;
}

/** piecewise k 구간 */
interface PiecewiseSegment {
  ratioStart: number;
  ratioEnd: number;
  k: number;
}

interface ZoomProfileChartProps {
  /** 측정 + 보간 포인트 */
  points: ZoomKPoint[];
  /** 글로벌 k (수평 참조선) */
  globalK?: number;
  /** piecewise k 구간 */
  piecewise?: PiecewiseSegment[];
  /** 에이밍 타입별 k (tracking/flicking) */
  aimTypeK?: { kTracking: number; kFlicking: number };
  width?: number;
  height?: number;
}

const PADDING = { top: 20, right: 30, bottom: 45, left: 55 };

/** 축 도메인 계산 */
function computeDomain(points: ZoomKPoint[], globalK?: number) {
  const allX = points.map(p => p.zoomRatio);
  const allY = [
    ...points.map(p => p.kValue),
    ...(globalK != null ? [globalK] : []),
  ];

  if (allX.length === 0) return { xMin: 1, xMax: 12, yMin: 0, yMax: 2 };

  const xMin = Math.max(0.5, Math.floor(Math.min(...allX) - 0.5));
  const xMax = Math.ceil(Math.max(...allX) + 0.5);
  const yMin = Math.max(0, Math.floor((Math.min(...allY) - 0.1) * 10) / 10);
  const yMax = Math.ceil((Math.max(...allY) + 0.2) * 10) / 10;

  return { xMin, xMax, yMin, yMax };
}

export function ZoomProfileChart({
  points,
  globalK,
  piecewise,
  aimTypeK,
  width = 600,
  height = 320,
}: ZoomProfileChartProps) {
  const plotW = width - PADDING.left - PADDING.right;
  const plotH = height - PADDING.top - PADDING.bottom;

  const domain = useMemo(() => computeDomain(points, globalK), [points, globalK]);

  const scaleX = (x: number) =>
    PADDING.left + ((x - domain.xMin) / (domain.xMax - domain.xMin)) * plotW;
  const scaleY = (y: number) =>
    PADDING.top + plotH - ((y - domain.yMin) / (domain.yMax - domain.yMin)) * plotH;

  // X축 눈금 (줌 배율)
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let x = Math.ceil(domain.xMin); x <= domain.xMax; x += 1) {
      ticks.push(x);
    }
    return ticks;
  }, [domain]);

  // Y축 눈금 (k값)
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    const step = domain.yMax - domain.yMin > 1 ? 0.5 : 0.2;
    for (let y = Math.ceil(domain.yMin / step) * step; y <= domain.yMax; y += step) {
      ticks.push(Math.round(y * 100) / 100);
    }
    return ticks;
  }, [domain]);

  // 보간 곡선 경로
  const curvePath = useMemo(() => {
    const sorted = [...points].sort((a, b) => a.zoomRatio - b.zoomRatio);
    if (sorted.length < 2) return '';
    return sorted.map((p, i) =>
      `${i === 0 ? 'M' : 'L'} ${scaleX(p.zoomRatio)} ${scaleY(p.kValue)}`
    ).join(' ');
  }, [points, domain]);

  // piecewise 구간별 경로
  const piecewisePaths = useMemo(() => {
    if (!piecewise || piecewise.length === 0) return [];
    return piecewise.map(seg => ({
      path: `M ${scaleX(seg.ratioStart)} ${scaleY(seg.k)} L ${scaleX(seg.ratioEnd)} ${scaleY(seg.k)}`,
      k: seg.k,
    }));
  }, [piecewise, domain]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ background: '#0f1923', borderRadius: 8 }}
    >
      {/* 그리드 */}
      {xTicks.map(x => (
        <line
          key={`gx-${x}`}
          x1={scaleX(x)} y1={PADDING.top}
          x2={scaleX(x)} y2={PADDING.top + plotH}
          stroke="#1e2d3d" strokeWidth={1}
        />
      ))}
      {yTicks.map(y => (
        <line
          key={`gy-${y}`}
          x1={PADDING.left} y1={scaleY(y)}
          x2={PADDING.left + plotW} y2={scaleY(y)}
          stroke="#1e2d3d" strokeWidth={1}
        />
      ))}

      {/* 글로벌 k 참조선 */}
      {globalK != null && (
        <>
          <line
            x1={PADDING.left} y1={scaleY(globalK)}
            x2={PADDING.left + plotW} y2={scaleY(globalK)}
            stroke={UI_COLORS.accentGold} strokeWidth={1.5} strokeDasharray="6 3"
          />
          <text x={PADDING.left + plotW + 4} y={scaleY(globalK) + 4}
            fill={UI_COLORS.accentGold} fontSize={10}>k={globalK.toFixed(2)}</text>
        </>
      )}

      {/* 에이밍 타입별 k 참조선 */}
      {aimTypeK && (
        <>
          <line
            x1={PADDING.left} y1={scaleY(aimTypeK.kTracking)}
            x2={PADDING.left + plotW} y2={scaleY(aimTypeK.kTracking)}
            stroke={UI_COLORS.successGreen} strokeWidth={1} strokeDasharray="4 4"
          />
          <text x={PADDING.left + 4} y={scaleY(aimTypeK.kTracking) - 4}
            fill={UI_COLORS.successGreen} fontSize={9}>Tracking k={aimTypeK.kTracking.toFixed(2)}</text>
          <line
            x1={PADDING.left} y1={scaleY(aimTypeK.kFlicking)}
            x2={PADDING.left + plotW} y2={scaleY(aimTypeK.kFlicking)}
            stroke={UI_COLORS.dangerRed} strokeWidth={1} strokeDasharray="4 4"
          />
          <text x={PADDING.left + 4} y={scaleY(aimTypeK.kFlicking) - 4}
            fill={UI_COLORS.dangerRed} fontSize={9}>Flicking k={aimTypeK.kFlicking.toFixed(2)}</text>
        </>
      )}

      {/* Piecewise k 구간 */}
      {piecewisePaths.map((seg, i) => (
        <motion.path
          key={`pw-${i}`}
          d={seg.path}
          fill="none" stroke="#c084fc" strokeWidth={2.5}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: i * 0.15 }}
        />
      ))}

      {/* 보간 곡선 */}
      {curvePath && (
        <motion.path
          d={curvePath}
          fill="none" stroke="#38bdf8" strokeWidth={2}
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      )}

      {/* 데이터 포인트 */}
      {points.map((p, i) => (
        <motion.circle
          key={`pt-${i}`}
          cx={scaleX(p.zoomRatio)}
          cy={scaleY(p.kValue)}
          r={p.isMeasured ? 5 : 3.5}
          fill={p.isMeasured ? '#38bdf8' : '#64748b'}
          stroke={p.isMeasured ? '#fff' : '#94a3b8'}
          strokeWidth={p.isMeasured ? 2 : 1}
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.1 * i }}
        />
      ))}

      {/* 포인트 라벨 */}
      {points.filter(p => p.label).map((p, i) => (
        <text
          key={`lbl-${i}`}
          x={scaleX(p.zoomRatio)}
          y={scaleY(p.kValue) - 10}
          fill={UI_COLORS.textPrimary} fontSize={9} textAnchor="middle"
        >{p.label}</text>
      ))}

      {/* X축 */}
      {xTicks.map(x => (
        <text key={`xt-${x}`} x={scaleX(x)} y={PADDING.top + plotH + 18}
          fill={UI_COLORS.textSecondary} fontSize={10} textAnchor="middle">{x}x</text>
      ))}
      <text x={PADDING.left + plotW / 2} y={height - 4}
        fill="#cbd5e1" fontSize={11} textAnchor="middle">줌 배율</text>

      {/* Y축 */}
      {yTicks.map(y => (
        <text key={`yt-${y}`} x={PADDING.left - 8} y={scaleY(y) + 4}
          fill={UI_COLORS.textSecondary} fontSize={10} textAnchor="end">{y.toFixed(1)}</text>
      ))}
      <text x={14} y={PADDING.top + plotH / 2}
        fill="#cbd5e1" fontSize={11} textAnchor="middle"
        transform={`rotate(-90, 14, ${PADDING.top + plotH / 2})`}>k 파라미터</text>

      {/* 범례 */}
      <g transform={`translate(${PADDING.left + 10}, ${PADDING.top + 10})`}>
        <circle cx={0} cy={0} r={4} fill="#38bdf8" stroke="#fff" strokeWidth={1.5} />
        <text x={10} y={4} fill={UI_COLORS.textPrimary} fontSize={9}>측정</text>
        <circle cx={60} cy={0} r={3} fill="#64748b" stroke={UI_COLORS.textSecondary} strokeWidth={1} />
        <text x={70} y={4} fill={UI_COLORS.textPrimary} fontSize={9}>보간</text>
        {piecewise && piecewise.length > 0 && (
          <>
            <line x1={120} y1={0} x2={140} y2={0} stroke="#c084fc" strokeWidth={2.5} />
            <text x={145} y={4} fill={UI_COLORS.textPrimary} fontSize={9}>Piecewise</text>
          </>
        )}
      </g>
    </svg>
  );
}
