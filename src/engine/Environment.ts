/**
 * 3D 환경 구성 — Cold Forge 테마 기반
 * MapPreset 프리셋 시스템으로 훈련 목적별 맵 생성
 * - 금속/산업 테마 벽 (프로시저럴 패널 라인 + 네온 트림)
 * - 3광원 조명 (Ambient + Hemisphere + Directional + PointLights)
 * - PCF 소프트 그림자
 * - 안개 (선형 / 지수)
 * - 네온 바닥 그리드
 * - 먼지 파티클
 *
 * THREE.Group으로 래핑 — Counter-Strafe 시나리오에서 이동 가능
 */
import * as THREE from 'three';
import {
  type MapPreset,
  type LightingConfig,
  type FogConfig,
  type ObstacleConfig,
  MAP_PRESETS,
  DEFAULT_MAP_PRESET_ID,
  COLD_FORGE_MATERIALS,
  createMaterial,
} from './EnvironmentPresets';
import {
  DustParticleSystem,
  createNeonGrid,
  createPerimeterTrim,
} from './EnvironmentEffects';
import { FORGE_COLORS } from '../config/theme';

// ═══════════════════════════════════════════════════════
// 환경 인스턴스 타입
// ═══════════════════════════════════════════════════════

/** createEnvironment 반환값 — 업데이트 + 해제 API 포함 */
export interface EnvironmentInstance {
  /** 환경 그룹 (counter-strafe 이동용) */
  group: THREE.Group;
  /** 매 프레임 업데이트 (먼지 파티클 등) */
  update: (deltaTime: number) => void;
  /** 리소스 해제 */
  dispose: () => void;
  /** 현재 프리셋 ID */
  presetId: string;
}

// ═══════════════════════════════════════════════════════
// 재질 캐시 (프리셋 전환 시 재사용)
// ═══════════════════════════════════════════════════════

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/** 캐시된 재질 가져오기 (없으면 생성) */
function getCachedMaterial(key: string): THREE.MeshStandardMaterial {
  let mat = materialCache.get(key);
  if (!mat) {
    const preset = COLD_FORGE_MATERIALS[key];
    if (!preset) {
      console.error(`[Environment] 알 수 없는 재질 키: ${key}`);
      mat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
    } else {
      mat = createMaterial(preset);
    }
    materialCache.set(key, mat);
  }
  return mat;
}

// ═══════════════════════════════════════════════════════
// 금속 패널 벽 생성 (프로시저럴)
// ═══════════════════════════════════════════════════════

/** 금속 패널 벽 — 분리선 + 하단 네온 트림 포함 */
function buildMetalWall(
  width: number,
  height: number,
  depth: number,
  materialKey: string,
): THREE.Group {
  const wallGroup = new THREE.Group();
  const mat = getCachedMaterial(materialKey);

  // 메인 패널
  const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), mat);
  panel.castShadow = true;
  panel.receiveShadow = true;
  wallGroup.add(panel);

  // 패널 분리선 (금속 패널 느낌)
  const panelCount = Math.max(1, Math.floor(width / 2.5));
  const concreteMat = getCachedMaterial('wallConcrete');
  for (let i = 0; i < panelCount; i++) {
    const lineGeo = new THREE.BoxGeometry(0.02, height * 0.9, depth + 0.01);
    const line = new THREE.Mesh(lineGeo, concreteMat);
    line.position.x = -width / 2 + (i + 1) * (width / (panelCount + 1));
    wallGroup.add(line);
  }

  // 하단 네온 트림
  const neonMat = getCachedMaterial('neonCyan');
  const trimGeo = new THREE.BoxGeometry(width, 0.05, depth + 0.02);
  const trim = new THREE.Mesh(trimGeo, neonMat);
  trim.position.y = -height / 2 + 0.08;
  wallGroup.add(trim);

  return wallGroup;
}

// ═══════════════════════════════════════════════════════
// 장애물 생성
// ═══════════════════════════════════════════════════════

/** ObstacleConfig → THREE.Object3D 변환 */
function createObstacle(obs: ObstacleConfig): THREE.Object3D {
  const [w, h, d] = obs.size;

  let obj: THREE.Object3D;
  if (obs.type === 'wall' && obs.material === 'wallMetal') {
    // 금속 벽 → 패널 + 트림 디테일
    obj = buildMetalWall(w, h, d < 0.5 ? 0.15 : d, obs.material);
  } else {
    // 일반 박스 (콘크리트 벽, 기둥, 크레이트)
    const mat = getCachedMaterial(obs.material);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    obj = mesh;
  }

  obj.position.set(obs.position[0], obs.position[1] + obs.size[1] / 2, obs.position[2]);
  if (obs.rotation) obj.rotation.y = obs.rotation;

  return obj;
}

// ═══════════════════════════════════════════════════════
// 바닥 + 벽 + 천장 생성
// ═══════════════════════════════════════════════════════

