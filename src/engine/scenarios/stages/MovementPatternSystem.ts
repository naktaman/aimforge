/**
 * 트래킹 이동 패턴 시스템
 * 실제 FPS 적 움직임을 시뮬레이션하는 4가지 패턴 + 혼합 모드
 * - Linear: 일정 속도 직선 이동 후 반전
 * - Parabolic: 포물선/곡선 이동 (위아래 곡선)
 * - Jitter: ADAD 스트레이핑 (불규칙 좌우 전환)
 * - Acceleration: 가속/감속 이동
 * - Mixed: 위 4가지 랜덤 조합
 */
import type { MovementPattern, MovementPatternConfig } from '../../../utils/types';

/** 패턴 실행 상태 */
interface PatternState {
  /** 현재 X 위치 (미터) */
  x: number;
  /** 현재 Y 위치 (미터) */
  y: number;
  /** 현재 이동 방향 (1 = 오른쪽, -1 = 왼쪽) */
  direction: number;
  /** 마지막 방향 전환 시각 (ms) */
  lastChangeMs: number;
  /** 다음 방향 전환 간격 (ms) */
  nextChangeMs: number;
  /** 현재 속도 (m/s) */
  currentSpeed: number;
  /** 가속 방향 (1 = 가속, -1 = 감속) */
  accelDirection: number;
  /** 경과 시간 (패턴 내부 타이머) */
  elapsedMs: number;
  /** 이전 프레임 방향 (방향전환 감지용) */
  prevDirection: number;
}

/** 이동 패턴 관리자 — 각 트래킹 시나리오에서 사용 */
export class MovementPatternSystem {
  private config: MovementPatternConfig;
  private state: PatternState;
  /** X축 이동 범위 제한 (미터) */
  private xBound: number;
  /** Y축 이동 범위 제한 (미터) — parabolic용 */
  private yBound: number;

  constructor(config: MovementPatternConfig, xBound = 5, yBound = 2) {
    this.config = config;
    this.xBound = xBound;
    this.yBound = yBound;
    this.state = this.createInitialState();
  }

  /** 초기 상태 생성 */
  private createInitialState(): PatternState {
    return {
      x: 0,
      y: 0,
      direction: Math.random() > 0.5 ? 1 : -1,
      lastChangeMs: 0,
      nextChangeMs: this.getInitialChangeInterval(),
      currentSpeed: this.config.baseSpeedDegPerSec / 10, // 도/초를 m/s로 대략 변환
      accelDirection: 1,
      elapsedMs: 0,
      prevDirection: 1,
    };
  }

  /** 매 프레임 업데이트 — deltaTime(초), elapsedMs(밀리초) */
  update(deltaTimeSec: number, elapsedMs: number): { x: number; y: number; directionChanged: boolean } {
    this.state.elapsedMs = elapsedMs;
    this.state.prevDirection = this.state.direction;

    const pattern = this.config.pattern;

    switch (pattern) {
      case 'linear':
        this.updateLinear(deltaTimeSec, elapsedMs);
        break;
      case 'parabolic':
        this.updateParabolic(deltaTimeSec, elapsedMs);
        break;
      case 'jitter':
        this.updateJitter(deltaTimeSec, elapsedMs);
        break;
      case 'acceleration':
        this.updateAcceleration(deltaTimeSec, elapsedMs);
        break;
      case 'mixed':
        this.updateMixed(deltaTimeSec, elapsedMs);
        break;
    }

    // 범위 제한
    this.state.x = Math.max(-this.xBound, Math.min(this.xBound, this.state.x));
    this.state.y = Math.max(-this.yBound, Math.min(this.yBound, this.state.y));

    const directionChanged = this.state.direction !== this.state.prevDirection;
    return { x: this.state.x, y: this.state.y, directionChanged };
  }

  /** 리셋 */
  reset(): void {
    this.state = this.createInitialState();
  }

  /** 현재 패턴 이름 */
  getPattern(): MovementPattern {
    return this.config.pattern;
  }

