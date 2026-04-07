# AimForge 타겟 시스템 딥리서치 기획서

> **프로젝트**: AimForge (Tauri 2 + React + Three.js 기반 FPS 에임 교정/훈련 데스크탑 앱)
> **작성일**: 2026-04-07
> **문서 버전**: v1.0

---

## 1. 주요 에임 트레이너 타겟 시스템 비교

### 1.1 타겟 유형 비교

| 특성 | Aim Lab | Kovaak's | 3D Aim Trainer | Aiming.Pro |
|---|---|---|---|---|
| **기본 타겟** | 구체(Sphere) | 구체/큐브/인체형 | 구체(Sphere) | 게임별 커스텀 |
| **인체형 타겟** | ✗ | ✓ (매니킨 봇) | 부분 지원 | ✓ (게임별 모델) |
| **벽면 타겟** | ✓ (Wallpeek) | ✓ (시나리오 편집기) | ✗ | ✗ |
| **이동 타겟** | ✓ (360° 회전) | ✓ (완전 커스텀) | ✓ (STRAFE/PASU/BOUNCE) | ✓ (동적 패턴) |
| **정적 타겟** | ✓ (Gridshot) | ✓ | ✓ | ✓ |
| **특수 타겟** | 분열/파괴 이펙트 | 적응형 봇 | 실드 구체, 클레이 피전 | 투사체 전용 타겟 |

**업계 표준**: 구체(Sphere)가 모든 트레이너에서 기본 타겟으로 사용됨. 인체형은 Kovaak's와 Aiming.Pro에서 지원.

### 1.2 크기 조절 시스템

#### 측정 단위 비교

| 단위 | 설명 | 사용처 |
|---|---|---|
| **시각각(°, Visual Angle)** | FOV 기반 실제 화면상 크기. 업계 표준 | 프로 리서치, Kovaak's FILM |
| **px (Pixels)** | 화면 해상도 기준 절대값 | Aiming.Pro |
| **% (Percentage)** | 기본 크기 대비 비율 | Aim Lab, 3D Aim Trainer |
| **cm at distance** | 거리 기반 실제 크기 | 거의 미사용 |

#### 시각각 기준 크기 데이터 (프로 에스포츠 연구)

| 분류 | 시각각 범위 | 비고 |
|---|---|---|
| **프로 경쟁 기준** | 1.3° – 1.7° | 프로 리서치 베이스라인 |
| **스폰 범위 (수평)** | 4.8° – 9.1° | 타겟 간 거리 |
| **스폰 범위 (수직)** | 5.1° – 7.8° | 타겟 간 거리 |

#### FOV 영향도

경쟁 FPS 플레이어의 68%가 HFOV 100°–110° 사용:

- 90° → 103° HFOV: 타겟 겉보기 너비 **~12% 감소**
- 103° → 120° HFOV: 추가 **~15% 감소**

#### AimForge 권장 크기 시스템

```typescript
interface TargetSizeConfig {
  // 기본 단위: 시각각(degree)
  sizeUnit: 'degree' | 'px' | 'cm';

  // FOV 기반 자동 변환
  baseSizeDeg: number;       // 기본 시각각 크기
  fovHorizontal: number;     // 플레이어 HFOV (기본 103°)

  // 난이도별 기본값 (시각각 degree)
  presets: {
    beginner:     { size: 3.0, tolerance: '±0.5°' };
    intermediate: { size: 1.8, tolerance: '±0.3°' };
    advanced:     { size: 1.3, tolerance: '±0.2°' };
    pro:          { size: 0.8, tolerance: '±0.1°' };
  };
}
```

### 1.3 스폰 패턴

#### 트레이너별 비교

| 패턴 | Aim Lab | Kovaak's | 3D Aim Trainer | Aiming.Pro |
|---|---|---|---|---|
| **그리드** | ✓ (3×3, 5×5) | ✓ (커스텀) | ✗ | ✗ |
| **랜덤** | ✓ (Motionshot) | ✓ | ✓ | ✓ |
| **원형/360°** | ✓ (Circletrack) | ✓ | ✗ | ✗ |
| **추적 궤적** | ✓ (Switchtrack) | ✓ | ✓ (STRAFE/PASU) | ✓ |
| **물리 기반** | ✗ | ✗ | ✓ (BOUNCE) | ✗ |
| **탄도 궤적** | ✗ | ✗ | ✓ (CLAY PIGEON) | ✗ |
| **점진적 난이도** | ✗ | ✗ | ✗ | ✓ |

#### AimForge 스폰 시스템 설계

```typescript
enum SpawnPattern {
  RANDOM       = 'random',        // 랜덤 위치
  GRID         = 'grid',          // N×M 그리드
  CIRCULAR     = 'circular',      // 원형 배치
  HEMISPHERE   = 'hemisphere',    // 반구 표면
  TRACKING     = 'tracking',      // 추적 궤적 (원형, 8자, 사인파)
  WALL_PEEK    = 'wall_peek',     // 엄폐물 뒤 출현
  PHYSICS      = 'physics',       // 물리 시뮬레이션
}

interface SpawnConfig {
  pattern: SpawnPattern;
  area: {
    horizontal: { min: number; max: number };  // degree
    vertical: { min: number; max: number };     // degree
    depth: { min: number; max: number };        // units
  };
  timing: {
    spawnInterval: number;     // ms
    maxSimultaneous: number;   // 동시 타겟 수
    spawnBurst: number;        // 한 번에 스폰할 수
  };
  constraints: {
    minDistance: number;        // 타겟 간 최소 거리 (degree)
    avoidCenter: boolean;      // 크로스헤어 주변 회피
    centerDeadzone: number;    // degree
  };
}
```

### 1.4 사라짐 메커니즘

| 메커니즘 | 동작 | 사용 트레이너 |
|---|---|---|
| **On-Hit (즉시)** | 명중 시 즉시 소멸 | 모든 트레이너 (기본) |
| **Multi-Hit (HP 기반)** | N회 명중 후 소멸 | Aim Lab (10히트), Aiming.Pro (커스텀) |
| **시간 제한** | 지정 시간 후 자동 소멸 | Kovaak's (ms 단위 커스텀) |
| **페이드 아웃** | 점진적 투명도 변화 후 소멸 | Aim Lab (파편 효과) |
| **HP 재생** | 시간 경과 시 HP 회복 | Aiming.Pro (트래킹 시나리오) |
| **실드 소멸** | 0.1초 지속 조준 후 실드 제거 | 3D Aim Trainer |

