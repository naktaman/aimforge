/**
 * Three.js 핵심 게임 엔진
 * - PerspectiveCamera + WebGLRenderer
 * - Rust raw input 배치 drain → 카메라 회전
 * - requestAnimationFrame 루프
 * - 시나리오/타겟 매니저 통합 포인트
 */
import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { rawToCm, cmToDegrees, DEG2RAD } from '../utils/physics';
import { createEnvironment } from './Environment';
import { requestPointerLock, isPointerLocked, onPointerLockChange } from './PointerLock';
import type { MouseBatch, EngineConfig, PerfData } from '../utils/types';
import type { TargetManager } from './TargetManager';
import type { Scenario } from './scenarios/Scenario';

/** Y축 단위벡터 (yaw 회전축) */
const UP = new THREE.Vector3(0, 1, 0);
/** X축 단위벡터 (pitch 회전축) */
const RIGHT = new THREE.Vector3(1, 0, 0);

export class GameEngine {
  // === Three.js 핵심 객체 ===
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private canvas: HTMLCanvasElement;

  // === 카메라 회전 상태 (yaw/pitch 분리로 gimbal lock 방지) ===
  private yaw = 0;   // 수평 회전 (라디안)
  private pitch = 0; // 수직 회전 (라디안, ±89° clamp)

  // === 입력 설정 ===
  private dpi: number;
  private cmPer360: number;
  private currentMultiplier = 1; // 줌 배율

  // === 게임 루프 ===
  private animFrameId: number | null = null;
  private isRunning = false;
  private lastTime = 0;
  private capturing = false;

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

  // === 콜백 ===
  private onFpsUpdate: ((fps: number) => void) | null = null;
  private onPointerLockStateChange: ((locked: boolean) => void) | null = null;

  // === 퍼포먼스 측정 (Phase 5) ===
  private frameTimeMs = 0;
  private inputLatencyUs = 0;
  private onPerfUpdate: ((data: PerfData) => void) | null = null;

  // === 입력 더블 버퍼 (Phase 5: 레이턴시 최소화) ===
  private pendingBatch: MouseBatch | null = null;
  private fetchingBatch = false;

  constructor(canvas: HTMLCanvasElement, config: EngineConfig) {
    this.canvas = canvas;
    this.dpi = config.dpi;
    this.cmPer360 = config.cmPer360;

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
    this.camera.position.set(0, 1.6, 0); // 눈 높이 ~1.6m

    // 환경 구성 (Group 반환 — counter-strafe에서 이동용)
    this.environmentGroup = createEnvironment(this.scene);

    // WebGL 컨텍스트 손실 핸들링
    this.setupContextHandlers();

    // 리사이즈 대응
    this.handleResize = this.handleResize.bind(this);
    window.addEventListener('resize', this.handleResize);

    // 클릭 이벤트 (Pointer Lock 진입)
    canvas.addEventListener('click', () => {
      if (!isPointerLocked()) {
        requestPointerLock(canvas);
      }
    });
  }

  // === 공개 API ===

