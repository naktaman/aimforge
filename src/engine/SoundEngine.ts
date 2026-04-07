/**
 * 사운드 엔진 — Web Audio API 기반 프로그래매틱 사운드 생성 (B-1 Phase 4)
 * 외부 오디오 파일 없이 절차적으로 모든 사운드를 합성
 * AudioContext 싱글턴, 5채널 볼륨 버스 (총성/히트/UI/환경/마스터)
 *
 * Phase 1 MVP:
 * - PannerNode 3D 공간 오디오 (equalpower)
 * - 거리 감쇠 + 공기 흡수 (고주파 로우패스)
 * - 3레이어 히트 사운드 (punch + ping + sub)
 * - 레이어드 총기 발사음 + 랜덤화
 *
 * Phase 3:
 * - 5레이어 발사음, HRTF 공간 오디오, ConvolverNode 리버브
 *
 * Phase 4:
 * - 5채널 볼륨 밸런싱 (총성, 히트, UI, 환경, 마스터)
 * - 히트 사운드 pitch/gain variation (반복 방지)
 * - 앰비언트 페이드 인/아웃
 * - 사운드 프리로드 (AudioContext + 노이즈 버퍼 사전 생성)
 * - Mute/Unmute 즉시 반영
 *
 * 사운드 디자인 원칙:
 * - 히트 피드백은 즉각적 (<100ms 지연)
 * - 시각+청각 멀티채널로 "찰진" 느낌
 * - 장시간 사용에도 피로하지 않는 볼륨 밸런스
 */

import { SpatialAudio, REVERB_PRESETS, type Vec3 } from './SpatialAudio';
import {
  synthHit, synthHeadshot, synthKill, synthMiss,
  synthGunshot, synthGunshot5Layer, synthSpawn,
  type GunSoundType,
} from './SoundRecipes';

/** 타입 재수출 (호출부 편의) */
export type { Vec3, ReverbPreset } from './SpatialAudio';
export type { GunSoundType } from './SoundRecipes';
export { REVERB_PRESETS } from './SpatialAudio';

// ═══════════════ Phase 4 상수 ═══════════════

/** 기본 마스터 볼륨 */
const DEFAULT_MASTER_VOLUME = 0.7;
/** 기본 히트 사운드 볼륨 */
const DEFAULT_HIT_VOLUME = 0.7;
/** 기본 UI 사운드 볼륨 */
const DEFAULT_UI_VOLUME = 0.7;
/** 기본 총성 볼륨 */
const DEFAULT_GUN_VOLUME = 0.6;
/** 기본 환경음 볼륨 */
const DEFAULT_AMBIENT_VOLUME = 0.4;

/** 히트 사운드 pitch variation 범위 (±semitone) — 음악적으로 자연스러운 범위 */
const HIT_PITCH_VARIATION_SEMITONES = 4;

/** 페이드 인/아웃 기본 시간 (초) */
const FADE_DURATION_SEC = 1.5;

/** 앰비언트 루프 재생 간격 (초) — 루프 끊김 방지 오버랩 */
const AMBIENT_LOOP_OVERLAP = 0.1;

// ═══════════════ 타입 ═══════════════

/** 5채널 볼륨 설정 인터페이스 */
export interface VolumeSettings {
  /** 마스터 (0~1) */
  master: number;
  /** 히트 사운드 (0~1) */
  hit: number;
  /** UI 사운드 (0~1) */
  ui: number;
  /** 총성 (0~1) */
  gun: number;
  /** 환경음 (0~1) */
  ambient: number;
}