```typescript
interface DespawnConfig {
  type: 'on_hit' | 'multi_hit' | 'timed' | 'fade' | 'hp_regen';

  // Multi-hit
  hitPoints?: number;             // HP (기본 1)

  // 시간 제한
  lifetime?: number;              // ms (0 = 무한)

  // 페이드
  fadeStartTime?: number;         // 페이드 시작 시점 (lifetime의 %)
  fadeDuration?: number;          // 페이드 소요 시간 (ms)

  // HP 재생 (트래킹용)
  hpRegenRate?: number;           // HP/초
  hpRegenDelay?: number;          // 비조준 후 재생 시작 딜레이 (ms)

  // 점수 패널티
  timeoutPenalty?: number;        // 시간 초과 시 점수 패널티
}
```

### 1.5 난이도 시스템

#### 트레이너별 접근법

| 접근법 | 설명 | 사용처 |
|---|---|---|
| **수동 고정** | 시나리오별 난이도 프리셋 | Aim Lab (90+ 시나리오) |
| **실시간 적응형** | 성과 기반 자동 조절 | Kovaak's (v3.6.0+) |
| **단계별 프리셋** | Easy → Medium → Hard → Goated | 3D Aim Trainer |
| **동적 파라미터** | 이벤트(히트/미스/초)별 변화 | Aiming.Pro |

#### AimForge 적응형 난이도 시스템

```typescript
interface AdaptiveDifficulty {
  enabled: boolean;

  // 목표 정확도 범위 (이 범위를 유지하도록 난이도 조절)
  targetAccuracyRange: { min: 0.70; max: 0.85 };

  // 조절 가능 파라미터
  adjustableParams: {
    targetSize:    { weight: 0.4; range: [0.5, 3.0] };  // degree
    targetSpeed:   { weight: 0.3; range: [0.5, 8.0] };  // m/s
    targetCount:   { weight: 0.15; range: [1, 20] };
    spawnInterval: { weight: 0.15; range: [200, 2000] }; // ms
  };

  // 조절 속도
  adjustmentRate: number;    // 0.01 – 0.1 (프레임당 변화량)
  evaluationWindow: number;  // 최근 N발 기준 평가

  // 난이도 곡선
  difficultyScore: number;   // 0.0 – 1.0 (현재 종합 난이도)
}
```

**Kovaak's 적응형 시스템 참고**: 최적 학습 영역(Zone of Proximal Development) 유지를 목표로, 타겟 크기와 속도를 실시간 조절. AimForge는 이를 확장하여 스폰 간격과 동시 타겟 수까지 적응형으로 관리.

---

## 2. 인체형 타겟 설계

### 2.1 히트존 분류

#### FPS 게임별 히트존 비교

| 게임 | 헤드 배율 | 상체 | 하체 | 팔다리 | 특이사항 |
|---|---|---|---|---|---|
| **CS2** | 4.0x | 1.0x | 1.25x (복부) | 0.75x | 표준화 히트박스, 캡슐형 |
| **Valorant** | 4.0x | 1.0x | 1.0x | 0.75x | 전 에이전트 동일 히트박스 |
| **Overwatch 2** | 2.0x | 1.0x | 1.0x | 1.0x | 히어로별 크기 차이 극대 |
| **Apex Legends** | 2.0x | 1.0x | 1.0x | 0.8x | 5단계 히트박스 카테고리 |
| **Call of Duty** | 1.4x–2.0x | 1.0x | 1.0x | 1.0x | 무기별 배율 상이 |

#### AimForge 히트존 정의

```typescript
enum HitZone {
  HEAD        = 'head',
  NECK        = 'neck',
  UPPER_CHEST = 'upper_chest',
  LOWER_CHEST = 'lower_chest',
  STOMACH     = 'stomach',
  UPPER_ARM   = 'upper_arm',
  FOREARM     = 'forearm',
  THIGH       = 'thigh',
  SHIN        = 'shin',
}

// 게임 프로파일별 점수 가중치
const GAME_PROFILES = {
  tactical: {  // CS2/Valorant 스타일
    [HitZone.HEAD]:        4.0,
    [HitZone.NECK]:        4.0,
    [HitZone.UPPER_CHEST]: 1.0,
    [HitZone.LOWER_CHEST]: 1.0,
    [HitZone.STOMACH]:     1.25,
    [HitZone.UPPER_ARM]:   0.75,
    [HitZone.FOREARM]:     0.75,
    [HitZone.THIGH]:       0.75,
    [HitZone.SHIN]:        0.75,
  },
  hero: {  // Overwatch 2 스타일
    [HitZone.HEAD]:        2.0,
    [HitZone.NECK]:        2.0,
    [HitZone.UPPER_CHEST]: 1.0,
    [HitZone.LOWER_CHEST]: 1.0,
    [HitZone.STOMACH]:     1.0,
    [HitZone.UPPER_ARM]:   1.0,
    [HitZone.FOREARM]:     1.0,
    [HitZone.THIGH]:       1.0,
    [HitZone.SHIN]:        1.0,
  },
  battleroyale: {  // Apex Legends 스타일
    [HitZone.HEAD]:        2.0,
    [HitZone.NECK]:        1.5,
    [HitZone.UPPER_CHEST]: 1.0,
    [HitZone.LOWER_CHEST]: 1.0,
    [HitZone.STOMACH]:     1.0,
    [HitZone.UPPER_ARM]:   0.8,
    [HitZone.FOREARM]:     0.8,
    [HitZone.THIGH]:       0.8,
    [HitZone.SHIN]:        0.8,
  },
} as const;
```

### 2.2 히트박스 크기 데이터

#### 실측 기반 인체형 타겟 치수 (cm)

