/**
 * 1인칭 무기 뷰모델
 * - 프로시저럴 무기 지오메트리 (권총/라이플)
 * - 별도 오버레이 씬/카메라로 월드 오브젝트에 가려지지 않게 렌더
 * - 발사 시 반동 킥백 애니메이션
 */
import * as THREE from 'three';

/** 무기 스타일 */
export type WeaponStyle = 'pistol' | 'rifle';

/** 반동 애니메이션 설정 */
const RECOIL_ANIM = {
  /** 킥백 기본 강도 (라디안) */
  baseKickRad: 0.08,
  /** 뒤로 밀리는 기본 거리 */
  baseKickZ: 0.03,
  /** 복귀 속도 (초당) — 클수록 빠르게 복귀 */
  recoverSpeed: 12,
};

export class WeaponViewModel {
  /** 무기 전용 오버레이 씬 */
  private overlayScene: THREE.Scene;
  /** 무기 전용 카메라 (메인 카메라와 독립) */
  private overlayCamera: THREE.PerspectiveCamera;
  /** 현재 무기 모델 그룹 */
  private weaponGroup: THREE.Group | null = null;
  /** 현재 무기 스타일 */
  private currentStyle: WeaponStyle = 'pistol';

  // === 반동 애니메이션 상태 ===
  /** 현재 킥백 회전량 (라디안, pitch up) */
  private kickRotation = 0;
  /** 현재 킥백 밀림량 (Z축) */
  private kickTranslation = 0;
  /** 킥백 목표값 (순간 설정 후 감쇠) */
  private targetKickRotation = 0;
  private targetKickTranslation = 0;

  constructor() {
    // 오버레이 씬 생성 (투명 배경)
    this.overlayScene = new THREE.Scene();

    // 오버레이 카메라 — 좁은 near plane으로 무기가 항상 보이게
    this.overlayCamera = new THREE.PerspectiveCamera(70, 16 / 9, 0.01, 10);
    this.overlayCamera.position.set(0, 0, 0);

    // 무기 전용 조명
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.overlayScene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 1);
    this.overlayScene.add(dirLight);

