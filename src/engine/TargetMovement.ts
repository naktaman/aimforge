/**
 * 타겟 고급 움직임 시스템 (B-3 Phase 2)
 * - Perlin Noise 기반 유기적 움직임 (외부 라이브러리 없는 순수 구현)
 * - ADAD Strafing 고도화 (가속/감속 곡선, 방향전환 딜레이, 랜덤 타이밍)
 * - 복합 패턴 (ADAD 기반 + Perlin 유기적 오버레이)
 * - 난이도별 프리셋 4종 (Easy / Medium / Hard / Extreme)
 */
import * as THREE from 'three';

// ═══════════════ 상수 ═══════════════

/** Perlin 순열 테이블 크기 */
const PERM_SIZE = 256;

/** ADAD 방향전환 최소 딜레이 (초) — 키 전환 반응시간 모사 */
const ADAD_DIR_DELAY_MIN = 0.05;

/** ADAD 방향전환 최대 딜레이 (초) */
const ADAD_DIR_DELAY_MAX = 0.15;

/** ADAD 기본 가속도 배율 (speed 대비) */
const ADAD_ACCEL_MULTIPLIER = 8;

/** ADAD 벽 충돌 시 속도 감쇠율 */
const ADAD_WALL_DAMPING = 0.3;

/** ADAD 같은방향 유지 기본 확률 (페이크 무빙) */
const ADAD_SAME_DIR_CHANCE = 0.15;

/** ADAD 속도 변동 최소 배율 */
const ADAD_SPEED_VAR_MIN = 0.7;

/** ADAD 속도 변동 최대 배율 */
const ADAD_SPEED_VAR_MAX = 1.3;

/** 복합 패턴 기본 Perlin 비중 */
const COMPOSITE_PERLIN_WEIGHT = 0.3;

/** 복합 Perlin X축 범위 감쇠율 */
const COMPOSITE_PERLIN_X_SCALE = 0.3;

/** 복합 Perlin Y축 범위 감쇠율 */
const COMPOSITE_PERLIN_Y_SCALE = 0.5;

/** ADAD 급감속 배율 (가속도 대비) */
const ADAD_DECEL_RATE_MULT = 1.5;

/** ADAD 정지 판정 속도 임계값 (m/s) */
const ADAD_STOP_THRESHOLD = 0.1;

/** ADAD 가속 수렴 임계값 (m/s) */
const ADAD_ACCEL_THRESHOLD = 0.01;

// ═══════════════ 타입 정의 ═══════════════

/** 확장 타겟 이동 패턴 — 기존 MovementType과 별도 (하위 호환) */
export type TargetMovementPattern =
  | 'static'      // 정지
  | 'perlin'      // Perlin Noise 유기적 움직임
  | 'adad'        // ADAD 스트레이핑 (가속/감속/딜레이)
  | 'composite';  // ADAD 기반 + Perlin 오버레이

/** 움직임 난이도 등급 */
export type MovementDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

/** 이동 축 제한 */
export type MovementAxis = 'horizontal' | 'vertical' | 'both';

/** 타겟 움직임 설정 */
export interface TargetMovementConfig {
  /** 이동 패턴 */
  pattern: TargetMovementPattern;
  /** 최대 이동 속도 (m/s) */
  speed: number;
  /** X축 이동 범위 ±(m) */
  rangeX: number;
  /** Y축 이동 범위 ±(m) */
  rangeY: number;
  /** 이동 축 제한 (기본: 'both') */
  axis?: MovementAxis;

  // ── Perlin Noise 설정 ──
  /** 노이즈 주파수 — 높을수록 빈번한 방향 변화 (기본 0.5) */
  noiseFrequency?: number;
  /** 노이즈 진폭 배율 (기본 1.0) */
  noiseAmplitude?: number;
  /** FBM 옥타브 수 — 디테일 레이어 (기본 3) */
  noiseOctaves?: number;

