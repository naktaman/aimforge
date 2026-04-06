/**
 * Three.js 핵심 게임 엔진
 * - PerspectiveCamera + WebGLRenderer
 * - InputHandler를 통한 마우스 입력 처리
 * - requestAnimationFrame 루프
 * - 시나리오/타겟 매니저 통합 포인트
 */
import * as THREE from 'three';
import { createEnvironment } from './Environment';
import { requestPointerLock, isPointerLocked, onPointerLockChange } from './PointerLock';
import { InputHandler } from './InputHandler';
import { WeaponViewModel } from './WeaponViewModel';
import type { FireMode } from './FireModeController';
import { EYE_HEIGHT_M } from '../config/constants';
import type { WeaponStyle } from './WeaponViewModel';
import type { EngineConfig, PerfData } from '../utils/types';
import type { TargetManager } from './TargetManager';
import type { Scenario } from './scenarios/Scenario';

export class GameEngine {
  // === Three.js 핵심 객체 ===
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  // === 입력 핸들러 (마우스 입력 + 발사 + 반동 전담) ===
  private inputHandler: InputHandler;

  // === 게임 루프 ===
  private animFrameId: number | null = null;
  private isRunning = false;
  private lastTime = 0;

  // === FPS 측정 ===
  private frameCount = 0;
  private fpsAccumulator = 0;
  private currentFps = 0;

  // === 서브시스템 ===
  private targetManager: TargetManager | null = null;
  private activeScenario: Scenario | null = null;
  private environmentGroup: THREE.Group | null = null;

  // === Pointer Lock 해제 콜백 ===
  private cleanupPointerLock: (() => void) | null = null;

  // === 이벤트 핸들러 참조 (정리용) ===
  private handleCanvasClick: (() => void) | null = null;
  private handleContextLost: ((e: Event) => void) | null = null;
  private handleContextRestored: (() => void) | null = null;

  // === 콜백 ===
  private onFpsUpdate: ((fps: number) => void) | null = null;
  private onPointerLockStateChange: ((locked: boolean) => void) | null = null;
  private onShoot: ((hit: boolean, hitResult: import('../utils/types').HitResult | null) => void) | null = null;

  // === 퍼포먼스 측정 (Phase 5) ===
  private frameTimeMs = 0;
  private onPerfUpdate: ((data: PerfData) => void) | null = null;

  // === 1인칭 무기 뷰모델 ===
  private weaponViewModel: WeaponViewModel;
  private weaponVisible = true;

  constructor(canvas: HTMLCanvasElement, config: EngineConfig) {
    this.canvas = canvas;

    // 입력 핸들러 초기화 (마우스 + 발사 + 반동 전담)
    this.inputHandler = new InputHandler(config.dpi, config.cmPer360);

    // Three.js 렌더러 초기화
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    // 씬 생성
    this.scene = new THREE.Scene();

    // 카메라: 게임 FOV 적용
    this.camera = new THREE.PerspectiveCamera(
      config.hfov,
      config.aspectRatio,
      0.1,
      500,
    );
    this.camera.position.set(0, EYE_HEIGHT_M, 0); // 눈 높이

    // 환경 구성 (Group 반환 — counter-strafe에서 이동용)
    this.environmentGroup = createEnvironment(this.scene);

    // 1인칭 무기 뷰모델 초기화
    this.weaponViewModel = new WeaponViewModel();
    this.weaponViewModel.updateAspect(config.aspectRatio);

    // WebGL 컨텍스트 손실 핸들링
    this.setupContextHandlers();

    // 리사이즈 대응
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // 클릭 이벤트 (Pointer Lock 진입) — 핸들러 참조 저장하여 dispose 시 제거
    this.handleCanvasClick = () => {
      if (!isPointerLocked()) {
        requestPointerLock(canvas);
      }
    };
    canvas.addEventListener('click', this.handleCanvasClick);

    // 마우스 업 이벤트 등록 (auto 모드 연사 중단용)
    this.inputHandler.setupMouseUpHandler();
  }

