/**
 * 무기 시뮬레이션 시스템
 * - 발사 모드: single / burst / auto / bolt
 * - 반동 패턴 (shot-by-shot recoil) + 블룸 시스템
 * - 탄창 + 리로드
 * - Bullet drop (중력 시뮬레이션)
 * - 줌 배율별 감도 차이
 * - 연사속도 (RPM → 발사 간격)
 */
import * as THREE from 'three';
import type { WeaponConfig, FireMode } from '../utils/types';
import { WEAPON_PRESETS } from './WeaponPresets';
import {
  RecoilPatternProcessor,
  RECOIL_PATTERN_PRESETS,
  type RecoilPatternConfig,
  type RecoilOutput,
} from './RecoilPattern';

/* re-export — 기존 import 호환 유지 */
export { WEAPON_PRESETS, SCENARIO_WEAPON_PRESETS } from './WeaponPresets';

/** 반동 상태 */
interface RecoilState {
  /** 현재 연사 카운트 */
  shotIndex: number;
  /** 마지막 발사 시각 (ms) */
  lastShotTime: number;
  /** 누적 반동 오프셋 (도) */
  accumulatedRecoil: THREE.Vector2;
}

/** 탄창 상태 */
interface MagazineState {
  /** 잔탄 수 */
  current: number;
  /** 리로드 중 여부 */
  isReloading: boolean;
  /** 리로드 시작 시각 (ms) */
  reloadStartTime: number;
}

/** 버스트 상태 */
interface BurstState {
  /** 현재 버스트 잔여 발수 */
  remaining: number;
  /** 버스트 내 마지막 발사 시각 */
  lastBurstShotTime: number;
}

/** 블룸 상태 */
interface BloomState {
  /** 현재 블룸 값 (도) */
  current: number;
  /** 마지막 업데이트 시각 */
  lastUpdateTime: number;
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

/** 발사 결과 — fire()의 상세 반환값 */
export interface FireResult {
  /** 반동 오프셋 (도 단위 dx, dy) */
  recoilOffset: THREE.Vector2;
  /** 스프레드 오프셋 (도 단위 dx, dy) */
  spreadOffset: THREE.Vector2;
  /** 실제 발사 여부 */
  fired: boolean;
  /** 리로드 중 여부 */
  isReloading: boolean;
  /** 탄창 부족 여부 */
  isEmpty: boolean;
}

// ── 유틸: Box-Muller 가우시안 난수 ──
function gaussianRandom(mean = 0, stdDev = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}

export class WeaponSystem {
  private config: WeaponConfig;
  private recoil: RecoilState;
  private magazine: MagazineState;
  private burst: BurstState;
  private bloom: BloomState;
  private isZoomed = false;

  /** 패턴 기반 반동 프로세서 (Phase 2) */
  private patternProcessor: RecoilPatternProcessor;
  /** 패턴 프로세서 활성화 여부 */
  private usePatternProcessor = false;

  constructor(config: WeaponConfig = WEAPON_PRESETS.default) {
    this.config = { ...config };
    this.recoil = { shotIndex: 0, lastShotTime: 0, accumulatedRecoil: new THREE.Vector2(0, 0) };
    this.magazine = {
      current: config.magazineSize ?? 0,
      isReloading: false,
      reloadStartTime: 0,
    };
    this.burst = { remaining: 0, lastBurstShotTime: 0 };
    this.bloom = { current: config.firstShotAccuracy ?? 0, lastUpdateTime: 0 };
    this.patternProcessor = new RecoilPatternProcessor(RECOIL_PATTERN_PRESETS.none);
  }

  /** 무기 설정 변경 */
  setConfig(config: WeaponConfig): void {
    this.config = { ...config };
    this.resetRecoil();
    this.magazine.current = config.magazineSize ?? 0;
    this.magazine.isReloading = false;
    this.burst.remaining = 0;
    this.bloom.current = config.firstShotAccuracy ?? 0;
  }

  /** 패턴 프로세서 설정 — Phase 2 반동 시스템 활성화 */
  setPatternConfig(config: RecoilPatternConfig): void {
    this.patternProcessor.setConfig(config);
    this.usePatternProcessor = true;
  }

