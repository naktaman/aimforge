/**
 * 스코프 오버레이
 * 줌 레벨에 따라 CSS 마스크/비네팅/블러 적용
 * 1x: 레드닷, 2x~3x: 원형 마스크, 4x~6x: 좁은 마스크+비네팅, 6x+: 스나이퍼
 */
import { UI_COLORS } from '../../config/theme';

interface ScopeOverlayProps {
  zoomLevel: number; // 1, 2, 3, 4, 6, 8 등
  active: boolean;
}

export function ScopeOverlay({ zoomLevel, active }: ScopeOverlayProps) {
  if (!active || zoomLevel <= 1) return null;

  // 줌 레벨에 따른 스코프 스타일 결정
  if (zoomLevel <= 1.5) {
    return <RedDotScope />;
  }
  if (zoomLevel <= 3) {
    return <MediumScope zoomLevel={zoomLevel} />;
  }
  if (zoomLevel <= 6) {
    return <HighScope zoomLevel={zoomLevel} />;
  }
  return <SniperScope />;
}

/** 1x 레드닷: 작은 빨간 점 + 얇은 원형 테두리 */
function RedDotScope() {
  return (
    <div className="scope-overlay">
      {/* 렌즈 테두리 */}
      <div
        style={{
          width: '40vh',
          height: '40vh',
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          position: 'absolute',
        }}
      />
      {/* 레드 도트 */}
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: UI_COLORS.scopeRedDot,
          boxShadow: `0 0 8px ${UI_COLORS.scopeRedDot}, 0 0 16px rgba(255,51,51,0.5)`,
          position: 'absolute',
        }}
      />
    </div>
  );
}

/** 2x~3x: 원형 마스크 (바깥 영역 어둡게) */
function MediumScope({ zoomLevel }: { zoomLevel: number }) {
  // 줌이 높을수록 원이 작아짐
  const radiusPct = 60 - (zoomLevel - 2) * 10;
  return (
    <div className="scope-overlay">
      {/* 원형 마스크 (radial-gradient) */}
      <div
        className="scope-mask"
        style={{
          background: `radial-gradient(circle ${radiusPct}vh at 50% 50%, transparent 90%, rgba(0,0,0,0.6) 100%)`,
        }}
      />
      {/* 크로스헤어 */}
      <svg
        className="scope-reticle"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
      >
        <line x1="50" y1="20" x2="50" y2="45" stroke="white" strokeWidth="0.3" />
        <line x1="50" y1="55" x2="50" y2="80" stroke="white" strokeWidth="0.3" />
        <line x1="20" y1="50" x2="45" y2="50" stroke="white" strokeWidth="0.3" />
        <line x1="55" y1="50" x2="80" y2="50" stroke="white" strokeWidth="0.3" />
      </svg>
    </div>
  );
}

/** 4x~6x: 좁은 원형 마스크 + 비네팅 강화 */
function HighScope({ zoomLevel }: { zoomLevel: number }) {
  const radiusPct = 40 - (zoomLevel - 4) * 5;
  return (
    <div className="scope-overlay">
      <div
        className="scope-mask"
        style={{
          background: `radial-gradient(circle ${radiusPct}vh at 50% 50%, transparent 85%, rgba(0,0,0,0.4) 92%, rgba(0,0,0,0.85) 100%)`,
        }}
      />
      {/* 밀도트 레티클 */}
      <svg
        className="scope-reticle"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
      >
        <line x1="50" y1="10" x2="50" y2="46" stroke="white" strokeWidth="0.2" />
        <line x1="50" y1="54" x2="50" y2="90" stroke="white" strokeWidth="0.2" />
        <line x1="10" y1="50" x2="46" y2="50" stroke="white" strokeWidth="0.2" />
        <line x1="54" y1="50" x2="90" y2="50" stroke="white" strokeWidth="0.2" />
        {/* 밀도트 마커 */}
        {[25, 35, 65, 75].map((pos) => (
          <circle key={`h${pos}`} cx={pos} cy="50" r="0.5" fill="white" />
        ))}
        {[25, 35, 65, 75].map((pos) => (
          <circle key={`v${pos}`} cx="50" cy={pos} r="0.5" fill="white" />
        ))}
      </svg>
    </div>
  );
}

/** 6x+: 스나이퍼 스코프 */
function SniperScope() {
  return (
    <div className="scope-overlay">
      {/* 좁은 시야 + 두꺼운 검은 테두리 */}
      <div
        className="scope-mask"
        style={{
          background: `radial-gradient(circle 25vh at 50% 50%, transparent 80%, rgba(0,0,0,0.3) 85%, rgba(0,0,0,0.95) 100%)`,
        }}
      />
      {/* 가장자리 블러 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          width: '50vh',
          height: '50vh',
          margin: 'auto',
          boxShadow: 'inset 0 0 60px 20px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}
      />
      {/* 스나이퍼 레티클 */}
      <svg
        className="scope-reticle"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
      >
        <line x1="50" y1="0" x2="50" y2="47" stroke="white" strokeWidth="0.15" />
        <line x1="50" y1="53" x2="50" y2="100" stroke="white" strokeWidth="0.15" />
        <line x1="0" y1="50" x2="47" y2="50" stroke="white" strokeWidth="0.15" />
        <line x1="53" y1="50" x2="100" y2="50" stroke="white" strokeWidth="0.15" />
        {/* BDC 마커 */}
        {[55, 60, 65, 70, 80].map((pos) => (
          <line
            key={pos}
            x1="48"
            y1={pos}
            x2="52"
            y2={pos}
            stroke="white"
            strokeWidth="0.2"
          />
        ))}
      </svg>
    </div>
  );
}