| 부위 | CS2 기준 | Valorant 기준 | AimForge 기본값 |
|---|---|---|---|
| **전체 높이** | ~185 cm | ~124.5 cm* | 175 cm |
| **헤드 반경** | ~11 cm | ~9 cm | 10 cm |
| **목** | W 8 × H 5 | W 7 × H 4 | W 8 × H 5 |
| **상체 (가슴)** | W 34 × H 22 | W 28 × H 18 | W 32 × H 20 |
| **하체 (복부)** | W 30 × H 18 | W 26 × H 15 | W 28 × H 16 |
| **상완 (좌우)** | L 30 × R 5 | L 25 × R 4 | L 28 × R 5 |
| **전완 (좌우)** | L 25 × R 4 | L 22 × R 3.5 | L 24 × R 4 |
| **대퇴 (좌우)** | L 42 × R 6 | L 35 × R 5 | L 40 × R 6 |
| **정강이 (좌우)** | L 42 × R 5 | L 35 × R 4.5 | L 40 × R 5 |

> *Valorant 에이전트는 게임 내 스케일이 실세계와 상이 (커뮤니티 측정 ~124.5cm, 실제 모델링 비율 축소)

#### Apex Legends 히트박스 면적 비교 (sq cm)

| 레전드 | 면적 | 카테고리 |
|---|---|---|
| Wraith | 33 | Small |
| Lifeline | 37 | Small |
| Bloodhound | 37 | Small+Tall |
| Mirage | 44 | Medium |
| Bangalore | 44 | Medium |
| Pathfinder | 63 | Medium+Wide |
| Caustic | 68 | Large |
| Gibraltar | 79 | Large |

### 2.3 Three.js 인체형 모델 구현

#### 방안 A: 프로시저럴 지오메트리 (권장)

캡슐(Sphere + Cylinder) 기본체를 조합하여 인체형 구성.

```typescript
import * as THREE from 'three';

interface HumanoidConfig {
  scale: number;  // 전체 스케일 (기본 1.0 = 175cm)

  // 부위별 치수 (cm, scale 1.0 기준)
  head:       { radius: 10, yOffset: 167.5 };
  neck:       { width: 8, height: 5, yOffset: 160 };
  upperChest: { width: 32, height: 20, depth: 18, yOffset: 145 };
  lowerChest: { width: 28, height: 16, depth: 16, yOffset: 127 };
  upperArm:   { length: 28, radius: 5, angle: 15 };   // degree 기울기
  forearm:    { length: 24, radius: 4, angle: 5 };
  thigh:      { length: 40, radius: 6, gap: 14 };      // 양쪽 간격
  shin:       { length: 40, radius: 5 };
}

class ProceduralHumanoid extends THREE.Group {
  private hitZones: Map<HitZone, THREE.Mesh> = new Map();

  constructor(config: HumanoidConfig) {
    super();
    this.buildHead(config);
    this.buildTorso(config);
    this.buildArms(config);
    this.buildLegs(config);
  }

  private buildHead(cfg: HumanoidConfig) {
    const geo = new THREE.SphereGeometry(cfg.head.radius * cfg.scale, 16, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4444 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = cfg.head.yOffset * cfg.scale;
    mesh.userData.hitZone = HitZone.HEAD;
    this.hitZones.set(HitZone.HEAD, mesh);
    this.add(mesh);
  }

  private buildTorso(cfg: HumanoidConfig) {
    // 상체 (BoxGeometry로 간소화, CapsuleGeometry도 가능)
    const upperGeo = new THREE.BoxGeometry(
      cfg.upperChest.width * cfg.scale,
      cfg.upperChest.height * cfg.scale,
      cfg.upperChest.depth * cfg.scale
    );
    const upperMat = new THREE.MeshStandardMaterial({ color: 0x44aaff });
    const upperMesh = new THREE.Mesh(upperGeo, upperMat);
    upperMesh.position.y = cfg.upperChest.yOffset * cfg.scale;
    upperMesh.userData.hitZone = HitZone.UPPER_CHEST;
    this.hitZones.set(HitZone.UPPER_CHEST, upperMesh);
    this.add(upperMesh);

    // 하체 (복부)
    const lowerGeo = new THREE.BoxGeometry(
      cfg.lowerChest.width * cfg.scale,
      cfg.lowerChest.height * cfg.scale,
      cfg.lowerChest.depth * cfg.scale
    );
    const lowerMat = new THREE.MeshStandardMaterial({ color: 0x44ccff });
    const lowerMesh = new THREE.Mesh(lowerGeo, lowerMat);
    lowerMesh.position.y = cfg.lowerChest.yOffset * cfg.scale;
    lowerMesh.userData.hitZone = HitZone.LOWER_CHEST;
    this.hitZones.set(HitZone.LOWER_CHEST, lowerMesh);
    this.add(lowerMesh);
  }

  // buildArms, buildLegs는 CapsuleGeometry 사용
  // ...

  /**
   * 레이캐스트 히트 판정 — hitZone별 점수 반환
   */
  checkHit(raycaster: THREE.Raycaster, profile: keyof typeof GAME_PROFILES): {
    hit: boolean;
    zone?: HitZone;
    score?: number;
    point?: THREE.Vector3;
  } {
    const intersects = raycaster.intersectObjects([...this.hitZones.values()]);
    if (intersects.length === 0) return { hit: false };

    const closest = intersects[0];
    const zone = closest.object.userData.hitZone as HitZone;
    const score = GAME_PROFILES[profile][zone];

    return { hit: true, zone, score, point: closest.point };
  }
}
```

**장점**: 경량 (삼각형 수 최소), 히트박스 직접 제어, 런타임 수정 용이, 스켈레톤 불필요, 빠른 렌더링

**단점**: 외관이 간소함, 애니메이션 제한적

#### 방안 B: glTF 모델

```typescript
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

class GLTFHumanoid {
  private model: THREE.Group;
  private hitBoxes: Map<string, THREE.Box3> = new Map();

  async load(url: string): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);
    this.model = gltf.scene;

    // 스켈레톤 본에서 히트박스 생성
    this.model.traverse((child) => {
      if (child.isBone) {
        const boneName = child.name.toLowerCase();
        if (boneName.includes('head')) {
          this.createHitBox(child, HitZone.HEAD, 10);
        } else if (boneName.includes('spine')) {
          this.createHitBox(child, HitZone.UPPER_CHEST, 16);
        }
        // ... 각 본에 대해 히트박스 매핑
      }
    });
  }

  private createHitBox(bone: THREE.Bone, zone: HitZone, radius: number) {
    const box = new THREE.Box3();
    box.setFromCenterAndSize(
      bone.getWorldPosition(new THREE.Vector3()),
      new THREE.Vector3(radius * 2, radius * 2, radius * 2)
    );
    this.hitBoxes.set(zone, box);
  }
}
```

