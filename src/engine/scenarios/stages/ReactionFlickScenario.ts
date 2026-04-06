/**
 * Reaction Flick 시나리오 — 적이 벽/코너 뒤에서 피킹하여 나타남
 * 반응시간 + 플릭 정확도 복합 측정
 * 다양한 스코프 배율 지원
 */
import * as THREE from 'three';
import { Scenario } from '../Scenario';
import type { GameEngine } from '../../GameEngine';
import type { TargetManager } from '../../TargetManager';
import { WeaponSystem, WEAPON_PRESETS } from '../../WeaponSystem';
import type { DifficultyConfig } from '../../../utils/types';
import { DEG2RAD } from '../../../utils/physics';
import { TARGET_COLORS } from '../../../config/theme';

/** 타겟 출현 이벤트 */
interface PeekEvent {
  /** 출현 방향 (yaw 오프셋, 도) */
  yawDeg: number;
  /** 출현 높이 (pitch 오프셋, 도) */
  pitchDeg: number;
  /** 출현 시각 (시나리오 시작 후 ms) */
  appearTimeMs: number;
  /** 노출 시간 (ms) — 이 시간 안에 맞춰야 함 */
  exposureDurationMs: number;
  /** 줌 배율 키 (weapon preset) */
  weaponPreset: string;
}

/** 개별 시행 결과 */
interface TrialResult {
  hit: boolean;
  reactionMs: number;
  overshootDeg: number;
  angularErrorDeg: number;
  weaponPreset: string;
  direction: string;
  peekIndex: number;
}

export class ReactionFlickScenario extends Scenario {
  private difficulty: DifficultyConfig;
  private weapon: WeaponSystem;
  private peekEvents: PeekEvent[] = [];
  private currentPeek = 0;
  private results: TrialResult[] = [];
  private completed = false;
  private scenarioStartTime = 0;
  private currentTargetId: string | null = null;
  private peekAppearTime = 0;
  private minAngularError = Infinity;
  private waitingForTarget = true;

  private onCompleteCallback: ((results: unknown) => void) | null = null;

  constructor(
    engine: GameEngine,
    targetManager: TargetManager,
    difficulty: DifficultyConfig,
    weaponPresets: string[] = ['default'],
  ) {
    super(engine, targetManager);
    this.difficulty = difficulty;
    this.weapon = new WeaponSystem();

    // 피킹 이벤트 생성
    this.peekEvents = this.generatePeekEvents(
      difficulty.targetCount,
      weaponPresets,
    );
  }

  /** 완료 콜백 설정 */
  setOnComplete(cb: (results: unknown) => void): void {
    this.onCompleteCallback = cb;
  }

  /** 피킹 이벤트 생성 — 랜덤 방향/타이밍 */
  private generatePeekEvents(count: number, presets: string[]): PeekEvent[] {
    const events: PeekEvent[] = [];
    let timeMs = 1500; // 첫 타겟 1.5초 후

    for (let i = 0; i < count; i++) {
      // 랜덤 방향 (좌우 ±120°, 상하 ±30°)
      const yaw = (Math.random() - 0.5) * 240;
      const pitch = (Math.random() - 0.5) * 60;

      // 랜덤 무기 프리셋
      const preset = presets[i % presets.length];

      events.push({
        yawDeg: yaw,
        pitchDeg: pitch,
        appearTimeMs: timeMs,
        exposureDurationMs: this.difficulty.reactionWindowMs,
        weaponPreset: preset,
      });

      // 다음 타겟 간격: 1~3초
      timeMs += 1000 + Math.random() * 2000;
    }

    return events;
  }

  start(): void {
    this.currentPeek = 0;
    this.completed = false;
    this.results = [];
    this.scenarioStartTime = performance.now();
    this.waitingForTarget = true;
  }

  update(_deltaTime: number): void {
    if (this.completed) return;

    const elapsed = performance.now() - this.scenarioStartTime;

    // 타겟 대기 중 — 다음 피킹 이벤트 시간이 되면 타겟 스폰
    if (this.waitingForTarget && this.currentPeek < this.peekEvents.length) {
      const peek = this.peekEvents[this.currentPeek];
      if (elapsed >= peek.appearTimeMs) {
        this.spawnPeekTarget(peek);
        this.waitingForTarget = false;
      }
    }

    // 타겟이 노출 중 — 제한 시간 초과 체크
    if (!this.waitingForTarget && this.currentTargetId) {
      const peek = this.peekEvents[this.currentPeek];
      const timeSinceAppear = performance.now() - this.peekAppearTime;

      // 최소 각도 오류 업데이트
      const camera = this.engine.getCamera();
      const forward = this.engine.getCameraForward();
      const hitResult = this.targetManager.checkHit(camera.position, forward);
      if (hitResult) {
        const errorDeg = hitResult.angularError * (180 / Math.PI);
        this.minAngularError = Math.min(this.minAngularError, errorDeg);
      }

      if (timeSinceAppear > peek.exposureDurationMs) {
        // 시간 초과 — 미스
        this.recordResult(false, peek.exposureDurationMs, 0);
        this.advanceToNext();
      }
    }
  }

