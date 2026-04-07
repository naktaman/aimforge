/**
 * 사운드 엔진 — Web Audio API 기반 프로그래매틱 사운드 생성 (B-1 Phase 4)
 * 외부 오디오 파일 없이 절차적으로 모든 사운드를 합성
 * AudioContext 싱글턴, 5채널 볼륨 버스 (총성/히트/UI/환경/마스터)
 *
 * B-1 Phase 4 추가 기능:
 * - 5채널 볼륨 밸런싱 (총성, 히트, UI, 환경, 마스터)
 * - 히트 사운드 pitch/gain variation (반복 방지)
 * - 앰비언트 페이드 인/아웃
 * - 사운드 프리로드 (AudioContext + 노이즈 버퍼 사전 생성)
 * - Mute/Unmute 즉시 반영
 */

// ═══════════════ 상수 ═══════════════

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
/** 히트 사운드 gain variation 범위 (±배율) */
const HIT_GAIN_VARIATION = 0.15;

/** 페이드 인/아웃 기본 시간 (초) */
const FADE_DURATION_SEC = 1.5;

/** 총성 노이즈 버퍼 길이 (초) — 프리로드 대상 */
const GUNSHOT_NOISE_DURATION = 0.08;
/** 헤드샷 노이즈 버퍼 길이 (초) */
const HEADSHOT_NOISE_DURATION = 0.05;
/** 미스 노이즈 버퍼 길이 (초) */
const MISS_NOISE_DURATION = 0.03;

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

  /** 볼륨 설정 (0~1) — 5채널 */
  private volumes: VolumeSettings = {
    master: DEFAULT_MASTER_VOLUME,
    hit: DEFAULT_HIT_VOLUME,
    ui: DEFAULT_UI_VOLUME,
    gun: DEFAULT_GUN_VOLUME,
    ambient: DEFAULT_AMBIENT_VOLUME,
  };

  // ── 프리로드된 노이즈 버퍼 (B-1 Phase 4) ──
  private gunshotNoiseBuffer: AudioBuffer | null = null;
  private headshotNoiseBuffer: AudioBuffer | null = null;
  private missNoiseBuffer: AudioBuffer | null = null;

  // ── 앰비언트 루프 상태 (B-1 Phase 4) ──
  private ambientSource: OscillatorNode | null = null;
  private ambientNoiseSource: AudioBufferSourceNode | null = null;
  private ambientActive = false;

  /** AudioContext + 게인 체인 초기화 (사용자 인터랙션 후 호출) */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();

      // 마스터 → destination
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

      // 노이즈 버퍼 프리로드 (B-1 Phase 4)
      this.preloadNoiseBuffers();
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

  // ═══════════════ 프리로드 (B-1 Phase 4) ═══════════════

  /**
   * 노이즈 버퍼 사전 생성 — 첫 발사 시 레이턴시 제거
   * AudioContext 생성 시 자동 호출, 화이트 노이즈 버퍼 3종 캐싱
   */
  private preloadNoiseBuffers(): void {
    if (!this.ctx) return;

    this.gunshotNoiseBuffer = this.createNoiseBuffer(GUNSHOT_NOISE_DURATION, 'gunshot');
    this.headshotNoiseBuffer = this.createNoiseBuffer(HEADSHOT_NOISE_DURATION, 'white');
    this.missNoiseBuffer = this.createNoiseBuffer(MISS_NOISE_DURATION, 'white');
  }

  /**
   * 화이트 노이즈 버퍼 생성
   * @param durationSec 버퍼 길이 (초)
   * @param type 노이즈 유형 ('white' | 'gunshot')
   */
  private createNoiseBuffer(durationSec: number, type: 'white' | 'gunshot'): AudioBuffer {
    const ctx = this.ctx!;
    const bufferSize = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (type === 'gunshot') {
      // 총성 전용 — 지수 감쇠 적용
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
      }
    } else {
      // 순수 화이트 노이즈
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    return buffer;
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

  /** 랜덤 gain 변형 배율 (1 ± HIT_GAIN_VARIATION) */
  private randomGainVariation(): number {
    return 1 + (Math.random() * 2 - 1) * HIT_GAIN_VARIATION;
  }

  // ─── 히트 사운드 ──────────────────────────────────────────────

  /**
   * 바디 히트 사운드 — 짧고 깔끔한 "틱"
   * sine wave 1000→800Hz sweep, 120ms
   * B-1 Phase 4: pitch + gain variation 적용
   * @param pitchMultiplier 콤보 피치 배율 (1.0~1.5)
   */
  playHitSound(pitchMultiplier = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    // pitch/gain 변형 (B-1 Phase 4)
    const pitchVar = this.randomPitchVariation();
    const gainVar = this.randomGainVariation();
    const totalPitch = pitchMultiplier * pitchVar;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000 * totalPitch, t);
    osc.frequency.exponentialRampToValueAtTime(800 * totalPitch, t + 0.12);

    gain.gain.setValueAtTime(0.3 * gainVar, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * 헤드샷 사운드 — CS2 "딩크" 느낌의 날카로운 금속성
   * triangle wave 1200→600Hz + white noise burst (highpass 3kHz)
   * B-1 Phase 4: pitch/gain variation + 프리로드 버퍼 사용
   * @param pitchMultiplier 콤보 피치 배율
   */
  playHeadshotSound(pitchMultiplier = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    const pitchVar = this.randomPitchVariation();
    const gainVar = this.randomGainVariation();
    const totalPitch = pitchMultiplier * pitchVar;

    // 메인 오실레이터 — 날카로운 triangle sweep
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 * totalPitch, t);
    osc.frequency.exponentialRampToValueAtTime(600 * totalPitch, t + 0.08);
    oscGain.gain.setValueAtTime(0.4 * gainVar, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.08);

    // 화이트 노이즈 버스트 — 프리로드 버퍼 사용 (B-1 Phase 4)
    const noise = ctx.createBufferSource();
    noise.buffer = this.headshotNoiseBuffer ?? this.createNoiseBuffer(HEADSHOT_NOISE_DURATION, 'white');

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 3000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25 * gainVar, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(dest);
    noise.start(t);
  }

  /**
   * 킬 사운드 — 무거운 타격감
   * sawtooth 800→200Hz + sine 5th harmonic (1200Hz)
   */
  playKillSound(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(800, t);
    osc1.frequency.exponentialRampToValueAtTime(200, t + 0.4);
    gain1.gain.setValueAtTime(0.35, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(t);
    osc1.stop(t + 0.4);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, t);
    osc2.frequency.exponentialRampToValueAtTime(600, t + 0.2);
    gain2.gain.setValueAtTime(0.2, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(t);
    osc2.stop(t + 0.2);
  }

  /**
   * 미스 사운드 — 거의 안 들릴 정도로 subtle
   * 프리로드 버퍼 사용 (B-1 Phase 4)
   */
  playMissSound(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.missNoiseBuffer ?? this.createNoiseBuffer(MISS_NOISE_DURATION, 'white');

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    noise.connect(gain);
    gain.connect(dest);
    noise.start(t);
  }

  /**
   * 총기 발사음 — 공격적인 클릭/팝
   * B-1 Phase 4: 전용 gun 버스 + 프리로드 버퍼 사용
   */
  playGunshot(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getGunDest();
    const t = ctx.currentTime;

    // 프리로드 노이즈 버퍼 사용 (B-1 Phase 4)
    const noise = ctx.createBufferSource();
    noise.buffer = this.gunshotNoiseBuffer ?? this.createNoiseBuffer(GUNSHOT_NOISE_DURATION, 'gunshot');

    // 로우패스 필터 — 총기 특성
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(3000, t);
    filter.frequency.exponentialRampToValueAtTime(500, t + 0.06);

    // 베이스 펀치 (저주파 충격감)
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(80, t);
    bass.frequency.exponentialRampToValueAtTime(30, t + 0.05);
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.5, t);
    bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime(0.35, t);
    mainGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    noise.connect(filter);
    filter.connect(mainGain);
    bass.connect(bassGain);
    bassGain.connect(dest);
    mainGain.connect(dest);

    noise.start(t);
    bass.start(t);
    bass.stop(t + 0.06);
  }

  /** 타겟 스폰 사운드 */
  playSpawn(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // ─── UI 사운드 ──────────────────────────────────────────────

  /** 메뉴 호버 — sine 440Hz, 20ms, gain 0.05 */
  playUIHover(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getUiDest();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.02);
  }

  /** 메뉴 클릭 — sine 880Hz, 30ms, gain 0.1 */
  playUIClick(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getUiDest();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  /** 카운트다운 틱 — sine 600Hz, 50ms, gain 0.15 */
  playCountdownTick(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getUiDest();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** 시나리오 시작 — ascending tone (400→800Hz), 200ms */
  playStartSound(): void {
    if (!this.enabled) return;
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
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** 시나리오 종료 — descending tone (800→400Hz), 300ms */
  playEndSound(): void {
    if (!this.enabled) return;
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
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.3);
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
    const noiseBuffer = this.createNoiseBuffer(noiseDuration, 'white');
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

  /** 리소스 정리 */
  dispose(): void {
    this.stopAmbient(0);
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.hitGain = null;
    this.uiGain = null;
    this.gunGain = null;
    this.ambientGain = null;
    this.gunshotNoiseBuffer = null;
    this.headshotNoiseBuffer = null;
    this.missNoiseBuffer = null;
  }
}
