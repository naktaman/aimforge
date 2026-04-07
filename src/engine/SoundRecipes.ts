/**
 * 사운드 레시피 — 개별 사운드의 합성 로직
 * SoundEngine에서 호출하여 실제 오디오 노드를 생성
 * 각 함수는 AudioContext + destination 노드를 받아 사운드를 스케줄링
 */

/**
 * 화이트 노이즈 버퍼 생성 (캐시 재사용)
 * @param ctx AudioContext
 * @param durationMs 지속 시간 (밀리초)
 * @param cache 버퍼 캐시 맵
 */
export function getNoiseBuffer(
  ctx: AudioContext,
  durationMs: number,
  cache: Map<number, AudioBuffer>,
): AudioBuffer {
  if (cache.has(durationMs)) {
    return cache.get(durationMs)!;
  }
  const size = Math.floor(ctx.sampleRate * durationMs / 1000);
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  cache.set(durationMs, buffer);
  return buffer;
}

/**
 * 세미톤 기반 랜덤 피치 오프셋 계산
 * @param semitones 최대 세미톤 편차 (±)
 */
export function randomPitch(semitones: number): number {
  const offset = (Math.random() * 2 - 1) * semitones;
  return Math.pow(2, offset / 12);
}

/**
 * 3-레이어 바디 히트 사운드 (<100ms)
 * Layer 1: Punch click (2-4kHz, 30ms) — 초기 임팩트
 * Layer 2: Metal ping (5-8kHz, 40ms) — 날카로운 피드백
 * Layer 3: Sub thump (80-150Hz, 50ms) — 바디감
 */
export function synthHit(ctx: AudioContext, dest: AudioNode, pm: number): void {
  const t = ctx.currentTime;

  // Layer 1: Punch click — 짧은 사각파 펄스
  const punch = ctx.createOscillator();
  const punchG = ctx.createGain();
  punch.type = 'square';
  punch.frequency.setValueAtTime(3000 * pm, t);
  punch.frequency.exponentialRampToValueAtTime(2000 * pm, t + 0.03);
  punchG.gain.setValueAtTime(0.25, t);
  punchG.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  punch.connect(punchG).connect(dest);
  punch.start(t);
  punch.stop(t + 0.03);

  // Layer 2: Metal ping — 삼각파, 5-8kHz
  const ping = ctx.createOscillator();
  const pingG = ctx.createGain();
  ping.type = 'triangle';
  ping.frequency.setValueAtTime(6000 * pm, t);
  ping.frequency.exponentialRampToValueAtTime(5000 * pm, t + 0.04);
  pingG.gain.setValueAtTime(0.15, t);
  pingG.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  ping.connect(pingG).connect(dest);
  ping.start(t);
  ping.stop(t + 0.04);

  // Layer 3: Sub thump — 사인파, 80-150Hz
  const sub = ctx.createOscillator();
  const subG = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(150, t);
  sub.frequency.exponentialRampToValueAtTime(80, t + 0.05);
  subG.gain.setValueAtTime(0.2, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  sub.connect(subG).connect(dest);
  sub.start(t);
  sub.stop(t + 0.05);
}

/**
 * 헤드샷 사운드 — CS2 "딩크" 날카로운 금속성
 * triangle sweep + 고주파 ping + 노이즈 버스트 + sub thump
 */
export function synthHeadshot(
  ctx: AudioContext,
  dest: AudioNode,
  pm: number,
  cache: Map<number, AudioBuffer>,
): void {
  const t = ctx.currentTime;

  // 메인 — 날카로운 triangle sweep (1200→600Hz)
  const osc = ctx.createOscillator();
  const oscG = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1200 * pm, t);
  osc.frequency.exponentialRampToValueAtTime(600 * pm, t + 0.08);
  oscG.gain.setValueAtTime(0.35, t);
  oscG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  osc.connect(oscG).connect(dest);
  osc.start(t);
  osc.stop(t + 0.08);

  // 고주파 metal ping — 8kHz 짧은 사인 버스트
  const hPing = ctx.createOscillator();
  const hPingG = ctx.createGain();
  hPing.type = 'sine';
  hPing.frequency.setValueAtTime(8000 * pm, t);
  hPing.frequency.exponentialRampToValueAtTime(6000 * pm, t + 0.04);
  hPingG.gain.setValueAtTime(0.2, t);
  hPingG.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  hPing.connect(hPingG).connect(dest);
  hPing.start(t);
  hPing.stop(t + 0.04);

  // 화이트 노이즈 버스트 — 금속성 질감 (highpass 3kHz)
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx, 50, cache);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.2, t);
  noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  noise.connect(hp);
  hp.connect(noiseG).connect(dest);
  noise.start(t);

  // Sub thump — 저주파 충격
  const sub = ctx.createOscillator();
  const subG = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(120, t);
  sub.frequency.exponentialRampToValueAtTime(60, t + 0.06);
  subG.gain.setValueAtTime(0.25, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  sub.connect(subG).connect(dest);
  sub.start(t);
  sub.stop(t + 0.06);
}

