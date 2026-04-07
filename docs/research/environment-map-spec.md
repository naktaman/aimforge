# AimForge 3D 환경/맵 디자인 딥리서치 기획서

> **작성일**: 2026-04-07
> **대상 프로젝트**: AimForge (Tauri 2 + React + Three.js FPS 에임 트레이너)
> **현재 상태**: Environment.ts 89줄, 기본 그리드 + 5개 벽
> **목표**: 훈련 목적별 최적 맵 프리셋 + Cold Forge 테마 통합 + 성능 최적화

---

## 1. 에임 트레이너 환경 비교 분석

### 1.1 Aim Lab

Aim Lab은 **시나리오 기반 접근**을 사용한다. 맵 자체보다 훈련 태스크가 환경을 정의하며, Creator Studio를 통해 커스텀 태스크와 맵 템플릿을 만들 수 있다.

**환경 특성:**
- Valorant 맵(Haven, Bind, Ascent, Split, Breeze, Icebox), CS 맵(Consulate) 등 실제 게임 맵 재현
- **Graybox Preset** 시스템: 기본 회색조 환경에서 Custom 설정으로 전환 가능
- 타겟 스타일링에 metallic/smoothing 효과 지원
- **핵심 원칙**: 타겟 색상과 배경 간 높은 대비 유지

**시사점 (AimForge 적용):**
- 기본 환경은 시각적으로 단순하게 유지하되, 타겟 가시성 최우선
- Graybox → Custom 전환 패턴은 프리셋 시스템 설계에 참고

### 1.2 Kovaak's FPS Aim Trainer

Kovaak's는 **Reflex Arena 엔진 맵 포맷**을 기반으로 하며, 인게임 맵 에디터를 제공한다.

**환경 특성:**
- 25,000+ 훈련 시나리오
- 바닥/벽 텍스처 라이브러리 (다양한 옵션)
- 캐릭터 바디/헤드 커스텀 RGB 색상
- 시나리오 기반 접근 — 아레나 분류보다 에임 메카닉별 분류

**맵 구조 패턴:**
- 대부분 **사각형 아레나** (20m × 20m ~ 40m × 40m)
- 벽과 바닥만으로 구성된 최소 환경
- 장애물은 훈련 목적에 따라 선택적 배치

**시사점 (AimForge 적용):**
- 맵 에디터보다 **프리셋 + 파라미터 조절** 우선
- 텍스처 라이브러리는 최소한으로 유지 (Cold Forge 테마 통일)

### 1.3 3D Aim Trainer (브라우저 기반)

**기술 스택이 AimForge와 가장 유사**: React + Three.js 기반.

**환경 특성:**
- FOV, 마우스 감도, 무기 파라미터(발사속도, 탄창, 재장전) 동기화
- 캐릭터 속성(이동속도, 점프, 앉기, 높이) 커스터마이징
- 200+ 과학적 설계 훈련 운동
- 리더보드, 업적, 실시간 진행 추적

**시사점 (AimForge 적용):**
- 같은 스택이므로 성능 벤치마크 참고 가능
- 환경보다 **메카닉 정밀도**가 핵심 차별화 요소

### 1.4 비교 요약

| 항목 | Aim Lab | Kovaak's | 3D Aim Trainer | **AimForge 방향** |
|------|---------|----------|----------------|-------------------|
| 맵 크기 | 가변 (실제 맵 재현) | 20-40m 아레나 | 중형 아레나 | **프리셋별 가변** |
| 시각 복잡도 | 중~고 | 저~중 | 저 | **Cold Forge 테마** |
| 조명 | 게임별 맞춤 | 기본 플랫 | 기본 | **산업/네온** |
| 커스터마이징 | Creator Studio | 맵 에디터 | 파라미터 | **프리셋 + 설정** |
| 핵심 원칙 | 타겟 가시성 | 시나리오 다양성 | 메카닉 정밀도 | **세 가지 통합** |

---

## 2. Three.js 실내 환경 구현 가이드

### 2.1 재질 시스템: PBR vs 심플

**권장: MeshStandardMaterial (PBR)**

AimForge의 Cold Forge 산업 테마에는 PBR이 필수다. 금속, 콘크리트, 페인트 등의 표면 차이를 물리 기반으로 표현해야 테마가 살아난다.

```typescript
// === 재질 팩토리 예시 ===
interface MaterialPreset {
  color: number;
  metalness: number;
  roughness: number;
  emissive?: number;
  emissiveIntensity?: number;
}

const COLD_FORGE_MATERIALS: Record<string, MaterialPreset> = {
  // 바닥: 어두운 콘크리트
  floor: {
    color: 0x1a1a2e,
    metalness: 0.1,
    roughness: 0.85,
  },
  // 벽: 금속 패널
  wallMetal: {
    color: 0x2a2a3e,
    metalness: 0.7,
    roughness: 0.4,
  },
  // 벽: 콘크리트
  wallConcrete: {
    color: 0x16213e,
    metalness: 0.0,
    roughness: 0.9,
  },
  // 천장: 산업용 금속
  ceiling: {
    color: 0x0f0f23,
    metalness: 0.5,
    roughness: 0.6,
  },
  // 네온 트림: 시안 글로우
  neonCyan: {
    color: 0x00e5ff,
    metalness: 0.0,
    roughness: 0.0,
    emissive: 0x00e5ff,
    emissiveIntensity: 2.5,
  },
  // 네온 트림: 마젠타 액센트
  neonMagenta: {
    color: 0xff2daa,
    metalness: 0.0,
    roughness: 0.0,
    emissive: 0xff2daa,
    emissiveIntensity: 1.8,
  },
};

function createMaterial(preset: MaterialPreset): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: preset.color,
    metalness: preset.metalness,
    roughness: preset.roughness,
  });
  if (preset.emissive !== undefined) {
    mat.emissive = new THREE.Color(preset.emissive);
    mat.emissiveIntensity = preset.emissiveIntensity ?? 1.0;
    mat.toneMapped = false; // 글로우가 tone mapping에 눌리지 않도록
  }
  return mat;
}
```

