/**
 * 타겟 움직임 패턴 모듈
 * static, linear, strafe, perlin, adad, composite 6종 지원
 * Target/HumanoidTarget 양쪽에서 공용으로 사용
 *
 * Phase 2 확장:
 * - perlin: Simplex Noise 기반 유기적 움직임
 * - adad: 가속/감속 곡선 + 방향전환 딜레이 + 랜덤 타이밍 변동
 * - composite: 복수 패턴 가중 결합
 * - 난이도 프리셋 4종 (easy/medium/hard/extreme)
 */
import * as THREE from 'three';
import { SimplexNoise2D } from './PerlinNoise';

// ═══════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════

/** 움직임 패턴 유형 */
export type MovementPattern =
  | 'static'
  | 'linear'
  | 'strafe'
  | 'perlin'
  | 'adad'
  | 'composite';

/** 선형 이동 방향 */
export type LinearAxis = 'horizontal' | 'vertical';

/** 움직임 난이도 프리셋 이름 */
export type MovementDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

/** 움직임 파라미터 — 패턴별 세부 설정 */
export interface MovementConfig {
  /** 움직임 패턴 */
  pattern: MovementPattern;
  /** 이동 속도 (m/s), 기본값 3.0 */
  speed?: number;
  /** 이동 범위 (m, 중심에서 편도), 기본값 3.0 */
  range?: number;
  /** linear 전용: 이동 축 방향 */
  axis?: LinearAxis;

  // === strafe (레거시 호환) ===
  /** strafe 전용: 방향 전환 최소 간격 (초) */
  strafeMinInterval?: number;
  /** strafe 전용: 방향 전환 최대 간격 (초) */
  strafeMaxInterval?: number;

  // === perlin 전용 ===
  /** 시간 스케일 — 느릴수록 부드러운 이동 (기본 0.5) */
  perlinTimeScale?: number;
  /** Y축 이동 활성화 (기본 false) */
  perlinVertical?: boolean;
  /** 노이즈 시드 (생략 시 랜덤) */
  perlinSeed?: number;

  // === adad 전용 ===
  /** 평균 방향 유지 시간 (초, 기본 0.4) */
  adadHoldDuration?: number;
  /** 타이밍 랜덤성 (0.0~1.0, 기본 0.2) */
  adadVariance?: number;
  /** 가속도 (m/s², 기본 25) */
  adadAcceleration?: number;
  /** 방향 전환 딜레이 (초, 기본 0.05) — 실제 FPS 카운터스트레이프 시뮬레이션 */
  adadChangeDelay?: number;

  // === composite 전용 ===
  /** 하위 패턴 배열 */
  subPatterns?: MovementConfig[];
  /** 하위 패턴 가중치 (합 = 1.0) */
  subWeights?: number[];
}

// ═══════════════════════════════════════════════════════
// 상수
// ═══════════════════════════════════════════════════════

const DEFAULT_SPEED = 3.0;
const DEFAULT_RANGE = 3.0;
const DEFAULT_STRAFE_MIN = 0.3;
const DEFAULT_STRAFE_MAX = 1.2;

/** Perlin 기본값 */
const DEFAULT_PERLIN_TIME_SCALE = 0.5;

/** ADAD 기본값 */
const DEFAULT_ADAD_HOLD_DURATION = 0.4;
const DEFAULT_ADAD_VARIANCE = 0.2;
const DEFAULT_ADAD_ACCELERATION = 25.0;
const DEFAULT_ADAD_CHANGE_DELAY = 0.05;

// ═══════════════════════════════════════════════════════
// 난이도 프리셋
// ═══════════════════════════════════════════════════════

/** 움직임 난이도 프리셋 — Easy~Extreme */
export const MOVEMENT_DIFFICULTY_PRESETS: Record<MovementDifficulty, MovementConfig> = {
  /** Easy: 느린 linear 좌우 이동 */
  easy: {
    pattern: 'linear',
    speed: 1.5,
    range: 2.0,
    axis: 'horizontal',
  },

  /** Medium: 기본 strafe — 적당한 방향전환 */
  medium: {
    pattern: 'strafe',
    speed: 3.5,
    range: 3.0,
    strafeMinInterval: 0.4,
    strafeMaxInterval: 1.0,
  },

  /** Hard: 빠른 ADAD + 수직 Perlin 복합 */
  hard: {
    pattern: 'composite',
    speed: 5.5,
    range: 4.0,
    subPatterns: [
      {
        pattern: 'adad',
        speed: 5.5,
        range: 4.0,
        adadHoldDuration: 0.3,
        adadVariance: 0.35,
        adadAcceleration: 40,
        adadChangeDelay: 0.04,
      },
      {
        pattern: 'perlin',
        speed: 2.0,
        range: 1.5,
        perlinTimeScale: 0.8,
        perlinVertical: true,
      },
    ],
    subWeights: [0.7, 0.3],
  },

  /** Extreme: 예측 불가 복합 패턴 — 최고 난이도 */
  extreme: {
    pattern: 'composite',
    speed: 7.0,
    range: 5.0,
    subPatterns: [
      {
        pattern: 'adad',
        speed: 7.0,
        range: 5.0,
        adadHoldDuration: 0.2,
        adadVariance: 0.5,
        adadAcceleration: 80,
        adadChangeDelay: 0.03,
      },
      {
        pattern: 'perlin',
        speed: 3.0,
        range: 2.5,
        perlinTimeScale: 1.2,
        perlinVertical: true,
      },
    ],
    subWeights: [0.6, 0.4],
  },
};

