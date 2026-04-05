/**
 * 무기 시뮬레이션 시스템
 * - 반동 패턴 (shot-by-shot recoil)
 * - Bullet drop (중력 시뮬레이션)
 * - 줌 배율별 감도 차이
 * - 연사속도 (RPM → 발사 간격)
 */
import * as THREE from 'three';
import type { WeaponConfig } from '../utils/types';

/** 반동 상태 */
interface RecoilState {
  /** 현재 연사 카운트 */
  shotIndex: number;
  /** 마지막 발사 시각 (ms) */
  lastShotTime: number;
  /** 누적 반동 오프셋 (도) */
  accumulatedRecoil: THREE.Vector2;
}

/** Bullet drop 계산 결과 */
export interface BulletDropResult {
  /** 탄착 위치 오프셋 (도 단위, 하향) */
  dropAngleDeg: number;
  /** 비행 시간 (ms) */
  flightTimeMs: number;
  /** 실제 타겟 거리에서의 낙하량 (m) */
  dropMeters: number;
}

/** 무기 프리셋 목록 */
export const WEAPON_PRESETS: Record<string, WeaponConfig> = {
  /** 기본 (반동/드롭 없음) */
  default: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 1,
    zoomFov: 103,
    zoomSensMultiplier: 1,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** AR 타입 (CS2 AK-47 스타일) */
  ar_cs2: {
    fireRateRpm: 600,
    recoilPattern: [
      [0, -0.8], [0.1, -1.0], [-0.1, -1.2], [0.2, -1.0], [-0.2, -0.8],
      [0.3, -0.6], [-0.3, -0.9], [0.1, -1.1], [-0.1, -0.7], [0.2, -0.5],
      [-0.2, -0.8], [0.3, -1.0], [-0.3, -0.6], [0.1, -0.4], [-0.1, -0.7],
      [0.2, -0.9], [-0.2, -0.5], [0.3, -0.3], [-0.3, -0.6], [0.1, -0.8],
      [0, -0.4], [0.2, -0.6], [-0.2, -0.3], [0.1, -0.5], [0, -0.4],
      [-0.1, -0.6], [0.2, -0.3], [-0.1, -0.5], [0.1, -0.4], [0, -0.3],
    ],
    recoilResetMs: 400,
    zoomMultiplier: 1,
    zoomFov: 103,
    zoomSensMultiplier: 1,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 스나이퍼 (PUBG AWM 스타일) */
  sniper_pubg: {
    fireRateRpm: 25,
    recoilPattern: [[0, -4.0]],
    recoilResetMs: 2000,
    zoomMultiplier: 8,
    zoomFov: 13,
    zoomSensMultiplier: 0.35,
    bulletDropEnabled: true,
    bulletDropGravity: 9.81,
    bulletVelocity: 945,
  },
  /** SMG (빠른 연사) */
  smg: {
    fireRateRpm: 900,
    recoilPattern: [
      [0, -0.3], [0.1, -0.4], [-0.1, -0.3], [0.05, -0.35], [-0.05, -0.3],
      [0.1, -0.25], [-0.1, -0.3], [0.05, -0.35], [-0.05, -0.25], [0, -0.3],
    ],
    recoilResetMs: 300,
    zoomMultiplier: 1,
    zoomFov: 103,
    zoomSensMultiplier: 1,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 400,
  },
  /** 줌 1x (Red Dot) */
  zoom_1x: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 1,
    zoomFov: 103,
    zoomSensMultiplier: 1,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 줌 2x (ACOG) */
  zoom_2x: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 2,
    zoomFov: 51.5,
    zoomSensMultiplier: 0.7,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 줌 4x */
  zoom_4x: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 4,
    zoomFov: 25.75,
    zoomSensMultiplier: 0.5,
    bulletDropEnabled: false,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 줌 6x */
  zoom_6x: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 6,
    zoomFov: 17,
    zoomSensMultiplier: 0.42,
    bulletDropEnabled: true,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 줌 8x */
  zoom_8x: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 8,
    zoomFov: 13,
    zoomSensMultiplier: 0.35,
    bulletDropEnabled: true,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 줌 10x (FOV ~10.3°, sens 0.3) */
  zoom_10x: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 10,
    zoomFov: 10.3,
    zoomSensMultiplier: 0.3,
    bulletDropEnabled: true,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
  /** 줌 12x (FOV ~8.6°, sens 0.25) */
  zoom_12x: {
    fireRateRpm: 0,
    recoilPattern: [],
    recoilResetMs: 500,
    zoomMultiplier: 12,
    zoomFov: 8.6,
    zoomSensMultiplier: 0.25,
    bulletDropEnabled: true,
    bulletDropGravity: 9.81,
    bulletVelocity: 900,
  },
};

export class WeaponSystem {
  private config: WeaponConfig;
  private recoil: RecoilState;
  private isZoomed = false;

  constructor(config: WeaponConfig = WEAPON_PRESETS.default) {
    this.config = { ...config };
    this.recoil = {
      shotIndex: 0,
      lastShotTime: 0,
      accumulatedRecoil: new THREE.Vector2(0, 0),
    };
  }

  /** 무기 설정 변경 */
  setConfig(config: WeaponConfig): void {
    this.config = { ...config };
    this.resetRecoil();
  }

  /** 발사 가능 여부 (연사 쿨다운 확인) */
  canFire(currentTimeMs: number): boolean {
    if (this.config.fireRateRpm <= 0) return true;
    const intervalMs = 60000 / this.config.fireRateRpm;
    return currentTimeMs - this.recoil.lastShotTime >= intervalMs;
  }

  /**
   * 발사 — 반동 오프셋 반환 (dx, dy 도 단위)
   * 시나리오에서 이 값을 카메라에 적용
   */
  fire(currentTimeMs: number): THREE.Vector2 {
    if (!this.canFire(currentTimeMs)) {
      return new THREE.Vector2(0, 0);
    }

    this.recoil.lastShotTime = currentTimeMs;

    // 반동 패턴에서 현재 shot의 오프셋 가져오기
    const pattern = this.config.recoilPattern;
    if (pattern.length === 0) {
      return new THREE.Vector2(0, 0);
    }

    // 패턴 인덱스 (순환)
    const idx = this.recoil.shotIndex % pattern.length;
    const [dx, dy] = pattern[idx];

    // 약간의 랜덤 분산 추가 (±20%)
    const spread = 0.2;
    const rx = dx * (1 + (Math.random() - 0.5) * spread);
    const ry = dy * (1 + (Math.random() - 0.5) * spread);

    this.recoil.shotIndex++;
    this.recoil.accumulatedRecoil.x += rx;
    this.recoil.accumulatedRecoil.y += ry;

    return new THREE.Vector2(rx, ry);
  }

  /** 매 프레임 반동 회복 업데이트 */
  updateRecoilRecovery(currentTimeMs: number): THREE.Vector2 {
    const timeSinceLast = currentTimeMs - this.recoil.lastShotTime;
    if (timeSinceLast > this.config.recoilResetMs && this.recoil.shotIndex > 0) {
      // 반동 리셋
      const recovery = this.recoil.accumulatedRecoil.clone();
      this.resetRecoil();
      return recovery;
    }
    return new THREE.Vector2(0, 0);
  }

  /** 반동 리셋 */
  resetRecoil(): void {
    this.recoil.shotIndex = 0;
    this.recoil.accumulatedRecoil.set(0, 0);
  }

  /** 줌 토글 */
  toggleZoom(): boolean {
    this.isZoomed = !this.isZoomed;
    return this.isZoomed;
  }

  /** 줌 상태 */
  getZoomState(): { isZoomed: boolean; fov: number; sensMultiplier: number } {
    if (this.isZoomed && this.config.zoomMultiplier > 1) {
      return {
        isZoomed: true,
        fov: this.config.zoomFov,
        sensMultiplier: this.config.zoomSensMultiplier,
      };
    }
    return { isZoomed: false, fov: 103, sensMultiplier: 1 };
  }

  /** 줌 강제 설정 */
  setZoomed(zoomed: boolean): void {
    this.isZoomed = zoomed;
  }

  /**
   * Bullet drop 계산 — 거리에 따른 탄착점 낙하
   * @param distanceM 타겟까지 거리 (m)
   * @returns 낙하 결과 (각도, 시간, 미터)
   */
  calculateBulletDrop(distanceM: number): BulletDropResult {
    if (!this.config.bulletDropEnabled || this.config.bulletVelocity <= 0) {
      return { dropAngleDeg: 0, flightTimeMs: 0, dropMeters: 0 };
    }

    // 비행 시간 = 거리 / 탄속
    const flightTimeS = distanceM / this.config.bulletVelocity;
    const flightTimeMs = flightTimeS * 1000;

    // 낙하량 = 0.5 * g * t²
    const dropMeters = 0.5 * this.config.bulletDropGravity * flightTimeS * flightTimeS;

    // 각도 변환 (라디안 → 도)
    const dropAngleDeg = Math.atan2(dropMeters, distanceM) * (180 / Math.PI);

    return { dropAngleDeg, flightTimeMs, dropMeters };
  }

  /** 현재 설정 반환 */
  getConfig(): WeaponConfig {
    return { ...this.config };
  }

  /** 현재 연사 카운트 */
  getShotCount(): number {
    return this.recoil.shotIndex;
  }
}