**장점**: 리얼리스틱 외관, 사전 제작 애니메이션 활용, 산업 표준 (glTF/GLB), 스키닝/모프 지원

**단점**: 파일 크기 (2–10MB), 히트박스 매핑 복잡, 렌더 비용 높음

#### 구현 방안 비교

| 항목 | 프로시저럴 | glTF |
|---|---|---|
| **퍼포먼스** | 우수 | 보통 |
| **히트 판정** | 단순 레이캐스트 | 본 매칭 필요 |
| **시각 품질** | 기본 기하학 | 리얼리스틱 |
| **파일 크기** | <1 MB | 2–10 MB |
| **커스터마이징** | 높음 (런타임) | 중간 (사전 제작) |
| **AimForge 권장** | **Phase 1–2 (핵심)** | **Phase 3–4 (확장)** |

### 2.4 피격 애니메이션

#### 히트존별 시각 피드백

| 히트존 | 시각 효과 | 사운드 | 지속 시간 |
|---|---|---|---|
| **HEAD** | 골드/화이트 플래시 + 파티클 폭발 | 고음 "핑" | 50ms 플래시 + 500ms 파티클 |
| **UPPER_CHEST** | 오렌지 플래시 + 충격파 | 중음 "둔탁" | 50ms 플래시 + 300ms 파동 |
| **LOWER_CHEST** | 연한 오렌지 플래시 | 중저음 | 50ms 플래시 |
| **ARMS/LEGS** | 연한 플래시 (미세) | 저음 | 30ms 플래시 |

```typescript
interface HitFeedback {
  zone: HitZone;

  // 시각 효과
  visual: {
    flashColor: THREE.Color;
    flashIntensity: number;     // 0.0 – 1.0
    flashDuration: number;      // ms
    scaleImpulse: number;       // 히트 시 타겟 스케일 변화 (1.0 = 변화 없음)
    particleCount: number;
    particleColor: THREE.Color;
    shakeAmplitude: number;     // 히트존별 흔들림
  };

  // 히트마커 (HUD)
  hitMarker: {
    style: 'default' | 'headshot' | 'kill';
    color: string;              // '#FFD700' (골드=헤드), '#FFFFFF' (화이트=바디)
    size: number;               // px
    duration: number;           // ms
  };

  // 데미지 넘버
  damageNumber: {
    value: number;
    color: string;
    fontSize: number;
    floatSpeed: number;         // px/s 위로 이동
    fadeDelay: number;          // ms
  };
}
```

---

## 3. 타겟 움직임 패턴

### 3.1 게임별 캐릭터 이동속도 참조 데이터

| 게임 | 달리기 (m/s) | 걷기 (m/s) | 웅크리기 (m/s) | 스프린트 (m/s) |
|---|---|---|---|---|
| **CS2** | 6.35 | 3.17 | 2.11 | – |
| **Valorant** | 6.75 | – | – | 9.11 (Neon) |
| **Apex Legends** | 5.70 | 3.80 | 1.75 | – |
| **CoD: MW** | ~7.0 | ~5.0 | ~4.2 | ~10.5 |
| **Overwatch 2** | 5.50 | – | – | 다양 (히어로별) |

> **AimForge 기본 이동속도**: 5.5 m/s (조절 범위 1.0–12.0 m/s)

### 3.2 선형 이동

```typescript
class LinearMovement implements MovementPattern {
  private direction: THREE.Vector3;
  private speed: number;
  private bounds: THREE.Box3;

  update(target: Target, deltaTime: number): void {
    target.position.addScaledVector(this.direction, this.speed * deltaTime);

    // 경계 반사
    if (!this.bounds.containsPoint(target.position)) {
      this.direction.negate();
    }
  }
}
```

### 3.3 ADAD 스트레이핑 시뮬레이션

경쟁 FPS에서의 ADAD 패턴 파라미터:

- 방향 전환 빈도: 프로 기준 **2–3회/초** (250–500ms 간격)
- 지글 피크(방어적): **4–6회/초** (150–250ms)
- CS2 카운터스트레이프 윈도우: 40–80ms (1–2프레임)
- Valorant: 속도 비례 정확도 (바이너리가 아닌 연속적)

```typescript
class ADADStrafing implements MovementPattern {
  private currentDirection: 1 | -1 = 1;
  private holdTimer: number = 0;
  private holdDuration: number;
  private speed: number;
  private variance: number;      // 타이밍 랜덤성 (0.0 – 1.0)

  constructor(params: {
    baseSpeed: number;           // m/s (게임별 참조)
    avgHoldDuration: number;     // ms (평균 방향 유지 시간)
    variance: number;            // 0.1 = 10% 랜덤, 0.5 = 50% 랜덤
    acceleration: number;        // m/s² (방향 전환 가속도)
  }) {
    this.speed = params.baseSpeed;
    this.holdDuration = params.avgHoldDuration;
    this.variance = params.variance;
  }

  update(target: Target, deltaTime: number): void {
    this.holdTimer += deltaTime * 1000;

    // 현재 hold 시간 초과 시 방향 전환
    const jitteredDuration = this.holdDuration *
      (1 + (Math.random() * 2 - 1) * this.variance);

    if (this.holdTimer >= jitteredDuration) {
      this.currentDirection *= -1;
      this.holdTimer = 0;
    }

    // 이징 적용 가속/감속
    const t = this.holdTimer / jitteredDuration;
    const easedSpeed = this.speed * this.easeInOutQuad(
      Math.min(t * 3, 1)  // 처음 33%에서 가속
    );

    target.position.x += this.currentDirection * easedSpeed * deltaTime;
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}

// 난이도 프리셋
const ADAD_PRESETS = {
  bronze:   { baseSpeed: 3.0, avgHoldDuration: 600, variance: 0.1, acceleration: 15 },
  silver:   { baseSpeed: 4.5, avgHoldDuration: 400, variance: 0.2, acceleration: 25 },
  gold:     { baseSpeed: 5.5, avgHoldDuration: 300, variance: 0.3, acceleration: 35 },
  platinum: { baseSpeed: 6.5, avgHoldDuration: 250, variance: 0.4, acceleration: 50 },
  pro:      { baseSpeed: 7.0, avgHoldDuration: 200, variance: 0.5, acceleration: 80 },
};
```