  // ── ADAD Strafing 설정 ──
  /** 스트레이프 최소 간격 (초, 기본 0.3) */
  adadMinInterval?: number;
  /** 스트레이프 최대 간격 (초, 기본 1.2) */
  adadMaxInterval?: number;
  /** 가속도 (m/s², 기본 speed × 8) */
  adadAcceleration?: number;
  /** 같은방향 유지 확률 — 페이크 무빙 (0~1, 기본 0.15) */
  adadSameDirectionChance?: number;

  // ── Composite 설정 ──
  /** Perlin 비중 (0~1, 기본 0.3 — 나머지 ADAD) */
  compositePerlinWeight?: number;
}

// ═══════════════ Classic 2D Perlin Noise ═══════════════

/**
 * Classic 2D Perlin Noise — Ken Perlin improved algorithm
 * LCG 시드 → Fisher-Yates 셔플로 재현 가능한 노이즈 생성
 * 외부 라이브러리 의존 없이 순수 TypeScript 구현
 */
class PerlinNoise {
  private perm: Uint8Array;

  constructor(seed = 0) {
    this.perm = new Uint8Array(PERM_SIZE * 2);
    this.initPermutation(seed);
  }

  /** 시드 기반 순열 테이블 초기화 (LCG 의사난수 + Fisher-Yates 셔플) */
  private initPermutation(seed: number): void {
    const p = new Uint8Array(PERM_SIZE);
    for (let i = 0; i < PERM_SIZE; i++) p[i] = i;

    // LCG (Linear Congruential Generator) 기반 셔플
    let s = seed === 0 ? 1 : seed;
    for (let i = PERM_SIZE - 1; i > 0; i--) {
      s = (s * 16807) % 2147483647; // Park-Miller LCG
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }

    // 2배 확장 — 인덱스 래핑 시 모듈로 연산 회피
    for (let i = 0; i < PERM_SIZE * 2; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  /** 2D Perlin noise 값 반환 (범위: -1 ~ 1) */
  noise2D(x: number, y: number): number {
    // 격자 좌표 (하위 8비트만 사용)
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    // 셀 내 상대 위치 (0~1)
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Improved fade 함수 적용
    const u = PerlinNoise.fade(xf);
    const v = PerlinNoise.fade(yf);

    // 4개 격자점 해시
    const aa = this.perm[this.perm[xi] + yi];
    const ab = this.perm[this.perm[xi] + yi + 1];
    const ba = this.perm[this.perm[xi + 1] + yi];
    const bb = this.perm[this.perm[xi + 1] + yi + 1];

    // 그래디언트 도트곱 후 이중 선형 보간
    return PerlinNoise.lerp(
      PerlinNoise.lerp(
        PerlinNoise.grad(aa, xf, yf),
        PerlinNoise.grad(ba, xf - 1, yf),
        u,
      ),
      PerlinNoise.lerp(
        PerlinNoise.grad(ab, xf, yf - 1),
        PerlinNoise.grad(bb, xf - 1, yf - 1),
        u,
      ),
      v,
    );
  }

  /**
   * Fractal Brownian Motion — 다중 옥타브 합성
   * 각 옥타브: 주파수 ×2, 진폭 ×0.5 → 자연스러운 디테일 누적
   */
  fbm(x: number, y: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxAmplitude = 0;

    for (let i = 0; i < octaves; i++) {
      value += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxAmplitude += amplitude;
      amplitude *= 0.5;   // persistence
      frequency *= 2.0;   // lacunarity
    }

    return value / maxAmplitude; // 정규화 → -1 ~ 1
  }

  /** Ken Perlin improved fade: 6t⁵ − 15t⁴ + 10t³ */
  private static fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /** 선형 보간 */
  private static lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  /** 8방향 그래디언트 벡터 도트곱 */
  private static grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  }
}

// ═══════════════ 타겟 움직임 상태 ═══════════════

/**
 * 타겟 움직임 상태 — 각 타겟 인스턴스에 1:1 대응
 * update(dt) 호출마다 새 월드 좌표를 THREE.Vector3로 반환
 */
export class TargetMovementState {
  private config: TargetMovementConfig;
  private noise: PerlinNoise;
  private origin: THREE.Vector3;
  private elapsed = 0;

