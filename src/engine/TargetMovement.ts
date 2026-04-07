/**
 * 타겟 움직임 패턴 모듈
 * static, linear(좌우/상하), strafe(ADAD 시뮬레이션) 3종 지원
 * Target/HumanoidTarget 양쪽에서 공용으로 사용
 */
import * as THREE from 'three';

/** 움직임 패턴 유형 */
export type MovementPattern = 'static' | 'linear' | 'strafe';

/** 선형 이동 방향 */
export type LinearAxis = 'horizontal' | 'vertical';

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
  /** strafe 전용: 방향 전환 최소 간격 (초) */
  strafeMinInterval?: number;
  /** strafe 전용: 방향 전환 최대 간격 (초) */
  strafeMaxInterval?: number;
}

/** 기본값 상수 */
const DEFAULT_SPEED = 3.0;
const DEFAULT_RANGE = 3.0;
const DEFAULT_STRAFE_MIN = 0.3;
const DEFAULT_STRAFE_MAX = 1.2;

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
  /** strafe: 다음 방향 전환까지 남은 시간 */
  private nextChangeTimer = 0;
  /** 경과 시간 (linear sine 계산용) */
  private elapsed = 0;

  private readonly config: MovementConfig;

  constructor(origin: THREE.Vector3, config: MovementConfig) {
    this.origin = origin.clone();
    this.config = config;
    // strafe 초기 타이머 설정
    if (config.pattern === 'strafe') {
      this.nextChangeTimer = this.randomStrafeInterval();
    }
  }

  /**
   * 매 프레임 호출 — 새 위치를 반환
   * @returns 현재 프레임의 월드 위치
   */
  update(dt: number): THREE.Vector3 {
    switch (this.config.pattern) {
      case 'linear':
        return this.updateLinear(dt);
      case 'strafe':
        return this.updateStrafe(dt);
      case 'static':
      default:
        return this.origin.clone();
    }
  }

  /**
   * 선형 이동 — 사인파 기반 부드러운 왕복
   * horizontal: X축 좌우, vertical: Y축 상하
   */
  private updateLinear(dt: number): THREE.Vector3 {
    const speed = this.config.speed ?? DEFAULT_SPEED;
    const range = this.config.range ?? DEFAULT_RANGE;
    this.elapsed += dt;

    // 주기 = 2 * range / speed → 사인파 주파수
    const period = (2 * range) / speed;
    const phase = (this.elapsed / period) * Math.PI * 2;
    const displacement = Math.sin(phase) * range;

    const pos = this.origin.clone();
    if (this.config.axis === 'vertical') {
      pos.y += displacement;
    } else {
      // 기본: horizontal (X축)
      pos.x += displacement;
    }
    return pos;
  }

  /**
   * ADAD 스트레이프 — 랜덤 간격으로 급격한 방향 전환
   * 실제 FPS 플레이어의 ADAD 움직임 시뮬레이션
   */
  private updateStrafe(dt: number): THREE.Vector3 {
    const speed = this.config.speed ?? DEFAULT_SPEED;
    const range = this.config.range ?? DEFAULT_RANGE;

    // 방향 전환 타이머
    this.nextChangeTimer -= dt;
    if (this.nextChangeTimer <= 0) {
      this.direction *= -1;
      this.nextChangeTimer = this.randomStrafeInterval();
    }

    // 등속 이동
    this.offset.x += this.direction * speed * dt;

    // 범위 제한 — 벽에 부딪히면 반전
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
}
