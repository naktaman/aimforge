/**
 * 무기 시각 이펙트 시스템 (Phase 3)
 * - 머즐 플래시: PointLight + Sprite, 50ms 발광
 * - 탄피 배출: 우측 배출 파티클 (오브젝트 풀링)
 * - 트레이서: 발사→착탄 빛줄기, 50ms 수명
 * - 피격 이펙트: 착탄점 스파크 + 먼지 파티클
 *
 * 오브젝트 풀링으로 GC 스파이크 방지
 */
import * as THREE from 'three';

// ─── 설정 상수 ──────────────────────────────────────────────

/** 머즐 플래시 설정 */
const MUZZLE = {
  /** 발광 지속 시간 (초) */
  duration: 0.05,
  /** 포인트 라이트 강도 */
  lightIntensity: 3.0,
  /** 포인트 라이트 범위 */
  lightRange: 5.0,
  /** 스프라이트 크기 */
  spriteSize: 0.08,
  /** 스프라이트 색상 */
  color: 0xffdd44,
};

/** 탄피 배출 설정 */
const SHELL = {
  /** 탄피 크기 */
  size: 0.008,
  /** 최대 동시 탄피 수 (풀 크기) */
  poolSize: 10,
  /** 수명 (초) */
  lifetime: 0.8,
  /** 배출 속도 (m/s) */
  ejectSpeed: 2.0,
  /** 중력 가속도 */
  gravity: 9.8,
};

/** 트레이서 설정 */
const TRACER = {
  /** 수명 (초) */
  lifetime: 0.05,
  /** 선 폭 — LineBasicMaterial linewidth (WebGL 제한 있음) */
  width: 1,
  /** 색상 */
  color: 0xffffaa,
  /** 최대 동시 트레이서 수 */
  poolSize: 5,
};

/** 피격 이펙트 설정 */
const IMPACT = {
  /** 파티클 수 (스파크) */
  sparkCount: 6,
  /** 수명 (초) */
  lifetime: 0.3,
  /** 확산 속도 (m/s) */
  speed: 3.0,
  /** 파티클 크기 */
  size: 0.015,
  /** 최대 동시 이펙트 수 */
  poolSize: 8,
};

// ─── 내부 타입 ──────────────────────────────────────────────

/** 탄피 파티클 상태 */
interface ShellState {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVel: THREE.Vector3;
  life: number;
  active: boolean;
}

/** 트레이서 상태 */
interface TracerState {
  line: THREE.Line;
  life: number;
  active: boolean;
}

/** 피격 이펙트 파티클 그룹 */
interface ImpactState {
  particles: THREE.Mesh[];
  velocities: THREE.Vector3[];
  life: number;
  active: boolean;
}

// ─── 메인 클래스 ────────────────────────────────────────────

export class WeaponEffects {
  /** 메인 씬 (트레이서, 피격 이펙트) */
  private scene: THREE.Scene;
  /** 오버레이 씬 (머즐 플래시, 탄피) */
  private overlayScene: THREE.Scene;

  // === 머즐 플래시 ===
  private muzzleLight: THREE.PointLight;
  private muzzleSprite: THREE.Sprite;
  private muzzleTimer = 0;

  // === 탄피 풀 ===
  private shellPool: ShellState[] = [];
  private shellMaterial: THREE.MeshStandardMaterial;

  // === 트레이서 풀 ===
  private tracerPool: TracerState[] = [];
  private tracerMaterial: THREE.LineBasicMaterial;

  // === 피격 이펙트 풀 ===
  private impactPool: ImpactState[] = [];
  private sparkMaterial: THREE.MeshBasicMaterial;

