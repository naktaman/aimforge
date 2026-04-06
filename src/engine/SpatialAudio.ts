/**
 * 공간 오디오 모듈 — PannerNode 3D 사운드 + 거리 감쇠 + 공기 흡수
 * Phase 1 MVP: equalpower 패닝, inverse distance 감쇠, 로우패스 공기 흡수
 *
 * 기획서: docs/research/sound-engine-spec.md §3.1~§3.3
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
 * AudioContext에 연결하여 PannerNode 생성 및 리스너 위치 업데이트
 */
export class SpatialAudio {
  private config: SpatialConfig;

  constructor(config?: Partial<SpatialConfig>) {
    this.config = { ...DEFAULT_SPATIAL_CONFIG, ...config };
  }

  /**
   * PannerNode 생성 — 소스 위치에 따른 3D 패닝
   * @param ctx AudioContext
   * @param position 사운드 소스 월드 위치
   * @returns 설정된 PannerNode
   */
  createPanner(ctx: AudioContext, position: Vec3): PannerNode {
    const panner = ctx.createPanner();
    panner.panningModel = this.config.panningModel;
    panner.distanceModel = this.config.distanceModel;
    panner.refDistance = this.config.refDistance;
    panner.maxDistance = this.config.maxDistance;
    panner.rolloffFactor = this.config.rolloffFactor;

    // 위치 설정 — linearRampToValueAtTime 대신 setPosition (Phase 1)
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;

    return panner;
  }

  /**
   * 리스너 위치 업데이트 — 카메라/플레이어 위치 동기화
   * linearRampToValueAtTime으로 지퍼 노이즈 방지
   * @param ctx AudioContext
   * @param position 리스너(플레이어) 월드 위치
   * @param forward 전방 벡터 (정규화)
   * @param up 상방 벡터 (정규화)
   */
  updateListener(
    ctx: AudioContext,
    position: Vec3,
    forward: Vec3 = { x: 0, y: 0, z: -1 },
    up: Vec3 = { x: 0, y: 1, z: 0 },
  ): void {
    const listener = ctx.listener;
    const t = ctx.currentTime + 0.02; // 20ms 램프로 지퍼 노이즈 방지

    // 위치 램프
    if (listener.positionX) {
      listener.positionX.linearRampToValueAtTime(position.x, t);
      listener.positionY.linearRampToValueAtTime(position.y, t);
      listener.positionZ.linearRampToValueAtTime(position.z, t);
    }

    // 방향 램프 (forward + up)
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
   * 공기 흡수 로우패스 필터 생성 — 거리에 따른 고주파 감쇠
   * 공식: cutoff = 20000 * exp(-distance / 30)
   * @param ctx AudioContext
   * @param distance 소스-리스너 거리
   * @returns BiquadFilterNode (lowpass)
   */
  createAirAbsorption(ctx: AudioContext, distance: number): BiquadFilterNode {
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    // Butterworth Q (평탄한 통과 대역)
    filter.Q.value = 0.7071;
    // 거리 기반 컷오프: 가까우면 ~20kHz (투명), 멀면 저역 통과
    const cutoff = Math.max(200, 20000 * Math.exp(-distance / 30));
    filter.frequency.value = cutoff;
    return filter;
  }

  /**
   * 두 위치 사이의 유클리드 거리 계산
   */
  calcDistance(a: Vec3, b: Vec3): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 소스 위치에 대한 전체 공간 오디오 체인 구성
   * source → airAbsorption → panner → destination
   * @param ctx AudioContext
   * @param sourcePos 사운드 소스 위치
   * @param listenerPos 리스너 위치 (거리 계산용)
   * @param destination 최종 출력 노드
   * @returns 체인 입력 노드 (소스를 여기에 연결)
   */
  createSpatialChain(
    ctx: AudioContext,
    sourcePos: Vec3,
    listenerPos: Vec3,
    destination: AudioNode,
  ): { input: AudioNode; panner: PannerNode } {
    const distance = this.calcDistance(sourcePos, listenerPos);

    // 공기 흡수 필터
    const absorption = this.createAirAbsorption(ctx, distance);

    // PannerNode
    const panner = this.createPanner(ctx, sourcePos);

    // 체인: input(absorption) → panner → destination
    absorption.connect(panner);
    panner.connect(destination);

    return { input: absorption, panner };
  }

  /** 현재 설정 반환 */
  getConfig(): SpatialConfig {
    return { ...this.config };
  }

  /** 설정 업데이트 */
  setConfig(config: Partial<SpatialConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
