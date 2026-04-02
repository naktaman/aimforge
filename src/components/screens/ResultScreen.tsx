/**
 * 결과 화면 — 3-Zone 감정 디자인
 * Hero Zone (등급+점수) → Analytics Zone (통계) → Action Zone (CTA)
 * PB 감지 시 컨페티 + 배너 표시
 */
import { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useGameMetricsStore, type GameMetrics } from '../../hooks/useGameMetrics';
import { useSessionStore } from '../../stores/sessionStore';
import { ResultGrade, getGrade } from './ResultGrade';
import { ResultStats } from './ResultStats';
import { ResultActions } from './ResultActions';

/** PB 저장 키 생성 — 시나리오별 최고 점수를 localStorage에 저장 */
function pbKey(scenarioType: string): string {
  return `aimforge_pb_${scenarioType}`;
}

/** PB 확인 및 갱신 — 신기록이면 true 반환 */
function checkAndUpdatePB(scenarioType: string, score: number): boolean {
  const key = pbKey(scenarioType);
  const prev = parseFloat(localStorage.getItem(key) ?? '0');
  if (score > prev) {
    localStorage.setItem(key, String(score));
    return prev > 0; // 첫 기록은 PB 배너 미표시
  }
  return false;
}

/** 점수 카운트업 훅 — 0에서 target까지 duration(ms) 동안 보간 */
function useCountUp(target: number, duration: number, delay: number): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const animate = (now: number) => {
        if (startRef.current === null) startRef.current = now;
        const elapsed = now - startRef.current;
        const progress = Math.min(elapsed / duration, 1);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) rafRef.current = requestAnimationFrame(animate);
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return value;
}

/** 컨페티 파티클 생성 (CSS 기반 경량 구현) */
function Confetti() {
  const particles = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      delay: Math.random() * 0.8,
      duration: 1.5 + Math.random() * 1.5,
      color: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A'][i % 5],
      size: 6 + Math.random() * 6,
      rotation: Math.random() * 360,
    })),
    [],
  );

  return (
    <div className="result-confetti" aria-hidden="true">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="result-confetti__particle"
          style={{
            left: p.left,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
          initial={{ y: -20, opacity: 1, rotate: p.rotation }}
          animate={{ y: '100vh', opacity: 0, rotate: p.rotation + 360 + Math.random() * 360 }}
          transition={{ duration: p.duration, delay: 2.5 + p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
}

interface ResultScreenProps {
  onRetry: () => void;
  onMainMenu: () => void;
  /** 등급 공개 시 사운드 재생용 콜백 */
  onGradeReveal?: () => void;
  /** PB 시 팡파르 콜백 */
  onPBFanfare?: () => void;
}

export function ResultScreen({ onRetry, onMainMenu, onGradeReveal, onPBFanfare }: ResultScreenProps) {
  const { scenarioType } = useSessionStore();

  /** 게임 종료 시점의 메트릭 스냅샷 (마운트 시 1회 캡처) */
  const metricsRef = useRef<GameMetrics | null>(null);
  if (!metricsRef.current) {
    const { startSession: _, endSession: __, recordShot: ___, tick: ____, updateTargetProgress: _____, syncCombo: ______, ...snapshot } =
      useGameMetricsStore.getState();
    metricsRef.current = snapshot;
  }
  const metrics = metricsRef.current;

  /** PB 여부 확인 */
  const [isNewPB, setIsNewPB] = useState(false);
  useEffect(() => {
    if (scenarioType && metrics.score > 0) {
      const isPB = checkAndUpdatePB(scenarioType, metrics.score);
      setIsNewPB(isPB);
    }
  }, [scenarioType, metrics.score]);

  /** 등급 공개 사운드 (0.5초 딜레이 후) */
  const soundPlayed = useRef(false);
  useEffect(() => {
    if (soundPlayed.current) return;
    soundPlayed.current = true;
    const t1 = setTimeout(() => onGradeReveal?.(), 500);
    const t2 = isNewPB ? setTimeout(() => onPBFanfare?.(), 2500) : undefined;
    return () => {
      clearTimeout(t1);
      if (t2) clearTimeout(t2);
    };
  }, [onGradeReveal, onPBFanfare, isNewPB]);

  /** 점수 카운트업 (1.0~2.5초 구간) */
  const displayScore = useCountUp(metrics.score, 1500, 1000);

  /** 통계 항목 구성 */
  const stats = useMemo(() => {
    const items = [
      { label: '정확도', value: `${(metrics.accuracy * 100).toFixed(1)}%`, ratio: metrics.accuracy },
      { label: '히트 / 샷', value: `${metrics.hits} / ${metrics.shots}` },
    ];
    // 헤드샷 비율 (humanoid 모드에서만 의미 있음)
    if (metrics.headshots > 0) {
      const hsRatio = metrics.hits > 0 ? metrics.headshots / metrics.hits : 0;
      items.push({ label: '헤드샷 비율', value: `${(hsRatio * 100).toFixed(1)}%`, ratio: hsRatio });
    }
    if (metrics.lastReactionTime > 0) {
      items.push({ label: '평균 반응시간', value: `${metrics.lastReactionTime.toFixed(0)}ms` });
    }
    if (metrics.comboCount > 0) {
      items.push({ label: '최고 콤보', value: `${metrics.comboCount}` });
    }
    items.push({ label: '킬 수', value: `${metrics.kills}` });
    return items;
  }, [metrics]);

  const grade = getGrade(metrics.accuracy);

  return (
    <div className="result-screen">
      {/* PB 컨페티 */}
      <AnimatePresence>{isNewPB && <Confetti />}</AnimatePresence>

      {/* ── Hero Zone (상단 40%) ── */}
      <div className="result-screen__hero">
        <ResultGrade accuracy={metrics.accuracy} />

        {/* 점수 카운트업 */}
        <motion.div
          className="result-screen__score"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.3 }}
        >
          <span className="result-screen__score-number">{displayScore.toLocaleString()}</span>
          <span className="result-screen__score-label">SCORE</span>
        </motion.div>

        {/* PB 배너 */}
        <AnimatePresence>
          {isNewPB && (
            <motion.div
              className="result-screen__pb-banner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: [0.8, 1.1, 1] }}
              exit={{ opacity: 0 }}
              transition={{ delay: 2.5, duration: 0.6, times: [0, 0.6, 1] }}
              style={{ color: grade.color }}
            >
              NEW PERSONAL BEST!
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Analytics Zone (중간 40%) ── */}
      <div className="result-screen__analytics">
        <ResultStats stats={stats} />
      </div>

      {/* ── Action Zone (하단 20%) ── */}
      <div className="result-screen__actions">
        <ResultActions onRetry={onRetry} onMainMenu={onMainMenu} />
      </div>
    </div>
  );
}