**심플 재질은 언제 쓰나?**
- 히트 피드백 오버레이 (`MeshBasicMaterial` — 조명 무시)
- 디버그 와이어프레임
- 타겟 자체 (조명 영향을 최소화해 가시성 보장)

### 2.2 조명 시스템

에임 트레이너의 조명은 **타겟 가시성**과 **분위기**를 동시에 만족해야 한다. PointLight 그림자는 draw call 6배이므로 반드시 제한한다.

```typescript
// === 조명 셋업 코드 스켈레톤 ===
interface LightingConfig {
  ambient: { color: number; intensity: number };
  hemisphere: { skyColor: number; groundColor: number; intensity: number };
  directional: {
    color: number;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
    shadowMapSize: number;
  };
  points: Array<{
    color: number;
    intensity: number;
    distance: number;
    position: [number, number, number];
    castShadow: false; // PointLight 그림자 비활성화 (성능)
  }>;
}

const COLD_FORGE_LIGHTING: LightingConfig = {
  // 기본 환경광 — 어둡게 유지
  ambient: { color: 0x0a0a1a, intensity: 0.3 },

  // 반구광 — 천장(차가운 블루) vs 바닥(따뜻한 앰버)
  hemisphere: {
    skyColor: 0x1a1a4e,
    groundColor: 0x2a1a0a,
    intensity: 0.4,
  },

  // 주 방향광 — 그림자 담당 (유일한 그림자 소스)
  directional: {
    color: 0xffffff,
    intensity: 0.6,
    position: [10, 20, 10],
    castShadow: true,
    shadowMapSize: 1024, // 2048은 고사양 옵션
  },

  // 포인트 라이트 — 네온 조명 효과 (그림자 없음)
  points: [
    {
      color: 0x00e5ff, // 시안
      intensity: 1.2,
      distance: 15,
      position: [0, 3, -10],
      castShadow: false,
    },
    {
      color: 0x00e5ff,
      intensity: 0.8,
      distance: 12,
      position: [8, 3, 5],
      castShadow: false,
    },
  ],
};

function setupLighting(scene: THREE.Scene, config: LightingConfig): void {
  // AmbientLight
  const ambient = new THREE.AmbientLight(config.ambient.color, config.ambient.intensity);
  scene.add(ambient);

  // HemisphereLight
  const hemi = new THREE.HemisphereLight(
    config.hemisphere.skyColor,
    config.hemisphere.groundColor,
    config.hemisphere.intensity
  );
  scene.add(hemi);

  // DirectionalLight (유일한 그림자 소스)
  const dir = new THREE.DirectionalLight(config.directional.color, config.directional.intensity);
  dir.position.set(...config.directional.position);
  dir.castShadow = config.directional.castShadow;
  dir.shadow.mapSize.setScalar(config.directional.shadowMapSize);
  // 그림자 카메라 frustum 최적화 — 맵 크기에 맞춤
  dir.shadow.camera.left = -25;
  dir.shadow.camera.right = 25;
  dir.shadow.camera.top = 25;
  dir.shadow.camera.bottom = -25;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 50;
  scene.add(dir);

  // PointLights (그림자 없음)
  for (const pl of config.points) {
    const point = new THREE.PointLight(pl.color, pl.intensity, pl.distance);
    point.position.set(...pl.position);
    point.castShadow = false; // 절대 true로 바꾸지 않음
    scene.add(point);
  }
}
```

**그림자 최적화 전략:**

| 그림자 타입 | 성능 비용 | 품질 | 권장 용도 |
|------------|----------|------|----------|
| BasicShadowMap | 최저 | 하드 엣지 | 저사양 모드 |
| **PCFSoftShadowMap** | **중간** | **소프트** | **기본 설정** |
| VSMShadowMap | 높음 | 매우 소프트 | 단일 그림자 소스만 |

```typescript
// 렌더러 그림자 설정
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 기본 권장
```

### 2.3 안개 및 깊이감

안개는 **GPU 비용이 거의 없는** 최고의 시각 효과다.

```typescript
// === 안개 설정 ===
// 선형 안개: 제어가 쉬움
scene.fog = new THREE.Fog(
  0x0a0a1a, // 배경색과 동일 (Cold Forge 어두운 네이비)
  20,       // near: 안개 시작 거리
  60        // far: 안개 완전 불투명 거리
);
scene.background = new THREE.Color(0x0a0a1a);

// 지수 안개: 더 자연스러움 (Long Range 맵에 적합)
// scene.fog = new THREE.FogExp2(0x0a0a1a, 0.02);
```