  // ── Perlin 오프셋 (인스턴스별 고유 시드) ──
  private noiseOffsetX: number;
  private noiseOffsetY: number;

  // ── ADAD 내부 상태 ──
  /** 현재 스트레이프 방향 (1: 오른쪽, -1: 왼쪽) */
  private adadDir: number;
  /** 현재 수평 속도 (m/s, 부호 = 방향) */
  private adadVel = 0;
  /** 현재 스트레이프 내 경과 시간 (초) */
  private adadTimeInStrafe = 0;
  /** 다음 방향전환까지 남은 시간 (초) */
  private adadNextChange: number;
  /** 방향전환 딜레이 잔여 시간 (초) */
  private adadDelayTimer = 0;
  /** 방향전환 딜레이 중 여부 */
  private adadIsDelaying = false;
  /** 현재 목표 속도 (랜덤 변동 적용됨) */
  private adadTargetSpeed: number;
  /** 누적 X 오프셋 (원점 대비, m) */
  private adadOffsetX = 0;

  constructor(config: TargetMovementConfig, origin: THREE.Vector3) {
    this.config = config;
    this.origin = origin.clone();
    this.noise = new PerlinNoise(Math.floor(Math.random() * 65536));
    this.noiseOffsetX = Math.random() * 1000;
    this.noiseOffsetY = Math.random() * 1000;
    this.adadDir = Math.random() > 0.5 ? 1 : -1;
    this.adadNextChange = this.randomADADInterval();
    this.adadTargetSpeed = config.speed;
  }

  /** 매 프레임 호출 — 새 월드 좌표 반환 */
  update(dt: number): THREE.Vector3 {
    this.elapsed += dt;

    switch (this.config.pattern) {
      case 'perlin':
        return this.calcPerlin();
      case 'adad':
        this.stepADAD(dt);
        return this.calcADADPosition();
      case 'composite':
        return this.calcComposite(dt);
      case 'static':
      default:
        return this.origin.clone();
    }
  }

  /** 상태 초기화 — 타겟 리스폰 시 사용 */
  reset(newOrigin?: THREE.Vector3): void {
    if (newOrigin) this.origin.copy(newOrigin);
    this.elapsed = 0;
    this.adadDir = Math.random() > 0.5 ? 1 : -1;
    this.adadVel = 0;
    this.adadTimeInStrafe = 0;
    this.adadNextChange = this.randomADADInterval();
    this.adadDelayTimer = 0;
    this.adadIsDelaying = false;
    this.adadTargetSpeed = this.config.speed;
    this.adadOffsetX = 0;
  }

  /** 현재 움직임 패턴 반환 */
  getPattern(): TargetMovementPattern {
    return this.config.pattern;
  }

  /** 움직임 존재 여부 */
  isActive(): boolean {
    return this.config.pattern !== 'static';
  }

  // ═══════════════ Perlin 움직임 ═══════════════

  /**
   * Perlin Noise 기반 위치 계산
   * 시간축을 입력으로 FBM 노이즈 샘플링 → 부드러운 유기적 궤적
   * X/Y 축에 서로 다른 오프셋으로 독립적인 움직임 생성
   */
  private calcPerlin(): THREE.Vector3 {
    const freq = this.config.noiseFrequency ?? 0.5;
    const amp = this.config.noiseAmplitude ?? 1.0;
    const octaves = this.config.noiseOctaves ?? 3;
    const axis = this.config.axis ?? 'both';
    const t = this.elapsed * freq;

    const pos = this.origin.clone();

    // 수평 축 노이즈
    if (axis !== 'vertical') {
      pos.x += this.noise.fbm(t + this.noiseOffsetX, 0.5, octaves)
        * amp * this.config.rangeX;
    }
    // 수직 축 노이즈 (다른 시드 오프셋)
    if (axis !== 'horizontal') {
      pos.y += this.noise.fbm(0.5, t + this.noiseOffsetY, octaves)
        * amp * this.config.rangeY;
    }

    return pos;
  }