/** 방 구조물 (바닥, 둘레 벽, 천장) 생성 */
function buildRoom(dims: MapPreset['dimensions']): THREE.Group {
  const roomGroup = new THREE.Group();
  const { width, depth, height } = dims;
  const halfW = width / 2;
  const halfD = depth / 2;

  // 바닥
  const floorMat = getCachedMaterial('floor');
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  roomGroup.add(floor);

  // 천장
  const ceilingMat = getCachedMaterial('ceiling');
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    ceilingMat,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = height;
  roomGroup.add(ceiling);

  // 둘레 벽 4면 (금속 패널)
  const wallThickness = 0.15;

  // 후방 벽 (-Z)
  const backWall = buildMetalWall(width, height, wallThickness, 'wallMetal');
  backWall.position.set(0, height / 2, -halfD);
  roomGroup.add(backWall);

  // 전방 벽 (+Z)
  const frontWall = buildMetalWall(width, height, wallThickness, 'wallMetal');
  frontWall.position.set(0, height / 2, halfD);
  roomGroup.add(frontWall);

  // 좌측 벽 (-X)
  const leftWall = buildMetalWall(depth, height, wallThickness, 'wallMetal');
  leftWall.position.set(-halfW, height / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  roomGroup.add(leftWall);

  // 우측 벽 (+X)
  const rightWall = buildMetalWall(depth, height, wallThickness, 'wallMetal');
  rightWall.position.set(halfW, height / 2, 0);
  rightWall.rotation.y = Math.PI / 2;
  roomGroup.add(rightWall);

  return roomGroup;
}

// ═══════════════════════════════════════════════════════
// 조명 설정
// ═══════════════════════════════════════════════════════

/** 조명 시스템 초기화 — 씬에 직접 추가 (그룹 이동과 무관) */
function setupLighting(
  scene: THREE.Scene,
  config: LightingConfig,
  renderer: THREE.WebGLRenderer | null,
): void {
  // AmbientLight — 전체 기본 밝기
  const ambient = new THREE.AmbientLight(config.ambient.color, config.ambient.intensity);
  scene.add(ambient);

  // HemisphereLight — 천장/바닥 색 대비
  const hemi = new THREE.HemisphereLight(
    config.hemisphere.skyColor,
    config.hemisphere.groundColor,
    config.hemisphere.intensity,
  );
  scene.add(hemi);

  // DirectionalLight — 유일한 그림자 소스
  const dir = new THREE.DirectionalLight(config.directional.color, config.directional.intensity);
  dir.position.set(...config.directional.position);
  dir.castShadow = config.directional.castShadow;
  dir.shadow.mapSize.setScalar(config.directional.shadowMapSize);
  // 그림자 카메라 frustum 최적화
  dir.shadow.camera.left = -25;
  dir.shadow.camera.right = 25;
  dir.shadow.camera.top = 25;
  dir.shadow.camera.bottom = -25;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 50;
  scene.add(dir);

  // PointLights — 네온 조명 효과 (그림자 없음)
  for (const pl of config.points) {
    const point = new THREE.PointLight(pl.color, pl.intensity, pl.distance);
    point.position.set(...pl.position);
    point.castShadow = false;
    scene.add(point);
  }

  // PCF 소프트 그림자 활성화
  if (renderer) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
}

// ═══════════════════════════════════════════════════════
// 안개 설정
// ═══════════════════════════════════════════════════════

/** 안개 적용 */
function setupFog(scene: THREE.Scene, config: FogConfig): void {
  if (config.type === 'exponential' && config.density !== undefined) {
    scene.fog = new THREE.FogExp2(config.color, config.density);
  } else {
    scene.fog = new THREE.Fog(config.color, config.near ?? 20, config.far ?? 60);
  }
}

// ═══════════════════════════════════════════════════════
// 메인 팩토리
// ═══════════════════════════════════════════════════════

/**
 * 씬에 환경 구성 (프리셋 기반)
 * @param scene     Three.js 씬
 * @param presetId  맵 프리셋 ID (기본: open-forge)
 * @param renderer  WebGLRenderer (그림자 설정용, 선택)
 * @returns EnvironmentInstance — update/dispose API 포함
 */
export function createEnvironment(
  scene: THREE.Scene,
  presetId?: string,
  renderer?: THREE.WebGLRenderer,
): EnvironmentInstance {
  const preset = MAP_PRESETS[presetId ?? DEFAULT_MAP_PRESET_ID]
    ?? MAP_PRESETS[DEFAULT_MAP_PRESET_ID];
  const { dimensions } = preset;

  const group = new THREE.Group();
  group.name = `env-${preset.id}`;

  // 1. 방 구조물 (바닥, 벽, 천장)
  const room = buildRoom(dimensions);
  group.add(room);

  // 2. 장애물 배치
  for (const obs of preset.obstacles) {
    group.add(createObstacle(obs));
  }

  // 3. 네온 바닥 그리드
  if (preset.gridSpacing > 0) {
    const neonGrid = createNeonGrid(dimensions.width, dimensions.depth, preset.gridSpacing);
    group.add(neonGrid);
  }

  // 4. 둘레 네온 트림
  const perimeterTrim = createPerimeterTrim(
    dimensions.width,
    dimensions.depth,
    0.1,
    FORGE_COLORS.neonCyan,
  );
  group.add(perimeterTrim);

  // 그룹을 씬에 추가
  scene.add(group);

  // 5. 조명 (씬에 직접 추가)
  setupLighting(scene, preset.lighting, renderer ?? null);

  // 6. 안개
  setupFog(scene, preset.fog);

  // 7. 배경색
  scene.background = new THREE.Color(FORGE_COLORS.baseDark);

  // 8. 먼지 파티클
  const dustSystem = new DustParticleSystem(preset.dust);
  scene.add(dustSystem.getObject());

  return {
    group,
    presetId: preset.id,
    update(deltaTime: number): void {
      dustSystem.update(deltaTime);
    },
    dispose(): void {
      dustSystem.dispose();
      // 재질 캐시는 전역이므로 여기서 해제하지 않음
      // 그룹 내 geometry는 GameEngine.dispose()에서 traverse로 해제
    },
  };
}