**맵 프리셋별 안개 설정 가이드:**
- **Flick (넓은 공간)**: near=30, far=80 — 배경 부드럽게 사라짐
- **Tracking (중간 공간)**: near=20, far=50 — 적당한 깊이감
- **CQB (좁은 공간)**: near=8, far=20 — 압박감 연출
- **Long Range (긴 복도)**: FogExp2, density=0.015 — 거리감 강조

---

## 3. 훈련 목적별 맵 프리셋

### 3.1 프리셋 아키텍처

```typescript
// === 맵 프리셋 타입 정의 ===
interface MapPreset {
  id: string;
  name: string;
  category: 'flick' | 'tracking' | 'cqb' | 'longrange';
  dimensions: {
    width: number;   // X축 (미터)
    depth: number;   // Z축 (미터)
    height: number;  // Y축 (미터)
  };
  obstacles: ObstacleConfig[];
  lighting: LightingConfig;
  fog: FogConfig;
  spawnArea: { min: THREE.Vector3; max: THREE.Vector3 };
  targetArea: { min: THREE.Vector3; max: THREE.Vector3 };
}

interface ObstacleConfig {
  type: 'wall' | 'pillar' | 'crate' | 'ramp';
  position: [number, number, number];
  size: [number, number, number];
  rotation?: number; // Y축 회전 (라디안)
  material: keyof typeof COLD_FORGE_MATERIALS;
}

interface FogConfig {
  type: 'linear' | 'exponential';
  color: number;
  near?: number;
  far?: number;
  density?: number;
}
```

### 3.2 Flick 전용 맵 — "Open Forge"

**설계 원칙**: 넓은 개방 공간, 높은 조명, 장애물 최소화. 타겟이 시야 전체에 걸쳐 나타나야 한다.

```typescript
const FLICK_PRESET: MapPreset = {
  id: 'flick-open-forge',
  name: 'Open Forge',
  category: 'flick',
  dimensions: { width: 30, depth: 30, height: 6 },
  obstacles: [
    // 시각적 참조점 역할만 하는 기둥 4개
    { type: 'pillar', position: [-8, 0, -8], size: [1, 6, 1], material: 'wallMetal' },
    { type: 'pillar', position: [8, 0, -8], size: [1, 6, 1], material: 'wallMetal' },
    { type: 'pillar', position: [-8, 0, 8], size: [1, 6, 1], material: 'wallMetal' },
    { type: 'pillar', position: [8, 0, 8], size: [1, 6, 1], material: 'wallMetal' },
  ],
  lighting: {
    ambient: { color: 0x1a1a3e, intensity: 0.5 }, // 약간 밝게
    hemisphere: { skyColor: 0x2a2a5e, groundColor: 0x1a1a0a, intensity: 0.5 },
    directional: {
      color: 0xffffff, intensity: 0.8,
      position: [0, 20, 0], castShadow: true, shadowMapSize: 1024,
    },
    points: [
      { color: 0x00e5ff, intensity: 0.6, distance: 20, position: [0, 5, 0], castShadow: false },
    ],
  },
  fog: { type: 'linear', color: 0x0a0a1a, near: 30, far: 80 },
  spawnArea: { min: new THREE.Vector3(-2, 0, -2), max: new THREE.Vector3(2, 0, 2) },
  targetArea: { min: new THREE.Vector3(-14, 0.5, -14), max: new THREE.Vector3(14, 5, 14) },
};
```

**핵심 수치:**
- 30m × 30m × 6m — 타겟이 최대 ~20m 거리에서 등장
- 장애물 4개 (기둥) — 시각적 깊이 참조용
- 밝은 조명 — 타겟 식별 시간 최소화

### 3.3 Tracking 전용 맵 — "Circuit Forge"

**설계 원칙**: 중간 크기, 장애물로 시야 차단 구간 생성. 타겟이 장애물 뒤로 사라졌다 나타나는 패턴.

```typescript
const TRACKING_PRESET: MapPreset = {
  id: 'tracking-circuit-forge',
  name: 'Circuit Forge',
  category: 'tracking',
  dimensions: { width: 24, depth: 24, height: 5 },
  obstacles: [
    // 중앙 기둥 구조
    { type: 'pillar', position: [0, 0, 0], size: [3, 5, 3], material: 'wallMetal' },
    // 반원형 벽 배치 (시야 차단)
    { type: 'wall', position: [-6, 0, -4], size: [4, 3, 0.5], rotation: 0.3, material: 'wallConcrete' },
    { type: 'wall', position: [6, 0, 4], size: [4, 3, 0.5], rotation: -0.3, material: 'wallConcrete' },
    // 높이가 낮은 장애물 (위로 넘어가는 타겟)
    { type: 'crate', position: [-4, 0, 6], size: [2, 1.5, 2], material: 'wallMetal' },
    { type: 'crate', position: [4, 0, -6], size: [2, 1.5, 2], material: 'wallMetal' },
    // 경사로 (수직 트래킹 연습)
    { type: 'ramp', position: [8, 0, 0], size: [3, 2, 6], rotation: 0, material: 'wallConcrete' },
  ],
  lighting: {
    ambient: { color: 0x12122a, intensity: 0.35 },
    hemisphere: { skyColor: 0x1a1a4e, groundColor: 0x2a1a0a, intensity: 0.4 },
    directional: {
      color: 0xeeeeff, intensity: 0.7,
      position: [5, 15, 5], castShadow: true, shadowMapSize: 1024,
    },
    points: [
      { color: 0x00e5ff, intensity: 1.0, distance: 12, position: [-8, 4, -8], castShadow: false },
      { color: 0x00e5ff, intensity: 1.0, distance: 12, position: [8, 4, 8], castShadow: false },
    ],
  },
  fog: { type: 'linear', color: 0x0a0a1a, near: 20, far: 50 },
  spawnArea: { min: new THREE.Vector3(-3, 0, 10), max: new THREE.Vector3(3, 0, 11) },
  targetArea: { min: new THREE.Vector3(-10, 0.5, -10), max: new THREE.Vector3(10, 4, 10) },
};
```