// ═══════════════════════════════════════════════════════
// MovementState 클래스
// ═══════════════════════════════════════════════════════

/**
 * 움직임 상태 — 각 타겟 인스턴스마다 하나씩 생성
 * 패턴 로직의 내부 상태를 캡슐화
 */
export class MovementState {
  /** 시작 위치 (스폰 지점, 왕복 기준점) */
  readonly origin: THREE.Vector3;
  /** 현재 오프셋 */
  private offset = new THREE.Vector3();
  /** 현재 이동 방향 (+1 or -1) */
  private direction = 1;
  /** strafe/adad: 다음 방향 전환까지 남은 시간 */
  private nextChangeTimer = 0;
  /** 경과 시간 (linear sine / perlin 계산용) */
  private elapsed = 0;

  /** perlin: 노이즈 생성기 */
  private noise: SimplexNoise2D | null = null;
  /** perlin: 시드 오프셋 (축 분리용) */
  private noiseSeed = 0;

  /** adad: 현재 속도 (가감속 적용) */
  private currentSpeed = 0;
  /** adad: 방향전환 딜레이 잔여 시간 */
  private changeDelayTimer = 0;
  /** adad: 딜레이 중 정지 여부 */
  private isChangingDirection = false;

  /** composite: 하위 MovementState 배열 */
  private subStates: MovementState[] | null = null;
  /** composite: 하위 가중치 */
  private subWeights: number[] | null = null;

  private readonly config: MovementConfig;

  constructor(origin: THREE.Vector3, config: MovementConfig) {
    this.origin = origin.clone();
    this.config = config;
    this.initPattern();
  }

  /** 패턴별 초기화 */
  private initPattern(): void {
    switch (this.config.pattern) {
      case 'strafe':
        this.nextChangeTimer = this.randomStrafeInterval();
        break;

      case 'perlin':
        this.noiseSeed = this.config.perlinSeed ?? Math.random() * 10000;
        this.noise = new SimplexNoise2D(this.noiseSeed);
        break;

      case 'adad':
        this.nextChangeTimer = this.randomAdadHold();
        this.currentSpeed = 0;
        break;

      case 'composite':
        this.initComposite();
        break;
    }
  }

  /** composite 하위 패턴 초기화 */
  private initComposite(): void {
    const subs = this.config.subPatterns;
    const weights = this.config.subWeights;
    if (!subs || subs.length === 0) return;

    this.subStates = subs.map((cfg) => new MovementState(this.origin, cfg));
    this.subWeights = weights && weights.length === subs.length
      ? weights
      : subs.map(() => 1 / subs.length);
  }

  /**
   * 매 프레임 호출 — 새 위치를 반환
   * @returns 현재 프레임의 월드 위치
   */
  update(dt: number): THREE.Vector3 {
    this.elapsed += dt;

    switch (this.config.pattern) {
      case 'linear':
        return this.updateLinear();
      case 'strafe':
        return this.updateStrafe(dt);
      case 'perlin':
        return this.updatePerlin();
      case 'adad':
        return this.updateAdad(dt);
      case 'composite':
        return this.updateComposite(dt);
      case 'static':
      default:
        return this.origin.clone();
    }
  }

  // ─── linear ───────────────────────────────────────

  /** 선형 이동 — 사인파 기반 부드러운 왕복 */
  private updateLinear(): THREE.Vector3 {
    const speed = this.config.speed ?? DEFAULT_SPEED;
    const range = this.config.range ?? DEFAULT_RANGE;

    const period = (2 * range) / speed;
    const phase = (this.elapsed / period) * Math.PI * 2;
    const displacement = Math.sin(phase) * range;

    const pos = this.origin.clone();
    if (this.config.axis === 'vertical') {
      pos.y += displacement;
    } else {
      pos.x += displacement;
    }
    return pos;
  }

  // ─── strafe (레거시 호환) ─────────────────────────

  /** ADAD 스트레이프 — 등속, 랜덤 간격 방향 전환 */
  private updateStrafe(dt: number): THREE.Vector3 {
    const speed = this.config.speed ?? DEFAULT_SPEED;
    const range = this.config.range ?? DEFAULT_RANGE;

    this.nextChangeTimer -= dt;
    if (this.nextChangeTimer <= 0) {
      this.direction *= -1;
      this.nextChangeTimer = this.randomStrafeInterval();
    }

    this.offset.x += this.direction * speed * dt;

    if (Math.abs(this.offset.x) > range) {
      this.offset.x = Math.sign(this.offset.x) * range;
      this.direction *= -1;
      this.nextChangeTimer = this.randomStrafeInterval();
    }

    return this.origin.clone().add(this.offset);
  }