  // === 공개 API ===

  /** 게임 루프 시작 + Raw Input 캡처 시작 */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Rust Raw Input 캡처 시작
    await this.inputHandler.startCapture();

    // Pointer Lock 상태 감지
    this.cleanupPointerLock = onPointerLockChange((locked) => {
      this.onPointerLockStateChange?.(locked);
    });

    // rAF 루프 시작
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /** 게임 루프 중지 + Raw Input 캡처 중지 */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    // Raw Input 캡처 중지
    await this.inputHandler.stopCapture();

    if (this.cleanupPointerLock) {
      this.cleanupPointerLock();
      this.cleanupPointerLock = null;
    }
  }

  /** FOV 변경 (스코프 전환 시) */
  setFov(fovDegrees: number): void {
    this.camera.fov = fovDegrees;
    this.camera.updateProjectionMatrix();
  }

  /** 스코프 전환: FOV + 감도 배율 동시 변경 */
  setScope(scopeFov: number, multiplier: number): void {
    this.setFov(scopeFov);
    this.inputHandler.setScope(multiplier);
  }

  /** 감도 변경 — InputHandler에 위임 */
  setSensitivity(cmPer360: number): void {
    this.inputHandler.setSensitivity(cmPer360);
  }

  /** DPI 변경 — InputHandler에 위임 */
  setDpi(dpi: number): void {
    this.inputHandler.setDpi(dpi);
  }

  /** 타겟 매니저 연결 */
  setTargetManager(tm: TargetManager): void {
    this.targetManager = tm;
  }

  /** 시나리오 연결 */
  setScenario(scenario: Scenario | null): void {
    this.activeScenario = scenario;
  }

  /** Three.js scene 접근 */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /** 카메라 접근 */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /** 현재 카메라 정면 방향 벡터 */
  getCameraForward(): THREE.Vector3 {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    return dir;
  }

  /** 현재 yaw/pitch (라디안) — InputHandler에서 가져옴 */
  getRotation(): { yaw: number; pitch: number } {
    return this.inputHandler.getRotation();
  }

  /** 환경 그룹 접근 (counter-strafe 시나리오에서 이동용) */
  getEnvironmentGroup(): THREE.Group | null {
    return this.environmentGroup;
  }

  /** 현재 FPS */
  getFps(): number {
    return this.currentFps;
  }

  /** FPS 업데이트 콜백 설정 */
  setOnFpsUpdate(cb: (fps: number) => void): void {
    this.onFpsUpdate = cb;
  }

  /** Pointer Lock 상태 변경 콜백 */
  setOnPointerLockStateChange(cb: (locked: boolean) => void): void {
    this.onPointerLockStateChange = cb;
  }

  /** 사격 이벤트 콜백 (hit 여부 전달) */
  setOnShoot(cb: (hit: boolean, hitResult: import('../utils/types').HitResult | null) => void): void {
    this.onShoot = cb;
  }

  /** 발사 모드 설정 — InputHandler에 위임 */
  setFireMode(mode: FireMode): void {
    this.inputHandler.setFireMode(mode);
  }

  /** RPM 설정 — InputHandler에 위임 */
  setFireRpm(rpm: number): void {
    this.inputHandler.setFireRpm(rpm);
  }

  /** 발사 모드 순환 (semi → auto → burst) — B키 등에서 호출 */
  cycleFireMode(): FireMode {
    return this.inputHandler.cycleFireMode();
  }

  /** 무기 스타일 변경 */
  setWeaponStyle(style: WeaponStyle): void {
    this.weaponViewModel.setStyle(style);
  }

  /** 무기 모델 표시/숨김 */
  setWeaponVisible(visible: boolean): void {
    this.weaponVisible = visible;
  }

  /** 반동 파라미터 설정 — InputHandler에 위임 */
  setRecoil(verticalDeg: number, horizontalSpreadDeg: number, recoveryRate: number): void {
    this.inputHandler.setRecoil(verticalDeg, horizontalSpreadDeg, recoveryRate);
  }

  /** 리소스 정리 — 모든 Three.js 리소스 명시적 해제 */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);

    // 입력 핸들러 마우스 업 리스너 정리
    this.inputHandler.cleanupMouseUpHandler();

    // 캔버스 이벤트 리스너 정리
    if (this.handleCanvasClick) {
      this.canvas.removeEventListener('click', this.handleCanvasClick);
      this.handleCanvasClick = null;
    }
    if (this.handleContextLost) {
      this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
      this.handleContextLost = null;
    }
    if (this.handleContextRestored) {
      this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
      this.handleContextRestored = null;
    }

    // 무기 뷰모델 정리
    this.weaponViewModel.dispose();

    // 씬 내 모든 geometry/material 명시적 dispose (메모리 누수 방지)
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
    this.scene.clear();
    this.renderer.dispose();
    this.environmentGroup = null;
  }

  /** 퍼포먼스 데이터 콜백 설정 */
  setOnPerfUpdate(cb: (data: PerfData) => void): void {
    this.onPerfUpdate = cb;
  }

  /** 현재 메모리 사용 정보 (Three.js renderer) */
  getMemoryInfo(): { geometries: number; textures: number } {
    const info = this.renderer.info;
    return {
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
  }

  /** WebGL 컨텍스트 손실 감지 + 복구 시도 — 핸들러 참조 저장 */
  private setupContextHandlers(): void {
    this.handleContextLost = (e: Event) => {
      e.preventDefault();
      this.stop();
      console.error('[GameEngine] WebGL 컨텍스트 손실');
    };
    this.handleContextRestored = () => {
      console.info('[GameEngine] WebGL 컨텍스트 복구됨');
    };
    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
  }

  // === 내부 메서드 ===

  /** 메인 게임 루프 (requestAnimationFrame 콜백) */
  private loop(time: DOMHighResTimeStamp): void {
    if (!this.isRunning) return;

    const deltaTime = (time - this.lastTime) / 1000; // 초 단위
    this.lastTime = time;

    // FPS + 프레임 타임 계산 (1초마다 업데이트)
    this.frameTimeMs = deltaTime * 1000;
    this.frameCount++;
    this.fpsAccumulator += deltaTime;
    if (this.fpsAccumulator >= 1.0) {
      this.currentFps = Math.round(this.frameCount / this.fpsAccumulator);
      this.onFpsUpdate?.(this.currentFps);
      // 퍼포먼스 데이터 콜백
      this.onPerfUpdate?.({
        fps: this.currentFps,
        frameTimeMs: this.frameTimeMs,
        inputLatencyUs: this.inputHandler.getInputLatencyUs(),
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      });
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    // 입력 처리 — InputHandler에 위임 (마우스 + 발사 + 반동)
    this.inputHandler.processFrame(deltaTime, this.camera, {
      targetManager: this.targetManager,
      activeScenario: this.activeScenario,
      onShoot: this.onShoot,
      weaponViewModel: this.weaponViewModel,
    });

    // 시나리오 업데이트
    if (this.activeScenario) {
      this.activeScenario.update(deltaTime);
    }

    // 타겟 매니저 업데이트
    if (this.targetManager) {
      this.targetManager.update(deltaTime);
    }

    // 무기 뷰모델 애니메이션 업데이트
    this.weaponViewModel.update(deltaTime);

    // 메인 씬 렌더
    this.renderer.render(this.scene, this.camera);

    // 무기 오버레이 렌더 (깊이 클리어 후 위에 그림)
    if (this.weaponVisible) {
      this.weaponViewModel.render(this.renderer);
    }

    // 다음 프레임 예약
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  /** 윈도우 리사이즈 대응 */
  private handleResize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    // 무기 오버레이 카메라도 종횡비 업데이트
    this.weaponViewModel.updateAspect(width / height);
  }
}
