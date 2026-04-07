/**
 * 1인칭 무기 뷰모델
 * - 프로시저럴 무기 지오메트리 (권총/라이플)
 * - 별도 오버레이 씬/카메라로 월드 오브젝트에 가려지지 않게 렌더
 * - 발사 시 반동 킥백 애니메이션
 * - Phase 3: View Bob, Weapon Sway, ADS 전환
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

/** View Bob 설정 — 이동 시 무기 흔들림 */
const VIEW_BOB = {
  /** 사이클 속도 (rad/s) */
  speed: 10,
  /** 수직 진폭 */
  vertAmp: 0.003,
  /** 수평 진폭 */
  horizAmp: 0.002,
};

/** Weapon Sway 설정 — 마우스 이동에 따른 관성 */
const SWAY = {
  /** sway 양 (px → offset 변환 계수) */
  amount: 0.0004,
  /** 부드러움 (lerp 속도) */
  smooth: 5,
  /** 최대 오프셋 */
  maxOffset: 0.015,
};

/** ADS (Aim Down Sights) 설정 */
const ADS_CONFIG = {
  /** hip→ADS 전환 속도 */
  transitionSpeed: 8,
  /** ADS 시 FOV 배율 (1.0 미만 = 줌인) */
  fovMultiplier: 0.85,
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
  private kickRotation = 0;
  private kickTranslation = 0;
  private targetKickRotation = 0;
  private targetKickTranslation = 0;

  // === View Bob 상태 (Phase 3) ===
  /** bob 위상 (라디안) */
  private bobPhase = 0;
  /** 이동 여부 — true면 bob 활성 */
  private isMoving = false;

  // === Weapon Sway 상태 (Phase 3) ===
  /** 현재 sway 오프셋 (X/Y) */
  private swayX = 0;
  private swayY = 0;
  /** 마우스 델타 누적 (프레임당 리셋) */
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;

  // === ADS 상태 (Phase 3) ===
  /** ADS 진행도 (0=hip, 1=ADS) */
  private adsProgress = 0;
  /** ADS 목표 (0 또는 1) */
  private adsTarget = 0;
  /** 머즐(총구) 월드 위치 — 이펙트 시스템에서 사용 */
  private muzzleWorldPos = new THREE.Vector3();

  constructor() {
    this.overlayScene = new THREE.Scene();
    this.overlayCamera = new THREE.PerspectiveCamera(70, 16 / 9, 0.01, 10);
    this.overlayCamera.position.set(0, 0, 0);

    // 무기 전용 조명
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.overlayScene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 1);
    this.overlayScene.add(dirLight);

    this.buildWeapon('pistol');
  }

  // === 공개 API ===

  /** 무기 스타일 변경 */
  setStyle(style: WeaponStyle): void {
    if (style === this.currentStyle && this.weaponGroup) return;
    this.buildWeapon(style);
  }

  /** 현재 무기 스타일 */
  getStyle(): WeaponStyle {
    return this.currentStyle;
  }

  /** 발사 반동 애니메이션 트리거 */
  triggerFireAnimation(intensity: number): void {
    const clampedIntensity = Math.min(Math.max(intensity, 0.1), 2.0);
    this.targetKickRotation += RECOIL_ANIM.baseKickRad * clampedIntensity;
    this.targetKickTranslation += RECOIL_ANIM.baseKickZ * clampedIntensity;
    this.targetKickRotation = Math.min(this.targetKickRotation, 0.4);
    this.targetKickTranslation = Math.min(this.targetKickTranslation, 0.15);
  }

  /** 이동 상태 설정 — View Bob 활성화 */
  setMoving(moving: boolean): void {
    this.isMoving = moving;
  }

  /** 마우스 델타 입력 — Sway 계산용 */
  feedMouseDelta(dx: number, dy: number): void {
    this.mouseDeltaX += dx;
    this.mouseDeltaY += dy;
  }

  /** ADS 토글 */
  toggleADS(): void {
    this.adsTarget = this.adsTarget > 0.5 ? 0 : 1;
  }

  /** ADS 상태 직접 설정 */
  setADS(active: boolean): void {
    this.adsTarget = active ? 1 : 0;
  }

  /** ADS 진행도 반환 (0=hip, 1=ADS) */
  getAdsProgress(): number {
    return this.adsProgress;
  }

  /** ADS 기반 FOV 배율 — 엔진에서 FOV 적용에 사용 */
  getAdsFovMultiplier(): number {
    return 1.0 - this.adsProgress * (1.0 - ADS_CONFIG.fovMultiplier);
  }

  /** 머즐(총구) 위치 반환 — 이펙트 발생 위치 */
  getMuzzlePosition(): THREE.Vector3 {
    return this.muzzleWorldPos.clone();
  }

  /** 매 프레임 업데이트 — 킥백 + Bob + Sway + ADS */
  update(deltaTime: number): void {
    if (!this.weaponGroup) return;

    // 킥백 복귀
    const speed = RECOIL_ANIM.recoverSpeed * deltaTime;
    this.kickRotation += (this.targetKickRotation - this.kickRotation) * Math.min(speed * 3, 1);
    this.kickTranslation += (this.targetKickTranslation - this.kickTranslation) * Math.min(speed * 3, 1);
    this.targetKickRotation *= Math.max(0, 1 - speed);
    this.targetKickTranslation *= Math.max(0, 1 - speed);

    // View Bob — 이동 시 sin/cos 기반 흔들림
    let bobX = 0;
    let bobY = 0;
    if (this.isMoving) {
      this.bobPhase += VIEW_BOB.speed * deltaTime;
      bobX = Math.cos(this.bobPhase) * VIEW_BOB.horizAmp;
      bobY = Math.abs(Math.sin(this.bobPhase)) * VIEW_BOB.vertAmp;
    } else {
      // 정지 시 위상 감쇠
      this.bobPhase *= 0.9;
    }

    // Weapon Sway — 마우스 움직임에 대한 관성 지연
    const targetSwayX = Math.max(-SWAY.maxOffset,
      Math.min(SWAY.maxOffset, -this.mouseDeltaX * SWAY.amount));
    const targetSwayY = Math.max(-SWAY.maxOffset,
      Math.min(SWAY.maxOffset, -this.mouseDeltaY * SWAY.amount));
    const swayLerp = 1 - Math.exp(-SWAY.smooth * deltaTime);
    this.swayX += (targetSwayX - this.swayX) * swayLerp;
    this.swayY += (targetSwayY - this.swayY) * swayLerp;
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    // ADS 전환 — lerp로 부드럽게
    const adsLerp = 1 - Math.exp(-ADS_CONFIG.transitionSpeed * deltaTime);
    this.adsProgress += (this.adsTarget - this.adsProgress) * adsLerp;

    // 최종 위치/회전 계산
    const hipPos = this.getBasePosition();
    const adsPos = this.getAdsPosition();
    const baseRot = this.getBaseRotation();

    // hip ↔ ADS 위치 보간
    const posX = hipPos.x + (adsPos.x - hipPos.x) * this.adsProgress;
    const posY = hipPos.y + (adsPos.y - hipPos.y) * this.adsProgress;
    const posZ = hipPos.z + (adsPos.z - hipPos.z) * this.adsProgress;

    // ADS 중에는 Bob/Sway 감소
    const adsSuppress = 1 - this.adsProgress * 0.8;

    this.weaponGroup.position.set(
      posX + (bobX + this.swayX) * adsSuppress,
      posY + (bobY + this.swayY + this.kickRotation * 0.1) * adsSuppress,
      posZ + this.kickTranslation,
    );
    this.weaponGroup.rotation.set(
      baseRot.x - this.kickRotation * adsSuppress,
      baseRot.y + this.swayX * 2 * adsSuppress,
      baseRot.z,
    );

    // 머즐 위치 업데이트 (총구 앞쪽)
    this.muzzleWorldPos.copy(this.weaponGroup.position);
    this.muzzleWorldPos.z -= this.currentStyle === 'rifle' ? 0.4 : 0.17;
  }

  /** 오버레이 렌더 — 깊이 클리어 후 무기 그리기 */
  render(renderer: THREE.WebGLRenderer): void {
    const prevAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.overlayScene, this.overlayCamera);
    renderer.autoClear = prevAutoClear;
  }

  /** 카메라 종횡비 업데이트 */
  updateAspect(aspect: number): void {
    this.overlayCamera.aspect = aspect;
    this.overlayCamera.updateProjectionMatrix();
  }

  /** 오버레이 씬 접근 — 머즐 플래시 등 이펙트 추가용 */
  getOverlayScene(): THREE.Scene {
    return this.overlayScene;
  }

  /** 리소스 정리 */
  dispose(): void {
    this.disposeWeapon();
    this.overlayScene.clear();
  }

  // === 내부 메서드 ===

  /** 무기 빌드 */
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

  /** hip 기본 위치 */
  private getBasePosition(): THREE.Vector3 {
    switch (this.currentStyle) {
      case 'pistol':
        return new THREE.Vector3(0.22, -0.22, -0.4);
      case 'rifle':
        return new THREE.Vector3(0.25, -0.25, -0.45);
    }
  }

  /** ADS 위치 — 화면 중앙으로 이동 */
  private getAdsPosition(): THREE.Vector3 {
    switch (this.currentStyle) {
      case 'pistol':
        return new THREE.Vector3(0.0, -0.15, -0.35);
      case 'rifle':
        return new THREE.Vector3(0.0, -0.14, -0.38);
    }
  }

  /** 기본 회전 */
  private getBaseRotation(): THREE.Euler {
    return new THREE.Euler(0, Math.PI, 0);
  }

  /** 기존 무기 정리 */
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

  /** 권총 프로시저럴 모델 */
  private createPistol(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.3 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.3, roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8, roughness: 0.2 });

    // 슬라이드 (상단)
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.17), bodyMat);
    slide.position.set(0, 0.015, 0);
    group.add(slide);

    // 프레임 (하단)
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.13), accentMat);
    frame.position.set(0, -0.015, -0.01);
    group.add(frame);

    // 총열
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.015, 0.1);
    group.add(barrel);

    // 그립
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.08, 0.032), gripMat);
    grip.position.set(0, -0.06, -0.035);
    grip.rotation.x = 0.15;
    group.add(grip);

    // 트리거 가드
    const tg = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.008, 0.04), accentMat);
    tg.position.set(0, -0.03, -0.005);
    group.add(tg);

    // 프론트/리어 사이트
    const fs = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.008, 0.004), accentMat);
    fs.position.set(0, 0.037, 0.07);
    group.add(fs);
    const rs = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.006, 0.004), accentMat);
    rs.position.set(0, 0.035, -0.05);
    group.add(rs);

    return group;
  }

  /** 라이플 프로시저럴 모델 */
  private createRifle(): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.7, roughness: 0.3 });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, metalness: 0.3, roughness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, metalness: 0.8, roughness: 0.2 });
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x222226, metalness: 0.4, roughness: 0.6 });

    // 리시버
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.2), bodyMat);
    group.add(receiver);

    // 핸드가드
    const hg = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.038, 0.18), accentMat);
    hg.position.set(0, -0.003, 0.18);
    group.add(hg);

    // 총열
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), bodyMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.005, 0.33);
    group.add(barrel);

    // 소염기
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.03, 8), accentMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.005, 0.4);
    group.add(muzzle);

    // 스톡 + 패드
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.15), stockMat);
    stock.position.set(0, -0.005, -0.17);
    group.add(stock);
    const sp = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.055, 0.01), gripMat);
    sp.position.set(0, -0.005, -0.245);
    group.add(sp);

    // 피스톨 그립
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.07, 0.028), gripMat);
    grip.position.set(0, -0.055, -0.05);
    grip.rotation.x = 0.2;
    group.add(grip);

    // 트리거 가드
    const tg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.04), accentMat);
    tg.position.set(0, -0.025, 0.005);
    group.add(tg);

    // 탄창
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.1, 0.025), bodyMat);
    mag.position.set(0, -0.07, 0.04);
    mag.rotation.x = 0.05;
    group.add(mag);

    // 레일
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, 0.22), accentMat);
    rail.position.set(0, 0.028, 0.05);
    group.add(rail);

    // 프론트/리어 사이트
    const fs = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.004), accentMat);
    fs.position.set(0, 0.037, 0.25);
    group.add(fs);
    const rs = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.008, 0.004), accentMat);
    rs.position.set(0, 0.035, -0.05);
    group.add(rs);

    return group;
  }
}