/**
 * 킬 사운드 — 무거운 타격감
 * sawtooth 800→200Hz + sine 5th 하모닉 (1200Hz)
 */
export function synthKill(ctx: AudioContext, dest: AudioNode): void {
  const t = ctx.currentTime;

  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type = 'sawtooth';
  osc1.frequency.setValueAtTime(800, t);
  osc1.frequency.exponentialRampToValueAtTime(200, t + 0.4);
  g1.gain.setValueAtTime(0.35, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc1.connect(g1).connect(dest);
  osc1.start(t);
  osc1.stop(t + 0.4);

  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(1200, t);
  osc2.frequency.exponentialRampToValueAtTime(600, t + 0.2);
  g2.gain.setValueAtTime(0.2, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  osc2.connect(g2).connect(dest);
  osc2.start(t);
  osc2.stop(t + 0.2);
}

/**
 * 미스 사운드 — subtle 화이트 노이즈, 30ms
 */
export function synthMiss(
  ctx: AudioContext,
  dest: AudioNode,
  cache: Map<number, AudioBuffer>,
): void {
  const t = ctx.currentTime;
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx, 30, cache);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.05, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  noise.connect(g).connect(dest);
  noise.start(t);
}

/**
 * 총기 발사음 — 레이어드 합성 + ±3세미톤/±3dB 랜덤화
 * Layer 1: 밴드패스 노이즈 (메커니즘)
 * Layer 2: 사인 피치 스윕 (충격파)
 * Layer 3: 서브 베이스 펀치
 */
export function synthGunshot(
  ctx: AudioContext,
  dest: AudioNode,
  cache: Map<number, AudioBuffer>,
): void {
  const t = ctx.currentTime;
  const pRand = randomPitch(3);
  const gRand = Math.pow(10, (Math.random() * 6 - 3) / 20); // ±3dB

  // Layer 1: 밴드패스 노이즈
  const noise = ctx.createBufferSource();
  noise.buffer = getNoiseBuffer(ctx, 100, cache);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(2500 * pRand, t);
  bp.frequency.exponentialRampToValueAtTime(800 * pRand, t + 0.07);
  bp.Q.value = 1.5;
  const noiseG = ctx.createGain();
  noiseG.gain.setValueAtTime(0.3 * gRand, t);
  noiseG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
  noise.connect(bp);
  bp.connect(noiseG).connect(dest);
  noise.start(t);

  // Layer 2: 사인 충격파 피치 스윕
  const osc = ctx.createOscillator();
  const oscG = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120 * pRand, t);
  osc.frequency.exponentialRampToValueAtTime(40 * pRand, t + 0.06);
  oscG.gain.setValueAtTime(0.4 * gRand, t);
  oscG.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
  osc.connect(oscG).connect(dest);
  osc.start(t);
  osc.stop(t + 0.07);

  // Layer 3: 서브 베이스 펀치
  const bass = ctx.createOscillator();
  const bassG = ctx.createGain();
  bass.type = 'sine';
  bass.frequency.setValueAtTime(80, t);
  bass.frequency.exponentialRampToValueAtTime(25, t + 0.05);
  bassG.gain.setValueAtTime(0.45 * gRand, t);
  bassG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  bass.connect(bassG).connect(dest);
  bass.start(t);
  bass.stop(t + 0.06);
}

/**
 * 5-레이어 총기 발사음 (Phase 2)
 * 스펙 §3.1 기반 — Body + Transient + Sub + Mechanical + Tail
 * 각 레이어 독립 주파수 대역/엔벨로프/볼륨
 *
 * Layer 1 — Body:       500-2kHz, 200-500ms, 화약 폭발 메인 바디
 * Layer 2 — Transient:  2-8kHz,   50-80ms,   초기 고역 어택
 * Layer 3 — Sub:        60-200Hz, 100-300ms,  서브 베이스 충격파
 * Layer 4 — Mechanical: 1-4kHz,   100-300ms,  슬라이드/볼트 기구음
 * Layer 5 — Tail:       전대역,   500ms-2s,   잔향/감쇠
 */
