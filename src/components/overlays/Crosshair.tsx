/**
 * 크로스헤어 오버레이
 * CS2/Valorant 스타일 커스터마이징 지원
 * settingsStore의 CrosshairConfig 기반 렌더링
 * SVG로 정밀한 서브픽셀 렌더링
 */
import { useSettingsStore } from '../../stores/settingsStore';
import { CROSSHAIR_COLORS } from '../../config/theme';
import type { CrosshairConfig } from '../../utils/types';

interface CrosshairProps {
  /** props로 직접 설정 전달 (미리보기용) */
  config?: CrosshairConfig;
  /** 다이나믹 스프레드 추가값 (발사 시) */
  dynamicOffset?: number;
}

export function Crosshair({ config: propConfig, dynamicOffset = 0 }: CrosshairProps) {
  const storeConfig = useSettingsStore((s) => s.crosshair);
  const c = propConfig ?? storeConfig;

  // 전체 크기 계산
  const totalLength = c.innerLength + c.outerLength;
  const halfSize = c.gap + totalLength + 4; // 여유 마진
  const size = halfSize * 2;
  const center = halfSize;
  const dynamicGap = c.dynamicEnabled ? c.gap + dynamicOffset : c.gap;

  // 아웃라인 두께
  const ol = c.outlineEnabled ? c.outlineThickness : 0;

  if (c.shape === 'dot') {
    return (
      <div className="crosshair-overlay">
        <svg width={c.dotSize * 2 + 4} height={c.dotSize * 2 + 4}>
          {/* 아웃라인 */}
          {ol > 0 && (
            <circle
              cx={c.dotSize + 2}
              cy={c.dotSize + 2}
              r={c.dotSize + ol}
              fill={c.outlineColor}
            />
          )}
          <circle
            cx={c.dotSize + 2}
            cy={c.dotSize + 2}
            r={c.dotSize}
            fill={c.color}
            opacity={c.opacity}
          />
        </svg>
      </div>
    );
  }

  if (c.shape === 'circle') {
    const r = c.gap;
    const svgSize = r * 2 + c.thickness * 2 + ol * 2 + 4;
    const cx = svgSize / 2;
    const cy = svgSize / 2;
    return (
      <div className="crosshair-overlay">
        <svg width={svgSize} height={svgSize}>
          {/* 아웃라인 링 */}
          {ol > 0 && (
            <circle
              cx={cx} cy={cy} r={r + c.thickness / 2 + ol / 2}
              fill="none"
              stroke={c.outlineColor}
              strokeWidth={c.thickness + ol * 2}
            />
          )}
          {/* 메인 링 */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={c.color}
            strokeWidth={c.thickness}
            opacity={c.opacity}
          />
          {/* 센터 도트 */}
          {c.dotEnabled && (
            <circle cx={cx} cy={cy} r={c.dotSize} fill={c.color} opacity={c.opacity} />
          )}
        </svg>
      </div>
    );
  }

  // cross, t_shape, cross_dot
  const isT = c.shape === 't_shape';

  return (
    <div className="crosshair-overlay">
      <svg width={size} height={size}>
        {/* 아웃라인 레이어 */}
        {ol > 0 && (
          <g>
            {/* 상 (T자에서는 생략) */}
            {!isT && renderLine(center, center - dynamicGap, 0, -1, c.innerLength, c.thickness + ol * 2, c.outlineColor, 1)}
            {/* 하 */}
            {renderLine(center, center + dynamicGap, 0, 1, c.innerLength, c.thickness + ol * 2, c.outlineColor, 1)}
            {/* 좌 */}
            {renderLine(center - dynamicGap, center, -1, 0, c.innerLength, c.thickness + ol * 2, c.outlineColor, 1)}
            {/* 우 */}
            {renderLine(center + dynamicGap, center, 1, 0, c.innerLength, c.thickness + ol * 2, c.outlineColor, 1)}
            {/* 외부선 아웃라인 */}
            {c.outerLength > 0 && (
              <>
                {!isT && renderLine(center, center - dynamicGap - c.innerLength - 2, 0, -1, c.outerLength, c.thickness + ol * 2, c.outlineColor, 1)}
                {renderLine(center, center + dynamicGap + c.innerLength + 2, 0, 1, c.outerLength, c.thickness + ol * 2, c.outlineColor, 1)}
                {renderLine(center - dynamicGap - c.innerLength - 2, center, -1, 0, c.outerLength, c.thickness + ol * 2, c.outlineColor, 1)}
                {renderLine(center + dynamicGap + c.innerLength + 2, center, 1, 0, c.outerLength, c.thickness + ol * 2, c.outlineColor, 1)}
              </>
            )}
          </g>
        )}

        {/* 메인 라인 레이어 */}
        <g>
          {/* 상 (T자에서는 생략) */}
          {!isT && renderLine(center, center - dynamicGap, 0, -1, c.innerLength, c.thickness, c.color, c.opacity)}
          {/* 하 */}
          {renderLine(center, center + dynamicGap, 0, 1, c.innerLength, c.thickness, c.color, c.opacity)}
          {/* 좌 */}
          {renderLine(center - dynamicGap, center, -1, 0, c.innerLength, c.thickness, c.color, c.opacity)}
          {/* 우 */}
          {renderLine(center + dynamicGap, center, 1, 0, c.innerLength, c.thickness, c.color, c.opacity)}

          {/* 외부선 (Valorant 스타일) */}
          {c.outerLength > 0 && (
            <>
              {!isT && renderLine(center, center - dynamicGap - c.innerLength - 2, 0, -1, c.outerLength, c.thickness, c.color, c.opacity * 0.7)}
              {renderLine(center, center + dynamicGap + c.innerLength + 2, 0, 1, c.outerLength, c.thickness, c.color, c.opacity * 0.7)}
              {renderLine(center - dynamicGap - c.innerLength - 2, center, -1, 0, c.outerLength, c.thickness, c.color, c.opacity * 0.7)}
              {renderLine(center + dynamicGap + c.innerLength + 2, center, 1, 0, c.outerLength, c.thickness, c.color, c.opacity * 0.7)}
            </>
          )}
        </g>

        {/* 센터 도트 — cross_dot shape는 dotEnabled 무관하게 항상 표시 */}
        {(c.dotEnabled || c.shape === 'cross_dot') && (
          <>
            {ol > 0 && (
              <circle cx={center} cy={center} r={(c.dotSize || 2) + ol} fill={c.outlineColor} />
            )}
            <circle cx={center} cy={center} r={c.dotSize || 2} fill={c.color} opacity={c.opacity} />
          </>
        )}
      </svg>
    </div>
  );
}

/** SVG 라인 렌더 헬퍼 */
function renderLine(
  startX: number, startY: number,
  dirX: number, dirY: number,
  length: number, thickness: number,
  color: string, opacity: number,
) {
  const w = dirX !== 0 ? length : thickness;
  const h = dirY !== 0 ? length : thickness;
  const x = dirX < 0 ? startX - length : dirX > 0 ? startX : startX - thickness / 2;
  const y = dirY < 0 ? startY - length : dirY > 0 ? startY : startY - thickness / 2;
  return <rect x={x} y={y} width={w} height={h} fill={color} opacity={opacity} />;
}

/** 레거시 호환: 기존 props 인터페이스 지원 */
export function CrosshairLegacy({
  type = 'cross',
  color = CROSSHAIR_COLORS.cs2Default,
  size = 20,
  thickness = 2,
  gap = 4,
}: {
  type?: 'dot' | 'cross' | 'circle';
  color?: string;
  size?: number;
  thickness?: number;
  gap?: number;
}) {
  const config: CrosshairConfig = {
    shape: type === 'dot' ? 'dot' : type === 'circle' ? 'circle' : 'cross',
    innerLength: size / 2 - gap,
    outerLength: 0,
    thickness,
    gap,
    color,
    opacity: 1,
    outlineEnabled: false,
    outlineThickness: 0,
    outlineColor: CROSSHAIR_COLORS.outline,
    dotEnabled: type === 'dot',
    dotSize: thickness,
    dynamicEnabled: false,
    dynamicSpread: 0,
  };
  return <Crosshair config={config} />;
}
