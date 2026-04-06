/**
 * Jump Tracking 시나리오 — 점프하는 적 트래킹
 * 오버워치 Genji/Lucio 스타일: 지면-공중-지면 반복
 * 점프 정점/착지 타이밍 예측 + 연속 트래킹
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import type { DifficultyConfig } from '../../../utils/types';
import { STAGE_COLORS } from '../../../config/theme';

/** 점프 패턴 타입 */
type JumpPattern = 'single' | 'double' | 'bunny_hop' | 'wall_jump';

/** 개별 결과 */
interface TrackingResult {
  errorDeg: number;
  timestamp: number;
  phase: 'ground' | 'ascending' | 'peak' | 'descending';
}

export class JumpTrackingScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private durationMs: number;
  private completed = false;
  private startTime = 0;
  private currentTargetId: string | null = null;

  // 점프 물리
  private jumpPattern: JumpPattern;
  private jumpHeight = 2.5; // 기본 점프 높이 (m)
  private jumpDuration = 600; // 점프 주기 (ms)
  private strafeSpeed = 3; // 좌우 이동 속도 (m/s)
  private basePos: THREE.Vector3;

  // 측정 데이터
  private samples: TrackingResult[] = [];
  private sampleInterval = 16;
  private lastSampleTime = 0;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    jumpPattern: JumpPattern = 'single',
    durationMs = 15000,
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.durationMs = durationMs;
    this.jumpPattern = jumpPattern;

    // 난이도별 파라미터 조절
    this.strafeSpeed = difficulty.targetSpeedDegPerSec / 10;
    this.jumpHeight = 1.5 + difficulty.targetSpeedDegPerSec / 20;

    // 기본 위치 — 전방 8~12m
    const dist = 8 + Math.random() * 4;
    this.basePos = new THREE.Vector3(
      (Math.random() - 0.5) * 6,
      1.6,
      -dist,
    );
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.completed = false;
    this.samples = [];
    this.startTime = performance.now();
    this.lastSampleTime = 0;

    // 초기 타겟 스폰
    const target = this.targetManager.spawnTarget(
      this.basePos.clone(),
      {
        angularSizeDeg: this.difficulty.targetSizeDeg,
        distanceM: this.basePos.length(),
        color: STAGE_COLORS.aerialTracking,
      },
    );
    this.currentTargetId = target.id;
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const elapsed = performance.now() - this.startTime;

    // 시간 초과 → 완료
    if (elapsed >= this.durationMs) {
      this.finish();
      return;
    }

    // 타겟 위치 업데이트
    if (this.currentTargetId) {
      const newPos = this.calculatePosition(elapsed);
      this.targetManager.updateTargetPosition(this.currentTargetId, newPos);

      // 트래킹 에러 샘플링
      if (elapsed - this.lastSampleTime >= this.sampleInterval) {
        this.sampleTrackingError(elapsed);
        this.lastSampleTime = elapsed;
      }
    }
  }

  onClick(): void {
    // 트래킹 시나리오 — 클릭 불필요 (연속 추적)
  }

  /** 점프 패턴별 위치 계산 */
  private calculatePosition(elapsedMs: number): THREE.Vector3 {
    const t = elapsedMs / 1000;
    const pos = this.basePos.clone();

    // 좌우 스트레이핑 (기본 이동)
    pos.x += Math.sin(t * this.strafeSpeed * 0.5) * 4;

    // 점프 패턴별 Y 계산
    switch (this.jumpPattern) {
      case 'single': {
        // 단일 점프 — 사인파 기반 (자연스러운 포물선)
        const jumpPhase = (elapsedMs % this.jumpDuration) / this.jumpDuration;
        pos.y += Math.max(0, Math.sin(jumpPhase * Math.PI)) * this.jumpHeight;
        break;
      }

      case 'double': {
        // 더블 점프 — 첫 점프 정점에서 한 번 더
        const phase = (elapsedMs % (this.jumpDuration * 1.5)) / (this.jumpDuration * 1.5);
        if (phase < 0.5) {
          pos.y += Math.sin(phase * 2 * Math.PI) * this.jumpHeight * 0.6;
        } else {
          pos.y += this.jumpHeight * 0.6 + Math.sin((phase - 0.5) * 2 * Math.PI) * this.jumpHeight * 0.4;
        }
        pos.y = Math.max(1.6, pos.y);
        break;
      }

      case 'bunny_hop': {
        // 버니홉 — 빠른 연속 점프 + 가속
        const hopPeriod = this.jumpDuration * 0.6;
        const hopPhase = (elapsedMs % hopPeriod) / hopPeriod;
        pos.y += Math.max(0, Math.sin(hopPhase * Math.PI)) * this.jumpHeight * 0.7;
        // 버니홉 가속 효과
        pos.x += Math.sin(t * this.strafeSpeed * 0.8) * 2;
        break;
      }

      case 'wall_jump': {
        // 월점프 — 벽 터치 후 방향 변환 + 높은 점프
        const cycleDuration = this.jumpDuration * 2;
        const cyclePhase = (elapsedMs % cycleDuration) / cycleDuration;
        if (cyclePhase < 0.4) {
          // 벽으로 접근
          pos.x += cyclePhase * 8;
          pos.y += Math.max(0, Math.sin(cyclePhase * 2.5 * Math.PI)) * this.jumpHeight;
        } else if (cyclePhase < 0.6) {
          // 월점프 (높은 점프)
          const wallPhase = (cyclePhase - 0.4) / 0.2;
          pos.x += 3.2 - wallPhase * 6;
          pos.y += Math.sin(wallPhase * Math.PI) * this.jumpHeight * 1.5;
        } else {
          // 착지 후 이동
          const landPhase = (cyclePhase - 0.6) / 0.4;
          pos.x += -2.8 + landPhase * 2.8;
          pos.y += Math.max(0, Math.sin(landPhase * Math.PI * 0.5) * this.jumpHeight * 0.3);
        }
        break;
      }
    }

    return pos;
  }

  /** 현재 점프 단계 판별 */
  private getJumpPhase(elapsedMs: number): TrackingResult['phase'] {
    const jumpPhase = (elapsedMs % this.jumpDuration) / this.jumpDuration;
    if (jumpPhase < 0.1 || jumpPhase > 0.9) return 'ground';
    if (jumpPhase < 0.4) return 'ascending';
    if (jumpPhase < 0.6) return 'peak';
    return 'descending';
  }

  /** 트래킹 에러 샘플 수집 */
  private sampleTrackingError(timestamp: number): void {
    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    if (hitResult) {
      const errorDeg = hitResult.angularError * (180 / Math.PI);
      this.samples.push({
        errorDeg,
        timestamp,
        phase: this.getJumpPhase(timestamp),
      });
    }
  }

  /** 시나리오 종료 */
  private finish(): void {
    this.completed = true;
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }
    if (this.onCompleteCallback) {
      this.onCompleteCallback(this.getResults());
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    if (this.samples.length === 0) {
      return {
        stageType: 'jump_tracking',
        mad: 999,
        accuracy: 0,
        score: 0,
        samples: 0,
        jumpPattern: this.jumpPattern,
      };
    }

    // MAD (Mean Angular Deviation)
    const mad = this.samples.reduce((s, sample) => s + sample.errorDeg, 0) / this.samples.length;

    // 타겟 이내 비율
    const targetRadDeg = this.difficulty.targetSizeDeg / 2;
    const onTarget = this.samples.filter((s) => s.errorDeg <= targetRadDeg).length;
    const accuracy = onTarget / this.samples.length;

    // 단계별 정확도 분석 — 점프 정점 vs 착지 비교
    const phaseStats: Record<string, { count: number; onTarget: number; avgError: number }> = {};
    for (const s of this.samples) {
      if (!phaseStats[s.phase]) phaseStats[s.phase] = { count: 0, onTarget: 0, avgError: 0 };
      phaseStats[s.phase].count++;
      phaseStats[s.phase].avgError += s.errorDeg;
      if (s.errorDeg <= targetRadDeg) phaseStats[s.phase].onTarget++;
    }
    for (const key of Object.keys(phaseStats)) {
      const ps = phaseStats[key];
      ps.avgError /= ps.count;
    }

    // 점수: accuracy 50% + MAD 역수 30% + 단계별 일관성 20%
    const consistency = Object.values(phaseStats).length > 1
      ? 1 - Math.min(
          Math.max(...Object.values(phaseStats).map((p) => p.avgError))
          - Math.min(...Object.values(phaseStats).map((p) => p.avgError)),
          10,
        ) / 10
      : 0.5;

    const score = accuracy * 50 + (1 - Math.min(mad / 10, 1)) * 30 + consistency * 20;

    return {
      stageType: 'jump_tracking',
      mad,
      accuracy,
      score,
      samples: this.samples.length,
      jumpPattern: this.jumpPattern,
      phaseStats,
      trackingMad: mad,
      durationMs: this.durationMs,
    };
  }
}
