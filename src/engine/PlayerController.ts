/**
 * PlayerController 추상화 — Phase 1: 고정 위치 + 시점 회전만
 * Phase 2 확장 대비로 인터페이스 분리
 *
 * 현재 구현: StaticPlayerController (이동 없음, 카메라 회전만)
 * 미래 확장: MovingPlayerController (WASD 이동 + 카메라 회전)
 */
import * as THREE from 'three';

/** 플레이어 상태 */
export interface PlayerState {
  /** 월드 위치 */
  position: THREE.Vector3;
  /** 카메라 yaw (라디안) */
  yaw: number;
  /** 카메라 pitch (라디안) */
  pitch: number;
  /** 이동 중 여부 */
  isMoving: boolean;
  /** 이동 속도 (m/s) */
  moveSpeed: number;
}

/** PlayerController 인터페이스 — Phase 2 확장용 */
export interface IPlayerController {
  /** 현재 플레이어 상태 */
  getState(): PlayerState;
  /** 마우스 입력 적용 (dx, dy: 도 단위) */
  applyMouseDelta(dx: number, dy: number): void;
  /** 매 프레임 업데이트 */
  update(deltaTime: number): void;
  /** 위치 리셋 */
  resetPosition(): void;
  /** 시점 리셋 */
  resetRotation(): void;
  /** 이동 가능 여부 (Phase 1: false) */
  canMove(): boolean;
}

/**
 * StaticPlayerController — Phase 1 구현
 * 고정 위치, 시점 회전만 가능
 */
export class StaticPlayerController implements IPlayerController {
  private position: THREE.Vector3;
  private yaw = 0;
  private pitch = 0;

  /** 눈높이 (m) */
  private readonly eyeHeight: number;

  constructor(eyeHeight = 1.6) {
    this.eyeHeight = eyeHeight;
    this.position = new THREE.Vector3(0, this.eyeHeight, 0);
  }

  getState(): PlayerState {
    return {
      position: this.position.clone(),
      yaw: this.yaw,
      pitch: this.pitch,
      isMoving: false,
      moveSpeed: 0,
    };
  }

  applyMouseDelta(dx: number, dy: number): void {
    const DEG2RAD = Math.PI / 180;
    this.yaw -= dx * DEG2RAD;
    this.pitch -= dy * DEG2RAD;
    // pitch 제한: ±89°
    this.pitch = Math.max(-89 * DEG2RAD, Math.min(89 * DEG2RAD, this.pitch));
  }

  update(_deltaTime: number): void {
    // Phase 1: 이동 없음 — 아무것도 하지 않음
  }

  resetPosition(): void {
    this.position.set(0, this.eyeHeight, 0);
  }

  resetRotation(): void {
    this.yaw = 0;
    this.pitch = 0;
  }

  canMove(): boolean {
    return false;
  }

  /** 카메라에 현재 회전 적용 */
  applyToCamera(camera: THREE.PerspectiveCamera): void {
    camera.position.copy(this.position);
    // yaw (Y축) + pitch (X축) 조합 — gimbal lock 방지
    const yawQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yaw,
    );
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.pitch,
    );
    camera.quaternion.copy(yawQ).multiply(pitchQ);
  }

  /** 카메라 전방 벡터 */
  getForward(): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, -1);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yaw,
    );
    const pitchQ = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      this.pitch,
    );
    forward.applyQuaternion(pitchQ).applyQuaternion(yawQ);
    return forward;
  }
}
