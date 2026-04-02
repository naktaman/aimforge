/**
 * 인게임 HUD 메인 컨테이너
 * Three.js 캔버스 위에 React 오버레이로 표시
 *
 * 레이아웃:
 *   [좌상단: 정확도]  [상단 중앙: 타이머]  [우상단: 점수]
 *   [       중앙 20-30% Sacred Zone — HUD 배치 금지        ]
 *   [                                    ] [우하단: Stats  ]
 *
 * z-index: 28 (Crosshair 20, Fire Mode 25 위, ShootingFeedback 30 아래)
 */
import { useThrottledMetrics } from '../../hooks/useGameMetrics';
import { HUDTimer } from './HUDTimer';
import { HUDScore } from './HUDScore';
import { HUDAccuracy } from './HUDAccuracy';
import { HUDStats } from './HUDStats';

export function GameHUD() {
  const metrics = useThrottledMetrics();

  // 시나리오 비활성 시 미표시
  if (!metrics.active) return null;

  return (
    <div className="game-hud">
      {/* Tier 1 — 항상 표시 */}
      <div className="game-hud-top">
        <HUDAccuracy metrics={metrics} />
        <HUDTimer metrics={metrics} />
        <HUDScore metrics={metrics} />
      </div>

      {/* Tier 2 — 우하단 통계 */}
      <div className="game-hud-bottom">
        <HUDStats metrics={metrics} />
      </div>
    </div>
  );
}
