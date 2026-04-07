/**
 * 공간 오디오 모듈 — 3D 사운드 + 거리 감쇠 + 공기 흡수 + HRTF + 리버브
 * Phase 1: equalpower 패닝, inverse distance 감쇠, 로우패스 공기 흡수
 * Phase 2: HRTF 핵심소스, ConvolverNode 리버브, 3밴드 공기 흡수
 *
 * 기획서: docs/research/sound-engine-spec.md §3~§5
 */

/** 3D 위치 벡터 (Three.js 좌표계 호환) */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 공간 오디오 설정 */
export interface SpatialConfig {
  panningModel: PanningModelType;     // 'equalpower' | 'HRTF'
  distanceModel: DistanceModelType;   // 'inverse' | 'linear' | 'exponential'
  refDistance: number;                 // 기준 거리 (이 안에서는 감쇠 없음)
  maxDistance: number;                 // 최대 거리
  rolloffFactor: number;              // 감쇠 기울기
}

/** 리버브 프리셋 설정 */
export interface ReverbPreset {
  /** 프리셋 이름 */
  name: string;
  /** RT60 감쇠 시간 (초) */
  decayTime: number;
  /** 프리딜레이 (초, 직접음과 리버브 분리) */
  preDelay: number;
  /** 웨트 게인 (0~1) */
  wetGain: number;
  /** 드라이 게인 (0~1) */
  dryGain: number;
  /** 고역 감쇠 주파수 (Hz, IR 생성 시 사용) */
  lpFreq: number;
}

/** 내장 리버브 프리셋 */
export const REVERB_PRESETS: Record<string, ReverbPreset> = {
  /** 실내 — 짧은 잔향, 선명한 직접음 */
  indoor: {
    name: 'indoor',
    decayTime: 0.4,
    preDelay: 0.015,
    wetGain: 0.25,
    dryGain: 0.8,
    lpFreq: 8000,
  },
  /** 야외 — 최소 잔향 */
  outdoor: {
    name: 'outdoor',
    decayTime: 0.15,
    preDelay: 0.005,
    wetGain: 0.1,
    dryGain: 0.9,
    lpFreq: 4000,
  },
  /** 아레나/창고 — 긴 잔향 */
  arena: {
    name: 'arena',
    decayTime: 0.8,
    preDelay: 0.03,
    wetGain: 0.35,
    dryGain: 0.7,
    lpFreq: 10000,
  },
  /** 없음 — 리버브 비활성화 */
  none: {
    name: 'none',
    decayTime: 0,
    preDelay: 0,
    wetGain: 0,
    dryGain: 1,
    lpFreq: 20000,
  },
};

/** Phase 1 MVP 기본 설정 — equalpower, inverse, refDist=2.5 */
const DEFAULT_SPATIAL_CONFIG: SpatialConfig = {
  panningModel: 'equalpower',
  distanceModel: 'inverse',
  refDistance: 2.5,
  maxDistance: 200,
  rolloffFactor: 1.2,
};

/**
 * 공간 오디오 관리자
 * AudioContext에 연결하여 PannerNode 생성, 리스너 위치 업데이트,
 * HRTF 패닝, ConvolverNode 리버브 관리
 */
export class SpatialAudio {
  private config: SpatialConfig;

  /** 리버브 ConvolverNode (프리셋별 캐시) */
  private reverbConvolver: ConvolverNode | null = null;
  /** 리버브 웨트 게인 */
  private reverbWetGain: GainNode | null = null;
  /** 리버브 드라이 게인 */
  private reverbDryGain: GainNode | null = null;
  /** 리버브 프리딜레이 */
  private reverbPreDelay: DelayNode | null = null;
  /** 현재 리버브 프리셋 */
  private currentReverbPreset: ReverbPreset = REVERB_PRESETS.none;
  /** IR 버퍼 캐시 (프리셋 이름 → AudioBuffer) */
  private irCache = new Map<string, AudioBuffer>();

  constructor(config?: Partial<SpatialConfig>) {
    this.config = { ...DEFAULT_SPATIAL_CONFIG, ...config };
  }

  /**
   * PannerNode 생성 — 소스 위치에 따른 3D 패닝
   * @param ctx AudioContext
   * @param position 사운드 소스 월드 위치
   * @param useHrtf true면 HRTF, false면 기본 설정의 panningModel 사용
   */
  createPanner(ctx: AudioContext, position: Vec3, useHrtf?: boolean): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = useHrtf ? 'HRTF' : this.config.panningModel;
    panner.distanceModel = this.config.distanceModel;
    panner.refDistance = this.config.refDistance;
    panner.maxDistance = this.config.maxDistance;
    panner.rolloffFactor = this.config.rolloffFactor;

    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;

