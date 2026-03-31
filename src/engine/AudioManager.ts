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
