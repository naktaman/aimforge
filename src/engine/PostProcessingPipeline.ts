/**
 * 포스트 프로세싱 파이프라인 (B-4 Phase 2)
 * EffectComposer 기반 렌더 파이프라인
 * RenderPass → UnrealBloomPass → OutputPass 체인
 * 블룸 파라미터 실시간 조절 + lowQuality 옵션
 */
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

// ═══════════════ 상수 ═══════════════

/** 블룸 기본 threshold — 이 밝기 이상인 픽셀만 발광 */
const DEFAULT_BLOOM_THRESHOLD = 0.85;

/** 블룸 기본 강도 */
const DEFAULT_BLOOM_STRENGTH = 0.6;

/** 블룸 기본 반지름 — 발광 퍼짐 정도 */
const DEFAULT_BLOOM_RADIUS = 0.4;

/** 저품질 블룸 강도 (성능 절약) */
const LOW_QUALITY_BLOOM_STRENGTH = 0.3;

/** 저품질 블룸 반지름 */
const LOW_QUALITY_BLOOM_RADIUS = 0.2;

/** 저품질 해상도 스케일 (0.5 = 절반 해상도) */
const LOW_QUALITY_RESOLUTION_SCALE = 0.5;

// ═══════════════ 타입 ═══════════════

/** 블룸 파라미터 설정 */
export interface BloomParams {
  /** 블룸 임계값 (0~1, 기본 0.85) — 밝기가 이 값 이상인 픽셀만 블룸 적용 */
  threshold?: number;
  /** 블룸 강도 (0~3, 기본 0.6) */
  strength?: number;
  /** 블룸 반지름 (0~1, 기본 0.4) — 발광 번짐 */
  radius?: number;
}

/** 포스트 프로세싱 전체 설정 */
export interface PostProcessingConfig {
  /** 블룸 활성화 여부 (기본 true) */
  bloomEnabled?: boolean;
  /** 저품질 모드 — 블룸 해상도 절반, 파라미터 축소 (기본 false) */
  lowQuality?: boolean;
  /** 블룸 커스텀 파라미터 */
  bloom?: BloomParams;
}

// ═══════════════ 파이프라인 클래스 ═══════════════

/**
 * 포스트 프로세싱 파이프라인 관리자
 * GameEngine에서 renderer.render() 대신 이 파이프라인의 render() 호출
 */
export class PostProcessingPipeline {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloomPass: UnrealBloomPass;
  private outputPass: OutputPass;
  private renderer: THREE.WebGLRenderer;
  private bloomEnabled: boolean;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    config: PostProcessingConfig = {},
  ) {
    this.renderer = renderer;
    this.bloomEnabled = config.bloomEnabled !== false;

    const size = renderer.getSize(new THREE.Vector2());
    const lowQ = config.lowQuality ?? false;
    const resScale = lowQ ? LOW_QUALITY_RESOLUTION_SCALE : 1;

    // EffectComposer 생성 (내부 렌더 타겟 자동 관리)
    this.composer = new EffectComposer(renderer);

    // Pass 1: 씬 렌더
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Pass 2: UnrealBloomPass — 네온 글로우 효과
    const bloomStrength = config.bloom?.strength
      ?? (lowQ ? LOW_QUALITY_BLOOM_STRENGTH : DEFAULT_BLOOM_STRENGTH);
    const bloomRadius = config.bloom?.radius
      ?? (lowQ ? LOW_QUALITY_BLOOM_RADIUS : DEFAULT_BLOOM_RADIUS);
    const bloomThreshold = config.bloom?.threshold ?? DEFAULT_BLOOM_THRESHOLD;

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.x * resScale, size.y * resScale),
      bloomStrength,
      bloomRadius,
      bloomThreshold,
    );
    this.bloomPass.enabled = this.bloomEnabled;
    this.composer.addPass(this.bloomPass);

    // Pass 3: OutputPass — 톤매핑 + 감마 보정
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  /** 프레임 렌더 — GameEngine.loop()에서 호출 */
  render(): void {
    this.composer.render();
  }

  /** 블룸 활성화/비활성화 토글 */
  setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
  }

  /** 블룸 활성화 여부 */
  isBloomEnabled(): boolean {
    return this.bloomEnabled;
  }

  /** 블룸 파라미터 실시간 업데이트 */
  setBloomParams(params: BloomParams): void {
    if (params.threshold !== undefined) {
      this.bloomPass.threshold = params.threshold;
    }
    if (params.strength !== undefined) {
      this.bloomPass.strength = params.strength;
    }
    if (params.radius !== undefined) {
      this.bloomPass.radius = params.radius;
    }
  }

  /** 현재 블룸 파라미터 조회 */
  getBloomParams(): Required<BloomParams> {
    return {
      threshold: this.bloomPass.threshold,
      strength: this.bloomPass.strength,
      radius: this.bloomPass.radius,
    };
  }

  /** 저품질/고품질 전환 */
  setLowQuality(lowQ: boolean): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    const scale = lowQ ? LOW_QUALITY_RESOLUTION_SCALE : 1;

    this.bloomPass.resolution.set(size.x * scale, size.y * scale);
    this.bloomPass.strength = lowQ ? LOW_QUALITY_BLOOM_STRENGTH : DEFAULT_BLOOM_STRENGTH;
    this.bloomPass.radius = lowQ ? LOW_QUALITY_BLOOM_RADIUS : DEFAULT_BLOOM_RADIUS;
  }

  /** 리사이즈 대응 — canvas 크기 변경 시 호출 */
  setSize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  /** 리소스 정리 */
  dispose(): void {
    this.composer.dispose();
  }
}