export function synthGunshot5Layer(
  ctx: AudioContext,
  dest: AudioNode,
  cache: Map<number, AudioBuffer>,
): void {
  const t = ctx.currentTime;
  const pRand = randomPitch(2); // ±2세미톤 (5Layer는 좀 더 보수적)
  const gRand = Math.pow(10, (Math.random() * 4 - 2) / 20); // ±2dB

  // Layer 1: Body — 밴드패스 노이즈 (500-2kHz), 250ms 감쇠
  const bodyNoise = ctx.createBufferSource();
  bodyNoise.buffer = getNoiseBuffer(ctx, 300, cache);
  const bodyBP = ctx.createBiquadFilter();
  bodyBP.type = 'bandpass';
  bodyBP.frequency.setValueAtTime(1500 * pRand, t);
  bodyBP.frequency.exponentialRampToValueAtTime(600 * pRand, t + 0.25);
  bodyBP.Q.value = 0.8;
  const bodyG = ctx.createGain();
  bodyG.gain.setValueAtTime(0.35 * gRand, t);
  bodyG.gain.setValueAtTime(0.35 * gRand, t + 0.005); // 어택 유지
  bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  bodyNoise.connect(bodyBP);
  bodyBP.connect(bodyG).connect(dest);
  bodyNoise.start(t);

  // Layer 2: Transient — 고역 노이즈 버스트 (2-8kHz), 60ms
  const transNoise = ctx.createBufferSource();
  transNoise.buffer = getNoiseBuffer(ctx, 80, cache);
  const transHP = ctx.createBiquadFilter();
  transHP.type = 'highpass';
  transHP.frequency.value = 2000 * pRand;
  const transLP = ctx.createBiquadFilter();
  transLP.type = 'lowpass';
  transLP.frequency.value = 8000 * pRand;
  const transG = ctx.createGain();
  transG.gain.setValueAtTime(0.3 * gRand, t);
  transG.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  transNoise.connect(transHP);
  transHP.connect(transLP);
  transLP.connect(transG).connect(dest);
  transNoise.start(t);

  // Layer 3: Sub — 사인파 (120→40Hz), 200ms 감쇠
  const subOsc = ctx.createOscillator();
  const subG = ctx.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(120 * pRand, t);
  subOsc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
  subG.gain.setValueAtTime(0.45 * gRand, t);
  subG.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  subOsc.connect(subG).connect(dest);
  subOsc.start(t);
  subOsc.stop(t + 0.2);

  // Layer 4: Mechanical — 금속성 클릭 (1-4kHz), 150ms
  const mechOsc = ctx.createOscillator();
  const mechG = ctx.createGain();
  mechOsc.type = 'square';
  mechOsc.frequency.setValueAtTime(3500 * pRand, t + 0.01); // 10ms 딜레이 (메커니즘 후행)
  mechOsc.frequency.exponentialRampToValueAtTime(1200 * pRand, t + 0.15);
  mechG.gain.setValueAtTime(0.0001, t); // 무음 시작
  mechG.gain.linearRampToValueAtTime(0.15 * gRand, t + 0.012);
  mechG.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  mechOsc.connect(mechG).connect(dest);
  mechOsc.start(t);
  mechOsc.stop(t + 0.15);

  // Layer 5: Tail — 로우패스 노이즈 감쇠 (전대역→저역, 800ms)
  const tailNoise = ctx.createBufferSource();
  tailNoise.buffer = getNoiseBuffer(ctx, 1000, cache);
  const tailLP = ctx.createBiquadFilter();
  tailLP.type = 'lowpass';
  tailLP.frequency.setValueAtTime(6000, t);
  tailLP.frequency.exponentialRampToValueAtTime(400, t + 0.8);
  tailLP.Q.value = 0.5;
  const tailG = ctx.createGain();
  tailG.gain.setValueAtTime(0.12 * gRand, t);
  tailG.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  tailNoise.connect(tailLP);
  tailLP.connect(tailG).connect(dest);
  tailNoise.start(t);
}

/**
 * 타겟 스폰 — sine 600→400Hz sweep, 60ms
 */
export function synthSpawn(ctx: AudioContext, dest: AudioNode): void {
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(400, t + 0.05);
  g.gain.setValueAtTime(0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + 0.06);
}