**핵심 수치:**
- 24m × 24m × 5m — 중간 교전 거리
- 장애물 6개 — 시야 차단/노출 리듬 생성
- 시안 포인트 라이트 2개 — 깊이감 + 분위기

### 3.4 CQB/Close 전용 맵 — "Pressure Forge"

**설계 원칙**: 좁은 공간, 낮은 천장, 코너 많음. 빠른 반응속도와 근접 에임 정밀도 훈련.

```typescript
const CQB_PRESET: MapPreset = {
  id: 'cqb-pressure-forge',
  name: 'Pressure Forge',
  category: 'cqb',
  dimensions: { width: 12, depth: 12, height: 3.5 },
  obstacles: [
    // L자 벽 (코너 교전)
    { type: 'wall', position: [-2, 0, -2], size: [6, 3.5, 0.4], rotation: 0, material: 'wallConcrete' },
    { type: 'wall', position: [-2, 0, -2], size: [0.4, 3.5, 4], rotation: 0, material: 'wallConcrete' },
    // 분리 벽
    { type: 'wall', position: [3, 0, 2], size: [0.4, 3.5, 5], rotation: 0, material: 'wallMetal' },
    // 엄폐물
    { type: 'crate', position: [0, 0, 4], size: [1.5, 1.2, 1.5], material: 'wallMetal' },
    { type: 'crate', position: [-4, 0, 0], size: [1.5, 1.2, 1.5], material: 'wallMetal' },
  ],
  lighting: {
    ambient: { color: 0x0a0a15, intensity: 0.25 }, // 어두운 분위기
    hemisphere: { skyColor: 0x101030, groundColor: 0x150a05, intensity: 0.3 },
    directional: {
      color: 0xccccee, intensity: 0.5,
      position: [2, 8, 2], castShadow: true, shadowMapSize: 1024,
    },
    points: [
      { color: 0x00e5ff, intensity: 1.5, distance: 8, position: [-3, 3, -3], castShadow: false },
      { color: 0xff2daa, intensity: 0.8, distance: 6, position: [4, 3, 3], castShadow: false },
    ],
  },
  fog: { type: 'linear', color: 0x050510, near: 8, far: 20 },
  spawnArea: { min: new THREE.Vector3(-1, 0, -5), max: new THREE.Vector3(1, 0, -4) },
  targetArea: { min: new THREE.Vector3(-5, 0.3, -5), max: new THREE.Vector3(5, 3, 5) },
};
```

**핵심 수치:**
- 12m × 12m × 3.5m — 극도로 좁은 공간
- 코너/엄폐물 — 실전 CQB 시뮬레이션
- 어두운 조명 + 시안/마젠타 강조 — 긴장감

### 3.5 Long Range 전용 맵 — "Corridor Forge"

**설계 원칙**: 긴 복도형, 타겟이 30m+ 거리에서 등장. 정밀 에임과 리코일 제어 훈련.

```typescript
const LONGRANGE_PRESET: MapPreset = {
  id: 'longrange-corridor-forge',
  name: 'Corridor Forge',
  category: 'longrange',
  dimensions: { width: 8, depth: 60, height: 5 },
  obstacles: [
    // 복도 양쪽 기둥 (거리감 참조)
    { type: 'pillar', position: [-3, 0, -20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [3, 0, -20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [-3, 0, 0], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [3, 0, 0], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [-3, 0, 20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [3, 0, 20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    // 부분 엄폐 (피킹 훈련)
    { type: 'crate', position: [-2, 0, -10], size: [2, 2, 1], material: 'wallConcrete' },
    { type: 'crate', position: [2, 0, 10], size: [2, 2, 1], material: 'wallConcrete' },
  ],
  lighting: {
    ambient: { color: 0x0a0a1a, intensity: 0.3 },
    hemisphere: { skyColor: 0x1a1a4e, groundColor: 0x2a1a0a, intensity: 0.35 },
    directional: {
      color: 0xffffff, intensity: 0.6,
      position: [0, 15, -20], castShadow: true, shadowMapSize: 2048, // 긴 거리라 해상도 올림
    },
    points: [
      { color: 0x00e5ff, intensity: 0.8, distance: 15, position: [0, 4, -20], castShadow: false },
      { color: 0x00e5ff, intensity: 0.8, distance: 15, position: [0, 4, 0], castShadow: false },
      { color: 0x00e5ff, intensity: 0.8, distance: 15, position: [0, 4, 20], castShadow: false },
    ],
  },
  fog: { type: 'exponential', color: 0x0a0a1a, density: 0.015 },
  spawnArea: { min: new THREE.Vector3(-2, 0, -28), max: new THREE.Vector3(2, 0, -26) },
  targetArea: { min: new THREE.Vector3(-3, 0.5, -25), max: new THREE.Vector3(3, 4, 25) },
};
```

