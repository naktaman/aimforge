/**
 * 입력 핸들러 — 마우스 입력 처리, 포인터 락, 발사 관리
 * GameEngine에서 분리하여 입력 관련 로직을 전담
 *
 * - Rust raw input 배치 drain → yaw/pitch 회전
 * - 더블 버퍼 패턴으로 IPC 지연 최소화
 * - 발사 모드 컨트롤러 (semi/auto/burst)
 * - 반동(리코일) 적용 + 자연 회복
 */
import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { rawToCm, cmToDegrees, DEG2RAD } from '../utils/physics';
import { isPointerLocked } from './PointerLock';
import { FireModeController } from './FireModeController';
import type { FireMode } from './FireModeController';
import type { WeaponViewModel } from './WeaponViewModel';
import type { MouseBatch, HitResult } from '../utils/types';
import type { TargetManager } from './TargetManager';
import type { Scenario } from './scenarios/Scenario';

/** Y축 단위벡터 (yaw 회전축) */
const UP = new THREE.Vector3(0, 1, 0);
/** X축 단위벡터 (pitch 회전축) */
const RIGHT = new THREE.Vector3(1, 0, 0);

/** processFrame에 전달할 외부 컨텍스트 */
export interface InputContext {
  targetManager: TargetManager | null;
  activeScenario: Scenario | null;
  onShoot: ((hit: boolean, hitResult: HitResult | null) => void) | null;
  weaponViewModel: WeaponViewModel;
}

/**
 * 입력 핸들러 클래스
 * 마우스 입력, 발사, 반동 처리를 GameEngine에서 분리
 */
export class InputHandler {
  // === 카메라 회전 상태 (yaw/pitch 분리로 gimbal lock 방지) ===
  private yaw = 0;   // 수평 회전 (라디안)
  private pitch = 0; // 수직 회전 (라디안, ±89° clamp)

  // === 입력 설정 ===
  private dpi: number;
  private cmPer360: number;
  private currentMultiplier = 1; // 줌 배율

  // === 캡처 상태 ===
  private capturing = false;

  // === 입력 더블 버퍼 (레이턴시 최소화) ===
  private pendingBatch: MouseBatch | null = null;
  private fetchingBatch = false;

  // === 반동(리코일) ===
  private recoilVerticalDeg = 0;
  private recoilHorizontalSpreadDeg = 0;
  private recoilRecoveryRate = 0;
  private recoilAccumulated = 0; // 누적 반동 (recovery용)

  // === 입력 레이턴시 측정 ===
  private inputLatencyUs = 0;

  // === 발사 모드 컨트롤러 ===
  private fireModeController: FireModeController;

  // === 마우스 업 핸들러 참조 (정리용) ===
  private handleMouseUp: ((e: MouseEvent) => void) | null = null;

  constructor(dpi: number, cmPer360: number) {
    this.dpi = dpi;
    this.cmPer360 = cmPer360;
    this.fireModeController = new FireModeController();
  }

  // === Getters / Setters ===