  // ── Linear: 일정 속도로 한 방향 이동, 벽에 닿으면 반전 ──
  private updateLinear(dt: number, elapsedMs: number): void {
    const speed = this.state.currentSpeed;
    this.state.x += this.state.direction * speed * dt;

    // 벽 반전 또는 타이머 기반 반전
    const timeSinceChange = elapsedMs - this.state.lastChangeMs;
    if (Math.abs(this.state.x) >= this.xBound || timeSinceChange >= this.state.nextChangeMs) {
      this.state.direction *= -1;
      this.state.lastChangeMs = elapsedMs;
      // 1000~2500ms 간격으로 반전
      this.state.nextChangeMs = 1000 + Math.random() * 1500;
    }
  }

  // ── Parabolic: 포물선 곡선 이동 (x: 좌우, y: 위아래) ──
  private updateParabolic(dt: number, elapsedMs: number): void {
    const amplitude = this.config.arcAmplitudeDeg ?? 15;
    const speed = this.state.currentSpeed;

    // X축: 좌우 이동
    this.state.x += this.state.direction * speed * dt;
    if (Math.abs(this.state.x) >= this.xBound) {
      this.state.direction *= -1;
      this.state.lastChangeMs = elapsedMs;
    }

    // Y축: 사인 곡선으로 위아래 (포물선 느낌)
    // amplitude를 미터로 변환 (도 → 거리 대략 변환)
    const yAmp = amplitude / 10;
    // 주기: 1.5~3초
    const period = 2000;
    this.state.y = yAmp * Math.sin((elapsedMs / period) * Math.PI * 2);

    // 주기적으로 방향 전환 추가 (예측 방해)
    const timeSinceChange = elapsedMs - this.state.lastChangeMs;
    if (timeSinceChange >= 1500 + Math.random() * 2000) {
      this.state.direction *= -1;
      this.state.lastChangeMs = elapsedMs;
    }
  }

  // ── Jitter: ADAD 스트레이핑 — 짧은 간격으로 방향 전환 ──
  private updateJitter(dt: number, elapsedMs: number): void {
    const freq = this.config.directionChangeFreq ?? 3; // 초당 3회 기본
    const speed = this.state.currentSpeed * 1.3; // jitter는 빠르게

    const timeSinceChange = elapsedMs - this.state.lastChangeMs;
    const interval = 1000 / freq;

    // 불규칙 방향 전환 — ±30% 랜덤 변동
    const jitteredInterval = interval * (0.7 + Math.random() * 0.6);

    if (timeSinceChange >= jitteredInterval) {
      // 같은 방향 유지 확률 15% (예측 방해)
      if (Math.random() > 0.15) {
        this.state.direction *= -1;
      }
      this.state.lastChangeMs = elapsedMs;
    }

    this.state.x += this.state.direction * speed * dt;

    // 가끔 정지 (jiggle peek 시뮬레이션)
    if (Math.random() < 0.005) {
      this.state.x *= 0.5; // 급정지 후 원래 위치 쪽으로
    }
  }

  // ── Acceleration: 가속/감속 — 속도가 변하는 이동 ──
  private updateAcceleration(dt: number, elapsedMs: number): void {
    const accelMult = this.config.accelMultiplier ?? 2.0;
    const baseSpeed = this.config.baseSpeedDegPerSec / 10;
    const minSpeed = baseSpeed * 0.3;
    const maxSpeed = baseSpeed * accelMult;

    // 가속/감속 전환 (800~1500ms 주기)
    const timeSinceChange = elapsedMs - this.state.lastChangeMs;
    if (timeSinceChange >= this.state.nextChangeMs) {
      this.state.accelDirection *= -1;
      this.state.lastChangeMs = elapsedMs;
      this.state.nextChangeMs = 800 + Math.random() * 700;

      // 가끔 방향도 전환 (30%)
      if (Math.random() < 0.3) {
        this.state.direction *= -1;
      }
    }

    // 속도 변화 적용
    const accelRate = baseSpeed * 1.5; // 초당 가속량
    this.state.currentSpeed += this.state.accelDirection * accelRate * dt;
    this.state.currentSpeed = Math.max(minSpeed, Math.min(maxSpeed, this.state.currentSpeed));

    // 위치 업데이트
    this.state.x += this.state.direction * this.state.currentSpeed * dt;

    // 벽 반전
    if (Math.abs(this.state.x) >= this.xBound) {
      this.state.direction *= -1;
    }
  }

  // ── Mixed: 4가지 패턴을 시간대별로 랜덤 전환 ──
  private mixedSubPattern: MovementPattern = 'linear';
  private mixedLastSwitch = 0;
  private mixedSwitchInterval = 3000; // 3초마다 패턴 전환