### 3.4 예측 불가 이동 (Perlin Noise)

```typescript
import { createNoise2D } from 'simplex-noise';

class PerlinMovement implements MovementPattern {
  private noise2D = createNoise2D();
  private timeScale: number;
  private amplitude: THREE.Vector3;
  private seed: number;

  constructor(params: {
    timeScale: number;      // 느릴수록 부드러운 이동 (0.3 – 2.0)
    amplitude: THREE.Vector3; // 각 축별 이동 범위
  }) {
    this.timeScale = params.timeScale;
    this.amplitude = params.amplitude;
    this.seed = Math.random() * 1000;
  }

  update(target: Target, elapsed: number): void {
    const t = elapsed * this.timeScale;

    target.position.x = this.amplitude.x * this.noise2D(t, this.seed);
    target.position.y = this.amplitude.y * this.noise2D(t, this.seed + 100);
    target.position.z = this.amplitude.z * this.noise2D(t, this.seed + 200);
  }
}
```

### 3.5 추적 타겟 (원형, 8자, 사인파)

```typescript
class TrackingMovement implements MovementPattern {
  private pattern: 'circular' | 'figure8' | 'sine' | 'lissajous';

  update(target: Target, elapsed: number): void {
    const t = elapsed * this.speed;
    const center = this.center;

    switch (this.pattern) {
      case 'circular':
        target.position.x = center.x + this.radius * Math.cos(t);
        target.position.y = center.y + this.radius * Math.sin(t);
        break;

      case 'figure8':  // 리사주 곡선 (freq 비율 2:1)
        target.position.x = center.x + this.radius * Math.sin(t);
        target.position.y = center.y + this.radius * Math.sin(t * 2);
        break;

      case 'sine':
        target.position.x = center.x + this.amplitude * t;
        target.position.y = center.y + this.amplitude *
          Math.sin(t * this.frequency);
        break;

      case 'lissajous':  // 일반화 리사주
        target.position.x = center.x + this.amplitudeX *
          Math.sin(this.freqX * t + this.phaseX);
        target.position.y = center.y + this.amplitudeY *
          Math.sin(this.freqY * t + this.phaseY);
        break;
    }
  }
}
```

### 3.6 복합 움직임 시스템

```typescript
class CompositeMovement implements MovementPattern {
  private patterns: MovementPattern[];
  private weights: number[];

  update(target: Target, deltaTime: number): void {
    const position = new THREE.Vector3();

    for (let i = 0; i < this.patterns.length; i++) {
      const tempTarget = { position: new THREE.Vector3() };
      this.patterns[i].update(tempTarget, deltaTime);
      position.addScaledVector(tempTarget.position, this.weights[i]);
    }

    target.position.copy(position);
  }
}

// 예: ADAD + Perlin 노이즈 결합 (고난이도 예측불가 이동)
const hardMovement = new CompositeMovement([
  new ADADStrafing(ADAD_PRESETS.gold),
  new PerlinMovement({ timeScale: 0.8, amplitude: new THREE.Vector3(0.5, 0.3, 0) }),
], [0.7, 0.3]);
```

---

## 4. 타겟 시각 디자인

### 4.1 가시성 최적화

#### 색상 및 대비 가이드라인

| 용도 | 권장 색상 | Hex | 이유 |
|---|---|---|---|
| **기본 타겟** | 밝은 빨강 | `#FF4444` | 어두운 배경 대비 최대 |
| **헤드존** | 밝은 주황 | `#FF8800` | 바디와 시각적 구분 |
| **이동 타겟** | 시안 | `#00FFCC` | 배경과 최대 대비 |
| **HP 감소 시** | 빨강 → 어두운 빨강 | `#FF4444 → #881111` | HP 상태 직관적 표현 |
| **크로스헤어** | 화이트/밝은 그린 | `#FFFFFF / #44FF44` | 타겟 색상과 구분 |

```typescript
interface TargetVisualConfig {
  // 기본 색상
  baseColor: THREE.Color;

  // 테두리 (외곽선)
  outline: {
    enabled: boolean;
    color: THREE.Color;        // 기본: 화이트
    thickness: number;         // px (1–3)
    glowIntensity: number;     // 0.0 – 1.0
  };

  // 가시성 모드
  highContrastMode: boolean;   // 접근성 모드
  colorBlindFriendly: boolean; // 색약 대응 (빨강/녹색 대신 파랑/주황)
}
```

### 4.2 피격 시각 피드백

```typescript
class HitFeedbackSystem {
  // 히트 플래시 (타겟 전체)
  applyHitFlash(target: Target, zone: HitZone): void {
    const isHeadshot = zone === HitZone.HEAD;

    target.material.emissive.set(isHeadshot ? 0xFFD700 : 0xFF6600);
    target.material.emissiveIntensity = 1.0;

    // 50ms 후 원복
    setTimeout(() => {
      target.material.emissiveIntensity = 0;
    }, 50);
  }

  // 히트 파티클
  spawnHitParticles(point: THREE.Vector3, zone: HitZone): void {
    const count = zone === HitZone.HEAD ? 20 : 8;
    const color = zone === HitZone.HEAD ? 0xFFD700 : 0xFF4444;

    // InstancedMesh 기반 파티클 풀에서 활성화
    this.particlePool.emit(point, count, color, {
      speed: 2.0,
      lifetime: 300,       // ms
      gravity: -9.8,
      spread: Math.PI / 4, // 45° 원뿔 범위
    });
  }

  // 타겟 쉐이크 (히트 반동)
  applyHitShake(target: Target, intensity: number): void {
    const originalPos = target.position.clone();
    const shakeFrames = 4;

    for (let i = 0; i < shakeFrames; i++) {
      setTimeout(() => {
        target.position.x = originalPos.x + (Math.random() - 0.5) * intensity;
        target.position.y = originalPos.y + (Math.random() - 0.5) * intensity;

        if (i === shakeFrames - 1) {
          target.position.copy(originalPos);
        }
      }, i * 16); // ~60fps
    }
  }
}
```