**핵심 수치:**
- 8m × 60m × 5m — 극도로 긴 복도
- 기둥 6개 — 등간격 거리감 참조
- 지수 안개 — 원거리 타겟의 자연스러운 깊이감
- 그림자 해상도 2048 — 긴 거리에서 그림자 디테일 유지

### 3.6 프리셋 요약

| 프리셋 | 크기 (W×D×H) | 장애물 수 | 조명 밝기 | 안개 범위 | 주요 훈련 |
|--------|-------------|----------|----------|----------|----------|
| Open Forge | 30×30×6 | 4 | 밝음 | 30-80m | 플릭, 반응속도 |
| Circuit Forge | 24×24×5 | 6 | 중간 | 20-50m | 트래킹, 예측 |
| Pressure Forge | 12×12×3.5 | 5 | 어두움 | 8-20m | CQB, 근접 정밀 |
| Corridor Forge | 8×60×5 | 8 | 중간 | exp 0.015 | 원거리, 리코일 |

---

## 4. Cold Forge 비주얼 통합

### 4.1 산업/금속 테마 환경

```typescript
// === Cold Forge 환경 빌더 스켈레톤 ===
class ColdForgeEnvironmentBuilder {
  private scene: THREE.Scene;
  private materials: Map<string, THREE.MeshStandardMaterial> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initMaterials();
  }

  private initMaterials(): void {
    for (const [key, preset] of Object.entries(COLD_FORGE_MATERIALS)) {
      this.materials.set(key, createMaterial(preset));
    }
  }

  // 금속 패널 벽 생성 (리벳 디테일 포함)
  buildMetalWall(
    width: number,
    height: number,
    position: THREE.Vector3,
    rotation: number = 0
  ): THREE.Group {
    const group = new THREE.Group();

    // 메인 패널
    const panelGeo = new THREE.BoxGeometry(width, height, 0.15);
    const panel = new THREE.Mesh(panelGeo, this.materials.get('wallMetal')!);
    panel.castShadow = true;
    panel.receiveShadow = true;
    group.add(panel);

    // 패널 분리선 (인셋 라인)
    const panelCount = Math.floor(width / 2);
    for (let i = 0; i < panelCount; i++) {
      const lineGeo = new THREE.BoxGeometry(0.02, height, 0.16);
      const line = new THREE.Mesh(lineGeo, this.materials.get('wallConcrete')!);
      line.position.x = -width / 2 + (i + 1) * (width / (panelCount + 1));
      group.add(line);
    }

    // 네온 트림 (하단)
    const trimGeo = new THREE.BoxGeometry(width, 0.05, 0.17);
    const trim = new THREE.Mesh(trimGeo, this.materials.get('neonCyan')!);
    trim.position.y = -height / 2 + 0.1;
    group.add(trim);

    group.position.copy(position);
    group.rotation.y = rotation;
    return group;
  }

  // 산업용 바닥 (그리드 패턴)
  buildIndustrialFloor(width: number, depth: number): THREE.Group {
    const group = new THREE.Group();

    // 메인 바닥
    const floorGeo = new THREE.PlaneGeometry(width, depth);
    const floor = new THREE.Mesh(floorGeo, this.materials.get('floor')!);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    group.add(floor);

    // 그리드 라인 (시안)
    const gridMat = this.materials.get('neonCyan')!.clone();
    gridMat.emissiveIntensity = 0.3; // 바닥 그리드는 은은하게

    const gridSpacing = 4;
    for (let x = -width / 2; x <= width / 2; x += gridSpacing) {
      const lineGeo = new THREE.PlaneGeometry(0.02, depth);
      const line = new THREE.Mesh(lineGeo, gridMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.001, 0); // 바닥 위로 살짝
      group.add(line);
    }
    for (let z = -depth / 2; z <= depth / 2; z += gridSpacing) {
      const lineGeo = new THREE.PlaneGeometry(width, 0.02);
      const line = new THREE.Mesh(lineGeo, gridMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.001, z);
      group.add(line);
    }

    return group;
  }
}
```

### 4.2 네온 글로우 시스템

**핵심: Emissive Material + UnrealBloomPass 조합**

```typescript
// === 블룸 포스트 프로세싱 설정 ===
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

interface BloomConfig {
  resolution: THREE.Vector2;
  strength: number;     // 블룸 강도 (1.0~2.0 권장)
  radius: number;       // 블룸 블러 반경 (0.0~1.0)
  threshold: number;    // 블룸 시작 밝기 임계값 (0.6~0.9)
}

const COLD_FORGE_BLOOM: BloomConfig = {
  resolution: new THREE.Vector2(256, 256),
  strength: 1.5,
  radius: 0.4,
  threshold: 0.8,
};

function setupPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  config: BloomConfig
): EffectComposer {
  const composer = new EffectComposer(renderer);

  // 기본 렌더 패스
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 블룸 패스
  const bloomPass = new UnrealBloomPass(
    config.resolution,
    config.strength,
    config.radius,
    config.threshold
  );
  composer.addPass(bloomPass);

  // 출력 패스 (감마 보정)
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  return composer;
}

// 렌더 루프에서 renderer.render() 대신 composer.render() 사용
```

**네온 라인 가이드 구현:**