  /** 프리셋 이름으로 패턴 프로세서 설정 */
  setPatternPreset(presetName: string): void {
    const preset = RECOIL_PATTERN_PRESETS[presetName];
    if (preset) {
      this.setPatternConfig(preset);
    }
  }

  /** 패턴 프로세서 비활성화 (레거시 모드로 복귀) */
  disablePatternProcessor(): void {
    this.usePatternProcessor = false;
    this.patternProcessor.reset();
  }

  /** 패턴 프로세서 직접 접근 (보정 분석 등) */
  getPatternProcessor(): RecoilPatternProcessor {
    return this.patternProcessor;
  }

  /** 패턴 프로세서 활성화 여부 */
  isPatternProcessorActive(): boolean {
    return this.usePatternProcessor;
  }

  /** 현재 유효 발사 모드 (기존 설정과 호환) */
  private resolveFireMode(): FireMode {
    if (this.config.fireMode) return this.config.fireMode;
    /* 레거시 호환: fireRateRpm > 0이면 auto, 아니면 single */
    return this.config.fireRateRpm > 0 ? 'auto' : 'single';
  }

  /** 탄창 무제한 여부 */
  private isUnlimitedAmmo(): boolean {
    return !this.config.magazineSize || this.config.magazineSize <= 0;
  }

  /** 발사 가능 여부 (연사 쿨다운 + 탄창 + 리로드 확인) */
  canFire(currentTimeMs: number): boolean {
    /* 리로드 중이면 발사 불가 */
    if (this.magazine.isReloading) return false;

    /* 탄창 확인 */
    if (!this.isUnlimitedAmmo() && this.magazine.current <= 0) return false;

    /* 버스트 진행 중이면 버스트 내부 RPM 적용 */
    if (this.burst.remaining > 0) {
      const internalRpm = this.config.burstInternalRpm ?? this.config.fireRateRpm;
      if (internalRpm <= 0) return true;
      const interval = 60000 / internalRpm;
      return currentTimeMs - this.burst.lastBurstShotTime >= interval;
    }

    /* RPM 쿨다운 */
    if (this.config.fireRateRpm <= 0) return true;
    const intervalMs = 60000 / this.config.fireRateRpm;
    return currentTimeMs - this.recoil.lastShotTime >= intervalMs;
  }

  /**
   * 발사 — 반동 오프셋 반환 (dx, dy 도 단위)
   * 기존 public API 유지: Vector2 반환
   */
  fire(currentTimeMs: number): THREE.Vector2 {
    const result = this.fireDetailed(currentTimeMs);
    if (!result.fired) return new THREE.Vector2(0, 0);
    /* 반동 + 스프레드 합산 */
    return new THREE.Vector2(
      result.recoilOffset.x + result.spreadOffset.x,
      result.recoilOffset.y + result.spreadOffset.y,
    );
  }

  /** 상세 발사 결과 (Phase 1 확장 API) */
  fireDetailed(currentTimeMs: number): FireResult {
    const empty: FireResult = {
      recoilOffset: new THREE.Vector2(0, 0),
      spreadOffset: new THREE.Vector2(0, 0),
      fired: false,
      isReloading: this.magazine.isReloading,
      isEmpty: !this.isUnlimitedAmmo() && this.magazine.current <= 0,
    };

    if (!this.canFire(currentTimeMs)) return empty;

    const mode = this.resolveFireMode();

    /* 버스트 시작 판정 */
    if (mode === 'burst' && this.burst.remaining <= 0) {
      this.burst.remaining = (this.config.burstCount ?? 3);
    }

    /* 발사 처리 */
    this.recoil.lastShotTime = currentTimeMs;

    /* 탄창 소모 */
    if (!this.isUnlimitedAmmo()) {
      this.magazine.current--;
    }

    /* 반동 계산 */
    const recoilOffset = this.calculateRecoil(currentTimeMs);

    /* 스프레드 계산 */
    const spreadOffset = this.calculateSpread();

    /* 버스트 카운트 감소 */
    if (mode === 'burst') {
      this.burst.remaining--;
      this.burst.lastBurstShotTime = currentTimeMs;
      /* 버스트 완료 시 반동 리셋 */
      if (this.burst.remaining <= 0) {
        this.recoil.shotIndex = 0;
      }
    }

    /* 볼트액션: 발사 후 다음 발 전까지 긴 쿨다운 (RPM으로 이미 처리됨) */

    return {
      recoilOffset,
      spreadOffset,
      fired: true,
      isReloading: false,
      isEmpty: false,
    };
  }