### 4.3 HP 바 표시 (트래킹 시나리오)

```typescript
class TargetHPBar {
  private canvas: HTMLCanvasElement;
  private texture: THREE.CanvasTexture;
  private sprite: THREE.Sprite;

  update(currentHP: number, maxHP: number): void {
    const ratio = currentHP / maxHP;
    const ctx = this.canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 64, 8);

    // 배경
    ctx.fillStyle = '#333333';
    ctx.fillRect(0, 0, 64, 8);

    // HP 바 (색상: 녹 → 황 → 적 그라데이션)
    const hue = ratio * 120; // 0(적) – 120(녹)
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fillRect(1, 1, 62 * ratio, 6);

    this.texture.needsUpdate = true;
  }
}
```

### 4.4 스폰/디스폰 애니메이션

```typescript
const SPAWN_ANIMATIONS = {
  // 스케일 팝인
  scaleIn: {
    duration: 200,  // ms
    from: { scale: 0.0, opacity: 0.5 },
    to: { scale: 1.0, opacity: 1.0 },
    easing: 'easeOutBack',  // 약간 오버슈트 후 안착
  },

  // 페이드인
  fadeIn: {
    duration: 150,
    from: { opacity: 0.0 },
    to: { opacity: 1.0 },
    easing: 'easeOutQuad',
  },

  // 텔레포트 플래시
  teleportFlash: {
    duration: 100,
    from: { emissive: 2.0, scale: 1.5 },
    to: { emissive: 0.0, scale: 1.0 },
    easing: 'easeOutExpo',
  },
};

const DESPAWN_ANIMATIONS = {
  // 파괴 (히트 소멸)
  shatter: {
    duration: 300,
    fragments: 8,      // 파편 수
    fragmentSpeed: 3.0,
    gravity: -15,
    fadeDelay: 200,
  },

  // 시간초과 소멸
  fadeOut: {
    duration: 500,
    from: { opacity: 1.0, scale: 1.0 },
    to: { opacity: 0.0, scale: 0.8 },
    easing: 'easeInQuad',
  },

  // 축소 소멸
  shrink: {
    duration: 200,
    from: { scale: 1.0 },
    to: { scale: 0.0 },
    easing: 'easeInBack',
  },
};
```

### 4.5 Cold Forge 디자인 시스템 통합

```typescript
// Cold Forge 디자인 토큰 매핑
const COLD_FORGE_THEME = {
  colors: {
    targetPrimary:    'var(--cf-accent-red)',      // #FF4444
    targetSecondary:  'var(--cf-accent-cyan)',      // #00FFCC
    targetHeadshot:   'var(--cf-accent-gold)',      // #FFD700
    hitMarker:        'var(--cf-text-primary)',     // #FFFFFF
    hpBarBg:          'var(--cf-surface-dark)',     // #1A1A2E
    hpBarFill:        'var(--cf-status-success)',   // #44FF44
  },

  // 3D 머티리얼은 CSS 변수 직접 사용 불가 → JS 브릿지
  getMaterialColor(token: string): THREE.Color {
    const cssValue = getComputedStyle(document.documentElement)
      .getPropertyValue(token).trim();
    return new THREE.Color(cssValue);
  },
};
```

---

## 5. 성능 최적화

### 5.1 동시 타겟 수 vs FPS 벤치마크

| 동시 타겟 수 | 렌더링 방식 | 60 FPS | 144 FPS | 240 FPS |
|---|---|---|---|---|
| **50** | 개별 Mesh | ✓ 여유 | ✓ 여유 | ✓ 여유 |
| **100** | 개별 Mesh | ✓ | ✓ | ✓ |
| **500** | 개별 Mesh | ⚠ 한계 | ✗ | ✗ |
| **500** | InstancedMesh | ✓ 여유 | ✓ 여유 | ✓ |
| **1,000** | InstancedMesh | ✓ | ✓ | ⚠ |
| **5,000** | InstancedMesh + LOD | ✓ | ✓ | ⚠ LOD 필수 |
| **10,000** | InstancedMesh + LOD + BVH | ✓ | ⚠ 풀옵션 필수 | ✗ |
| **100,000** | 완전 최적화 | ✓ | ⚠ | ✗ |

> **AimForge 타겟**: 동시 타겟 1–50개가 일반적. 최대 200개 시나리오 지원 목표 → InstancedMesh 필수, LOD는 Phase 3.

### 5.2 InstancedMesh 활용

```typescript
class TargetInstanceManager {
  private instancedMesh: THREE.InstancedMesh;
  private maxInstances: number;
  private activeCount: number = 0;
  private matrices: Float32Array;
  private colors: Float32Array;

  constructor(geometry: THREE.BufferGeometry, material: THREE.Material, max: number) {
    this.maxInstances = max;
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, max);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0; // 초기에는 0개 렌더
  }

  spawn(position: THREE.Vector3, scale: number, color: THREE.Color): number {
    const index = this.activeCount++;

    const matrix = new THREE.Matrix4();
    matrix.makeScale(scale, scale, scale);
    matrix.setPosition(position);

    this.instancedMesh.setMatrixAt(index, matrix);
    this.instancedMesh.setColorAt(index, color);
    this.instancedMesh.count = this.activeCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.instancedMesh.instanceColor!.needsUpdate = true;

    return index;
  }

  despawn(index: number): void {
    // 마지막 인스턴스와 swap하여 빈 슬롯 제거
    const lastIndex = this.activeCount - 1;
    if (index !== lastIndex) {
      const lastMatrix = new THREE.Matrix4();
      this.instancedMesh.getMatrixAt(lastIndex, lastMatrix);
      this.instancedMesh.setMatrixAt(index, lastMatrix);

      const lastColor = new THREE.Color();
      this.instancedMesh.getColorAt(lastIndex, lastColor);
      this.instancedMesh.setColorAt(index, lastColor);
    }

    this.activeCount--;
    this.instancedMesh.count = this.activeCount;
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  updatePosition(index: number, position: THREE.Vector3): void {
    const matrix = new THREE.Matrix4();
    this.instancedMesh.getMatrixAt(index, matrix);
    matrix.setPosition(position);
    this.instancedMesh.setMatrixAt(index, matrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
```