    // 기본 무기 생성
    this.buildWeapon('pistol');
  }

  /** 무기 스타일 변경 */
  setStyle(style: WeaponStyle): void {
    if (style === this.currentStyle && this.weaponGroup) return;
    this.buildWeapon(style);
  }

  /** 현재 무기 스타일 */
  getStyle(): WeaponStyle {
    return this.currentStyle;
  }

  /**
   * 발사 반동 애니메이션 트리거
   * @param intensity 반동 강도 (0~1 범위 권장, recoilVerticalDeg / 2.0 정도)
   */
  triggerFireAnimation(intensity: number): void {
    // 누적 방식 — 연사 시 킥백이 쌓임
    const clampedIntensity = Math.min(Math.max(intensity, 0.1), 2.0);
    this.targetKickRotation += RECOIL_ANIM.baseKickRad * clampedIntensity;
    this.targetKickTranslation += RECOIL_ANIM.baseKickZ * clampedIntensity;

    // 최대값 제한 (과도한 누적 방지)
    this.targetKickRotation = Math.min(this.targetKickRotation, 0.4);
    this.targetKickTranslation = Math.min(this.targetKickTranslation, 0.15);
  }

  /** 매 프레임 업데이트 — 킥백 복귀 애니메이션 */
  update(deltaTime: number): void {
    if (!this.weaponGroup) return;

    const speed = RECOIL_ANIM.recoverSpeed * deltaTime;

    // 킥백 → 현재값으로 빠르게 점프
    this.kickRotation += (this.targetKickRotation - this.kickRotation) * Math.min(speed * 3, 1);
    this.kickTranslation += (this.targetKickTranslation - this.kickTranslation) * Math.min(speed * 3, 1);

    // 타겟값 감쇠 (복귀)
    this.targetKickRotation *= Math.max(0, 1 - speed);
    this.targetKickTranslation *= Math.max(0, 1 - speed);

    // 무기 그룹에 반동 적용
    const basePos = this.getBasePosition();
    const baseRot = this.getBaseRotation();

    this.weaponGroup.position.set(
      basePos.x,
      basePos.y + this.kickRotation * 0.1, // 약간 위로
      basePos.z + this.kickTranslation,      // 뒤로 밀림
    );
    this.weaponGroup.rotation.set(
      baseRot.x - this.kickRotation, // pitch up (음수 방향이 위)
      baseRot.y,
      baseRot.z,
    );
  }

  /**
   * 오버레이 렌더 — 메인 씬 렌더 후 호출
   * 깊이 버퍼만 클리어하여 무기가 월드 위에 그려짐
   */
  render(renderer: THREE.WebGLRenderer): void {
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.overlayScene, this.overlayCamera);
    renderer.autoClear = prevAutoClear;
  }

  /** 카메라 종횡비 업데이트 (리사이즈 시) */
  updateAspect(aspect: number): void {
    this.overlayCamera.aspect = aspect;
    this.overlayCamera.updateProjectionMatrix();
  }

  /** 리소스 정리 */
  dispose(): void {
    this.disposeWeapon();
    this.overlayScene.clear();
  }

  // === 내부 메서드 ===

  /** 무기 빌드 (기존 무기 정리 후 새로 생성) */
  private buildWeapon(style: WeaponStyle): void {
    this.disposeWeapon();
    this.currentStyle = style;

    switch (style) {
      case 'pistol':
        this.weaponGroup = this.createPistol();
        break;
      case 'rifle':
        this.weaponGroup = this.createRifle();
        break;
    }

    if (this.weaponGroup) {
      const pos = this.getBasePosition();
      const rot = this.getBaseRotation();
      this.weaponGroup.position.set(pos.x, pos.y, pos.z);
      this.weaponGroup.rotation.set(rot.x, rot.y, rot.z);
      this.overlayScene.add(this.weaponGroup);
    }
  }

  /** 무기 스타일별 기본 위치 */
  private getBasePosition(): THREE.Vector3 {
    switch (this.currentStyle) {
      case 'pistol':
        return new THREE.Vector3(0.22, -0.22, -0.4);
      case 'rifle':
        return new THREE.Vector3(0.25, -0.25, -0.45);
    }
  }

  /** 무기 스타일별 기본 회전 */
  private getBaseRotation(): THREE.Euler {
    switch (this.currentStyle) {
      case 'pistol':
        return new THREE.Euler(0, Math.PI, 0);
      case 'rifle':
        return new THREE.Euler(0, Math.PI, 0);
    }
  }

  /** 기존 무기 지오메트리/머티리얼 정리 */
  private disposeWeapon(): void {
    if (!this.weaponGroup) return;
    this.weaponGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else if (obj.material) {
          obj.material.dispose();
        }
      }
    });
    this.overlayScene.remove(this.weaponGroup);
    this.weaponGroup = null;
  }

  /**
   * 권총 프로시저럴 모델 생성
   * BoxGeometry + CylinderGeometry 조합
   */
  private createPistol(): THREE.Group {
    const group = new THREE.Group();

    // 공통 머티리얼 — 어두운 금속 느낌
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2e,
      metalness: 0.7,
      roughness: 0.3,
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      metalness: 0.3,
      roughness: 0.7,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a40,
      metalness: 0.8,
      roughness: 0.2,
    });

    // 슬라이드 (상단 본체)
    const slide = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.035, 0.17),
      bodyMat,
    );
    slide.position.set(0, 0.015, 0);
    group.add(slide);

    // 프레임 (하단 본체)
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.025, 0.13),
      accentMat,
    );
    frame.position.set(0, -0.015, -0.01);
    group.add(frame);

    // 총열
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8),
      bodyMat,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, 0.1);
    group.add(barrel);

    // 그립 (아래로 기울어짐)
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.08, 0.032),
      gripMat,
    );
    grip.position.set(0, -0.06, -0.035);
    grip.rotation.x = 0.15; // 약간 뒤로 기울임
    group.add(grip);

    // 트리거 가드
    const triggerGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.008, 0.04),
      accentMat,
    );
    triggerGuard.position.set(0, -0.03, -0.005);
    group.add(triggerGuard);

    // 조준기 (프론트 사이트)
    const frontSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.008, 0.004),
      accentMat,
    );
    frontSight.position.set(0, 0.037, 0.07);
    group.add(frontSight);

    // 조준기 (리어 사이트)
    const rearSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.006, 0.004),
      accentMat,
    );
    rearSight.position.set(0, 0.035, -0.05);
    group.add(rearSight);

    return group;
  }

  /**
   * 라이플 프로시저럴 모델 생성
   * 더 긴 본체 + 스톡 + 탄창 + 핸드가드
   */
  private createRifle(): THREE.Group {
    const group = new THREE.Group();

    // 머티리얼
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2e,
      metalness: 0.7,
      roughness: 0.3,
    });
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      metalness: 0.3,
      roughness: 0.7,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a40,
      metalness: 0.8,
      roughness: 0.2,
    });
    const stockMat = new THREE.MeshStandardMaterial({
      color: 0x222226,
      metalness: 0.4,
      roughness: 0.6,
    });

    // 리시버 (본체)
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.045, 0.2),
      bodyMat,
    );
    receiver.position.set(0, 0, 0);
    group.add(receiver);

    // 핸드가드 (총열 덮개)
    const handguard = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.038, 0.18),
      accentMat,
    );
    handguard.position.set(0, -0.003, 0.18);
    group.add(handguard);

    // 총열
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8),
      bodyMat,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.005, 0.33);
    group.add(barrel);

    // 소염기 (머즐 브레이크)
    const muzzle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.01, 0.008, 0.03, 8),
      accentMat,
    );
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.005, 0.4);
    group.add(muzzle);

    // 스톡 (개머리판)
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.035, 0.05, 0.15),
      stockMat,
    );
    stock.position.set(0, -0.005, -0.17);
    group.add(stock);

    // 스톡 패드
    const stockPad = new THREE.Mesh(
      new THREE.BoxGeometry(0.038, 0.055, 0.01),
      gripMat,
    );
    stockPad.position.set(0, -0.005, -0.245);
    group.add(stockPad);

    // 피스톨 그립
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, 0.07, 0.028),
      gripMat,
    );
    grip.position.set(0, -0.055, -0.05);
    grip.rotation.x = 0.2;
    group.add(grip);

    // 트리거 가드
    const triggerGuard = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.008, 0.04),
      accentMat,
    );
    triggerGuard.position.set(0, -0.025, 0.005);
    group.add(triggerGuard);

    // 탄창
    const magazine = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.1, 0.025),
      bodyMat,
    );
    magazine.position.set(0, -0.07, 0.04);
    magazine.rotation.x = 0.05; // 약간 앞으로 기울임
    group.add(magazine);

    // 캐리 핸들 / 레일
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.006, 0.22),
      accentMat,
    );
    rail.position.set(0, 0.028, 0.05);
    group.add(rail);

    // 프론트 사이트
    const frontSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.004, 0.012, 0.004),
      accentMat,
    );
    frontSight.position.set(0, 0.037, 0.25);
    group.add(frontSight);

    // 리어 사이트
    const rearSight = new THREE.Mesh(
      new THREE.BoxGeometry(0.015, 0.008, 0.004),
      accentMat,
    );
    rearSight.position.set(0, 0.035, -0.05);
    group.add(rearSight);

    return group;
  }
}