    return panner;
  }

  /**
   * 리스너 위치 업데이트 — 카메라/플레이어 위치 동기화
   * linearRampToValueAtTime으로 지퍼 노이즈 방지
   */
  updateListener(
    ctx: AudioContext,
    position: Vec3,
    forward: Vec3 = { x: 0, y: 0, z: -1 },
    up: Vec3 = { x: 0, y: 1, z: 0 },
  ): void {
    const listener = ctx.listener;
    const t = ctx.currentTime + 0.02; // 20ms 램프

    if (listener.positionX) {
      listener.positionX.linearRampToValueAtTime(position.x, t);
      listener.positionY.linearRampToValueAtTime(position.y, t);
      listener.positionZ.linearRampToValueAtTime(position.z, t);
    }

    if (listener.forwardX) {
      listener.forwardX.linearRampToValueAtTime(forward.x, t);
      listener.forwardY.linearRampToValueAtTime(forward.y, t);
      listener.forwardZ.linearRampToValueAtTime(forward.z, t);
      listener.upX.linearRampToValueAtTime(up.x, t);
      listener.upY.linearRampToValueAtTime(up.y, t);
      listener.upZ.linearRampToValueAtTime(up.z, t);
    }
  }

  /**
   * 3밴드 공기 흡수 필터 체인 — 거리에 따른 주파수 의존 감쇠
   * 저역(≤800Hz): 최소 감쇠, 중역(800-8kHz): 중간, 고역(>8kHz): 공격적 감쇠
   * 스펙 §4.3 기반 개선된 모델
   * @returns 체인 입력 노드 (첫 번째 필터)
   */
  createAirAbsorption(ctx: AudioContext, distance: number): BiquadFilterNode {
    // 메인 로우패스 — 고역 롤오프 (스펙 감쇠 커브 기반)
    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.Q.value = 0.7071; // Butterworth

    // 스펙 기반 거리→컷오프 매핑 (비선형, 더 정교한 모델)
    // 0m→20kHz, 10m→10kHz, 20m→6kHz, 30m→4kHz, 50m→2kHz, 100m→800Hz
    const cutoff = this.calcAirAbsorptionCutoff(distance);
    lpFilter.frequency.value = cutoff;

    // 중역 셸빙 — 800Hz~8kHz 구간 미세 감쇠
    const midShelf = ctx.createBiquadFilter();
    midShelf.type = 'peaking';
    midShelf.frequency.value = 3000;
    midShelf.Q.value = 0.5;
    // 거리에 비례하여 중역 감쇠 (-0.5dB per 10m, 최대 -6dB)
    midShelf.gain.value = Math.max(-6, -distance * 0.05);

    // 체인: lpFilter → midShelf
    lpFilter.connect(midShelf);

    return lpFilter;
  }

  /**
   * 스펙 기반 공기 흡수 컷오프 주파수 계산
   * 구간별 보간으로 스펙의 비선형 감쇠 커브를 정확히 근사
   */
  private calcAirAbsorptionCutoff(distance: number): number {
    // 스펙 §1.3 감쇠 커브 데이터포인트
    const points: Array<[number, number]> = [
      [0, 20000], [10, 10000], [20, 6000],
      [30, 4000], [50, 2000], [100, 800],
    ];

    if (distance <= 0) return 20000;
    if (distance >= 100) return 800;

    // 구간 찾아 선형 보간
    for (let i = 0; i < points.length - 1; i++) {
      const [d0, f0] = points[i];
      const [d1, f1] = points[i + 1];
      if (distance >= d0 && distance <= d1) {
        const t = (distance - d0) / (d1 - d0);
        // 로그 스케일 보간 (주파수는 로그 인지)
        return f0 * Math.pow(f1 / f0, t);
      }
    }
    return 800;
  }

  /** 두 위치 사이의 유클리드 거리 계산 */
  calcDistance(a: Vec3, b: Vec3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 공간 오디오 체인 구성 — HRTF 지정 가능
   * source → airAbsorption → midShelf → panner → destination
   * @param useHrtf 핵심 소스(히트/발사)는 true, 비핵심은 false
   */
  createSpatialChain(
    ctx: AudioContext,
    sourcePos: Vec3,
    listenerPos: Vec3,
    destination: AudioNode,
    useHrtf = false,
  ): { input: AudioNode; panner: PannerNode } {
    const distance = this.calcDistance(sourcePos, listenerPos);

    // PannerNode (HRTF 또는 equalpower)
    const panner = this.createPanner(ctx, sourcePos, useHrtf);

    // 3밴드 공기 흡수 체인을 직접 빌드 (lpFilter → midShelf → panner)
    const lpFilter = ctx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.Q.value = 0.7071;
    lpFilter.frequency.value = this.calcAirAbsorptionCutoff(distance);

    const midShelf = ctx.createBiquadFilter();
    midShelf.type = 'peaking';
    midShelf.frequency.value = 3000;
    midShelf.Q.value = 0.5;
    midShelf.gain.value = Math.max(-6, -distance * 0.05);

    lpFilter.connect(midShelf);
    midShelf.connect(panner);
    panner.connect(destination);

    return { input: lpFilter, panner };
  }

  // ─── 리버브 시스템 (Phase 2) ─────────────────────────────────

  /**
   * 리버브 프리셋 설정 — ConvolverNode 기반 환경 리버브
   * 프로시저럴 IR 생성 후 캐싱
   */
  setReverbPreset(ctx: AudioContext, preset: ReverbPreset, destination: AudioNode): void {
    this.currentReverbPreset = preset;

    // 기존 리버브 노드 정리
    this.disposeReverb();

    if (preset.decayTime <= 0) return; // 'none' 프리셋

    // IR 생성 또는 캐시에서 가져오기
    const irBuffer = this.getOrCreateIR(ctx, preset);

    // ConvolverNode
    this.reverbConvolver = ctx.createConvolver();
    this.reverbConvolver.buffer = irBuffer;

    // 프리딜레이 (직접음과 리버브 시간 분리)
    this.reverbPreDelay = ctx.createDelay(0.1);
    this.reverbPreDelay.delayTime.value = preset.preDelay;

    // 웨트/드라이 게인
    this.reverbWetGain = ctx.createGain();
    this.reverbWetGain.gain.value = preset.wetGain;

    this.reverbDryGain = ctx.createGain();
    this.reverbDryGain.gain.value = preset.dryGain;

    // 라우팅: preDelay → convolver → wetGain → destination
    this.reverbPreDelay.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(destination);

    // 드라이 경로: dryGain → destination
    this.reverbDryGain.connect(destination);
  }

  /**
   * 리버브 센드 노드 반환 — 소스를 여기에 연결하면 리버브 적용
   * @returns [dryInput, reverbSend] 또는 리버브 비활성화 시 [destination, null]
   */
  getReverbNodes(): { dryInput: GainNode | null; reverbSend: DelayNode | null } {
    return {
      dryInput: this.reverbDryGain,
      reverbSend: this.reverbPreDelay,
    };
  }

  /** 현재 리버브 프리셋 */
  getCurrentReverbPreset(): ReverbPreset {
    return { ...this.currentReverbPreset };
  }

  /**
   * 프로시저럴 임펄스 응답 생성 (Moorer 방식)
   * 지수 감쇠 화이트 노이즈 + 고역 감쇠 + 페이드인
   */
  private getOrCreateIR(ctx: AudioContext, preset: ReverbPreset): AudioBuffer {
    if (this.irCache.has(preset.name)) {
      return this.irCache.get(preset.name)!;
    }

    const sampleRate = ctx.sampleRate;
    const length = Math.ceil(sampleRate * preset.decayTime);
    // 모노 IR (성능 최적화 — 스펙 §5.4)
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const fadeInTime = 0.005; // 5ms 페이드인 (클릭 방지)
    const fadeInSamples = Math.ceil(sampleRate * fadeInTime);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // 화이트 노이즈 × 지수 감쇠 (-60dB at decayTime)
      const noise = Math.random() * 2 - 1;
      const decay = Math.exp(-6.908 * t / preset.decayTime);

      // 페이드인 (클릭 방지)
      const fadeIn = i < fadeInSamples ? i / fadeInSamples : 1.0;

      // 고역 감쇠 시뮬레이션 — 시간이 지날수록 고역 줄어듦
      // 간단한 1차 IIR로 근사
      const highCut = 1.0 - (t / preset.decayTime) * 0.5;

      data[i] = noise * decay * fadeIn * highCut;
    }

    this.irCache.set(preset.name, buffer);
    return buffer;
  }

  /** 리버브 노드 정리 */
  private disposeReverb(): void {
    this.reverbConvolver?.disconnect();
    this.reverbWetGain?.disconnect();
    this.reverbDryGain?.disconnect();
    this.reverbPreDelay?.disconnect();
    this.reverbConvolver = null;
    this.reverbWetGain = null;
    this.reverbDryGain = null;
    this.reverbPreDelay = null;
  }

  /** 현재 설정 반환 */
  getConfig(): SpatialConfig {
    return { ...this.config };
  }

  /** 설정 업데이트 */
  setConfig(config: Partial<SpatialConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 리소스 정리 */
  dispose(): void {
    this.disposeReverb();
    this.irCache.clear();
  }
}