  /** 반동 계산 (유형별 분기) */
  private calculateRecoil(currentTimeMs: number): THREE.Vector2 {
    const recoilType = this.config.recoilType ??
      (this.config.recoilPattern.length > 0 ? 'fixed' : 'none');
    const deviation = this.config.recoilRandomDeviation ?? 0.2;

    switch (recoilType) {
      case 'none':
        return new THREE.Vector2(0, 0);

      case 'fixed':
      case 'valorant': {
        /* 고정 패턴 기반 반동 (기존 로직 유지) */
        const pattern = this.config.recoilPattern;
        if (pattern.length === 0) return new THREE.Vector2(0, 0);

        const idx = this.recoil.shotIndex % pattern.length;
        const [dx, dy] = pattern[idx];

        /* 랜덤 분산 */
        const rx = dx + gaussianRandom(0, Math.abs(dx) * deviation);
        const ry = dy + gaussianRandom(0, Math.abs(dy) * deviation);

        this.recoil.shotIndex++;
        this.recoil.accumulatedRecoil.x += rx;
        this.recoil.accumulatedRecoil.y += ry;

        return new THREE.Vector2(rx, ry);
      }

      case 'bloom': {
        /* 블룸 시스템: 발사마다 블룸 증가, 시간 경과로 회복 */
        const bloomPerShot = this.config.bloomPerShot ?? 2;
        const bloomMax = this.config.bloomMax ?? 30;

        /* 시간 경과에 따른 블룸 회복 */
        if (this.bloom.lastUpdateTime > 0) {
          const elapsed = (currentTimeMs - this.bloom.lastUpdateTime) / 1000;
          const recovery = (this.config.bloomRecoveryRate ?? 10) * elapsed;
          const minBloom = this.config.firstShotAccuracy ?? 0;
          this.bloom.current = Math.max(minBloom, this.bloom.current - recovery);
        }

        /* 현재 블룸 범위 내 랜덤 오프셋 */
        const angle = Math.random() * Math.PI * 2;
        const radius = gaussianRandom(0, this.bloom.current * 0.4);
        const spreadX = Math.cos(angle) * Math.abs(radius);
        const spreadY = Math.sin(angle) * Math.abs(radius);

        /* 블룸 증가 */
        this.bloom.current = Math.min(bloomMax, this.bloom.current + bloomPerShot);
        this.bloom.lastUpdateTime = currentTimeMs;

        this.recoil.shotIndex++;
        return new THREE.Vector2(spreadX, spreadY);
      }

      default:
        return new THREE.Vector2(0, 0);
    }
  }

  /** 스프레드 계산 (baseSpread 기반 원형 분포) */
  private calculateSpread(): THREE.Vector2 {
    const spread = this.config.baseSpread ?? 0;
    if (spread <= 0) return new THREE.Vector2(0, 0);

    const angle = Math.random() * Math.PI * 2;
    const radius = gaussianRandom(0, spread * 0.3);
    return new THREE.Vector2(
      Math.cos(angle) * Math.abs(radius),
      Math.sin(angle) * Math.abs(radius),
    );
  }

  /** 매 프레임 반동 회복 업데이트 */
  updateRecoilRecovery(currentTimeMs: number): THREE.Vector2 {
    /* 블룸 시간 경과 회복 */
    if (this.getRecoilType() === 'bloom' && this.bloom.lastUpdateTime > 0) {
      const elapsed = (currentTimeMs - this.bloom.lastUpdateTime) / 1000;
      const recovery = (this.config.bloomRecoveryRate ?? 10) * elapsed;
      const minBloom = this.config.firstShotAccuracy ?? 0;
      this.bloom.current = Math.max(minBloom, this.bloom.current - recovery);
      this.bloom.lastUpdateTime = currentTimeMs;
    }

    /* 기존 패턴 반동 리셋 */
    const timeSinceLast = currentTimeMs - this.recoil.lastShotTime;
    if (timeSinceLast > this.config.recoilResetMs && this.recoil.shotIndex > 0) {
      const recovery = this.recoil.accumulatedRecoil.clone();
      this.resetRecoil();
      return recovery;
    }
    return new THREE.Vector2(0, 0);
  }

