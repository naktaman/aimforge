/**
 * Aim DNA Scan 시나리오 — 2분 종합 평가
 * Game Readiness Score 대체
 * 축약 배터리: Static Flick 10발 + Tracking 15초 + Multi-Flick 1웨이브 + Close Range 5발
 * DNA 프로파일 업데이트 및 약점 진단용
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import { TARGET_COLORS } from '../../../config/theme';

/** 평가 단계 */
type ScanPhase = 'flick' | 'tracking' | 'multi' | 'close' | 'done';

/** 단계별 결과 */
interface PhaseResult {
  phase: ScanPhase;
  score: number;
  accuracy: number;
  avgReactionMs: number;
  trackingMad?: number;
}

export class AimDnaScanScenario extends Scenario {
  private currentPhase: ScanPhase = 'flick';
  private phaseResults: PhaseResult[] = [];
  private completed = false;
  private phaseStartTime = 0;

  // 간이 Flick 상태
  private flickCount = 0;
  private flickHits = 0;
  private flickReactions: number[] = [];
  private flickTargetId: string | null = null;
  private flickTargetTime = 0;

  // 간이 Tracking 상태
  private trackingSamples: number[] = [];
  private trackingTargetId: string | null = null;
  private lastSampleTime = 0;
  private trackingDurationMs = 15000;

  // 간이 Multi-Flick 상태
  private multiTargetIds: string[] = [];
  private multiKills = 0;
  private multiStartTime = 0;

  // 간이 Close Range 상태
  private closeCount = 0;
  private closeHits = 0;
  private closeReactions: number[] = [];
  private closeTargetId: string | null = null;
  private closeTargetTime = 0;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(engine: GameEngine, targetManager: TargetManager) {
    super(engine, targetManager);
  }

  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  start(): void {
    this.currentPhase = 'flick';
    this.completed = false;
    this.phaseResults = [];
    this.phaseStartTime = performance.now();

    // Flick Phase 시작
    this.flickCount = 0;
    this.flickHits = 0;
    this.flickReactions = [];
    this.spawnFlickTarget();
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const now = performance.now();

    switch (this.currentPhase) {
      case 'flick':
        // Flick 타임아웃 (3초)
        if (this.flickTargetId && now - this.flickTargetTime > 3000) {
          this.flickCount++;
          this.targetManager.removeTarget(this.flickTargetId);
          this.flickTargetId = null;
          if (this.flickCount >= 10) {
            this.endFlickPhase();
          } else {
            this.spawnFlickTarget();
          }
        }
        break;

      case 'tracking':
        // 트래킹 샘플 수집 (16ms 간격)
        if (this.trackingTargetId && now - this.lastSampleTime >= 16) {
          const camera = this.engine.getCamera();
          const forward = this.engine.getCameraForward();
          const hitResult = this.targetManager.checkHit(camera.position, forward);
          if (hitResult) {
            this.trackingSamples.push(hitResult.angularError * (180 / Math.PI));
          }
          this.lastSampleTime = now;

          // 타겟 이동 (수평 사인파)
          const elapsed = (now - this.phaseStartTime) / 1000;
          const x = Math.sin(elapsed * 1.5) * 5;
          const pos = new THREE.Vector3(x, 1.6, -12);
          this.targetManager.updateTargetPosition(this.trackingTargetId, pos);
        }

        // 트래킹 종료
        if (now - this.phaseStartTime > this.trackingDurationMs) {
          this.endTrackingPhase();
        }
        break;

      case 'multi':
        // Multi 타임아웃 (8초)
        if (now - this.multiStartTime > 8000) {
          this.endMultiPhase();
        }
        break;

      case 'close':
        // Close Range 타임아웃 (2초)
        if (this.closeTargetId && now - this.closeTargetTime > 2000) {
          this.closeCount++;
          this.targetManager.removeTarget(this.closeTargetId);
          this.closeTargetId = null;
          if (this.closeCount >= 5) {
            this.endClosePhase();
          } else {
            this.spawnCloseTarget();
          }
        }
        break;
    }
  }

  onClick(): void {
    if (this.completed) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);
    const now = performance.now();