```typescript
// === 벽/바닥 네온 라인 ===
function createNeonLine(
  points: THREE.Vector3[],
  color: number = 0x00e5ff,
  width: number = 0.03
): THREE.Mesh {
  // CatmullRomCurve3로 부드러운 곡선
  const curve = new THREE.CatmullRomCurve3(points);
  const tubeGeo = new THREE.TubeGeometry(curve, 64, width, 8, false);

  const mat = new THREE.MeshStandardMaterial({
    color: color,
    emissive: new THREE.Color(color),
    emissiveIntensity: 3.0,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(tubeGeo, mat);
  return mesh;
}

// 사용 예: 벽 하단 네온 트림
const wallTrim = createNeonLine([
  new THREE.Vector3(-15, 0.1, -15),
  new THREE.Vector3(15, 0.1, -15),
], 0x00e5ff, 0.025);
scene.add(wallTrim);
```

### 4.3 환경 파티클 (먼지, 연기)

```typescript
// === 먼지 파티클 시스템 ===
interface DustConfig {
  count: number;
  area: { width: number; height: number; depth: number };
  size: number;
  opacity: number;
  speed: number;  // 초당 이동 거리
  color: number;
}

const COLD_FORGE_DUST: DustConfig = {
  count: 500,
  area: { width: 30, height: 6, depth: 30 },
  size: 0.04,
  opacity: 0.3,
  speed: 0.02,
  color: 0x88aacc,
};

class DustParticleSystem {
  private points: THREE.Points;
  private velocities: Float32Array;
  private config: DustConfig;

  constructor(config: DustConfig) {
    this.config = config;

    const positions = new Float32Array(config.count * 3);
    this.velocities = new Float32Array(config.count * 3);

    for (let i = 0; i < config.count; i++) {
      // 초기 위치: 영역 내 랜덤
      positions[i * 3] = (Math.random() - 0.5) * config.area.width;
      positions[i * 3 + 1] = Math.random() * config.area.height;
      positions[i * 3 + 2] = (Math.random() - 0.5) * config.area.depth;

      // 속도: 느린 랜덤 드리프트
      this.velocities[i * 3] = (Math.random() - 0.5) * config.speed;
      this.velocities[i * 3 + 1] = (Math.random() - 0.5) * config.speed * 0.5;
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * config.speed;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: config.color,
      size: config.size,
      transparent: true,
      opacity: config.opacity,
      depthWrite: false,       // 투명 파티클 정렬 문제 방지
      blending: THREE.AdditiveBlending, // 글로우 느낌
    });

    this.points = new THREE.Points(geometry, material);
  }

  update(deltaTime: number): void {
    const positions = this.points.geometry.attributes.position.array as Float32Array;
    const { width, height, depth } = this.config.area;

    for (let i = 0; i < this.config.count; i++) {
      const idx = i * 3;
      positions[idx] += this.velocities[idx] * deltaTime;
      positions[idx + 1] += this.velocities[idx + 1] * deltaTime;
      positions[idx + 2] += this.velocities[idx + 2] * deltaTime;

      // 경계 래핑
      if (positions[idx] > width / 2) positions[idx] = -width / 2;
      if (positions[idx] < -width / 2) positions[idx] = width / 2;
      if (positions[idx + 1] > height) positions[idx + 1] = 0;
      if (positions[idx + 1] < 0) positions[idx + 1] = height;
      if (positions[idx + 2] > depth / 2) positions[idx + 2] = -depth / 2;
      if (positions[idx + 2] < -depth / 2) positions[idx + 2] = depth / 2;
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  getMesh(): THREE.Points {
    return this.points;
  }
}
```

### 4.4 Cold Forge 컬러 팔레트

```
┌─────────────────────────────────────────────────────────┐
│  COLD FORGE COLOR SYSTEM                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ■ Base Dark      #0a0a1a  (배경, 안개)                  │
│  ■ Floor Dark     #1a1a2e  (바닥)                        │
│  ■ Wall Metal     #2a2a3e  (금속 벽)                     │
│  ■ Wall Concrete  #16213e  (콘크리트 벽)                  │
│  ■ Ceiling        #0f0f23  (천장)                        │
│                                                         │
│  ■ Neon Cyan      #00e5ff  (주 액센트)                   │
│  ■ Neon Magenta   #ff2daa  (보조 액센트)                  │
│  ■ Dust Particle  #88aacc  (파티클)                      │
│                                                         │
│  ■ Hemi Sky       #1a1a4e  (반구광 상단)                  │
│  ■ Hemi Ground    #2a1a0a  (반구광 하단)                  │
│                                                         │
│  원칙: 어두운 베이스 + 최소 2~3개 네온 포인트              │
│  네온은 전체가 아닌 엣지/트림/라인에만 적용                 │
└─────────────────────────────────────────────────────────┘
```

---

## 5. 성능 최적화 전략

### 5.1 정적 지오메트리 머지

맵의 벽, 바닥, 천장, 기둥은 모두 정적이다. 개별 메시로 두면 draw call이 수십~수백 개가 되므로 반드시 머지한다.

```typescript
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// === 정적 지오메트리 머지 ===
function mergeStaticEnvironment(
  meshes: THREE.Mesh[],
  material: THREE.Material
): THREE.Mesh {
  // 1. 각 메시의 월드 변환을 지오메트리에 베이크
  const geometries: THREE.BufferGeometry[] = [];

  for (const mesh of meshes) {
    const geo = mesh.geometry.clone();
    mesh.updateMatrixWorld(true);
    geo.applyMatrix4(mesh.matrixWorld);
    geometries.push(geo);
  }

  // 2. 머지
  const merged = mergeGeometries(geometries, false);
  if (!merged) throw new Error('Geometry merge failed — attribute mismatch');

  // 3. 바운딩 정보 재계산 (frustum culling용)
  merged.computeBoundingSphere();
  merged.computeBoundingBox();

  const mesh = new THREE.Mesh(merged, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // 4. 원본 지오메트리 해제
  for (const geo of geometries) geo.dispose();

  return mesh;
}
```