  // ═══════════════ ADAD Strafing ═══════════════

  /**
   * ADAD 내부 상태 한 프레임 진행
   * 실제 FPS 플레이어의 A-D-A-D 키 입력 패턴 모사:
   * 1) 한 방향으로 가속 이동
   * 2) 짧은 정지 딜레이 (키 전환 반응시간)
   * 3) 반대 방향 가속 → 반복
   * 간헐적으로 같은 방향 유지 (페이크 무빙)
   */
  private stepADAD(dt: number): void {
    this.adadTimeInStrafe += dt;

    if (this.adadIsDelaying) {
      // ── 방향전환 딜레이 중 — 급감속 ──
      this.adadDelayTimer -= dt;
      const decelRate = this.config.speed * ADAD_ACCEL_MULTIPLIER * ADAD_DECEL_RATE_MULT;
      const absVel = Math.abs(this.adadVel);
      this.adadVel = absVel > ADAD_STOP_THRESHOLD
        ? Math.sign(this.adadVel) * Math.max(0, absVel - decelRate * dt)
        : 0;

      if (this.adadDelayTimer <= 0) {
        this.adadIsDelaying = false;
        // 방향 결정 — 일정 확률로 같은 방향 유지 (페이크)
        const sameChance = this.config.adadSameDirectionChance ?? ADAD_SAME_DIR_CHANCE;
        if (Math.random() > sameChance) {
          this.adadDir *= -1;
        }
        this.adadNextChange = this.randomADADInterval();
        this.adadTimeInStrafe = 0;
        // 목표 속도에 랜덤 변동 적용 (단조로움 방지)
        this.adadTargetSpeed = this.config.speed
          * (ADAD_SPEED_VAR_MIN + Math.random() * (ADAD_SPEED_VAR_MAX - ADAD_SPEED_VAR_MIN));
      }
    } else if (this.adadTimeInStrafe >= this.adadNextChange) {
      // ── 방향전환 딜레이 진입 (키 전환 반응시간 시뮬레이션) ──
      this.adadIsDelaying = true;
      this.adadDelayTimer = ADAD_DIR_DELAY_MIN
        + Math.random() * (ADAD_DIR_DELAY_MAX - ADAD_DIR_DELAY_MIN);
    }

    // ── 가속 적용 (딜레이 중이 아닐 때만) ──
    if (!this.adadIsDelaying) {
      const accel = this.config.adadAcceleration
        ?? (this.config.speed * ADAD_ACCEL_MULTIPLIER);
      const targetVel = this.adadDir * this.adadTargetSpeed;
      const diff = targetVel - this.adadVel;

      if (Math.abs(diff) > ADAD_ACCEL_THRESHOLD) {
        const step = Math.min(accel * dt, Math.abs(diff));
        this.adadVel += Math.sign(diff) * step;
      }
    }

    // ── 위치 오프셋 갱신 ──
    this.adadOffsetX += this.adadVel * dt;

    // ── 범위 제한 — 벽 반전 + 감쇠 ──
    if (Math.abs(this.adadOffsetX) > this.config.rangeX) {
      this.adadOffsetX = Math.sign(this.adadOffsetX) * this.config.rangeX;
      this.adadDir *= -1;
      this.adadVel *= -ADAD_WALL_DAMPING;
      this.adadTimeInStrafe = 0;
      this.adadNextChange = this.randomADADInterval();
    }
  }