    switch (this.currentPhase) {
      case 'flick':
        if (this.flickTargetId) {
          if (hitResult?.hit) {
            this.flickHits++;
            this.flickReactions.push(now - this.flickTargetTime);
          }
          this.flickCount++;
          this.targetManager.removeTarget(this.flickTargetId);
          this.flickTargetId = null;
          if (this.flickCount >= 10) {
            this.endFlickPhase();
          } else {
            this.spawnFlickTarget();
          }
        }
        break;

      case 'multi':
        if (hitResult?.hit && this.multiTargetIds.includes(hitResult.targetId)) {
          this.targetManager.removeTarget(hitResult.targetId);
          this.multiTargetIds = this.multiTargetIds.filter((id) => id !== hitResult.targetId);
          this.multiKills++;
          if (this.multiTargetIds.length === 0) {
            this.endMultiPhase();
          }
        }
        break;

      case 'close':
        if (this.closeTargetId) {
          if (hitResult?.hit) {
            this.closeHits++;
            this.closeReactions.push(now - this.closeTargetTime);
          }
          this.closeCount++;
          this.targetManager.removeTarget(this.closeTargetId);
          this.closeTargetId = null;
          if (this.closeCount >= 5) {
            this.endClosePhase();
          } else {
            this.spawnCloseTarget();
          }
        }
        break;
    }
  }

  // ── 스폰 헬퍼 ──

  private spawnFlickTarget(): void {
    // 120° 방위각 제한 (±60°)
    const azimuth = (Math.random() * 120) - 60;
    const DEG2RAD = Math.PI / 180;
    const d = 12;
    const pos = new THREE.Vector3(
      d * Math.sin(azimuth * DEG2RAD),
      1.6 + (Math.random() - 0.5) * 3,
      -d * Math.cos(azimuth * DEG2RAD),
    );
    const target = this.targetManager.spawnTarget(pos, {
      angularSizeDeg: 3.0,
      distanceM: d,
      color: TARGET_COLORS.flickRed,
    });
    this.flickTargetId = target.id;
    this.flickTargetTime = performance.now();
  }

  private spawnCloseTarget(): void {
    // 근거리 + 큰 각도
    // 120° 방위각 제한 (±60°)
    const azimuth = (Math.random() * 120) - 60;
    const DEG2RAD = Math.PI / 180;
    const d = 3 + Math.random() * 3;
    const pos = new THREE.Vector3(
      d * Math.sin(azimuth * DEG2RAD),
      1.6 + (Math.random() - 0.5) * 1,
      -d * Math.cos(azimuth * DEG2RAD),
    );
    const target = this.targetManager.spawnTarget(pos, {
      angularSizeDeg: 5.0,
      distanceM: d,
      color: TARGET_COLORS.alertRed,
    });
    this.closeTargetId = target.id;
    this.closeTargetTime = performance.now();
  }

  // ── Phase 종료 ──

  private endFlickPhase(): void {
    const accuracy = this.flickCount > 0 ? this.flickHits / this.flickCount : 0;
    const avgReaction = this.flickReactions.length > 0
      ? this.flickReactions.reduce((a, b) => a + b, 0) / this.flickReactions.length : 0;

    this.phaseResults.push({
      phase: 'flick',
      score: accuracy * 60 + (1 - Math.min(avgReaction / 2000, 1)) * 40,
      accuracy,
      avgReactionMs: avgReaction,
    });

    // Tracking Phase 시작
    this.currentPhase = 'tracking';
    this.phaseStartTime = performance.now();
    this.trackingSamples = [];
    this.lastSampleTime = 0;

    const target = this.targetManager.spawnTarget(
      new THREE.Vector3(0, 1.6, -12),
      { angularSizeDeg: 3.5, distanceM: 12, color: TARGET_COLORS.trackingTeal },
    );
    this.trackingTargetId = target.id;
  }

  private endTrackingPhase(): void {
    if (this.trackingTargetId) {
      this.targetManager.removeTarget(this.trackingTargetId);
      this.trackingTargetId = null;
    }

    const mad = this.trackingSamples.length > 0
      ? this.trackingSamples.reduce((a, b) => a + b, 0) / this.trackingSamples.length : 999;

    this.phaseResults.push({
      phase: 'tracking',
      score: (1 - Math.min(mad / 10, 1)) * 100,
      accuracy: this.trackingSamples.filter((s) => s < 1.5).length / Math.max(this.trackingSamples.length, 1),
      avgReactionMs: 0,
      trackingMad: mad,
    });

    // Multi Phase 시작
    this.currentPhase = 'multi';
    this.multiKills = 0;
    this.multiStartTime = performance.now();
    this.multiTargetIds = [];

    const DEG2RAD = Math.PI / 180;
    for (let i = 0; i < 4; i++) {
      const yaw = (i * 90 - 135) * DEG2RAD;
      const d = 10;
      const pos = new THREE.Vector3(d * Math.sin(yaw), 1.6, -d * Math.cos(yaw));
      const target = this.targetManager.spawnTarget(pos, {
        angularSizeDeg: 3.0,
        distanceM: d,
        color: TARGET_COLORS.flickRed,
      });
      this.multiTargetIds.push(target.id);
    }
  }

  private endMultiPhase(): void {
    // 남은 타겟 제거
    for (const id of this.multiTargetIds) {
      this.targetManager.removeTarget(id);
    }

    const elapsed = performance.now() - this.multiStartTime;

    this.phaseResults.push({
      phase: 'multi',
      score: (this.multiKills / 4) * 60 + (1 - Math.min(elapsed / 8000, 1)) * 40,
      accuracy: this.multiKills / 4,
      avgReactionMs: this.multiKills > 0 ? elapsed / this.multiKills : 8000,
    });

    this.multiTargetIds = [];

    // Close Range Phase 시작
    this.currentPhase = 'close';
    this.closeCount = 0;
    this.closeHits = 0;
    this.closeReactions = [];
    this.spawnCloseTarget();
  }

  private endClosePhase(): void {
    const accuracy = this.closeCount > 0 ? this.closeHits / this.closeCount : 0;
    const avgReaction = this.closeReactions.length > 0
      ? this.closeReactions.reduce((a, b) => a + b, 0) / this.closeReactions.length : 0;

    this.phaseResults.push({
      phase: 'close',
      score: accuracy * 50 + (1 - Math.min(avgReaction / 1500, 1)) * 50,
      accuracy,
      avgReactionMs: avgReaction,
    });

    this.currentPhase = 'done';
    this.completed = true;

    if (this.onCompleteCallback) {
      this.onCompleteCallback(this.getResults());
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    // 가중 평균 점수 (flick 30%, tracking 30%, multi 20%, close 20%)
    const weights = [0.3, 0.3, 0.2, 0.2];
    let totalScore = 0;
    for (let i = 0; i < Math.min(this.phaseResults.length, weights.length); i++) {
      totalScore += this.phaseResults[i].score * weights[i];
    }

    // 트래킹 MAD (있으면)
    const trackingPhase = this.phaseResults.find((p) => p.phase === 'tracking');
    const trackingMad = trackingPhase?.trackingMad ?? null;

    // 약점 감지
    const weakest = [...this.phaseResults].sort((a, b) => a.score - b.score)[0];

    return {
      stageType: 'aim_dna_scan',
      score: totalScore,
      phases: this.phaseResults,
      weakestPhase: weakest?.phase ?? 'unknown',
      accuracy: this.phaseResults.reduce((s, p) => s + p.accuracy, 0) / Math.max(this.phaseResults.length, 1),
      avgReactionMs: this.phaseResults
        .filter((p) => p.avgReactionMs > 0)
        .reduce((s, p) => s + p.avgReactionMs, 0) /
        Math.max(this.phaseResults.filter((p) => p.avgReactionMs > 0).length, 1),
      trackingMad,
      avgOvershootDeg: 0,
      readiness: totalScore,
      readinessLabel: totalScore >= 90 ? '최상 컨디션' :
        totalScore >= 75 ? '양호' : '컨디션 저하 — 워밍업 필요',
    };
  }
}
