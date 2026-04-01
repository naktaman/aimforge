/**
 * 오디오 매니저
 * Web Audio API로 절차적 사운드 생성 (외부 파일 불필요)
 * 히트/미스/타겟출현 사운드
 */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private enabled = true;

  /** AudioContext 초기화 (사용자 인터랙션 후 호출 필요) */
  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** 히트 사운드 — 짧은 metallic ping (높은 주파수 감쇠) */
  playHit(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  }

  /** 미스 사운드 — 낮은 thud */
  playMiss(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
  }

  /** 총기 발사음 — 공격적인 클릭/팝 (단발) */
  playGunshot(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();

    // 노이즈 버스트로 총기음 생성 (화이트 노이즈 + 엔벨로프)
    const bufferSize = ctx.sampleRate * 0.08; // 80ms
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
    filter.frequency.setValueAtTime(3000, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.06);

    // 베이스 펀치 (저주파 충격감)
    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(80, ctx.currentTime);
    bass.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.05);
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.5, ctx.currentTime);
    bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    // 메인 게인
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    gain.connect(ctx.destination);

    noise.start(ctx.currentTime);
    bass.start(ctx.currentTime);
    bass.stop(ctx.currentTime + 0.06);
  }

  /** 타겟 출현 사운드 — subtle click/pop */
  playSpawn(): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
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
  }
}
