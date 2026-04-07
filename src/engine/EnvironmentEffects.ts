/**
 * 환경 이펙트 — 먼지 파티클 시스템 + 네온 그리드
 * Cold Forge 분위기 연출용 (성능 최적화: AdditiveBlending, depthWrite false)
 */
import * as THREE from 'three';
import type { DustConfig } from './EnvironmentPresets';
import { createMaterial, COLD_FORGE_MATERIALS } from './EnvironmentPresets';

// ═══════════════════════════════════════════════════════
// 먼지 파티클 시스템
// ═══════════════════════════════════════════════════════

export class DustParticleSystem {
  private points: THREE.Points;
  private velocities: Float32Array;
  private config: DustConfig;

  constructor(config: DustConfig) {
    this.config = config;

    const positions = new Float32Array(config.count * 3);
    this.velocities = new Float32Array(config.count * 3);

    // 초기 위치 + 느린 랜덤 드리프트 속도
    for (let i = 0; i < config.count; i++) {
      const idx = i * 3;
      positions[idx] = (Math.random() - 0.5) * config.area.width;
      positions[idx + 1] = Math.random() * config.area.height;
      positions[idx + 2] = (Math.random() - 0.5) * config.area.depth;

      this.velocities[idx] = (Math.random() - 0.5) * config.speed;
      this.velocities[idx + 1] = (Math.random() - 0.5) * config.speed * 0.5;
      this.velocities[idx + 2] = (Math.random() - 0.5) * config.speed;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: config.color,
      size: config.size,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.points = new THREE.Points(geometry, material);
  }

  /** 매 프레임 위치 업데이트 — 경계 래핑 */
  update(deltaTime: number): void {
    const positions = this.points.geometry.attributes.position.array as Float32Array;
    const { width, height, depth } = this.config.area;
    const halfW = width / 2;
    const halfD = depth / 2;

    for (let i = 0; i < this.config.count; i++) {
      const idx = i * 3;
      positions[idx] += this.velocities[idx] * deltaTime;
      positions[idx + 1] += this.velocities[idx + 1] * deltaTime;
      positions[idx + 2] += this.velocities[idx + 2] * deltaTime;

      // 경계 래핑
      if (positions[idx] > halfW) positions[idx] = -halfW;
      else if (positions[idx] < -halfW) positions[idx] = halfW;
      if (positions[idx + 1] > height) positions[idx + 1] = 0;
      else if (positions[idx + 1] < 0) positions[idx + 1] = height;
      if (positions[idx + 2] > halfD) positions[idx + 2] = -halfD;
      else if (positions[idx + 2] < -halfD) positions[idx + 2] = halfD;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  /** Three.js Points 객체 반환 (씬에 추가용) */
  getObject(): THREE.Points {
    return this.points;
  }

  /** 리소스 해제 */
  dispose(): void {
    this.points.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}

// ═══════════════════════════════════════════════════════
// 네온 바닥 그리드
// ═══════════════════════════════════════════════════════

/**
 * 네온 글로우 바닥 그리드 생성
 * @param width  바닥 폭 (m)
 * @param depth  바닥 깊이 (m)
 * @param spacing 그리드 간격 (m)
 * @returns Three.js Group (씬에 추가)
 */
export function createNeonGrid(
  width: number,
  depth: number,
  spacing: number,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'neon-grid';

  // 은은한 시안 그리드 재질 (emissive 낮춤)
  const gridMat = createMaterial(COLD_FORGE_MATERIALS.neonCyan);
  gridMat.emissiveIntensity = 0.3;

  const halfW = width / 2;
  const halfD = depth / 2;
  const yOffset = 0.001; // 바닥 위로 미세 오프셋

  // X 방향 라인 (Z축 따라 깔림)
  for (let x = -halfW; x <= halfW; x += spacing) {
    const geo = new THREE.PlaneGeometry(0.02, depth);
    const line = new THREE.Mesh(geo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(x, yOffset, 0);
    group.add(line);
  }

  // Z 방향 라인 (X축 따라 깔림)
  for (let z = -halfD; z <= halfD; z += spacing) {
    const geo = new THREE.PlaneGeometry(width, 0.02);
    const line = new THREE.Mesh(geo, gridMat);
    line.rotation.x = -Math.PI / 2;
    line.position.set(0, yOffset, z);
    group.add(line);
  }

  return group;
}

// ═══════════════════════════════════════════════════════
// 네온 트림 라인 (벽 하단 장식)
// ═══════════════════════════════════════════════════════

/**
 * 벽/바닥 경계에 얇은 네온 트림 라인 생성
 * @param points  경로 포인트 배열 (3개 이상)
 * @param color   네온 색상 (기본: 시안)
 */
export function createNeonTrimLine(
  points: THREE.Vector3[],
  color: number = 0x00e5ff,
): THREE.Mesh {
  if (points.length < 2) {
    // 최소 2점 필요 — 빈 메시 반환
    return new THREE.Mesh(new THREE.BufferGeometry());
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, Math.max(points.length * 8, 16), 0.025, 6, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 3.0,
    toneMapped: false,
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * 사각 영역 하단에 네온 트림 라인 자동 생성 (4변)
 */
export function createPerimeterTrim(
  width: number,
  depth: number,
  height: number = 0.1,
  color: number = 0x00e5ff,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'perimeter-trim';
  const halfW = width / 2;
  const halfD = depth / 2;
  const y = height;

  // 4변 경로
  const corners = [
    new THREE.Vector3(-halfW, y, -halfD),
    new THREE.Vector3(halfW, y, -halfD),
    new THREE.Vector3(halfW, y, halfD),
    new THREE.Vector3(-halfW, y, halfD),
    new THREE.Vector3(-halfW, y, -halfD), // 닫기
  ];

  const trim = createNeonTrimLine(corners, color);
  group.add(trim);
  return group;
}
