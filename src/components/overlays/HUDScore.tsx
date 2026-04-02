/**
 * HUD 점수 — 우상단
 * 현재 점수 + 히트 시 팝업 애니메이션
 * ShootingFeedback의 score popup과 역할 분담:
 *   - ShootingFeedback: 화면 중앙 즉시 반응 팝업 (600ms 페이드)
 *   - HUDScore: 우상단 누적 점수 + 작은 점수 변화 표시
 */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type { GameMetrics } from '../../hooks/useGameMetrics';

interface Props {
  metrics: GameMetrics;
}

/** 점수 변화 팝업 */
interface ScoreFlash {
  id: number;
  points: number;
  isHeadshot: boolean;
}

let flashId = 0;

export function HUDScore({ metrics }: Props) {
  const [flashes, setFlashes] = useState<ScoreFlash[]>([]);
  const prevScoreRef = useRef(0);
  const prevHitTimeRef = useRef(0);

  // 점수 변화 감지 → 플래시 팝업 생성
  useEffect(() => {
    if (
      metrics.lastHitTime > prevHitTimeRef.current &&
      metrics.lastHitScore > 0
    ) {
      prevHitTimeRef.current = metrics.lastHitTime;
      const id = ++flashId;
      setFlashes((prev) => [
        ...prev,
        {
          id,
          points: metrics.lastHitScore,
          isHeadshot: metrics.lastHitScore > 100,
        },
      ]);
      // 500ms 후 제거
      setTimeout(() => {
        setFlashes((prev) => prev.filter((f) => f.id !== id));
      }, 500);
    }
    prevScoreRef.current = metrics.score;
  }, [metrics.lastHitTime, metrics.lastHitScore, metrics.score]);

  return (
    <div className="hud-score">
      {/* 점수 변화 플래시 */}
      <AnimatePresence>
        {flashes.map((flash) => (
          <motion.div
            key={flash.id}
            className={`hud-score-flash ${flash.isHeadshot ? 'hud-score-flash-headshot' : ''}`}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -20 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            +{flash.points}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* 메인 점수 */}
      <motion.div
        className="hud-score-value"
        key={metrics.score}
        initial={{ scale: 1.15 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.15 }}
      >
        {metrics.score.toLocaleString()}
      </motion.div>

      <div className="hud-score-label">SCORE</div>
    </div>
  );
}