  /** strafe 랜덤 방향 전환 간격 */
  private randomStrafeInterval(): number {
    const min = this.config.strafeMinInterval ?? DEFAULT_STRAFE_MIN;
    const max = this.config.strafeMaxInterval ?? DEFAULT_STRAFE_MAX;
    return min + Math.random() * (max - min);
  }

  // ─── perlin ───────────────────────────────────────

  /** Perlin Noise 기반 유기적 이동 — 부드럽고 예측 불가 */
  private updatePerlin(): THREE.Vector3 {
    if (!this.noise) return this.origin.clone();

    const range = this.config.range ?? DEFAULT_RANGE;
    const timeScale = this.config.perlinTimeScale ?? DEFAULT_PERLIN_TIME_SCALE;
    const t = this.elapsed * timeScale;

    const pos = this.origin.clone();
    // X축: 노이즈 채널 1
    pos.x += this.noise.noise2D(t, this.noiseSeed) * range;

    // Y축: 별도 노이즈 채널 (수직 이동 옵션)
    if (this.config.perlinVertical) {
      pos.y += this.noise.noise2D(t, this.noiseSeed + 100) * range * 0.6;
    }

    return pos;
  }

  // ─── adad (고도화) ────────────────────────────────

  /**
   * 고도화 ADAD Strafing
   * - 가속/감속 곡선 (easeInOutQuad)
   * - 방향 전환 딜레이 (카운터스트레이프 시뮬레이션)
   * - 랜덤 타이밍 변동
   */
  private updateAdad(dt: number): THREE.Vector3 {
    const speed = this.config.speed ?? DEFAULT_SPEED;
    const range = this.config.range ?? DEFAULT_RANGE;
    const accel = this.config.adadAcceleration ?? DEFAULT_ADAD_ACCELERATION;
    const changeDelay = this.config.adadChangeDelay ?? DEFAULT_ADAD_CHANGE_DELAY;

    // 방향 전환 딜레이 처리 (정지 상태)
    if (this.isChangingDirection) {
      this.changeDelayTimer -= dt;
      // 딜레이 중 감속
      this.currentSpeed = Math.max(0, this.currentSpeed - accel * dt * 2);
      this.offset.x += this.direction * this.currentSpeed * dt;

      if (this.changeDelayTimer <= 0) {
        this.isChangingDirection = false;
        this.direction *= -1;
        this.currentSpeed = 0;
        this.nextChangeTimer = this.randomAdadHold();
      }
    } else {
      // 일반 이동: 가속
      this.currentSpeed = Math.min(speed, this.currentSpeed + accel * dt);
      this.offset.x += this.direction * this.currentSpeed * dt;

      // 홀드 타이머 카운트다운
      this.nextChangeTimer -= dt;
      if (this.nextChangeTimer <= 0) {
        this.isChangingDirection = true;
        this.changeDelayTimer = changeDelay;
      }
    }

    // 범위 제한 — 벽 충돌 시 즉시 방향 전환
    if (Math.abs(this.offset.x) > range) {
      this.offset.x = Math.sign(this.offset.x) * range;
      this.direction *= -1;
      this.currentSpeed = 0;
      this.isChangingDirection = false;
      this.nextChangeTimer = this.randomAdadHold();
    }

    return this.origin.clone().add(this.offset);
  }

  /** ADAD 랜덤 홀드 시간 (분산 포함) */
  private randomAdadHold(): number {
    const hold = this.config.adadHoldDuration ?? DEFAULT_ADAD_HOLD_DURATION;
    const variance = this.config.adadVariance ?? DEFAULT_ADAD_VARIANCE;
    return hold * (1 + (Math.random() * 2 - 1) * variance);
  }

  // ─── composite ────────────────────────────────────

  /** 복합 패턴 — 하위 패턴들의 오프셋을 가중 합산 */
  private updateComposite(dt: number): THREE.Vector3 {
    if (!this.subStates || !this.subWeights) return this.origin.clone();

    const result = new THREE.Vector3();
    for (let i = 0; i < this.subStates.length; i++) {
      const subPos = this.subStates[i].update(dt);
      // 하위 패턴의 origin 기준 오프셋만 추출
      const subOffset = subPos.clone().sub(this.subStates[i].origin);
      result.addScaledVector(subOffset, this.subWeights[i]);
    }

    return this.origin.clone().add(result);
  }
}

// ═══════════════════════════════════════════════════════
// 헬퍼 함수
// ═══════════════════════════════════════════════════════

/** 난이도 프리셋으로 MovementConfig 생성 */
export function getMovementByDifficulty(difficulty: MovementDifficulty): MovementConfig {
  return { ...MOVEMENT_DIFFICULTY_PRESETS[difficulty] };
}
