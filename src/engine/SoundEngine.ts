/**
 * 사운드 엔진 — Web Audio API 기반 프로그래매틱 사운드 생성
 * 외부 오디오 파일 없이 절차적으로 모든 사운드를 합성
 * AudioContext 싱글턴, 프리로드 불필요
 *
 * Phase 1 MVP:
 * - PannerNode 3D 공간 오디오 (equalpower)
 * - 거리 감쇠 + 공기 흡수 (고주파 로우패스)
 * - 3레이어 히트 사운드 (punch + ping + sub)
 * - 레이어드 총기 발사음 + 랜덤화
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
} from './SoundRecipes';

/** Vec3 타입 재수출 (호출부 편의) */
export type { Vec3, ReverbPreset } from './SpatialAudio';
export { REVERB_PRESETS } from './SpatialAudio';

/** 볼륨 설정 인터페이스 */
export interface VolumeSettings {
  master: number;   // 0~1, 기본 0.7
  hit: number;      // 0~1, 기본 0.7
  ui: number;       // 0~1, 기본 0.7
}

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private hitGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private enabled = true;

  /** 공간 오디오 모듈 */
  private spatial = new SpatialAudio();
  /** 리스너(플레이어) 현재 위치 */
  private listenerPos: Vec3 = { x: 0, y: 0, z: 0 };
  /** 공간 오디오 활성화 여부 */
  private spatialEnabled = true;
  /** 5레이어 발사음 사용 여부 (Phase 2) */
  private use5LayerGunshot = true;

  /** 볼륨 설정 (0~1) */
  private volumes: VolumeSettings = { master: 0.7, hit: 0.7, ui: 0.7 };

  /** 재사용 노이즈 버퍼 캐시 (ms → AudioBuffer) */
  private noiseCache = new Map<number, AudioBuffer>();

  /** AudioContext + 마스터 게인 체인 초기화 (사용자 인터랙션 후 호출) */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ latencyHint: 'interactive' });
      // 마스터 → destination 게인 체인 구성
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.volumes.master;
      this.masterGain.connect(this.ctx.destination);

      // 히트 사운드 버스
      this.hitGain = this.ctx.createGain();
      this.hitGain.gain.value = this.volumes.hit;
      this.hitGain.connect(this.masterGain);

      // UI 사운드 버스
      this.uiGain = this.ctx.createGain();
      this.uiGain.gain.value = this.volumes.ui;
      this.uiGain.connect(this.masterGain);
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

  // ─── 히트 사운드 ──────────────────────────────────────────────

  /**
   * 바디 히트 사운드 — 3-레이어 (punch + ping + sub), <100ms
   * @param pitchMultiplier 콤보 피치 배율 (1.0~1.5)
   * @param sourcePos 타겟 월드 위치 (공간 오디오용, 생략 시 2D)
   */
  playHitSound(pitchMultiplier = 1.0, sourcePos?: Vec3): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      // 히트 사운드 — HRTF 적용 (핵심 소스)
      const dest = this.getSpatialOrDirect(ctx, sourcePos, this.getHitDest(), true);
      synthHit(ctx, dest, pitchMultiplier);
    } catch (e) {
      console.error('[SoundEngine] playHitSound 실패:', e);
    }
  }

  /**
   * 헤드샷 사운드 — CS2 "딩크" 금속성 강화
   * @param pitchMultiplier 콤보 피치 배율
   * @param sourcePos 타겟 월드 위치 (공간 오디오용)
   */
  playHeadshotSound(pitchMultiplier = 1.0, sourcePos?: Vec3): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      // 헤드샷 사운드 — HRTF 적용 (핵심 소스)
      const dest = this.getSpatialOrDirect(ctx, sourcePos, this.getHitDest(), true);
      synthHeadshot(ctx, dest, pitchMultiplier, this.noiseCache);
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
   * Phase 2: Body + Transient + Sub + Mechanical + Tail
   * 1인칭이므로 sourcePos 없이 HRTF 비적용 (본인 발사음)
   */
  playGunshot(): void {
    if (!this.enabled) return;
    try {
      const ctx = this.ensureContext();
      const dest = this.getHitDest();
      if (this.use5LayerGunshot) {
        synthGunshot5Layer(ctx, dest, this.noiseCache);
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

  // ─── 볼륨 제어 ──────────────────────────────────────────────

  /** 마스터 볼륨 설정 (0~1) */
  setMasterVolume(v: number): void {
    this.volumes.master = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.volumes.master;
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

  /** 현재 볼륨 설정 반환 */
  getVolumes(): VolumeSettings {
    return { ...this.volumes };
  }

  /** 사운드 활성화/비활성화 */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
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
    this.spatial.dispose();
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.hitGain = null;
    this.uiGain = null;
    this.noiseCache.clear();
  }
}
