/**
 * 크로스헤어 오버레이
 * dot / cross / circle 타입 지원
 * Three.js 캔버스 위에 CSS로 렌더링
 */

interface CrosshairProps {
  type?: 'dot' | 'cross' | 'circle';
  color?: string;
  size?: number;
  thickness?: number;
  gap?: number;
}

export function Crosshair({
  type = 'cross',
  color = '#4ade80',
  size = 20,
  thickness = 2,
  gap = 4,
}: CrosshairProps) {
  const center = size / 2;

  if (type === 'dot') {
    return (
      <div className="crosshair-overlay">
        <div
          style={{
            width: thickness * 2,
            height: thickness * 2,
            borderRadius: '50%',
            backgroundColor: color,
            boxShadow: `0 0 4px ${color}`,
          }}
        />
      </div>
    );
  }

  if (type === 'circle') {
    return (
      <div className="crosshair-overlay">
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `${thickness}px solid ${color}`,
            boxShadow: `0 0 4px ${color}`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            width: thickness,
            height: thickness,
            borderRadius: '50%',
            backgroundColor: color,
          }}
        />
      </div>
    );
  }

  // cross 타입 (기본)
  return (
    <svg
      className="crosshair-overlay"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
    >
      {/* 상 */}
      <rect
        x={center - thickness / 2}
        y={0}
        width={thickness}
        height={center - gap}
        fill={color}
      />
      {/* 하 */}
      <rect
        x={center - thickness / 2}
        y={center + gap}
        width={thickness}
        height={center - gap}
        fill={color}
      />
      {/* 좌 */}
      <rect
        x={0}
        y={center - thickness / 2}
        width={center - gap}
        height={thickness}
        fill={color}
      />
      {/* 우 */}
      <rect
        x={center + gap}
        y={center - thickness / 2}
        width={center - gap}
        height={thickness}
        fill={color}
      />
    </svg>
  );
}