  /** 패턴 프로세서 기반 발사 — AimPunch + ViewPunch 분리 반환 (Phase 2) */
  fireWithPattern(currentTimeMs: number): RecoilOutput | null {
    if (!this.usePatternProcessor) return null;
    if (!this.canFire(currentTimeMs)) return null;

    this.recoil.lastShotTime = currentTimeMs;
    this.recoil.shotIndex++;

    if (!this.isUnlimitedAmmo()) {
      this.magazine.current--;
    }

    return this.patternProcessor.fire(currentTimeMs);
  }

  /** 반동 리셋 */
  resetRecoil(): void {
    this.recoil.shotIndex = 0;
    this.recoil.accumulatedRecoil.set(0, 0);
    this.bloom.current = this.config.firstShotAccuracy ?? 0;
    if (this.usePatternProcessor) {
      this.patternProcessor.reset();
    }
  }

  // ── 탄창/리로드 ──

  /** 리로드 시작 */
  startReload(currentTimeMs: number): boolean {
    if (this.isUnlimitedAmmo()) return false;
    if (this.magazine.isReloading) return false;
    if (this.magazine.current >= (this.config.magazineSize ?? 0)) return false;

    this.magazine.isReloading = true;
    this.magazine.reloadStartTime = currentTimeMs;
    return true;
  }

  /** 리로드 업데이트 — 매 프레임 호출, 완료 시 true 반환 */
  updateReload(currentTimeMs: number): boolean {
    if (!this.magazine.isReloading) return false;
    const reloadTime = this.config.reloadTimeMs ?? 2000;
    if (currentTimeMs - this.magazine.reloadStartTime >= reloadTime) {
      this.magazine.current = this.config.magazineSize ?? 0;
      this.magazine.isReloading = false;
      return true;
    }
    return false;
  }

  /** 잔탄 수 */
  getAmmo(): number {
    if (this.isUnlimitedAmmo()) return Infinity;
    return this.magazine.current;
  }

  /** 탄창 크기 */
  getMagazineSize(): number {
    return this.config.magazineSize ?? 0;
  }

  /** 리로드 중 여부 */
  getIsReloading(): boolean {
    return this.magazine.isReloading;
  }

  /** 리로드 진행률 (0~1) */
  getReloadProgress(currentTimeMs: number): number {
    if (!this.magazine.isReloading) return 0;
    const reloadTime = this.config.reloadTimeMs ?? 2000;
    return Math.min(1, (currentTimeMs - this.magazine.reloadStartTime) / reloadTime);
  }

  // ── 블룸 ──

  /** 현재 블룸 값 (도) */
  getCurrentBloom(): number {
    return this.bloom.current;
  }

  // ── 줌 (기존 API 유지) ──

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

  // ── Bullet Drop (기존 API 유지) ──

  /**
   * Bullet drop 계산 — 거리에 따른 탄착점 낙하
   * @param distanceM 타겟까지 거리 (m)
   */
  calculateBulletDrop(distanceM: number): BulletDropResult {
    if (!this.config.bulletDropEnabled || this.config.bulletVelocity <= 0) {
      return { dropAngleDeg: 0, flightTimeMs: 0, dropMeters: 0 };
    }
    const flightTimeS = distanceM / this.config.bulletVelocity;
    const flightTimeMs = flightTimeS * 1000;
    const dropMeters = 0.5 * this.config.bulletDropGravity * flightTimeS * flightTimeS;
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

  /** 현재 발사 모드 (public accessor) */
  getCurrentFireMode(): FireMode {
    return this.resolveFireMode();
  }

  /** 현재 반동 유형 */
  getRecoilType(): string {
    return this.config.recoilType ??
      (this.config.recoilPattern.length > 0 ? 'fixed' : 'none');
  }
}