  constructor(scene: THREE.Scene, overlayScene: THREE.Scene) {
    this.scene = scene;
    this.overlayScene = overlayScene;

    // 머즐 플래시 — PointLight + Sprite
    this.muzzleLight = new THREE.PointLight(MUZZLE.color, 0, MUZZLE.lightRange);
    this.overlayScene.add(this.muzzleLight);

    const spriteMat = new THREE.SpriteMaterial({
      color: MUZZLE.color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
    });
    this.muzzleSprite = new THREE.Sprite(spriteMat);
    this.muzzleSprite.scale.set(MUZZLE.spriteSize, MUZZLE.spriteSize, 1);
    this.overlayScene.add(this.muzzleSprite);

    // 공유 머티리얼 생성
    this.shellMaterial = new THREE.MeshStandardMaterial({
      color: 0xc8a832,
      metalness: 0.9,
      roughness: 0.2,
    });
    this.tracerMaterial = new THREE.LineBasicMaterial({
      color: TRACER.color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    this.sparkMaterial = new THREE.MeshBasicMaterial({
      color: 0xffcc33,
      transparent: true,
      opacity: 1,
    });

    // 오브젝트 풀 초기화
    this.initShellPool();
    this.initTracerPool();
    this.initImpactPool();
  }

  // === 트리거 API ===

  /** 머즐 플래시 발동 — 발사 시 호출 */
  triggerMuzzleFlash(muzzlePos: THREE.Vector3): void {
    this.muzzleTimer = MUZZLE.duration;
    this.muzzleLight.position.copy(muzzlePos);
    this.muzzleLight.intensity = MUZZLE.lightIntensity;
    this.muzzleSprite.position.copy(muzzlePos);
    (this.muzzleSprite.material as THREE.SpriteMaterial).opacity = 1;
    // 랜덤 크기 변동 (자연스러움)
    const scale = MUZZLE.spriteSize * (0.8 + Math.random() * 0.4);
    this.muzzleSprite.scale.set(scale, scale, 1);
  }

  /** 탄피 배출 — 발사 시 호출 */
  ejectShell(muzzlePos: THREE.Vector3): void {
    const shell = this.shellPool.find((s) => !s.active);
    if (!shell) return;

    shell.active = true;
    shell.life = SHELL.lifetime;
    shell.mesh.visible = true;
    shell.mesh.position.copy(muzzlePos);
    // 우측+위+약간 뒤로 배출
    shell.velocity.set(
      SHELL.ejectSpeed * (0.7 + Math.random() * 0.3),
      SHELL.ejectSpeed * (0.3 + Math.random() * 0.4),
      SHELL.ejectSpeed * (-0.1 + Math.random() * 0.2),
    );
    // 랜덤 회전 속도
    shell.angularVel.set(
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
      (Math.random() - 0.5) * 15,
    );
  }

  /**
   * 트레이서 생성 — 발사→착탄 빛줄기
   * @param from 총구 월드 위치
   * @param to 착탄 월드 위치
   */
  spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const tracer = this.tracerPool.find((t) => !t.active);
    if (!tracer) return;

    tracer.active = true;
    tracer.life = TRACER.lifetime;
    tracer.line.visible = true;

    // 지오메트리 위치 업데이트
    const geom = tracer.line.geometry as THREE.BufferGeometry;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    geom.computeBoundingSphere();

    // 불투명으로 초기화
    (tracer.line.material as THREE.LineBasicMaterial).opacity = 1;
  }

  /**
   * 피격 이펙트 — 착탄점 스파크 + 먼지
   * @param position 착탄 월드 위치
   * @param normal 표면 법선 (기본 위쪽)
   */
  spawnImpact(
    position: THREE.Vector3,
    normal: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  ): void {
    const impact = this.impactPool.find((i) => !i.active);
    if (!impact) return;

    impact.active = true;
    impact.life = IMPACT.lifetime;

    for (let j = 0; j < IMPACT.sparkCount; j++) {
      const p = impact.particles[j];
      p.visible = true;
      p.position.copy(position);
      // 법선 기준 반구 방향으로 확산
      const dir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random(),
        (Math.random() - 0.5) * 2,
      ).normalize();
      // 법선 방향으로 편향
      dir.add(normal.clone().multiplyScalar(0.5)).normalize();
      impact.velocities[j].copy(dir.multiplyScalar(IMPACT.speed * (0.3 + Math.random() * 0.7)));
    }
  }

  /** 매 프레임 업데이트 — 모든 이펙트 갱신 */
  update(deltaTime: number): void {
    this.updateMuzzleFlash(deltaTime);
    this.updateShells(deltaTime);
    this.updateTracers(deltaTime);
    this.updateImpacts(deltaTime);
  }

  /** 리소스 정리 */
  dispose(): void {
    // 머즐 플래시
    this.overlayScene.remove(this.muzzleLight);
    this.overlayScene.remove(this.muzzleSprite);
    (this.muzzleSprite.material as THREE.SpriteMaterial).dispose();

    // 탄피 풀
    for (const shell of this.shellPool) {
      this.overlayScene.remove(shell.mesh);
      shell.mesh.geometry.dispose();
    }
    this.shellMaterial.dispose();

    // 트레이서 풀
    for (const tracer of this.tracerPool) {
      this.scene.remove(tracer.line);
      tracer.line.geometry.dispose();
    }
    this.tracerMaterial.dispose();

    // 피격 이펙트 풀
    for (const impact of this.impactPool) {
      for (const p of impact.particles) {
        this.scene.remove(p);
        p.geometry.dispose();
      }
    }
    this.sparkMaterial.dispose();
  }

  // === 내부: 업데이트 ═══════════════════════════════════════