  private updateMixed(dt: number, elapsedMs: number): void {
    // 패턴 전환 체크
    if (elapsedMs - this.mixedLastSwitch >= this.mixedSwitchInterval) {
      const patterns: MovementPattern[] = ['linear', 'parabolic', 'jitter', 'acceleration'];
      // 현재 패턴과 다른 것으로 전환
      let next: MovementPattern;
      do {
        next = patterns[Math.floor(Math.random() * patterns.length)];
      } while (next === this.mixedSubPattern);
      this.mixedSubPattern = next;
      this.mixedLastSwitch = elapsedMs;
      // 다음 전환 간격도 랜덤 (2~5초)
      this.mixedSwitchInterval = 2000 + Math.random() * 3000;
    }

    // 현재 서브 패턴 실행
    switch (this.mixedSubPattern) {
      case 'linear':
        this.updateLinear(dt, elapsedMs);
        break;
      case 'parabolic':
        this.updateParabolic(dt, elapsedMs);
        break;
      case 'jitter':
        this.updateJitter(dt, elapsedMs);
        break;
      case 'acceleration':
        this.updateAcceleration(dt, elapsedMs);
        break;
    }
  }

  /** 패턴 초기 방향 전환 간격 */
  private getInitialChangeInterval(): number {
    switch (this.config.pattern) {
      case 'linear': return 1500 + Math.random() * 1000;
      case 'parabolic': return 2000 + Math.random() * 1500;
      case 'jitter': return 200 + Math.random() * 300;
      case 'acceleration': return 1000 + Math.random() * 500;
      case 'mixed': return 3000;
      default: return 1000;
    }
  }
}

/** 기본 패턴 시퀀스 — Close/Mid/Long 공통 */
export function getDefaultPatterns(baseSpeed: number): MovementPatternConfig[] {
  return [
    { pattern: 'linear', baseSpeedDegPerSec: baseSpeed },
    { pattern: 'parabolic', baseSpeedDegPerSec: baseSpeed * 0.8, arcAmplitudeDeg: 12 },
    { pattern: 'jitter', baseSpeedDegPerSec: baseSpeed * 1.2, directionChangeFreq: 3 },
    { pattern: 'acceleration', baseSpeedDegPerSec: baseSpeed, accelMultiplier: 2.0 },
    { pattern: 'mixed', baseSpeedDegPerSec: baseSpeed },
  ];
}

/** Close Range 패턴 — 빠르고 불규칙 (팔 움직임) */
export function getCloseRangePatterns(): MovementPatternConfig[] {
  return [
    { pattern: 'jitter', baseSpeedDegPerSec: 70, directionChangeFreq: 4 },
    { pattern: 'acceleration', baseSpeedDegPerSec: 60, accelMultiplier: 2.5 },
    { pattern: 'linear', baseSpeedDegPerSec: 55 },
    { pattern: 'parabolic', baseSpeedDegPerSec: 50, arcAmplitudeDeg: 18 },
    { pattern: 'mixed', baseSpeedDegPerSec: 60 },
  ];
}

/** Mid Range 패턴 — 중간 속도, 다양한 움직임 */
export function getMidRangePatterns(): MovementPatternConfig[] {
  return [
    { pattern: 'linear', baseSpeedDegPerSec: 40 },
    { pattern: 'jitter', baseSpeedDegPerSec: 45, directionChangeFreq: 3 },
    { pattern: 'parabolic', baseSpeedDegPerSec: 35, arcAmplitudeDeg: 10 },
    { pattern: 'acceleration', baseSpeedDegPerSec: 38, accelMultiplier: 1.8 },
    { pattern: 'mixed', baseSpeedDegPerSec: 40 },
  ];
}

/** Long Range 패턴 — 느리고 정밀 (손목 움직임) */
export function getLongRangePatterns(): MovementPatternConfig[] {
  return [
    { pattern: 'linear', baseSpeedDegPerSec: 20 },
    { pattern: 'parabolic', baseSpeedDegPerSec: 18, arcAmplitudeDeg: 6 },
    { pattern: 'acceleration', baseSpeedDegPerSec: 22, accelMultiplier: 1.5 },
    { pattern: 'jitter', baseSpeedDegPerSec: 15, directionChangeFreq: 2 },
    { pattern: 'mixed', baseSpeedDegPerSec: 20 },
  ];
}