### 5.3 히트 판정 최적화

#### BVH 가속 (three-mesh-bvh)

```typescript
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// 전역 레이캐스트 가속 적용
THREE.Mesh.prototype.raycast = acceleratedRaycast;

class OptimizedHitDetection {
  private bvh: MeshBVH;

  init(geometry: THREE.BufferGeometry): void {
    this.bvh = new MeshBVH(geometry);
    geometry.boundsTree = this.bvh;
  }

  // 성능: 80,000 폴리곤 모델에 대해 500 레이 → 60 FPS 유지
}
```

#### GPU 피킹 (O(1) 히트 판정)

```typescript
class GPUPicker {
  private pickingScene: THREE.Scene;
  private pickingTexture: THREE.WebGLRenderTarget;
  private idToTarget: Map<number, Target> = new Map();

  constructor(renderer: THREE.WebGLRenderer, width: number, height: number) {
    this.pickingTexture = new THREE.WebGLRenderTarget(1, 1); // 1px만 필요
  }

  /**
   * 화면 중앙 (크로스헤어) 1px만 렌더하여 히트 타겟 판별
   * CPU 레이캐스트 대비 99.5% 빠름 (45ms → <1ms)
   */
  pick(mouse: THREE.Vector2, camera: THREE.Camera): Target | null {
    // 1. ID 텍스처로 각 타겟에 고유 RGB 색상 부여
    // 2. 크로스헤어 위치 1px만 렌더
    // 3. readPixels로 RGB 읽어 타겟 식별

    this.pickingTexture.setSize(1, 1);
    const renderer = this.renderer;

    renderer.setRenderTarget(this.pickingTexture);
    renderer.render(this.pickingScene, camera);

    const pixelBuffer = new Uint8Array(4);
    renderer.readRenderTargetPixels(this.pickingTexture, 0, 0, 1, 1, pixelBuffer);

    const id = (pixelBuffer[0] << 16) | (pixelBuffer[1] << 8) | pixelBuffer[2];
    renderer.setRenderTarget(null);

    return this.idToTarget.get(id) ?? null;
  }
}
```

#### 히트 판정 방식 비교

| 방식 | 시간 복잡도 | 50 타겟 | 200 타겟 | 비고 |
|---|---|---|---|---|
| **CPU Raycaster (기본)** | O(n) | 0.5ms | 2ms | 단순, 교차점 정보 포함 |
| **BVH 가속** | O(log n) | 0.1ms | 0.3ms | 복잡 지오메트리에 유리 |
| **GPU Picking** | O(1) | <0.1ms | <0.1ms | 타겟 수 무관, 가장 빠름 |
| **Spatial Hash** | O(1) 평균 | 0.05ms | 0.1ms | 충돌 검출에 최적 |

**AimForge 권장**: Phase 1은 CPU Raycaster (50 타겟 이하 충분), Phase 3에서 GPU Picking으로 전환.

### 5.4 오브젝트 풀링

```typescript
class TargetPool<T extends Target> {
  private available: T[] = [];
  private active: Set<T> = new Set();
  private factory: () => T;

  constructor(factory: () => T, initialSize: number = 100) {
    this.factory = factory;

    // 사전 할당 (GC 스파이크 방지)
    for (let i = 0; i < initialSize; i++) {
      const target = factory();
      target.visible = false;
      this.available.push(target);
    }
  }

  acquire(): T {
    const target = this.available.pop() ?? this.factory();
    target.visible = true;
    this.active.add(target);
    return target;
  }

  release(target: T): void {
    target.visible = false;
    target.reset();  // 상태 초기화
    this.active.delete(target);
    this.available.push(target);
  }

  get activeCount(): number { return this.active.size; }
  get poolSize(): number { return this.available.length; }
}
```

### 5.5 LOD 시스템

```typescript
class TargetLOD {
  // AimForge에서 LOD는 동시 타겟 100+ 시나리오에서만 의미 있음
  createLODTarget(): THREE.LOD {
    const lod = new THREE.LOD();

    // Level 0: 가까운 거리 (전체 디테일)
    const highPoly = new THREE.SphereGeometry(1, 32, 24);
    lod.addLevel(new THREE.Mesh(highPoly, material), 0);

    // Level 1: 중간 거리
    const medPoly = new THREE.SphereGeometry(1, 16, 12);
    lod.addLevel(new THREE.Mesh(medPoly, material), 30);

    // Level 2: 먼 거리
    const lowPoly = new THREE.SphereGeometry(1, 8, 6);
    lod.addLevel(new THREE.Mesh(lowPoly, material), 60);

    // Level 3: 매우 먼 거리 (빌보드)
    const sprite = new THREE.Sprite(spriteMaterial);
    lod.addLevel(sprite, 100);

    return lod;
  }
}
```

### 5.6 메모리 관리

```typescript
class TargetLifecycleManager {
  dispose(target: Target): void {
    // Three.js는 GPU 리소스를 자동 해제하지 않음 → 수동 dispose 필수
    target.geometry.dispose();

    if (Array.isArray(target.material)) {
      target.material.forEach(m => m.dispose());
    } else {
      target.material.dispose();
    }

    // 텍스처 dispose
    if (target.material.map) target.material.map.dispose();
    if (target.material.emissiveMap) target.material.emissiveMap.dispose();
  }

  // 프레임마다 모니터링
  debugMemory(renderer: THREE.WebGLRenderer): void {
    const info = renderer.info;
    console.log(`Geometries: ${info.memory.geometries}`);
    console.log(`Textures: ${info.memory.textures}`);
    console.log(`Draw calls: ${info.render.calls}`);
    console.log(`Triangles: ${info.render.triangles}`);
  }
}
```

### 5.7 드로우 콜 최적화 요약

| 기법 | 설명 | 효과 |
|---|---|---|
| **InstancedMesh** | 동일 지오메트리 → 1 드로우 콜 | 드로우 콜 N → 1 |
| **BatchedMesh** (r156+) | 다른 지오메트리 + 동일 머티리얼 | 드로우 콜 감소 |
| **머티리얼 공유** | 동일 타입 타겟 → 단일 머티리얼 | GPU 상태 전환 감소 |
| **프러스텀 컬링** | 화면 밖 타겟 렌더 스킵 | CPU/GPU 부하 감소 |
| **오브젝트 풀링** | 생성/파괴 대신 재활용 | GC 스파이크 제거 |

