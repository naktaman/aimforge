/**
 * 사운드 엔진 — Web Audio API 기반 프로그래매틱 사운드 생성
 * 외부 오디오 파일 없이 절차적으로 모든 사운드를 합성
 * AudioContext 싱글턴, 프리로드 불필요
 *
 * 사운드 디자인 원칙:
 * - 히트 피드백은 즉각적 (<100ms 지연)
 * - 시각+청각 멀티채널로 "찰진" 느낌
 * - 장시간 사용에도 피로하지 않는 볼륨 밸런스
 */

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

  /** 볼륨 설정 (0~1) */
  private volumes: VolumeSettings = { master: 0.7, hit: 0.7, ui: 0.7 };

  /** AudioContext + 마스터 게인 체인 초기화 (사용자 인터랙션 후 호출) */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
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

  // ─── 히트 사운드 ──────────────────────────────────────────────

  /**
   * 바디 히트 사운드 — 짧고 깔끔한 "틱"
   * sine wave 1000→800Hz sweep, 120ms
   * @param pitchMultiplier 콤보 피치 배율 (1.0~1.5)
   */
  playHitSound(pitchMultiplier = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000 * pitchMultiplier, t);
    osc.frequency.exponentialRampToValueAtTime(800 * pitchMultiplier, t + 0.12);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  /**
   * 헤드샷 사운드 — CS2 "딩크" 느낌의 날카로운 금속성
   * triangle wave 1200→600Hz + white noise burst (highpass 3kHz)
   * @param pitchMultiplier 콤보 피치 배율
   */
  playHeadshotSound(pitchMultiplier = 1.0): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    // 메인 오실레이터 — 날카로운 triangle sweep
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200 * pitchMultiplier, t);
    osc.frequency.exponentialRampToValueAtTime(600 * pitchMultiplier, t + 0.08);
    oscGain.gain.setValueAtTime(0.4, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(oscGain);
    oscGain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.08);

    // 화이트 노이즈 버스트 — 금속성 질감 (highpass 3kHz)
    const bufferSize = Math.floor(ctx.sampleRate * 0.05); // 50ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 3000;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.25, t);
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

    // 메인 — 무거운 sawtooth sweep
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

    // 5th 하모닉 — 밝은 오버톤
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
   * white noise only, 30ms, gain 0.05
   */
  playMissSound(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.03); // 30ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    noise.connect(gain);
    gain.connect(dest);
    noise.start(t);
  }

  /**
   * 총기 발사음 — 공격적인 클릭/팝
   * (기존 AudioManager의 playGunshot과 동일)
   */
  playGunshot(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const dest = this.getHitDest();
    const t = ctx.currentTime;

    // 노이즈 버스트 (화이트 노이즈 + 지수 감쇠)
    const bufferSize = Math.floor(ctx.sampleRate * 0.08); // 80ms
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

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

  /** 리소스 정리 */
  dispose(): void {
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
    this.hitGain = null;
    this.uiGain = null;
  }
}