  /** 게임 루프 시작 + Raw Input 캡처 시작 */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    // Rust Raw Input 캡처 시작
    try {
      await invoke('start_mouse_capture');
      this.capturing = true;
    } catch (e) {
      console.warn('마우스 캡처 시작 실패 (이미 실행 중?):', e);
      this.capturing = true; // 이미 실행 중이면 계속 진행
    }

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
    if (this.capturing) {
      try {
        await invoke('stop_mouse_capture');
      } catch (e) {
        console.warn('마우스 캡처 중지 실패:', e);
      }
      this.capturing = false;
    }

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
    this.currentMultiplier = multiplier;
  }

  /** 감도 변경 */
  setSensitivity(cmPer360: number): void {
    this.cmPer360 = cmPer360;
  }

  /** DPI 변경 */
  setDpi(dpi: number): void {
    this.dpi = dpi;
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

  /** 현재 yaw/pitch (라디안) */
  getRotation(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
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

  /** 리소스 정리 — 모든 Three.js 리소스 명시적 해제 */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);

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

  /** WebGL 컨텍스트 손실 감지 + 복구 시도 */
  private setupContextHandlers(): void {
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.stop();
      console.error('[GameEngine] WebGL 컨텍스트 손실');
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      console.info('[GameEngine] WebGL 컨텍스트 복구됨');
    });
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
        inputLatencyUs: this.inputLatencyUs,
        geometries: this.renderer.info.memory.geometries,
        textures: this.renderer.info.memory.textures,
      });
      this.frameCount = 0;
      this.fpsAccumulator = 0;
    }

    // 마우스 입력 처리 — 더블 버퍼 패턴으로 IPC 지연 최소화
    if (this.capturing && isPointerLocked()) {
      // 이전 프레임에서 가져온 배치를 즉시 적용
      if (this.pendingBatch) {
        const batch = this.pendingBatch;
        this.pendingBatch = null;
        if (batch.total_dx !== 0 || batch.total_dy !== 0) {
          this.applyMouseDelta(batch.total_dx, batch.total_dy);
        }
        if (batch.button_events.length > 0 && this.activeScenario) {
          for (const evt of batch.button_events) {
            if (evt.button === 'Left') {
              this.activeScenario.onClick();
            }
          }
        }
        // 입력 레이턴시 추정 (최신 이벤트 타임스탬프 기준)
        if (batch.latest_timestamp_us) {
          const nowUs = performance.now() * 1000;
          this.inputLatencyUs = Math.max(0, nowUs - batch.latest_timestamp_us);
        }
      }
      // 다음 프레임용 배치를 비동기로 가져옴 (렌더 블로킹 없음)
      this.prefetchMouseBatch();
    }

    // 시나리오 업데이트
    if (this.activeScenario) {
      this.activeScenario.update(deltaTime);
    }

    // 타겟 매니저 업데이트
    if (this.targetManager) {
      this.targetManager.update(deltaTime);
    }

    // 렌더
    this.renderer.render(this.scene, this.camera);

    // 다음 프레임 예약
    this.animFrameId = requestAnimationFrame((t) => this.loop(t));
  }

  /** 다음 프레임용 마우스 배치를 비동기 프리페치 (렌더 블로킹 없음) */
  private prefetchMouseBatch(): void {
    if (this.fetchingBatch) return; // 이미 가져오는 중이면 스킵
    this.fetchingBatch = true;
    invoke('drain_mouse_batch')
      .then((batch) => {
        this.pendingBatch = batch as MouseBatch;
        this.fetchingBatch = false;
      })
      .catch(() => {
        this.fetchingBatch = false;
      });
  }

  /** raw delta → 카메라 회전 적용 */
  private applyMouseDelta(totalDx: number, totalDy: number): void {
    // raw delta → cm
    const [cmX, cmY] = rawToCm(totalDx, totalDy, this.dpi);
    // cm → degrees (줌 배율 적용: effectiveCm360 = baseCm360 * multiplier)
    const effectiveCm360 = this.cmPer360 * this.currentMultiplier;
    const degX = cmToDegrees(cmX, effectiveCm360);
    const degY = cmToDegrees(cmY, effectiveCm360);

    // 회전 적용 (좌로 이동 = yaw 증가, 위로 이동 = pitch 증가)
    this.yaw -= degX * DEG2RAD;
    this.pitch -= degY * DEG2RAD;

    // pitch ±89° clamp (직상/직하 보기 제한)
    const maxPitch = 89 * DEG2RAD;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Quaternion으로 카메라 회전 적용 (gimbal lock 방지)
    const qYaw = new THREE.Quaternion().setFromAxisAngle(UP, this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(RIGHT, this.pitch);
    this.camera.quaternion.copy(qYaw).multiply(qPitch);
  }

  /** 윈도우 리사이즈 대응 */
  private handleResize(): void {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}