  /** ADAD 현재 위치 계산 (원점 + X오프셋) */
  private calcADADPosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.origin.x + this.adadOffsetX,
      this.origin.y,
      this.origin.z,
    );
  }

  // ═══════════════ 복합 패턴 ═══════════════

  /**
   * Composite — ADAD 기반 이동 + Perlin 유기적 오버레이
   * ADAD가 주요 좌우 움직임을 담당, Perlin이 미세한 X/Y 변동 추가
   * → 불규칙하면서도 인간적인 움직임 생성
   */
  private calcComposite(dt: number): THREE.Vector3 {
    // ADAD 상태 진행
    this.stepADAD(dt);

    // Perlin 오버레이 계산
    const weight = this.config.compositePerlinWeight ?? COMPOSITE_PERLIN_WEIGHT;
    const freq = this.config.noiseFrequency ?? 0.8;
    const octaves = this.config.noiseOctaves ?? 2;
    const t = this.elapsed * freq;

    const perlinX = this.noise.fbm(t + this.noiseOffsetX, 0.5, octaves)
      * weight * this.config.rangeX * COMPOSITE_PERLIN_X_SCALE;
    const perlinY = this.noise.fbm(0.5, t + this.noiseOffsetY, octaves)
      * weight * this.config.rangeY * COMPOSITE_PERLIN_Y_SCALE;

    return new THREE.Vector3(
      this.origin.x + this.adadOffsetX + perlinX,
      this.origin.y + perlinY,
      this.origin.z,
    );
  }

  // ═══════════════ 유틸리티 ═══════════════

  /** ADAD 랜덤 스트레이프 간격 생성 (min~max 균등분포) */
  private randomADADInterval(): number {
    const min = this.config.adadMinInterval ?? 0.3;
    const max = this.config.adadMaxInterval ?? 1.2;
    return min + Math.random() * (max - min);
  }
}

// ═══════════════ 난이도별 프리셋 ═══════════════

/** 난이도별 움직임 프리셋 — 시나리오/프리셋에서 참조 */
export const MOVEMENT_DIFFICULTY_PRESETS: Record<MovementDifficulty, TargetMovementConfig> = {
  /**
   * Easy: 느린 Perlin — 부드럽고 예측 가능한 유기적 움직임
   * 저주파 노이즈로 거의 직선에 가까운 천천한 이동
   */
  easy: {
    pattern: 'perlin',
    speed: 1.5,
    rangeX: 2.0,
    rangeY: 0.5,
    axis: 'horizontal',
    noiseFrequency: 0.3,
    noiseAmplitude: 0.6,
    noiseOctaves: 2,
  },

  /**
   * Medium: 기본 ADAD — 보통 속도의 좌우 스트레이핑
   * 안정적인 간격, 낮은 페이크 확률
   */
  medium: {
    pattern: 'adad',
    speed: 3.0,
    rangeX: 3.0,
    rangeY: 0,
    axis: 'horizontal',
    adadMinInterval: 0.5,
    adadMaxInterval: 1.5,
    adadSameDirectionChance: 0.1,
  },

  /**
   * Hard: 빠른 ADAD + Perlin 복합
   * 잦은 방향전환 + 수직 변동 → 불규칙하고 빠른 이동
   */
  hard: {
    pattern: 'composite',
    speed: 5.0,
    rangeX: 4.0,
    rangeY: 1.0,
    axis: 'both',
    noiseFrequency: 0.7,
    noiseAmplitude: 0.8,
    noiseOctaves: 3,
    adadMinInterval: 0.2,
    adadMaxInterval: 0.8,
    adadSameDirectionChance: 0.2,
    compositePerlinWeight: 0.3,
  },

  /**
   * Extreme: 예측 불가 — 최고 속도, 초고주파 노이즈, 잦은 페이크
   * 높은 가속도 + 강한 Perlin 오버레이 → 프로 수준 트래킹 요구
   */
  extreme: {
    pattern: 'composite',
    speed: 7.0,
    rangeX: 5.0,
    rangeY: 1.5,
    axis: 'both',
    noiseFrequency: 1.2,
    noiseAmplitude: 1.0,
    noiseOctaves: 4,
    adadMinInterval: 0.1,
    adadMaxInterval: 0.5,
    adadSameDirectionChance: 0.25,
    adadAcceleration: 70,
    compositePerlinWeight: 0.4,
  },
};