**머지 그룹 전략:**
- 같은 재질의 메시끼리만 머지 (재질별 1개의 draw call)
- 예상 그룹: `floorGroup`, `wallMetalGroup`, `wallConcreteGroup`, `ceilingGroup`, `neonGroup`
- 네온 메시는 별도 그룹 — 블룸 selective 처리 가능

### 5.2 Frustum Culling 최적화

Three.js 기본 frustum culling은 자동 적용되지만, 대형 맵에서는 계층적 그룹핑이 효과적이다.

```typescript
// === 계층적 Frustum Culling ===
// 맵을 섹터로 나누어 그룹 단위 culling
function createSectorGroups(
  mapWidth: number,
  mapDepth: number,
  sectorSize: number = 10
): THREE.Group[] {
  const sectors: THREE.Group[] = [];
  const cols = Math.ceil(mapWidth / sectorSize);
  const rows = Math.ceil(mapDepth / sectorSize);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const group = new THREE.Group();
      group.name = `sector_${r}_${c}`;
      // frustumCulled = true (기본값)
      // 그룹의 바운딩 박스가 카메라 밖이면 자식 전체 스킵
      sectors.push(group);
    }
  }

  return sectors;
}

// InstancedMesh 최적화 (반복 오브젝트용)
function createInstancedPillars(
  count: number,
  positions: THREE.Vector3[],
  geometry: THREE.BufferGeometry,
  material: THREE.Material
): THREE.InstancedMesh {
  const instanced = new THREE.InstancedMesh(geometry, material, count);
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    matrix.setPosition(positions[i]);
    instanced.setMatrixAt(i, matrix);
  }

  instanced.instanceMatrix.needsUpdate = true;
  instanced.castShadow = true;
  instanced.receiveShadow = true;

  return instanced;
}
```

### 5.3 텍스처 압축 (KTX2 / Basis Universal)

텍스처를 사용할 경우 KTX2 포맷으로 제공하면 로딩 속도와 VRAM 사용량을 크게 줄일 수 있다.

```typescript
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

// === KTX2 로더 초기화 ===
function setupKTX2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  const loader = new KTX2Loader();
  // Basis Universal 트랜스코더 경로 (빌드에 포함)
  loader.setTranscoderPath('/assets/basis/');
  loader.detectSupport(renderer); // GPU 지원 포맷 자동 감지
  return loader;
}

// 텍스처 로드 예시
async function loadCompressedTexture(
  loader: KTX2Loader,
  path: string
): Promise<THREE.CompressedTexture> {
  return new Promise((resolve, reject) => {
    loader.load(path, resolve, undefined, reject);
  });
}
```

**텍스처 변환 파이프라인 (빌드 시):**

```bash
# toktx CLI로 PNG → KTX2 변환 (Basis Universal UASTC 모드)
toktx --t2 --encode uastc --uastc_quality 2 \
  --assign_oetf srgb --assign_primaries bt709 \
  output.ktx2 input.png

# 일괄 변환 스크립트
for f in textures/*.png; do
  toktx --t2 --encode uastc --uastc_quality 2 \
    "${f%.png}.ktx2" "$f"
done
```

**현재 Phase 1에서는 텍스처 없이 PBR 파라미터만으로 충분**. 텍스처는 Phase 2~3에서 선택적 도입.

### 5.4 LOD (Level of Detail)

에임 트레이너에서 LOD가 필요한 경우는 제한적이다 — 대부분의 지오메트리가 단순하기 때문이다. Long Range 맵의 원거리 디테일에만 선택적 적용.

```typescript
// === LOD 유틸리티 ===
function createLODObject(
  highDetail: THREE.Mesh,   // 가까이: 전체 디테일
  medDetail: THREE.Mesh,    // 중간: 단순화
  lowDetail: THREE.Mesh,    // 멀리: 최소 지오메트리
  distances: [number, number, number] = [0, 20, 50]
): THREE.LOD {
  const lod = new THREE.LOD();
  lod.addLevel(highDetail, distances[0]);
  lod.addLevel(medDetail, distances[1]);
  lod.addLevel(lowDetail, distances[2]);
  return lod;
}

// Long Range 맵 기둥 예시
const pillarHigh = new THREE.Mesh(
  new THREE.CylinderGeometry(0.4, 0.4, 5, 16), // 16 세그먼트
  metalMat
);
const pillarMed = new THREE.Mesh(
  new THREE.CylinderGeometry(0.4, 0.4, 5, 8),  // 8 세그먼트
  metalMat
);
const pillarLow = new THREE.Mesh(
  new THREE.BoxGeometry(0.8, 5, 0.8),           // 박스로 대체
  metalMat
);

const pillarLOD = createLODObject(pillarHigh, pillarMed, pillarLow);
```

### 5.5 성능 예산 (Performance Budget)