  /** 머즐 플래시 감쇠 */
  private updateMuzzleFlash(dt: number): void {
    if (this.muzzleTimer <= 0) return;
    this.muzzleTimer -= dt;
    if (this.muzzleTimer <= 0) {
      this.muzzleLight.intensity = 0;
      (this.muzzleSprite.material as THREE.SpriteMaterial).opacity = 0;
    } else {
      // 선형 감쇠
      const t = this.muzzleTimer / MUZZLE.duration;
      this.muzzleLight.intensity = MUZZLE.lightIntensity * t;
      (this.muzzleSprite.material as THREE.SpriteMaterial).opacity = t;
    }
  }

  /** 탄피 물리 업데이트 (중력 + 회전) */
  private updateShells(dt: number): void {
    for (const shell of this.shellPool) {
      if (!shell.active) continue;
      shell.life -= dt;
      if (shell.life <= 0) {
        shell.active = false;
        shell.mesh.visible = false;
        continue;
      }
      // 중력 적용
      shell.velocity.y -= SHELL.gravity * dt;
      shell.mesh.position.addScaledVector(shell.velocity, dt);
      // 회전
      shell.mesh.rotation.x += shell.angularVel.x * dt;
      shell.mesh.rotation.y += shell.angularVel.y * dt;
      shell.mesh.rotation.z += shell.angularVel.z * dt;
      // 페이드 아웃 (마지막 20%)
      const fadeStart = SHELL.lifetime * 0.2;
      if (shell.life < fadeStart) {
        const scale = shell.life / fadeStart;
        shell.mesh.scale.setScalar(scale);
      }
    }
  }

  /** 트레이서 페이드 */
  private updateTracers(dt: number): void {
    for (const tracer of this.tracerPool) {
      if (!tracer.active) continue;
      tracer.life -= dt;
      if (tracer.life <= 0) {
        tracer.active = false;
        tracer.line.visible = false;
        continue;
      }
      // 페이드 아웃
      const t = tracer.life / TRACER.lifetime;
      (tracer.line.material as THREE.LineBasicMaterial).opacity = t;
    }
  }

  /** 피격 파티클 확산 + 감쇠 */
  private updateImpacts(dt: number): void {
    for (const impact of this.impactPool) {
      if (!impact.active) continue;
      impact.life -= dt;
      if (impact.life <= 0) {
        impact.active = false;
        for (const p of impact.particles) p.visible = false;
        continue;
      }
      const t = impact.life / IMPACT.lifetime;
      for (let j = 0; j < IMPACT.sparkCount; j++) {
        // 이동
        impact.particles[j].position.addScaledVector(impact.velocities[j], dt);
        // 중력 (스파크는 약한 중력)
        impact.velocities[j].y -= 4.0 * dt;
        // 크기 + 투명도 감쇠
        impact.particles[j].scale.setScalar(t);
      }
      (this.sparkMaterial as THREE.MeshBasicMaterial).opacity = t;
    }
  }

  // === 내부: 풀 초기화 ══════════════════════════════════════

  /** 탄피 오브젝트 풀 생성 */
  private initShellPool(): void {
    const geom = new THREE.CylinderGeometry(SHELL.size * 0.3, SHELL.size * 0.3, SHELL.size, 6);
    for (let i = 0; i < SHELL.poolSize; i++) {
      const mesh = new THREE.Mesh(geom, this.shellMaterial);
      mesh.visible = false;
      this.overlayScene.add(mesh);
      this.shellPool.push({
        mesh,
        velocity: new THREE.Vector3(),
        angularVel: new THREE.Vector3(),
        life: 0,
        active: false,
      });
    }
  }

  /** 트레이서 오브젝트 풀 생성 */
  private initTracerPool(): void {
    for (let i = 0; i < TRACER.poolSize; i++) {
      const geom = new THREE.BufferGeometry();
      const positions = new Float32Array(6); // 2 vertices × 3 coords
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const line = new THREE.Line(geom, this.tracerMaterial.clone());
      line.visible = false;
      this.scene.add(line);
      this.tracerPool.push({ line, life: 0, active: false });
    }
  }

  /** 피격 이펙트 오브젝트 풀 생성 */
  private initImpactPool(): void {
    const geom = new THREE.SphereGeometry(IMPACT.size, 4, 4);
    for (let i = 0; i < IMPACT.poolSize; i++) {
      const particles: THREE.Mesh[] = [];
      const velocities: THREE.Vector3[] = [];
      for (let j = 0; j < IMPACT.sparkCount; j++) {
        const mesh = new THREE.Mesh(geom, this.sparkMaterial);
        mesh.visible = false;
        this.scene.add(mesh);
        particles.push(mesh);
        velocities.push(new THREE.Vector3());
      }
      this.impactPool.push({ particles, velocities, life: 0, active: false });
    }
  }
}