  onClick(): void {
    if (this.completed || this.waitingForTarget || !this.currentTargetId) return;

    const camera = this.engine.getCamera();
    const forward = this.engine.getCameraForward();
    const hitResult = this.targetManager.checkHit(camera.position, forward);

    const reactionMs = performance.now() - this.peekAppearTime;
    const hit = hitResult?.hit ?? false;
    const errorDeg = hitResult ? hitResult.angularError * (180 / Math.PI) : 999;

    // 반동 적용 (있으면)
    this.weapon.fire(performance.now());

    this.recordResult(hit, reactionMs, errorDeg);
    this.advanceToNext();
  }

  /** 피킹 타겟 스폰 */
  private spawnPeekTarget(peek: PeekEvent): void {
    // 무기 설정 적용
    const preset = WEAPON_PRESETS[peek.weaponPreset] ?? WEAPON_PRESETS.default;
    this.weapon.setConfig(preset);

    // 줌 상태 적용
    if (preset.zoomMultiplier > 1) {
      this.weapon.setZoomed(true);
      this.engine.setScope(preset.zoomFov, preset.zoomSensMultiplier);
    }

    // 타겟 위치 계산 — 카메라 기준 상대 각도
    const distance = 15; // 15m 거리
    const yawRad = peek.yawDeg * DEG2RAD;
    const pitchRad = peek.pitchDeg * DEG2RAD;

    const x = distance * Math.sin(yawRad) * Math.cos(pitchRad);
    const y = 1.6 + distance * Math.sin(pitchRad);
    const z = -distance * Math.cos(yawRad) * Math.cos(pitchRad);

    const target = this.targetManager.spawnTarget(
      new THREE.Vector3(x, y, z),
      {
        angularSizeDeg: this.difficulty.targetSizeDeg,
        distanceM: distance,
        color: TARGET_COLORS.flickRed,
      },
    );

    this.currentTargetId = target.id;
    this.peekAppearTime = performance.now();
    this.minAngularError = Infinity;
  }

  /** 결과 기록 */
  private recordResult(hit: boolean, reactionMs: number, errorDeg: number): void {
    const peek = this.peekEvents[this.currentPeek];
    const overshoot = this.minAngularError < Infinity ? this.minAngularError : errorDeg;

    // 방향 분류
    const yaw = peek.yawDeg;
    let direction = 'center';
    if (yaw > 30) direction = 'right';
    else if (yaw < -30) direction = 'left';
    else if (peek.pitchDeg > 15) direction = 'up';
    else if (peek.pitchDeg < -15) direction = 'down';

    this.results.push({
      hit,
      reactionMs,
      overshootDeg: overshoot,
      angularErrorDeg: errorDeg,
      weaponPreset: peek.weaponPreset,
      direction,
      peekIndex: this.currentPeek,
    });
  }

  /** 다음 피킹으로 전진 */
  private advanceToNext(): void {
    // 현재 타겟 제거
    if (this.currentTargetId) {
      this.targetManager.removeTarget(this.currentTargetId);
      this.currentTargetId = null;
    }

    // 줌 리셋
    this.weapon.setZoomed(false);
    this.engine.setScope(103, 1);

    this.currentPeek++;
    this.waitingForTarget = true;

    if (this.currentPeek >= this.peekEvents.length) {
      this.completed = true;
      if (this.onCompleteCallback) {
        this.onCompleteCallback(this.getResults());
      }
    }
  }

  isComplete(): boolean {
    return this.completed;
  }

  getResults(): unknown {
    const hits = this.results.filter((r) => r.hit);
    const accuracy = this.results.length > 0
      ? hits.length / this.results.length
      : 0;
    const avgReaction = hits.length > 0
      ? hits.reduce((s, r) => s + r.reactionMs, 0) / hits.length
      : 0;
    const avgOvershoot = this.results.length > 0
      ? this.results.reduce((s, r) => s + r.overshootDeg, 0) / this.results.length
      : 0;

    return {
      stageType: 'reaction_flick',
      accuracy,
      avgReactionMs: avgReaction,
      avgOvershootDeg: avgOvershoot,
      totalTargets: this.results.length,
      hits: hits.length,
      trials: this.results,
      score: accuracy * 50 + (1 - Math.min(avgReaction / 1000, 1)) * 30
        + (1 - Math.min(avgOvershoot / 5, 1)) * 20,
    };
  }
}