  /** 현재 yaw/pitch (라디안) */
  getRotation(): { yaw: number; pitch: number } {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  /** 입력 레이턴시 (마이크로초) */
  getInputLatencyUs(): number {
    return this.inputLatencyUs;
  }

  /** 캡처 중 여부 */
  isCapturing(): boolean {
    return this.capturing;
  }

  /** 감도 변경 */
  setSensitivity(cmPer360: number): void {
    this.cmPer360 = cmPer360;
  }

  /** DPI 변경 */
  setDpi(dpi: number): void {
    this.dpi = dpi;
  }

  /** 스코프 배율 설정 */
  setScope(multiplier: number): void {
    this.currentMultiplier = multiplier;
  }

  /** 반동 파라미터 설정 */
  setRecoil(verticalDeg: number, horizontalSpreadDeg: number, recoveryRate: number): void {
    this.recoilVerticalDeg = verticalDeg;
    this.recoilHorizontalSpreadDeg = horizontalSpreadDeg;
    this.recoilRecoveryRate = recoveryRate;
    this.recoilAccumulated = 0;
  }

  /** 발사 모드 설정 */
  setFireMode(mode: FireMode): void {
    this.fireModeController.setMode(mode);
  }

  /** RPM 설정 */
  setFireRpm(rpm: number): void {
    this.fireModeController.setRpm(rpm);
  }

  /** 발사 모드 순환 (semi → auto → burst) */
  cycleFireMode(): FireMode {
    return this.fireModeController.cycleMode();
  }

  // === 캡처 시작/중지 ===

  /** Rust Raw Input 캡처 시작 */
  async startCapture(): Promise<void> {
    try {
      await invoke('start_mouse_capture');
      this.capturing = true;
    } catch (e) {
      const msg = String(e).toLowerCase();
      // 이미 실행 중인 경우만 계속 진행, 그 외 실패는 capturing=false 유지
      if (msg.includes('already') || msg.includes('이미')) {
        this.capturing = true;
      } else {
        console.error('마우스 캡처 시작 실패:', e);
        this.capturing = false;
      }
    }
  }

  /** Rust Raw Input 캡처 중지 */
  async stopCapture(): Promise<void> {
    if (this.capturing) {
      try {
        await invoke('stop_mouse_capture');
      } catch (e) {
        console.warn('마우스 캡처 중지 실패:', e);
      }
      this.capturing = false;
    }
  }

  // === 마우스 업 이벤트 핸들러 ===

  /** 마우스 업 이벤트 등록 (auto 모드 연사 중단용) */
  setupMouseUpHandler(): void {
    this.handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) { // 좌클릭
        this.fireModeController.onMouseUp();
      }
    };
    window.addEventListener('mouseup', this.handleMouseUp);
  }

  /** 마우스 업 이벤트 해제 */
  cleanupMouseUpHandler(): void {
    if (this.handleMouseUp) {
      window.removeEventListener('mouseup', this.handleMouseUp);
      this.handleMouseUp = null;
    }
  }

  // === 프레임 처리 ===

  /**
   * 매 프레임 호출 — 마우스 입력 + 발사 + 반동 회복 처리
   * @param deltaTime 프레임 간격 (초)
   * @param camera Three.js 카메라 (히트 판정 + quaternion 동기화용)
   * @param context 외부 컨텍스트 (타겟매니저, 시나리오, 콜백 등)
   */
  processFrame(
    deltaTime: number,
    camera: THREE.PerspectiveCamera,
    context: InputContext,
  ): void {
    // 마우스 입력 처리 — 더블 버퍼 패턴으로 IPC 지연 최소화
    if (this.capturing && isPointerLocked()) {
      // 이전 프레임에서 가져온 배치를 즉시 적용
      if (this.pendingBatch) {
        const batch = this.pendingBatch;
        this.pendingBatch = null;
        if (batch.totalDx !== 0 || batch.totalDy !== 0) {
          this.applyMouseDelta(batch.totalDx, batch.totalDy, camera);
        }
        if (batch.buttonEvents.length > 0 && context.activeScenario) {
          for (const evt of batch.buttonEvents) {
            if (evt.button === 'Left') {
              // 발사 모드 컨트롤러를 통한 발사 판정
              const now = performance.now();
              if (this.fireModeController.onMouseDown(now)) {
                this.executeFire(camera, context);
              }
            }
          }
        }
        // 입력 레이턴시 추정 (최신 이벤트 타임스탬프 기준)
        if (batch.latestTimestampUs) {
          const nowUs = performance.now() * 1000;
          this.inputLatencyUs = Math.max(0, nowUs - batch.latestTimestampUs);
        }
      }
      // 다음 프레임용 배치를 비동기로 가져옴 (렌더 블로킹 없음)
      this.prefetchMouseBatch();
    }

    // 발사 모드 컨트롤러 업데이트 — auto/burst 추가 발사
    if (context.activeScenario && isPointerLocked()) {
      const fireCount = this.fireModeController.update(performance.now());
      for (let i = 0; i < fireCount; i++) {
        this.executeFire(camera, context);
      }
    }

    // 반동 자연 회복 (recoilRecoveryRate > 0이면 점진적으로 원위치)
    if (this.recoilAccumulated > 0 && this.recoilRecoveryRate > 0) {
      const recoveryDeg = this.recoilAccumulated * this.recoilRecoveryRate * deltaTime;
      this.pitch -= recoveryDeg * DEG2RAD;
      this.recoilAccumulated = Math.max(0, this.recoilAccumulated - recoveryDeg);
      const maxPitch = 89 * DEG2RAD;
      this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
      this.syncCamera(camera);
    }
  }

  /** 카메라 quaternion을 현재 yaw/pitch와 동기화 */
  syncCamera(camera: THREE.PerspectiveCamera): void {
    const qYaw = new THREE.Quaternion().setFromAxisAngle(UP, this.yaw);
    const qPitch = new THREE.Quaternion().setFromAxisAngle(RIGHT, this.pitch);
    camera.quaternion.copy(qYaw).multiply(qPitch);
  }

  // === 내부 메서드 ===

  /** 단일 발사 실행 — 히트 판정 + 콜백 + 반동 + 무기 애니메이션 */
  private executeFire(camera: THREE.PerspectiveCamera, context: InputContext): void {
    // 카메라 정면 방향으로 히트 판정
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const hitBefore = context.targetManager
      ? context.targetManager.checkHit(camera.position, dir)
      : null;
    context.activeScenario?.onClick();
    // 사격 피드백 콜백 (오디오 + 머즐플래시 + 히트마커 + 콤보)
    context.onShoot?.(hitBefore?.hit ?? false, hitBefore ?? null);
    // 카메라 반동 적용
    this.applyRecoil(camera);
    // 무기 모델 반동 애니메이션
    const intensity = this.recoilVerticalDeg > 0 ? this.recoilVerticalDeg / 2.0 : 0.3;
    context.weaponViewModel.triggerFireAnimation(intensity);
  }

  /** 반동 적용 — 카메라를 위로 밀어올림 + 좌우 랜덤 흔들림 */
  private applyRecoil(camera: THREE.PerspectiveCamera): void {
    if (this.recoilVerticalDeg <= 0) return;
    const vDeg = this.recoilVerticalDeg * (0.8 + Math.random() * 0.4);
    const hDeg = (Math.random() - 0.5) * 2 * this.recoilHorizontalSpreadDeg;
    this.pitch += vDeg * DEG2RAD;
    this.yaw += hDeg * DEG2RAD;
    this.recoilAccumulated += vDeg;

    // pitch clamp
    const maxPitch = 89 * DEG2RAD;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // quaternion 갱신
    this.syncCamera(camera);
  }

  /** raw delta → 카메라 회전 적용 */
  private applyMouseDelta(
    totalDx: number,
    totalDy: number,
    camera: THREE.PerspectiveCamera,
  ): void {
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
    this.syncCamera(camera);
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
}