| 항목 | 목표 | 측정 방법 |
|------|------|----------|
| FPS | 144+ (게이밍 모니터 지원) | `renderer.info.render.frame` |
| Draw Calls | < 50 (머지 후) | `renderer.info.render.calls` |
| Triangles | < 100K | `renderer.info.render.triangles` |
| Textures | < 64MB VRAM | `renderer.info.memory.textures` |
| Shadow Maps | 1개 (DirectionalLight만) | 설계 제약 |
| PointLights | < 4개 | 설계 제약 |

```typescript
// === 성능 모니터 ===
function logPerformanceMetrics(renderer: THREE.WebGLRenderer): void {
  const info = renderer.info;
  console.table({
    'Draw Calls': info.render.calls,
    'Triangles': info.render.triangles,
    'Geometries': info.memory.geometries,
    'Textures': info.memory.textures,
  });
}

// 매 60프레임마다 체크 (디버그 모드)
let frameCount = 0;
function onFrame(renderer: THREE.WebGLRenderer): void {
  if (++frameCount % 60 === 0) {
    logPerformanceMetrics(renderer);
  }
}
```

---

## 6. 구현 로드맵

### Phase 1: 기본 환경 시스템 (2주)

**목표**: 현재 89줄 Environment.ts를 모듈화하고, 1개 맵 프리셋으로 Cold Forge 테마 적용

| 태스크 | 파일 | 설명 |
|--------|------|------|
| 1.1 | `environment/types.ts` | MapPreset, LightingConfig, FogConfig 등 타입 정의 |
| 1.2 | `environment/materials.ts` | COLD_FORGE_MATERIALS + createMaterial() |
| 1.3 | `environment/lighting.ts` | setupLighting() + 그림자 설정 |
| 1.4 | `environment/EnvironmentBuilder.ts` | ColdForgeEnvironmentBuilder 클래스 |
| 1.5 | `environment/presets/FlickPreset.ts` | Open Forge 프리셋 (첫 번째) |
| 1.6 | `environment/StaticMerger.ts` | mergeStaticEnvironment() |
| 1.7 | `postprocessing/BloomSetup.ts` | UnrealBloomPass 설정 |
| 1.8 | 기존 `Environment.ts` 리팩토링 | 새 모듈 시스템으로 마이그레이션 |

**완료 기준:**
- Open Forge 맵에서 타겟 스폰/파괴 정상 동작
- Draw calls < 30
- FPS 144+ (GTX 1060 기준)
- Cold Forge 테마 시각적으로 적용 (네온 트림, 어두운 배경)

### Phase 2: 전체 프리셋 + 파티클 (2주)

| 태스크 | 파일 | 설명 |
|--------|------|------|
| 2.1 | `environment/presets/TrackingPreset.ts` | Circuit Forge |
| 2.2 | `environment/presets/CQBPreset.ts` | Pressure Forge |
| 2.3 | `environment/presets/LongRangePreset.ts` | Corridor Forge |
| 2.4 | `environment/particles/DustSystem.ts` | DustParticleSystem |
| 2.5 | `environment/NeonLineBuilder.ts` | createNeonLine() |
| 2.6 | `environment/EnvironmentManager.ts` | 프리셋 로딩/전환 매니저 |
| 2.7 | UI | 맵 선택 드롭다운 + 미리보기 |

**완료 기준:**
- 4개 프리셋 모두 정상 동작
- 프리셋 간 전환 시 지오메트리/라이트/파티클 정리
- 먼지 파티클 표시
- 네온 라인 가이드 표시

### Phase 3: 폴리싱 + 성능 최적화 (1주)

| 태스크 | 파일 | 설명 |
|--------|------|------|
| 3.1 | `environment/LODManager.ts` | Long Range 맵 LOD 적용 |
| 3.2 | 텍스처 파이프라인 | KTX2 빌드 스크립트 + 선택적 텍스처 |
| 3.3 | 성능 프로파일링 | 성능 예산 검증 + 최적화 |
| 3.4 | 품질 설정 | Low/Medium/High 그래픽 옵션 |
| 3.5 | 안개 미세조정 | 프리셋별 안개 파라미터 QA |

**완료 기준:**
- Low 설정에서 GTX 960급에서 144fps
- High 설정에서 RTX 3060급에서 240fps
- 그래픽 설정 전환 즉시 적용
- 전체 프리셋 시각적 QA 통과

---

## 부록: 참고 자료

### 에임 트레이너

- Aim Lab Creator Studio, Graybox Preset 시스템
- Kovaak's Reflex Arena 맵 포맷, 인게임 에디터
- 3D Aim Trainer (React + Three.js) — GitHub 구현 참고
- Yprac Aim Trainer: 25+ 태스크 (flick, speed, precision, tracking, burst)

### Three.js 기술

- `MeshStandardMaterial` PBR (metalness/roughness workflow)
- `PCFSoftShadowMap` — 성능/품질 균형
- `BufferGeometryUtils.mergeGeometries()` — draw call 감소
- `UnrealBloomPass` — 네온 글로우 (strength 1.5, radius 0.4, threshold 0.8)
- `THREE.Points` — 파티클 시스템 (AdditiveBlending)
- `KTX2Loader` + Basis Universal — 텍스처 압축
- `THREE.LOD` — 원거리 디테일 최적화
- `THREE.Fog` / `THREE.FogExp2` — 거의 무료 깊이 효과

### 사이버펑크 컬러

- 베이스: #0a0a1a (거의 검정)
- 주 네온: #00e5ff (시안)
- 보조 네온: #ff2daa (마젠타)
- 원칙: 어두운 배경에 2~3개의 날카로운 네온 포인트만 배치