// ═══════════════ SoundEngine ═══════════════

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private hitGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  /** 총성 전용 버스 (B-1 Phase 4) */
  private gunGain: GainNode | null = null;
  /** 환경음 전용 버스 (B-1 Phase 4) */
  private ambientGain: GainNode | null = null;
  private enabled = true;
  /** 뮤트 상태 — 마스터 게인을 0으로 설정 (B-1 Phase 4) */
  private muted = false;

  /** 공간 오디오 모듈 */
  private spatial = new SpatialAudio();
  /** 리스너(플레이어) 현재 위치 */
  private listenerPos: Vec3 = { x: 0, y: 0, z: 0 };
  /** 공간 오디오 활성화 여부 */
  private spatialEnabled = true;
  /** 5레이어 발사음 사용 여부 (Phase 2) */
  private use5LayerGunshot = true;
  /** 현재 무기 사운드 타입 (Phase 3) */
  private gunSoundType: GunSoundType = 'rifle';

  /** 볼륨 설정 (0~1) — 5채널 */
  private volumes: VolumeSettings = {
    master: DEFAULT_MASTER_VOLUME,
    hit: DEFAULT_HIT_VOLUME,
    ui: DEFAULT_UI_VOLUME,
    gun: DEFAULT_GUN_VOLUME,
    ambient: DEFAULT_AMBIENT_VOLUME,
  };

  /** 재사용 노이즈 버퍼 캐시 (ms → AudioBuffer) */
  private noiseCache = new Map<number, AudioBuffer>();

  // ── 앰비언트 루프 상태 (B-1 Phase 4) ──
  private ambientSource: OscillatorNode | null = null;
  private ambientNoiseSource: AudioBufferSourceNode | null = null;
  private ambientActive = false;

  /** AudioContext + 마스터 게인 체인 초기화 (사용자 인터랙션 후 호출) */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      // 마스터 → destination 게인 체인 구성
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volumes.master;
      this.masterGain.connect(this.ctx.destination);

      // 히트 사운드 버스
      this.hitGain = this.ctx.createGain();
      this.hitGain.gain.value = this.volumes.hit;
      this.hitGain.connect(this.masterGain);

      // UI 사운드 버스
      this.uiGain = this.ctx.createGain();
      this.uiGain.gain.value = this.volumes.ui;
      this.uiGain.connect(this.masterGain);

      // 총성 버스 (B-1 Phase 4)
      this.gunGain = this.ctx.createGain();
      this.gunGain.gain.value = this.volumes.gun;
      this.gunGain.connect(this.masterGain);

      // 환경음 버스 (B-1 Phase 4)
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = this.volumes.ambient;
      this.ambientGain.connect(this.masterGain);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 히트 사운드 게인 노드 (히트 버스에 연결) */
  private getHitDest(): GainNode {
    this.ensureContext();
    return this.hitGain!;
  }

  /** UI 사운드 게인 노드 (UI 버스에 연결) */
  private getUiDest(): GainNode {
    this.ensureContext();
    return this.uiGain!;
  }

  /** 총성 게인 노드 (B-1 Phase 4) */
  private getGunDest(): GainNode {
    this.ensureContext();
    return this.gunGain!;
  }

  /** 환경음 게인 노드 (B-1 Phase 4) */
  private getAmbientDest(): GainNode {
    this.ensureContext();
    return this.ambientGain!;
  }

  /**
   * 공간 오디오 체인 또는 직접 연결 반환
   * 공간 오디오 비활성화 시 destination 직접 반환
   * @param useHrtf 핵심 소스(히트/발사)는 true — HRTF PannerNode 적용
   */
  private getSpatialOrDirect(
    ctx: AudioContext,
    sourcePos: Vec3 | undefined,
    destination: GainNode,
    useHrtf = false,
  ): AudioNode {
    if (!this.spatialEnabled || !sourcePos) {
      return destination;
    }
    const { input } = this.spatial.createSpatialChain(
      ctx, sourcePos, this.listenerPos, destination, useHrtf,
    );
    return input;
  }

  // ═══════════════ 히트 사운드 변형 (B-1 Phase 4) ═══════════════

  /**
   * 랜덤 pitch 변형 배율 생성 — 세미톤 기반
   * ±HIT_PITCH_VARIATION_SEMITONES 범위에서 랜덤 선택
   */
  private randomPitchVariation(): number {
    const semitones = (Math.random() * 2 - 1) * HIT_PITCH_VARIATION_SEMITONES;
    return Math.pow(2, semitones / 12);
  }

  // ─── 히트 사운드 ──────────────────────────────────────────────

  /**
   * 바디 히트 사운드 — 3-레이어 (punch + ping + sub), <100ms
   * B-1 Phase 4: pitch/gain variation 적용 (synthHit 내부 pitchMultiplier로 전달)
   * @param pitchMultiplier 콤보 피치 배율 (1.0~1.5)
   * @param sourcePos 타겟 월드 위치 (공간 오디오용, 생략 시 2D)
   */
  playHitSound(pitchMultiplier = 1.0, sourcePos?: Vec3): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      // Phase 4: pitch/gain variation
      const pitchVar = this.randomPitchVariation();
      const totalPitch = pitchMultiplier * pitchVar;
      // 히트 사운드 — HRTF 적용 (핵심 소스)
      const dest = this.getSpatialOrDirect(ctx, sourcePos, this.getHitDest(), true);
      synthHit(ctx, dest, totalPitch);
    } catch (e) {
      console.error('[SoundEngine] playHitSound 실패:', e);
    }
  }

  /**
   * 헤드샷 사운드 — CS2 "딩크" 금속성 강화
   * B-1 Phase 4: pitch/gain variation 적용
   * @param pitchMultiplier 콤보 피치 배율
   * @param sourcePos 타겟 월드 위치 (공간 오디오용)
   */
  playHeadshotSound(pitchMultiplier = 1.0, sourcePos?: Vec3): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      // Phase 4: pitch/gain variation
      const pitchVar = this.randomPitchVariation();
      const totalPitch = pitchMultiplier * pitchVar;
      // 헤드샷 사운드 — HRTF 적용 (핵심 소스)
      const dest = this.getSpatialOrDirect(ctx, sourcePos, this.getHitDest(), true);
      synthHeadshot(ctx, dest, totalPitch, this.noiseCache);
    } catch (e) {
      console.error('[SoundEngine] playHeadshotSound 실패:', e);
    }
  }

  /**
   * 킬 사운드 — 무거운 타격감
   * sawtooth 800→200Hz + sine 5th harmonic
   */
  playKillSound(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      synthKill(ctx, this.getHitDest());
    } catch (e) {
      console.error('[SoundEngine] playKillSound 실패:', e);
    }
  }

  /**
   * 미스 사운드 — subtle 화이트 노이즈
   * @param sourcePos 타겟 월드 위치 (공간 오디오용)
   */
  playMissSound(sourcePos?: Vec3): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      const dest = this.getSpatialOrDirect(ctx, sourcePos, this.getHitDest());
      synthMiss(ctx, dest, this.noiseCache);
    } catch (e) {
      console.error('[SoundEngine] playMissSound 실패:', e);
    }
  }

  /**
   * 총기 발사음 — 5레이어 또는 3레이어 합성
   * Phase 3: 무기 타입별 프로파일, 연발 시 Tail 자연 오버랩
   * Phase 4: 전용 gun 버스 사용
   * @param typeOverride 무기 타입 오버라이드 (생략 시 현재 설정)
   */
  playGunshot(typeOverride?: GunSoundType): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      // Phase 4: gun 전용 버스로 라우팅
      const dest = this.getGunDest();
      if (this.use5LayerGunshot) {
        synthGunshot5Layer(ctx, dest, this.noiseCache, typeOverride ?? this.gunSoundType);
      } else {
        synthGunshot(ctx, dest, this.noiseCache);
      }
    } catch (e) {
      console.error('[SoundEngine] playGunshot 실패:', e);
    }
  }

  /** 5레이어 발사음 사용 여부 토글 */
  setUse5LayerGunshot(enabled: boolean): void {
    this.use5LayerGunshot = enabled;
  }

  /** 무기 사운드 타입 설정 (Phase 3) */
  setGunSoundType(type: GunSoundType): void {
    this.gunSoundType = type;
  }

  /** 현재 무기 사운드 타입 반환 */
  getGunSoundType(): GunSoundType {
    return this.gunSoundType;
  }

  /** 타겟 스폰 사운드 */
  playSpawn(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      synthSpawn(ctx, this.getHitDest());
    } catch (e) {
      console.error('[SoundEngine] playSpawn 실패:', e);
    }
  }

  // ─── UI 사운드 ──────────────────────────────────────────────

  /** 메뉴 호버 — sine 440Hz, 20ms, gain 0.05 */
  playUIHover(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      const dest = this.getUiDest();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.02);
    } catch (e) {
      console.error('[SoundEngine] playUIHover 실패:', e);
    }
  }

  /** 메뉴 클릭 — sine 880Hz, 30ms, gain 0.1 */
  playUIClick(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      const dest = this.getUiDest();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.03);
    } catch (e) {
      console.error('[SoundEngine] playUIClick 실패:', e);
    }
  }

  /** 카운트다운 틱 — sine 600Hz, 50ms, gain 0.15 */
  playCountdownTick(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      const dest = this.getUiDest();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.05);
    } catch (e) {
      console.error('[SoundEngine] playCountdownTick 실패:', e);
    }
  }

  /** 시나리오 시작 — ascending tone (400→800Hz), 200ms */
  playStartSound(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      const dest = this.getUiDest();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.exponentialRampToValueAtTime(800, t + 0.2);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.2);
    } catch (e) {
      console.error('[SoundEngine] playStartSound 실패:', e);
    }
  }

  /** 시나리오 종료 — descending tone (800→400Hz), 300ms */
  playEndSound(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      const dest = this.getUiDest();
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(400, t + 0.3);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain).connect(dest);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch (e) {
      console.error('[SoundEngine] playEndSound 실패:', e);
    }
  }

  // ─── 공간 오디오 제어 ───────────────────────────────────────

  /**
   * 리스너(플레이어/카메라) 위치 업데이트
   * Three.js 카메라 위치와 동기화하여 호출
   */
  updateListenerPosition(position: Vec3, forward?: Vec3, up?: Vec3): void {
    this.listenerPos = { ...position };
    if (this.ctx) {
      this.spatial.updateListener(this.ctx, position, forward, up);
    }
  }

  /** 공간 오디오 활성화/비활성화 */
  setSpatialEnabled(enabled: boolean): void {
    this.spatialEnabled = enabled;
  }

  /** 공간 오디오 활성화 상태 반환 */
  isSpatialEnabled(): boolean {
    return this.spatialEnabled;
  }

  // ═══════════════ 앰비언트 사운드 (B-1 Phase 4) ═══════════════

  /**
   * 앰비언트 시작 (페이드 인) — 저주파 드론 + 미세 노이즈
   * 게임 시작 시 호출, 공간감 있는 배경음 생성
   * @param fadeDuration 페이드 인 시간 (초, 기본 1.5)
   */
  startAmbient(fadeDuration = FADE_DURATION_SEC): void {
    if (!this.enabled || this.ambientActive) return;
    const ctx = this.ensureContext();
    const dest = this.getAmbientDest();
    const t = ctx.currentTime;

    // 저주파 드론 — 매우 낮은 볼륨의 사인파
    this.ambientSource = ctx.createOscillator();
    this.ambientSource.type = 'sine';
    this.ambientSource.frequency.value = 55; // A1 — 깊은 저음

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0, t);
    droneGain.gain.linearRampToValueAtTime(0.06, t + fadeDuration);

    this.ambientSource.connect(droneGain);
    droneGain.connect(dest);
    this.ambientSource.start(t);

    // 미세 노이즈 레이어 — 공간감
    const noiseDuration = 4; // 4초 루프
    const noiseBufferSize = Math.floor(ctx.sampleRate * noiseDuration);
    const noiseBuffer = ctx.createBuffer(1, noiseBufferSize, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseBufferSize; i++) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    this.ambientNoiseSource = ctx.createBufferSource();
    this.ambientNoiseSource.buffer = noiseBuffer;
    this.ambientNoiseSource.loop = true;
    // 루프 끊김 방지 — loopEnd를 약간 전으로
    this.ambientNoiseSource.loopEnd = noiseDuration - AMBIENT_LOOP_OVERLAP;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.value = 400;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, t);
    noiseGain.gain.linearRampToValueAtTime(0.03, t + fadeDuration);

    this.ambientNoiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(dest);
    this.ambientNoiseSource.start(t);

    this.ambientActive = true;
  }

  /**
   * 앰비언트 종료 (페이드 아웃) — 자연스러운 감쇠 후 정지
   * @param fadeDuration 페이드 아웃 시간 (초, 기본 1.5)
   */
  stopAmbient(fadeDuration = FADE_DURATION_SEC): void {
    if (!this.ambientActive || !this.ctx) return;
    const t = this.ctx.currentTime;

    // 드론 페이드 아웃 후 정지
    if (this.ambientSource) {
      try {
        this.ambientSource.stop(t + fadeDuration);
      } catch {
        // 이미 중지됨
      }
      this.ambientSource = null;
    }

    // 노이즈 페이드 아웃
    if (this.ambientNoiseSource) {
      try {
        this.ambientNoiseSource.stop(t + fadeDuration);
      } catch {
        // 이미 중지됨
      }
      this.ambientNoiseSource = null;
    }

    this.ambientActive = false;
  }

  // ═══════════════ 볼륨 제어 ═══════════════

  /** 마스터 볼륨 설정 (0~1) */
  setMasterVolume(v: number): void {
    this.volumes.master = Math.max(0, Math.min(1, v));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.value = this.volumes.master;
    }
  }

  /** 히트 사운드 볼륨 설정 (0~1) */
  setHitVolume(v: number): void {
    this.volumes.hit = Math.max(0, Math.min(1, v));
    if (this.hitGain) this.hitGain.gain.value = this.volumes.hit;
  }

  /** UI 사운드 볼륨 설정 (0~1) */
  setUIVolume(v: number): void {
    this.volumes.ui = Math.max(0, Math.min(1, v));
    if (this.uiGain) this.uiGain.gain.value = this.volumes.ui;
  }

  /** 총성 볼륨 설정 (0~1) (B-1 Phase 4) */
  setGunVolume(v: number): void {
    this.volumes.gun = Math.max(0, Math.min(1, v));
    if (this.gunGain) this.gunGain.gain.value = this.volumes.gun;
  }

  /** 환경음 볼륨 설정 (0~1) (B-1 Phase 4) */
  setAmbientVolume(v: number): void {
    this.volumes.ambient = Math.max(0, Math.min(1, v));
    if (this.ambientGain) this.ambientGain.gain.value = this.volumes.ambient;
  }

  /** 전체 볼륨 일괄 설정 (B-1 Phase 4) */
  setVolumes(settings: Partial<VolumeSettings>): void {
    if (settings.master !== undefined) this.setMasterVolume(settings.master);
    if (settings.hit !== undefined) this.setHitVolume(settings.hit);
    if (settings.ui !== undefined) this.setUIVolume(settings.ui);
    if (settings.gun !== undefined) this.setGunVolume(settings.gun);
    if (settings.ambient !== undefined) this.setAmbientVolume(settings.ambient);
  }

  /** 현재 볼륨 설정 반환 */
  getVolumes(): VolumeSettings {
    return { ...this.volumes };
  }

  // ═══════════════ Mute/Unmute (B-1 Phase 4) ═══════════════

  /** 뮤트 토글 — 마스터 게인 즉시 0/복원 */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.volumes.master;
    }
  }

  /** 뮤트 토글 (현재 상태 반전) */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /** 뮤트 상태 조회 */
  isMuted(): boolean {
    return this.muted;
  }

  /** 사운드 활성화/비활성화 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAmbient(0);
    }
  }

  /** 현재 활성화 상태 */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ─── 리버브 제어 (Phase 2) ─────────────────────────────────

  /**
   * 리버브 프리셋 설정 — 환경에 따른 공간 잔향
   * @param presetName 프리셋 이름 (indoor, outdoor, arena, none)
   */
  setReverbPreset(presetName: string): void {
    const preset = REVERB_PRESETS[presetName];
    if (!preset) {
      console.error(`[SoundEngine] 알 수 없는 리버브 프리셋: ${presetName}`);
      return;
    }
    try {
      const ctx = this.ensureContext();
      this.spatial.setReverbPreset(ctx, preset, this.masterGain!);
    } catch (e) {
      console.error('[SoundEngine] setReverbPreset 실패:', e);
    }
  }

  /** 현재 리버브 프리셋 이름 반환 */
  getReverbPreset(): string {
    return this.spatial.getCurrentReverbPreset().name;
  }

  /** 리소스 정리 */
  dispose(): void {
    this.stopAmbient(0);
    this.spatial.dispose();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.hitGain = null;
    this.uiGain = null;
    this.gunGain = null;
    this.ambientGain = null;
    this.noiseCache.clear();
  }
}
