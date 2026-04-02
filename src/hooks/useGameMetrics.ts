/**
 * 인게임 HUD용 실시간 메트릭 수집 훅
 * 게임 플레이 중 히트/미스/점수/시간 등을 쓰로틀링하여 HUD에 전달
 *
 * 구조: zustand 스토어 기반 pub/sub — 시나리오 시작/종료, 샷 이벤트를 외부에서 push
 */
import { create } from 'zustand';

/** HUD에 표시할 실시간 메트릭 */
export interface GameMetrics {
  /** 시나리오 활성 여부 */
  active: boolean;
  /** 시나리오 시작 시각 (ms, performance.now) */
  startTime: number;
  /** 시나리오 총 제한시간 (ms, 0이면 타겟 카운트 기반) */
  durationMs: number;
  /** 남은 시간 (ms) — durationMs > 0일 때만 유효 */
  remainingMs: number;
  /** 경과 시간 (ms) */
  elapsedMs: number;

  /** 총 발사 횟수 */
  shots: number;
  /** 히트 횟수 */
  hits: number;
  /** 헤드샷 횟수 */
  headshots: number;
  /** 실시간 정확도 (0-1) */
  accuracy: number;

  /** 현재 점수 */
  score: number;
  /** 마지막 히트 점수 (팝업용) */
  lastHitScore: number;
  /** 마지막 히트 시각 (팝업 트리거용) */
  lastHitTime: number;

  /** 킬 카운트 (히트 = 킬로 취급, 타겟 제거형 시나리오) */
  kills: number;

  /** 최근 반응시간 (ms) */
  lastReactionTime: number;

  /** 현재 콤보 카운트 */
  comboCount: number;

  /** PB 페이스: 현재 점수 - PB 시점 예상 점수 (양수 = 앞서는 중) */
  pbDelta: number;
  /** 개인 최고 점수 */
  personalBest: number;

  /** Flick 계열: 타겟 진행 (currentTarget / totalTargets) */
  targetProgress: { current: number; total: number } | null;
}

/** HUD 메트릭 이벤트 액션 */
interface GameMetricsActions {
  /** 시나리오 시작 시 호출 — 메트릭 초기화 */
  startSession: (opts: {
    durationMs: number;
    totalTargets?: number;
    personalBest?: number;
  }) => void;
  /** 시나리오 종료 시 호출 */
  endSession: () => void;

  /** 샷 이벤트 (App.tsx의 onShoot에서 호출) */
  recordShot: (opts: {
    hit: boolean;
    headshot: boolean;
    reactionTimeMs?: number;
  }) => void;

  /** 경과 시간 업데이트 (requestAnimationFrame 기반) */
  tick: (nowMs: number) => void;

  /** Flick 계열 타겟 진행 업데이트 */
  updateTargetProgress: (current: number) => void;

  /** 콤보 동기화 (ShootingFeedback에서) */
  syncCombo: (count: number) => void;
}

/** 히트 점수 계산 (body=100, headshot=200) */
const HIT_SCORE = 100;
const HEADSHOT_BONUS = 100;

/** 초기 상태 */
const initialMetrics: GameMetrics = {
  active: false,
  startTime: 0,
  durationMs: 0,
  remainingMs: 0,
  elapsedMs: 0,
  shots: 0,
  hits: 0,
  headshots: 0,
  accuracy: 0,
  score: 0,
  lastHitScore: 0,
  lastHitTime: 0,
  kills: 0,
  lastReactionTime: 0,
  comboCount: 0,
  pbDelta: 0,
  personalBest: 0,
  targetProgress: null,
};

/** 메트릭 업데이트 쓰로틀 간격 (100ms = 10Hz) */
const THROTTLE_INTERVAL = 100;

export const useGameMetricsStore = create<GameMetrics & GameMetricsActions>(
  (set, get) => ({
    ...initialMetrics,

    startSession: ({ durationMs, totalTargets, personalBest }) => {
      set({
        ...initialMetrics,
        active: true,
        startTime: performance.now(),
        durationMs,
        remainingMs: durationMs,
        personalBest: personalBest ?? 0,
        targetProgress: totalTargets
          ? { current: 0, total: totalTargets }
          : null,
      });
    },

    endSession: () => {
      set({ active: false });
    },

    recordShot: ({ hit, headshot, reactionTimeMs }) => {
      const s = get();
      if (!s.active) return;

      const newShots = s.shots + 1;
      const newHits = s.hits + (hit ? 1 : 0);
      const newHeadshots = s.headshots + (headshot ? 1 : 0);
      const accuracy = newShots > 0 ? newHits / newShots : 0;

      let addedScore = 0;
      if (hit) {
        addedScore = HIT_SCORE + (headshot ? HEADSHOT_BONUS : 0);
      }
      const newScore = s.score + addedScore;

      // PB 페이스 (시간 기반 보간)
      let pbDelta = 0;
      if (s.personalBest > 0 && s.durationMs > 0 && s.elapsedMs > 0) {
        const expectedPace = s.personalBest * (s.elapsedMs / s.durationMs);
        pbDelta = newScore - expectedPace;
      }

      set({
        shots: newShots,
        hits: newHits,
        headshots: newHeadshots,
        accuracy,
        score: newScore,
        lastHitScore: addedScore > 0 ? addedScore : s.lastHitScore,
        lastHitTime: addedScore > 0 ? performance.now() : s.lastHitTime,
        kills: s.kills + (hit ? 1 : 0),
        lastReactionTime: reactionTimeMs ?? s.lastReactionTime,
        pbDelta,
      });
    },

    tick: (nowMs: number) => {
      const s = get();
      if (!s.active) return;

      const elapsedMs = nowMs - s.startTime;
      const remainingMs = s.durationMs > 0
        ? Math.max(0, s.durationMs - elapsedMs)
        : 0;

      set({ elapsedMs, remainingMs });
    },

    updateTargetProgress: (current: number) => {
      const s = get();
      if (!s.active || !s.targetProgress) return;
      set({ targetProgress: { ...s.targetProgress, current } });
    },

    syncCombo: (count: number) => {
      set({ comboCount: count });
    },
  }),
);

/**
 * HUD 쓰로틀링 훅 — 10Hz로 메트릭 스냅샷 제공
 * 고주파 업데이트를 리렌더 최소화하며 전달
 */
import { useRef, useCallback, useEffect, useState } from 'react';

export function useThrottledMetrics(): GameMetrics {
  const [snapshot, setSnapshot] = useState<GameMetrics>(initialMetrics);
  const lastUpdate = useRef(0);
  const rafRef = useRef(0);

  const updateLoop = useCallback(() => {
    const now = performance.now();
    const store = useGameMetricsStore.getState();

    // tick 업데이트 (시간 경과)
    if (store.active) {
      store.tick(now);
    }

    // 쓰로틀링: 100ms마다 스냅샷 갱신
    if (now - lastUpdate.current >= THROTTLE_INTERVAL) {
      lastUpdate.current = now;
      const {
        startSession: _, endSession: __, recordShot: ___,
        tick: ____, updateTargetProgress: _____,
        syncCombo: ______, ...metrics
      } = useGameMetricsStore.getState();
      setSnapshot(metrics);
    }

    rafRef.current = requestAnimationFrame(updateLoop);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [updateLoop]);

  return snapshot;
}