**목표**: 드로우 콜 **<100** → 144 FPS 안정적 유지

---

## 6. 구현 로드맵

### Phase 1: 기본 타겟 시스템 (2주)

**목표**: 구체 타겟 + 기본 스폰/소멸 + 히트 판정

| 항목 | 상세 | 우선순위 |
|---|---|---|
| `SphereTarget` 클래스 | 크기 조절, 색상, 히트 판정 | P0 |
| `TargetSpawner` | 랜덤/그리드 스폰 패턴 | P0 |
| `HitDetection` | CPU Raycaster 기반 | P0 |
| `DespawnSystem` | on-hit, timed 소멸 | P0 |
| `HitFeedback` | 기본 플래시 + 사운드 | P1 |
| `TargetPool` | 오브젝트 풀링 | P1 |
| 크기 단위 시스템 | 시각각(degree) 기반 + FOV 변환 | P1 |

**산출물**: 기본 플릭 훈련 시나리오 동작

### Phase 2: 움직임 + 난이도 (2주)

**목표**: 이동 타겟 + 적응형 난이도 + 다양한 스폰 패턴

| 항목 | 상세 | 우선순위 |
|---|---|---|
| `LinearMovement` | 좌우/상하/전후 선형 이동 | P0 |
| `ADADStrafing` | 난이도별 프리셋 (bronze–pro) | P0 |
| `TrackingMovement` | 원형, 8자, 사인파 | P0 |
| `PerlinMovement` | 예측 불가 이동 | P1 |
| `CompositeMovement` | 복합 패턴 결합 | P1 |
| `AdaptiveDifficulty` | 정확도 기반 자동 조절 | P1 |
| `CircularSpawn` | 원형/반구 스폰 | P1 |
| `WallPeekSpawn` | 엄폐물 출현 패턴 | P2 |

**산출물**: 트래킹, ADAD, 플릭 훈련 시나리오 동작

### Phase 3: 인체형 타겟 + 최적화 (3주)

**목표**: 프로시저럴 인체형 타겟 + 히트존 시스템 + 성능 최적화

| 항목 | 상세 | 우선순위 |
|---|---|---|
| `ProceduralHumanoid` | 캡슐 기반 인체형 모델 | P0 |
| `HitZoneSystem` | 9개 히트존 + 게임 프로파일별 점수 | P0 |
| `InstancedMesh` 전환 | 구체 타겟 인스턴싱 | P0 |
| `GPUPicker` | GPU 피킹 히트 판정 | P1 |
| `HitFeedback` 고도화 | 파티클, 데미지 넘버, 히트마커 | P1 |
| `TargetHPBar` | HP 바 스프라이트 | P1 |
| `LODSystem` | 3단계 LOD | P2 |
| 성능 프로파일링 | FPS 벤치마크 + 병목 분석 | P2 |

**산출물**: 인체형 타겟 헤드샷/바디샷 훈련 동작, 144 FPS 안정

### Phase 4: 시각 연출 + 확장 (2주)

**목표**: 시각 디자인 고도화 + Cold Forge 통합 + glTF 지원

| 항목 | 상세 | 우선순위 |
|---|---|---|
| 스폰/디스폰 애니메이션 | scaleIn, shatter, fadeOut | P1 |
| Cold Forge 테마 통합 | 디자인 토큰 → 3D 머티리얼 매핑 | P1 |
| `GLTFHumanoid` | glTF 모델 로드 + 히트박스 매핑 | P2 |
| HP 재생 타겟 | 트래킹 시나리오용 | P2 |
| 물리 기반 타겟 | BOUNCE, CLAY PIGEON | P2 |
| `BatchedMesh` 지원 | 혼합 타겟 타입 최적화 | P2 |
| 접근성 모드 | 색약 대응, 고대비 모드 | P2 |

**산출물**: 풀 시각 피드백, glTF 인체형 모델, 최종 프로덕션 빌드

---

## 부록 A: 핵심 의존성

| 패키지 | 용도 | 버전 |
|---|---|---|
| `three` | 3D 렌더링 엔진 | ^0.168.0 |
| `three-mesh-bvh` | BVH 가속 레이캐스트 | ^0.8.0 |
| `@three.ez/instanced-mesh` | 고급 InstancedMesh (프러스텀 컬링, LOD) | ^1.0.0 |
| `simplex-noise` | Perlin/Simplex 노이즈 | ^4.0.0 |
| `@tweenjs/tween.js` | 이징 애니메이션 | ^23.0.0 |

## 부록 B: 참고 자료

### 에임 트레이너

- Kovaak's FILM Notation: https://www.kovaak.com/film-notation/
- Kovaak's Adaptive Training (v3.6.0): https://steamdb.info/patchnotes/15584706/
- 3D Aim Trainer: https://www.3daimtrainer.com/
- Aiming.Pro Custom Drills: https://aiming.pro/creating-custom-drills

### 히트박스 데이터

- CS2 Hitboxes: https://www.fragster.com/changes-in-the-counter-strike-2-hitbox/
- Valorant Hitboxes: https://www.vlr.gg/401413/valorant-hitboxes/
- Apex Legends Hitbox Sizes: https://dotesports.com/apex-legends/news/apex-legends-has-some-drastically-different-hitbox-sizes
- Overwatch 2 Critical Hit: https://overwatch.fandom.com/wiki/Critical_hit

### 성능 최적화

- Three.js Performance Tips: https://threejs-journey.com/lessons/performance-tips
- three-mesh-bvh: https://github.com/gkjohnson/three-mesh-bvh
- InstancedMesh2: https://github.com/agargaro/instanced-mesh
- 100k Spheres Benchmark: https://velasquezdaniel.com/blog/rendering-100k-spheres-instantianing-and-draw-calls/

### 학술 연구

- Display Size & FPS Esports: https://dl.acm.org/doi/10.1145/3723498.3723813
- Eye Movement in FPS: https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2022.979293/full
- Long-term Motor Learning: https://pmc.ncbi.nlm.nih.gov/articles/PMC8720934/
- FPS Aim Trainer Analytics: https://pmc.ncbi.nlm.nih.gov/articles/PMC10925653/
