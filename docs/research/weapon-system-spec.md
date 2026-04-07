# AimForge 총기 시스템 딥리서치 기획서

> **프로젝트**: AimForge — Tauri 2 + React + Three.js 기반 FPS 에임 교정/훈련 데스크탑 앱
> **문서 버전**: v1.0
> **작성일**: 2026-04-07

---

## 목차

1. [주요 FPS 게임 총기 시스템 비교 분석](#1-주요-fps-게임-총기-시스템-비교-분석)
2. [에임 트레이너에서의 총기 구현](#2-에임-트레이너에서의-총기-구현)
3. [Three.js 1인칭 뷰모델 구현](#3-threejs-1인칭-뷰모델-구현)
4. [반동 시뮬레이션 알고리즘](#4-반동-시뮬레이션-알고리즘)
5. [발사 이펙트](#5-발사-이펙트)
6. [에임 트레이너 최적 무기 카테고리 설계](#6-에임-트레이너-최적-무기-카테고리-설계)
7. [4단계 구현 로드맵](#7-4단계-구현-로드맵)

---

## 1. 주요 FPS 게임 총기 시스템 비교 분석

### 1.1 발사 모드 비교

| 게임 | 풀오토 | 버스트 | 싱글/세미오토 | 볼트액션 | 특수 |
|------|--------|--------|--------------|---------|------|
| **CS2** | AK-47, M4A4, P90 등 | FAMAS(3발), Glock(3발) | USP-S, P250, Deagle | AWP, SSG 08 | - |
| **Valorant** | Phantom, Vandal, Spectre | Bulldog(ADS시 3발), Stinger(ADS시 4발) | Guardian, Sheriff | - | Odin(발사속도 증가 모드) |
| **Apex Legends** | R-301, R-99, Flatline | Prowler(버스트모드) | Wingman, Longbow | Kraber | Havoc(히트스캔 빔 모드) |
| **Overwatch 2** | Soldier:76, Tracer, Sombra | Genji(수리검 3발) | Widowmaker(스코프), Cassidy | - | 차지샷(Widowmaker), 프로젝타일(Pharah) |
| **R6 Siege** | R4-C, MP5, Vector | 일부 무기 버스트 | BOSG.12.2, 마크스맨 라이플 | - | SMG-11(1270 RPM 초고속) |

### 1.2 반동 패턴 시스템

**CS2 — 고정 스프레이 패턴**
- 각 무기마다 완전히 결정론적(deterministic)인 고정 스프레이 패턴 보유
- 탄이 올라갔다가 좌우로 꺾이는 특정 궤적을 매번 동일하게 반복
- 랜덤 요소는 "inaccuracy"로 별도 관리 (이동/점프/서있기 상태에 따라)
- 패턴 학습 → 반대 방향 마우스 이동으로 보정 가능 (순수 스킬 기반)

**Valorant — 하이브리드 패턴**
- 처음 약 5발: 고정된 수직 상승 패턴 (결정론적)
- 6~15발: 기본 패턴 + 점진적 랜덤 편차 증가
- 16발 이후: 거의 순수 랜덤 → 장기 스프레이 비효율적
- 0.5초 미발사 시 패턴 리셋

**Apex Legends — 블룸(Bloom) 기반**
- 연사 시 Cone of Fire(발사 원뿔)가 점진적으로 확대
- 각 탄환은 블룸 원뿔 내 랜덤 위치에 착탄
- 미발사 시 초당 8~12도 회복
- 버스트 사격 시 30~40% 감소된 블룸

**Overwatch 2 — 히어로 특화**
- Soldier:76: 유일하게 수직 반동 시스템 사용 (블룸 없음)
- 대부분 히어로: 연사 시 탄 확산(spread) 증가
- Widowmaker: 차지 시스템 (충전율에 따라 데미지 변동)
- 히트스캔 vs 프로젝타일 구분

**R6 Siege — 프로시저럴 다이아몬드 패턴**
- 다이아몬드 형태의 파라미터 세트 내에서 다음 탄착점 결정
- 현대 시스템: 다단계 프로시저럴 반동 (개발자가 각 탄환 궤적 정밀 제어)
- RNG 요소 제거된 결정론적 패턴으로 진화
- 무기별 다이아몬드 크기/형태 상이 (세로형 = 수직 상승, 가로형 = 수평 확산)

### 1.3 에임 다운 사이트(ADS) 메커니즘

| 게임 | ADS 방식 | 주요 특징 |
|------|---------|----------|
| **CS2** | ADS 없음 (스코프만 존재) | AWP/AUG/SG553 등 6개 무기만 스코프 토글 가능 |
| **Valorant** | 대부분 무기 ADS 지원 | ADS 시 확산 감소 + 발사속도 감소, Bulldog/Stinger는 ADS 시 버스트 전환 |
| **Apex Legends** | 전 무기 ADS 지원 | 힙파이어 vs ADS 정확도 차이 큼, 스코프 배율 다양 |
| **Overwatch 2** | 히어로별 상이 | Widowmaker(차지 스코프), Soldier:76(스프린트만), Ana(스코프 히트스캔 전환) |
| **R6 Siege** | 전 무기 ADS + 린(Lean) | 스코프 배율 다양 (1x~12x), 린 + ADS 조합으로 피킹 |

### 1.4 이동 정확도 패널티

| 게임 | 정지 | 이동 | 앉기 | 점프 | 특수 |
|------|------|------|------|------|------|
| **CS2** | 최고 정확도 | 심각한 패널티 | 빠른 회복 | 극심한 패널티 | 카운터스트레이핑 필수 (1~2프레임 내 속도 34% 이하) |
| **Valorant** | 0.2° 오차 | 이동 6.2° 오차, 걷기 3.0° 오차 | 0.17° 오차 | 큰 패널티 | 방향 전환 시 즉시 정확도 리셋 |
| **Apex Legends** | 기본 정확도 | 이동 중 사격 가능 (패널티 적음) | ADS 시 감소 | 공중 사격 가능 | 이동 사격이 게임의 핵심 |
| **Overwatch 2** | 히어로별 상이 | 히어로별 상이 | - | 히어로별 상이 | 이동 중심 게임 디자인 |
| **R6 Siege** | 최고 정확도 | 유의미한 패널티 | 개선된 정확도 | 큰 패널티 | 자세(린/앉기)에 따라 정확도 변동 |

### 1.5 첫발 정확도(FSA)

| 게임 | FSA 특성 |
|------|---------|
| **CS2** | 정지 시 최대 정확도, 앉기 시 유효 사거리 증가 (P250 기준 17m 이상 헤드샷 가능) |
| **Valorant** | Phantom이 Vandal보다 20% 높은 FSA, 앉기+ADS 조합 시 0편차 달성 가능 |
| **Apex Legends** | 블룸 시스템이므로 첫발이 가장 정확, ADS 시 현저한 개선 |
| **Overwatch 2** | 히어로별 상이 — Soldier:76은 FSA 완벽, Widowmaker는 차지율 의존 |
| **R6 Siege** | 다이아몬드 패턴 첫발은 랜덤 범위 내, 정지 + ADS 시 최고 정확도 |

### 1.6 발사 속도(RPM) — 주요 무기

| 게임 | 무기 | RPM | 카테고리 |
|------|------|-----|---------|
| **CS2** | AK-47 | 600 | AR |
| | M4A4 | 667 | AR |
| | AWP | 41 | SR |
| | Deagle | 267 | 권총 |
| | P90 | 857 | SMG |
| **Valorant** | Vandal | 585 | AR |
| | Phantom | 660 | AR |
| | Operator | 36 | SR |
| | Sheriff | 240 | 권총 |
| | Spectre | 800 | SMG |
| **Apex** | R-301 | 720 | AR |
| | R-99 | 1080 | SMG |
| | Wingman | 205 | 권총 |
| | Kraber | 36 | SR |
| **R6 Siege** | R4-C | 860 | AR |
| | MP5 | 800 | SMG |
| | SMG-11 | 1270 | 보조SMG |
| | BOSG | 300 | 샷건(슬러그) |

### 1.7 무기 카테고리 종합

모든 게임에서 공통적으로 등장하는 카테고리: 권총(Pistol/Sidearm), SMG, AR(Assault Rifle), 스나이퍼/마크스맨(Sniper/Marksman), 샷건(Shotgun). 추가로 Apex는 LMG와 마크스맨을 별도 분리하고, Overwatch 2는 히트스캔/프로젝타일/레이저/근접으로 구분한다.

---

## 2. 에임 트레이너에서의 총기 구현

### 2.1 Aim Lab 총기 시스템

**제공 파라미터:**
- **발사 속도**: 발사 간격(초) 기반 설정 (예: 0.125초 = 8발/초)
- **투사체 속성**: 히트스캔/프로젝타일, 투사체 속도
- **반동 시스템**: 커스텀 반동 패턴 지원 — 시각적 그래프에서 궤적 직접 편집
- **반동 파라미터**: Recoil Smoothness, Max Y Recoil, Recoil Strength (X/Y축)
- **무기 외형**: 크기, 화면 위치, 각도 조절
- **리로드 시간**: 무기별 개별 설정

**반동 시스템:**
1. Custom > Weapons > New Recoil Pattern에서 시각적 그래프로 패턴 생성
2. 각 포인트를 직접 배치하여 반동 궤적 정의
3. Settings > Game > Weapon Recoil 토글로 전체 활성/비활성
4. 게임별 프리셋 제공 (CS:GO, Valorant, Apex, Overwatch)
5. Steam Workshop을 통한 커뮤니티 무기 공유

### 2.2 Kovaak's FPS Aim Trainer 총기 시스템

**제공 파라미터:**
- **Generic Recoil**: 정의된 범위 내 랜덤 반동
- **Per-Shot Recoil (PSR)**: 비랜덤 일관적 패턴 (CS:GO 스타일 학습에 최적)
- **Weapon Spread (bloom)**: 확산 반경 설정
- **Per Bullet Spread (PBS)**: 사전 정의된 확산 패턴 (샷건 특화)
- **SpreadDecayDelay**: 발사 후 확산 감소 시작 타이밍 제어
- **탄창 크기**: 탄당 발사 수, 재장전 시간
- **줌 민감도 배율**: 게임별 ADS 민감도 매칭
- **커스텀 레티클/사운드**: 무기별 개별 설정

**핵심 차이점:**
- Aim Lab: 시각적 반동 패턴 생성 + 빠른 이터레이션에 특화
- Kovaak's: 통계적 제어(PSR, PBS, SpreadDecayDelay)로 특정 게임 무기 행동 정밀 재현에 특화

### 2.3 훈련 목적별 최적 무기 설정

| 훈련 유형 | 최적 발사 모드 | RPM 범위 | 반동 수준 | 탄창 | 근거 |
|-----------|--------------|---------|----------|------|------|
| **Flick** | 싱글샷/세미오토 | 240~400 | 없음~극소 | 12~18 | 한 발씩 정밀 조준, 반동 무관 |
| **Tracking** | 풀오토 (저반동) | 600~900 | 낮음 | 30~50 | 지속 추적 + 미세 반동 보정 |
| **Target Switching** | 버스트/세미오토 | 300~600 | 중간 | 20~30 | 신속 전환 + 단시간 추적 |
| **Spray Control** | 풀오토 (고반동) | 600~900 | 높음 | 20~30 | 스프레이 패턴 근육 기억 훈련 |

### 2.4 시나리오별 무기 프리셋 설계

**Flick 시나리오:**
- 무기: Flick Pistol (Sheriff/Deagle 모방)
- RPM: 240, Spread: 0.5°, Recoil: 없음, ADS: 없음
- 용도: 정적 타겟 빠른 조준 → 단발 사격

**Tracking 시나리오:**
- 무기: Tracking Rifle (R-301/Phantom 모방)
- RPM: 660, Spread: 1.0°, Recoil: 미미한 수직 상승, ADS: 1.5x
- 용도: 이동 타겟 지속 추적

**Spray 시나리오:**
- 무기: Spray AR (AK-47/Vandal 모방)
- RPM: 600, Spread: 0.3°, Recoil: CS2 스타일 고정 패턴, ADS: 없음
- 용도: 스프레이 패턴 학습 및 보정 훈련

**Burst Switch 시나리오:**
- 무기: Burst AR (Bulldog/FAMAS 모방)
- RPM: 450 (3발 버스트), Spread: 1.5°, Recoil: 중간, ADS: 2x
- 용도: 다중 타겟 전환 + 버스트 제어

---

## 3. Three.js 1인칭 뷰모델 구현

### 3.1 무기 모델링 방식

#### 옵션 A: Low-poly 프로시저럴 생성

BoxGeometry/CylinderGeometry 조합으로 무기 형상을 코드로 생성한다. 로딩 시간 제로, 파라미터로 배럴 길이/스톡 크기 등을 자유롭게 조절할 수 있어 에임 트레이너에 적합하다.

```typescript
class ProceduralWeapon {
  private group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
  }

  buildRifle(): THREE.Group {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a, metalness: 0.8, roughness: 0.2
    });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

    // 스톡
    const stock = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.15, 0.15), woodMat
    );
    stock.position.set(-0.4, 0, 0);

    // 배럴
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.8, 16), metalMat
    );
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.4, 0, 0);

    // 리시버
    const receiver = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.08, 0.12), metalMat
    );

    this.group.add(stock, barrel, receiver);
    return this.group;
  }
}
```

장점: 제로 로딩, 경량, 무기 변형 생성 용이. 단점: 시각적 퀄리티 한계.

#### 옵션 B: glTF/GLB 모델 임포트

```typescript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class WeaponModelLoader {
  private loader = new GLTFLoader();

  async load(path: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      this.loader.load(path, (gltf) => {
        const model = gltf.scene;
        model.scale.multiplyScalar(0.4);
        model.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
          }
        });
        resolve(model);
      }, undefined, reject);
    });
  }
}
```

장점: 프로페셔널 비주얼, 리깅/애니메이션 지원. 단점: 외부 모델링 필요, 다운로드 오버헤드.

**AimForge 권장**: Phase 1은 프로시저럴, Phase 3+에서 glTF 지원 추가.

### 3.2 뷰모델 흔들림 — View Bob

이동 시 사인/코사인 파형으로 무기를 상하좌우 흔든다. 이동 속도에 비례하여 진폭과 주파수가 변한다.

```typescript
class WeaponBobController {
  private basePosition: THREE.Vector3;
  private bobTimer = 0;

  // 설정값
  private frequency = 6;             // 초당 사이클 (달리기 기준)
  private verticalAmplitude = 0.12;  // 수직 최대 변위
  private horizontalAmplitude = 0.08; // 수평 최대 변위

  constructor(private weapon: THREE.Group) {
    this.basePosition = weapon.position.clone();
  }

  update(dt: number, isMoving: boolean, velocity: THREE.Vector3) {
    if (!isMoving) { this.bobTimer = 0; return; }

    this.bobTimer += dt * this.frequency;
    const intensity = Math.min(velocity.length() / 5, 1);

    const vBob = Math.sin(this.bobTimer * Math.PI * 2)
      * this.verticalAmplitude * intensity;
    const hBob = Math.cos(this.bobTimer * Math.PI)
      * this.horizontalAmplitude * intensity;

    this.weapon.position.x = this.basePosition.x + hBob;
    this.weapon.position.y = this.basePosition.y + vBob;
  }

  setStance(stance: 'walking' | 'running' | 'sprinting') {
    const presets = {
      walking:   { freq: 3, amp: 0.05 },
      running:   { freq: 6, amp: 0.10 },
      sprinting: { freq: 8, amp: 0.15 },
    };
    const p = presets[stance];
    this.frequency = p.freq;
    this.verticalAmplitude = p.amp;
  }
}
```

### 3.3 뷰모델 흔들림 — Weapon Sway

마우스 이동에 지연 반응하여 무기 관성/무게감을 시뮬레이션한다. Lerp 기반 지연 추종 방식이다.

```typescript
class WeaponSwayController {
  private maxSway = 0.15; // 라디안
  private lerpSpeed = 0.1;
  private pitchFactor = 0.08;
  private yawFactor = 0.08;

  constructor(private weapon: THREE.Group) {}

  update(mouseX: number, mouseY: number) {
    const targetPitch = THREE.MathUtils.clamp(
      mouseY * this.pitchFactor, -this.maxSway, this.maxSway
    );
    const targetYaw = THREE.MathUtils.clamp(
      mouseX * this.yawFactor, -this.maxSway, this.maxSway
    );

    this.weapon.rotation.x = THREE.MathUtils.lerp(
      this.weapon.rotation.x, targetPitch, this.lerpSpeed
    );
    this.weapon.rotation.y = THREE.MathUtils.lerp(
      this.weapon.rotation.y, targetYaw, this.lerpSpeed
    );
  }

  setAiming(isADS: boolean) {
    // ADS 시 스웨이 대폭 감소
    this.pitchFactor = isADS ? 0.02 : 0.08;
    this.yawFactor = isADS ? 0.02 : 0.08;
    this.lerpSpeed = isADS ? 0.2 : 0.1;
  }
}
```

### 3.4 발사 킥백 애니메이션

스프링 물리 기반으로 발사 시 무기의 회전(pitch up) + 위치(Z축 후퇴) 킥백을 구현한다.

```typescript
interface RecoilConfig {
  rotationalKick: number;   // 라디안 (기본 0.1 ≈ 5.7°)
  positionalKick: number;   // 유닛 (기본 0.15)
  returnSpeed: number;      // 스프링 강성 (0.15)
  damping: number;          // 감쇠 (0.15)
}

class FireKickbackController {
  private config: RecoilConfig;
  private rotVelocity = new THREE.Euler(0, 0, 0);
  private posVelocity = new THREE.Vector3(0, 0, 0);
  private basePos: THREE.Vector3;
  private baseRot: THREE.Euler;

  constructor(private weapon: THREE.Group, config?: Partial<RecoilConfig>) {
    this.basePos = weapon.position.clone();
    this.baseRot = weapon.rotation.clone();
    this.config = {
      rotationalKick: 0.1,
      positionalKick: 0.15,
      returnSpeed: 0.15,
      damping: 0.15,
      ...config,
    };
  }

  fire() {
    this.rotVelocity.x -= this.config.rotationalKick;
    this.posVelocity.z -= this.config.positionalKick;
    this.rotVelocity.y += (Math.random() - 0.5) * 0.02; // 랜덤 수평 흔들림
  }

  update(dt: number) {
    // 스프링: F = -kx - cv
    const posDelta = new THREE.Vector3()
      .subVectors(this.basePos, this.weapon.position)
      .multiplyScalar(this.config.returnSpeed);
    this.posVelocity.add(posDelta);
    this.posVelocity.multiplyScalar(1 - this.config.damping);
    this.weapon.position.add(this.posVelocity);

    const rotDeltaX = (this.baseRot.x - this.weapon.rotation.x) * this.config.returnSpeed;
    const rotDeltaY = (this.baseRot.y - this.weapon.rotation.y) * this.config.returnSpeed;
    this.rotVelocity.x += rotDeltaX;
    this.rotVelocity.y += rotDeltaY;
    this.rotVelocity.x *= (1 - this.config.damping);
    this.rotVelocity.y *= (1 - this.config.damping);
    this.weapon.rotation.x += this.rotVelocity.x;
    this.weapon.rotation.y += this.rotVelocity.y;
  }

  // 무기 유형별 프리셋
  setWeaponType(type: 'pistol' | 'rifle' | 'shotgun') {
    const presets = {
      pistol:  { rotationalKick: 0.05, positionalKick: 0.08 },
      rifle:   { rotationalKick: 0.10, positionalKick: 0.15 },
      shotgun: { rotationalKick: 0.18, positionalKick: 0.25 },
    };
    Object.assign(this.config, presets[type]);
  }
}
```

### 3.5 머즐 플래시 이펙트

Sprite + PointLight 하이브리드 방식이 에임 트레이너에 최적이다. 단일 드로콜로 144+FPS 유지 가능하다.

```typescript
class MuzzleFlashController {
  private sprite: THREE.Sprite;
  private light: THREE.PointLight;

  constructor(weaponGroup: THREE.Group, muzzleOffset: THREE.Vector3) {
    // Sprite (AdditiveBlending으로 발광 효과)
    const spriteMat = new THREE.SpriteMaterial({
      map: new THREE.TextureLoader().load('textures/muzzle-flash.png'),
      blending: THREE.AdditiveBlending,
    });
    this.sprite = new THREE.Sprite(spriteMat);
    this.sprite.position.copy(muzzleOffset);
    this.sprite.visible = false;
    weaponGroup.add(this.sprite);

    // PointLight (순간 조명)
    this.light = new THREE.PointLight(0xffaa00, 0, 10);
    this.light.position.copy(muzzleOffset);
    weaponGroup.add(this.light);
  }

  fire() {
    this.sprite.visible = true;
    this.sprite.material.opacity = 1;
    this.sprite.material.rotation = Math.random() * Math.PI * 2;
    const s = 0.2 + Math.random() * 0.2;
    this.sprite.scale.set(s, s, 1);
    this.light.intensity = 2;

    // 100ms 페이드아웃
    const start = performance.now();
    const animate = () => {
      const p = Math.min((performance.now() - start) / 100, 1);
      this.sprite.material.opacity = 1 - p;
      this.light.intensity = 2 * (1 - p);
      if (p < 1) requestAnimationFrame(animate);
      else this.sprite.visible = false;
    };
    requestAnimationFrame(animate);
  }
}
```

### 3.6 탄피 배출 파티클

물리 엔진 없이 간단한 포물선 운동으로 탄피 배출을 구현한다. 오브젝트 풀링으로 GC 압박을 방지한다.

```typescript
interface CasingParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVel: THREE.Euler;
  lifetime: number;
}

class ShellCasingEjector {
  private pool: CasingParticle[] = [];
  private active: CasingParticle[] = [];

  constructor(private scene: THREE.Scene, poolSize = 30) {
    const geo = new THREE.CylinderGeometry(0.015, 0.02, 0.04, 8);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffcc00, metalness: 0.9, roughness: 0.2
    });

    for (let i = 0; i < poolSize; i++) {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push({
        mesh, velocity: new THREE.Vector3(),
        angularVel: new THREE.Euler(), lifetime: 0
      });
    }
  }

  eject(muzzlePos: THREE.Vector3) {
    const c = this.pool.pop();
    if (!c) return;
    c.mesh.position.copy(muzzlePos);
    c.velocity.set(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 1.5 + 0.5,
      1 + Math.random() * 0.5
    );
    c.angularVel.set(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    );
    c.lifetime = 0;
    c.mesh.visible = true;
    this.active.push(c);
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];
      c.lifetime += dt;
      c.velocity.y -= 9.8 * dt;
      c.velocity.multiplyScalar(0.98);
      c.mesh.position.addScaledVector(c.velocity, dt);
      c.mesh.rotation.x += c.angularVel.x * dt;
      c.mesh.rotation.y += c.angularVel.y * dt;
      if (c.lifetime > 3) {
        c.mesh.visible = false;
        this.pool.push(c);
        this.active.splice(i, 1);
      }
    }
  }
}
```

### 3.7 에임 다운 사이트 줌 전환

FOV Lerp + 무기 위치 이동으로 부드러운 ADS 전환을 구현한다.

```typescript
class ADSController {
  private defaultFOV = 75;
  private adsFOV = 40;     // 약 2x 줌
  private speed = 0.08;
  private normalOffset = new THREE.Vector3(0.4, -0.2, -0.5);
  private adsOffset = new THREE.Vector3(0, -0.1, -0.3); // 중앙 정렬
  private isADS = false;
  private currentFOV: number;

  constructor(
    private camera: THREE.PerspectiveCamera,
    private weapon: THREE.Group
  ) {
    this.currentFOV = this.defaultFOV;
  }

  toggle() { this.isADS = !this.isADS; }

  update() {
    const targetFOV = this.isADS ? this.adsFOV : this.defaultFOV;
    this.currentFOV = THREE.MathUtils.lerp(this.currentFOV, targetFOV, this.speed);
    this.camera.fov = this.currentFOV;
    this.camera.updateProjectionMatrix();

    const targetPos = this.isADS ? this.adsOffset : this.normalOffset;
    this.weapon.position.lerp(targetPos, this.speed);
  }
}
```

---

## 4. 반동 시뮬레이션 알고리즘

### 4.1 CS2 스타일 — 고정 스프레이 패턴 재현

각 탄환에 대해 미리 정의된 (X, Y) 오프셋 테이블을 참조하며, 그 위에 가우시안 랜덤 편차를 추가한다.

```typescript
interface SprayPatternData {
  weaponId: string;
  fireRate: number;              // 초당 발사 수
  offsets: { x: number; y: number }[];  // 탄번호별 오프셋
  inaccuracyScale: float;        // 랜덤 편차 배율
  movementMultiplier: float;     // 이동 시 부정확도 배율
}

class CS2SpraySimulator {
  private pattern: SprayPatternData;
  private currentBullet = 0;
  private lastFireTime = 0;

  constructor(pattern: SprayPatternData) {
    this.pattern = pattern;
  }

  fire(timestamp: number, isMoving: boolean): { x: number; y: number } {
    // 발사 간격 체크
    const interval = 1 / this.pattern.fireRate;
    if (timestamp - this.lastFireTime < interval) return null;
    this.lastFireTime = timestamp;

    // 패턴 오프셋 참조
    const idx = Math.min(this.currentBullet, this.pattern.offsets.length - 1);
    const base = this.pattern.offsets[idx];

    // 가우시안 랜덤 편차 (Box-Muller 변환)
    const sigma = this.pattern.inaccuracyScale * (isMoving ? this.pattern.movementMultiplier : 1);
    const randX = gaussianRandom(0, sigma);
    const randY = gaussianRandom(0, sigma);

    this.currentBullet++;
    return { x: base.x + randX, y: base.y + randY };
  }

  reset() { this.currentBullet = 0; }
}

// AK-47 예시 패턴 (처음 10발)
const AK47_PATTERN: SprayPatternData = {
  weaponId: 'cs2-ak47',
  fireRate: 10,
  offsets: [
    { x: 0, y: 0 },         // 1발: 정중앙
    { x: 0.5, y: 3.2 },     // 2발: 수직 상승 시작
    { x: 1.0, y: 6.5 },
    { x: 0.8, y: 9.7 },
    { x: 0.2, y: 12.8 },
    { x: -1.2, y: 15.5 },   // 6발: 좌측 편향 시작
    { x: -2.5, y: 18.2 },
    { x: -3.8, y: 20.1 },
    { x: -4.2, y: 21.5 },
    { x: -3.5, y: 22.0 },
    // ... 30발까지 계속
  ],
  inaccuracyScale: 0.5,
  movementMultiplier: 1.5,
};
```

### 4.2 Valorant 스타일 — 하이브리드 결정론+랜덤

처음 N발은 고정 패턴, 이후 점진적으로 랜덤 확산이 증가한다. 0.5초 미발사 시 패턴이 리셋된다.

```typescript
class ValorantRecoilSimulator {
  private deterministicShots = 5;
  private transitionShots = 10;
  private basePattern: { x: number; y: number }[];
  private currentBullet = 0;
  private lastFireTime = 0;
  private resetWindow = 0.5; // 초

  constructor(basePattern: { x: number; y: number }[]) {
    this.basePattern = basePattern;
  }

  fire(timestamp: number): { x: number; y: number } {
    // 리셋 체크
    if (timestamp - this.lastFireTime > this.resetWindow) {
      this.currentBullet = 0;
    }
    this.lastFireTime = timestamp;

    const n = this.currentBullet;
    let offset: { x: number; y: number };

    if (n < this.deterministicShots) {
      // 완전 결정론적
      offset = this.basePattern[n];
    } else if (n < this.deterministicShots + this.transitionShots) {
      // 점진적 랜덤 혼합
      const blend = (n - this.deterministicShots) / this.transitionShots;
      const base = this.basePattern[n % this.basePattern.length];
      offset = {
        x: base.x + gaussianRandom(0, 2.0 * blend),
        y: base.y + gaussianRandom(0, 2.5 * blend),
      };
    } else {
      // 거의 순수 랜덤
      offset = {
        x: gaussianRandom(0, 4.0),
        y: gaussianRandom(0, 5.0),
      };
    }

    this.currentBullet++;
    return offset;
  }
}
```

### 4.3 Apex 스타일 — 블룸 기반

Cone of Fire가 연사 시 확대되고 미발사 시 회복되는 시스템이다.

```typescript
class ApexBloomSimulator {
  private currentBloom = 0;        // 현재 확산각 (도)
  private maxBloom = 45;           // 최대 확산
  private bloomPerShot = 2.0;      // 발당 블룸 증가
  private recoveryRate = 8.0;      // 초당 회복 (도/초)

  fire(): { x: number; y: number } {
    this.currentBloom = Math.min(this.currentBloom + this.bloomPerShot, this.maxBloom);

    // 블룸 원뿔 내 랜덤 위치
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * this.currentBloom;

    return {
      x: Math.cos(angle) * dist,
      y: Math.sin(angle) * dist,
    };
  }

  update(dt: number, isFiring: boolean) {
    if (!isFiring) {
      this.currentBloom = Math.max(0, this.currentBloom - this.recoveryRate * dt);
    }
  }

  getBloomRadius(): number { return this.currentBloom; }
}
```

### 4.4 ViewPunch vs AimPunch 구분

**ViewPunch** — 발사 시 카메라만 흔들림 (시각적 효과, 자동 회복)

```typescript
class ViewPunchSystem {
  private punchAngle = { x: 0, y: 0 };
  private decayRate = 0.92; // 프레임당 감쇠

  applyRecoil(magnitude: { x: number; y: number }) {
    this.punchAngle.x += magnitude.y * 0.3;  // pitch
    this.punchAngle.y += magnitude.x * 0.1;  // yaw
  }

  update() {
    this.punchAngle.x *= this.decayRate;
    this.punchAngle.y *= this.decayRate;
  }

  getCameraOffset(): { pitch: number; yaw: number } {
    return { pitch: this.punchAngle.x, yaw: this.punchAngle.y };
  }
}
```

**AimPunch** — 피격 시 실제 에임 포인트 이동 (히트 등록에 영향, 느린 회복)

```typescript
class AimPunchSystem {
  private offset = { x: 0, y: 0 };
  private recoveryRate = 0.05;

  applyDamage(amount: number) {
    this.offset.x += gaussianRandom(0, amount * 0.3);
    this.offset.y += Math.abs(gaussianRandom(0, amount * 0.5)); // 상향 편향
  }

  update(dt: number) {
    const mag = Math.sqrt(this.offset.x ** 2 + this.offset.y ** 2);
    if (mag < 0.5) { this.offset = { x: 0, y: 0 }; return; }
    const norm = { x: -this.offset.x / mag, y: -this.offset.y / mag };
    this.offset.x += norm.x * this.recoveryRate * 30 * dt;
    this.offset.y += norm.y * this.recoveryRate * 30 * dt;
  }

  getAimDisplacement(): { x: number; y: number } {
    return this.offset;
  }
}
```

### 4.5 반동 보정 훈련 지원

플레이어의 마우스 입력과 무기 반동 패턴을 비교하여 보정 정확도를 측정한다.

```typescript
class RecoilCompensationAnalyzer {
  analyze(
    pattern: { x: number; y: number }[],
    playerInputs: { x: number; y: number }[],
  ): {
    accuracy: number;       // 0~100
    errorsByShot: number[];
    consistency: number;    // 0~100
    grade: string;          // S/A/B/C/D/F
  } {
    const errors: number[] = [];

    for (let i = 0; i < Math.min(pattern.length, playerInputs.length); i++) {
      // 완벽한 보정 = playerInput == -patternOffset
      const residual = Math.sqrt(
        (playerInputs[i].x + pattern[i].x) ** 2 +
        (playerInputs[i].y + pattern[i].y) ** 2
      );
      errors.push(residual);
    }

    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const accuracy = 100 * Math.exp(-avgError / 10);

    const variance = errors.reduce((sum, e) =>
      sum + (e - avgError) ** 2, 0) / errors.length;
    const consistency = Math.max(0, 100 - Math.sqrt(variance) * 2);

    const grade = accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' :
      accuracy >= 70 ? 'B' : accuracy >= 55 ? 'C' :
      accuracy >= 40 ? 'D' : 'F';

    return { accuracy, errorsByShot: errors, consistency, grade };
  }
}
```

**시각적 피드백:**
- 예상 패턴(고스트)을 반투명 파란색으로 표시
- 실제 탄착점을 흰색으로 표시
- 오차가 큰 탄환은 빨간 선으로 예상↔실제 연결
- 실시간 점수 색상: 90+ 초록, 75+ 노랑, 60+ 주황, 이하 빨강

---

## 5. 발사 이펙트

### 5.1 트레이서(탄도선) 구현

Raycaster로 히트 판정 후 Line 지오메트리로 시각적 탄도선을 렌더링한다.

```typescript
class BulletTracer {
  private line: THREE.Line;
  private lifetime: number;
  private createdAt: number;

  constructor(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    scene: THREE.Scene,
    velocity = 500,
    maxDist = 1000
  ) {
    this.createdAt = performance.now();

    const raycaster = new THREE.Raycaster(origin, direction.normalize());
    const hits = raycaster.intersectObjects(scene.children, true);
    const endPoint = hits.length > 0
      ? hits[0].point
      : origin.clone().addScaledVector(direction, maxDist);

    this.lifetime = (origin.distanceTo(endPoint) / velocity) * 1000;

    const geo = new THREE.BufferGeometry().setFromPoints([origin, endPoint]);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffaa00, transparent: true, linewidth: 2
    });
    this.line = new THREE.Line(geo, mat);
    scene.add(this.line);

    return { line: this.line, hitPoint: hits[0]?.point ?? null };
  }

  update(): boolean {
    const progress = Math.min(
      (performance.now() - this.createdAt) / this.lifetime, 1
    );
    (this.line.material as THREE.LineBasicMaterial).opacity = 1 - progress;
    return progress < 1;
  }
}
```

### 5.2 총구 화염 (Muzzle Flash)

3.5절의 MuzzleFlashController 참조. PointLight(50ms 스파이크) + Sprite(100ms 페이드) 하이브리드가 최적이다. 랜덤 회전/스케일로 시각적 다양성을 확보한다.

### 5.3 피격 이펙트 (Impact)

표면 유형에 따라 다른 파티클을 생성한다: 금속면은 스파크(밝은 파티클, 빠른 속도), 일반면은 더스트(느린 파티클, 큰 크기). DecalGeometry로 탄흔을 표면에 투영한다.

```typescript
class ImpactEffectSystem {
  createImpact(
    position: THREE.Vector3,
    normal: THREE.Vector3,
    surfaceType: 'metal' | 'concrete' | 'wood',
    targetMesh: THREE.Mesh,
    scene: THREE.Scene
  ) {
    const isMetal = surfaceType === 'metal';
    const count = isMetal ? 20 : 12;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: isMetal ? 0xcccccc : 0x999966,
      size: isMetal ? 0.05 : 0.1,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(geo, mat);
    scene.add(particles);

    // DecalGeometry로 탄흔 생성
    // import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
    // const decalGeo = new DecalGeometry(targetMesh, position, orientation, size);
  }
}
```

### 5.4 총구 연기 파티클

Sprite 기반 파티클로 배럴 연기를 구현한다. Radial gradient 텍스처로 부드러운 연기 외관을 만들고, S커브 불투명도 감소와 바람 표류 시뮬레이션을 적용한다.

```typescript
class BarrelSmokeSystem {
  private particles: SmokeParticle[] = [];
  private pool: SmokeParticle[] = [];
  private wind = new THREE.Vector3(0.5, 0, 0.2);

  emit(position: THREE.Vector3, count = 5) {
    for (let i = 0; i < count; i++) {
      const p = this.pool.pop() || this.createParticle();
      p.position.copy(position);
      p.velocity.set(
        (Math.random() - 0.5) * 0.5,
        1.5 + Math.random() * 0.5, // 상향 바이어스
        (Math.random() - 0.5) * 0.5
      );
      p.life = 1;
      p.maxLife = 2 + Math.random();
      p.sprite.visible = true;
      this.particles.push(p);
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt / p.maxLife;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.pool.push(p);
        this.particles.splice(i, 1);
        continue;
      }
      // 물리 + 바람
      p.position.addScaledVector(p.velocity, dt);
      p.position.addScaledVector(this.wind, dt * 0.5);
      p.sprite.position.copy(p.position);
      // S커브 페이드
      const fade = 1 - p.life;
      (p.sprite.material as THREE.SpriteMaterial).opacity = p.life * 0.6;
      const scale = p.baseSize * (1 + fade * 0.5);
      p.sprite.scale.set(scale, scale, 1);
    }
  }
}
```

### 5.5 성능 최적화 가이드

144+FPS(프레임당 ~6.9ms) 유지를 위한 이펙트 예산:

| 항목 | 예산 | 최적화 전략 |
|------|------|------------|
| 레이캐스팅 | ~0.5ms | three-mesh-bvh로 가속, 프레임당 1회 제한 |
| 파티클 업데이트 | ~2ms | 오브젝트 풀링 필수, 최대 500~1000개 |
| 렌더링 | ~3ms | InstancedMesh(5000+), 드로콜 100 이하 |
| 오디오 | ~0.5ms | Howler.js 또는 THREE.PositionalAudio |
| 기타(입력 등) | ~0.9ms | - |

핵심 원칙:
- Sprite 기반(1~100개): 단일 드로콜, UI 친화적
- BufferGeometry Points(100~5000개): 복잡 형상, 다수 인스턴스
- InstancedMesh(5000+개): 동일 지오메트리 반복, 최대 성능
- 오브젝트 풀링: 모든 파티클/트레이서/이펙트에 필수
- DecalGeometry: 영구 효과 전용 (1회 비용)

---

## 6. 에임 트레이너 최적 무기 카테고리 설계

### 6.1 훈련 목적별 무기 프리셋

#### Flick Pistol

| 파라미터 | 값 | 설명 |
|---------|---|------|
| 발사 모드 | 싱글샷 | 클릭당 1발 |
| RPM | 240 | Sheriff/Deagle 기반 |
| 첫발 정확도 | 0.0° | 완전 정확 |
| 스프레드 | 0.5° | 최소 확산 |
| 반동 | 없음 | 플릭 정확도만 측정 |
| 탄창 | 12발 | 빈번한 리로드로 집중 유도 |
| ADS 줌 | 없음 | 힙파이어 전용 |

#### Tracking Rifle

| 파라미터 | 값 | 설명 |
|---------|---|------|
| 발사 모드 | 풀오토 | 지속 발사 |
| RPM | 660 | Phantom/R-301 기반 |
| 첫발 정확도 | 0.0° | |
| 스프레드 | 1.0° | 약간의 확산 |
| 반동 | 미미 수직 (발당 0.3° 상승) | 추적에 집중 가능한 수준 |
| 탄창 | 50발 | 장시간 추적 가능 |
| ADS 줌 | 1.5x | 선택적 정밀 조준 |

#### Spray AR

| 파라미터 | 값 | 설명 |
|---------|---|------|
| 발사 모드 | 풀오토 | |
| RPM | 600 | AK-47/Vandal 기반 |
| 첫발 정확도 | 0.0° | |
| 스프레드 | 0.3° | 타이트 |
| 반동 유형 | CS2 스타일 고정 패턴 | 학습 가능한 패턴 |
| 반동 강도 | 발당 3~5 유닛 수직 + 좌우 편향 | 무거운 반동 |
| 탄창 | 30발 | 표준 |
| ADS 줌 | 없음 | 힙파이어 패턴 연습 |

#### Burst AR

| 파라미터 | 값 | 설명 |
|---------|---|------|
| 발사 모드 | 3발 버스트 | |
| RPM | 450 (버스트 내 800) | FAMAS/Bulldog 기반 |
| 첫발 정확도 | 0.0° | |
| 스프레드 | 1.5° | 중간 |
| 반동 | 버스트당 중간 수직 (5°) | 버스트 간 리셋 |
| 탄창 | 24발 (8 버스트) | |
| ADS 줌 | 2x | 중거리 타겟 전환 |

#### Precision Sniper

| 파라미터 | 값 | 설명 |
|---------|---|------|
| 발사 모드 | 볼트액션 | |
| RPM | 40 | AWP/Operator 기반 |
| 첫발 정확도 | 0.0° (ADS), 3.0° (노스코프) | |
| 스프레드 | 0.0° (ADS) | ADS 필수 |
| 반동 | 높은 시각적 킥 (회복 느림) | |
| 탄창 | 5발 | |
| ADS 줌 | 4x | 장거리 정밀 플릭 |

#### Bloom SMG

| 파라미터 | 값 | 설명 |
|---------|---|------|
| 발사 모드 | 풀오토 | |
| RPM | 900 | R-99/Spectre 기반 |
| 첫발 정확도 | 0.5° | 약간의 초기 확산 |
| 블룸 증가 | 발당 2° | Apex 스타일 |
| 블룸 최대 | 30° | |
| 블룸 회복 | 초당 10° | |
| 탄창 | 35발 | |
| ADS 줌 | 1.25x | 미세 줌 |

### 6.2 커스텀 무기 파라미터 범위

유저가 조절 가능한 모든 파라미터와 그 범위이다.

| 파라미터 | 최소값 | 최대값 | 기본값 | 단위 |
|---------|-------|-------|-------|------|
| 발사 모드 | - | - | auto | enum: single/burst/auto/bolt |
| RPM | 30 | 1500 | 600 | 분당 발수 |
| 버스트 카운트 | 2 | 6 | 3 | 발 |
| 탄창 크기 | 1 | 200 | 30 | 발 |
| 리로드 시간 | 0.5 | 5.0 | 2.0 | 초 |
| 첫발 정확도 | 0.0 | 5.0 | 0.0 | 도 |
| 정지 스프레드 | 0.0 | 10.0 | 0.5 | 도 |
| 이동 스프레드 배율 | 1.0 | 5.0 | 2.0 | 배율 |
| 반동 유형 | - | - | fixed | enum: none/fixed/valorant/bloom |
| 수직 반동 강도 | 0 | 30 | 5 | 유닛/발 |
| 수평 반동 강도 | 0 | 15 | 2 | 유닛/발 |
| 반동 랜덤 편차 | 0 | 5.0 | 0.5 | σ |
| 블룸 증가율 | 0 | 10.0 | 2.0 | 도/발 |
| 블룸 최대 | 0 | 60 | 30 | 도 |
| 블룸 회복율 | 0 | 30 | 10 | 도/초 |
| 패턴 리셋 시간 | 0.1 | 3.0 | 0.5 | 초 |
| ADS 줌 배율 | 1.0 | 12.0 | 1.0 | 배율 |
| ADS 발사속도 배율 | 0.5 | 1.0 | 0.85 | 배율 |
| ADS 전환 시간 | 0.05 | 0.5 | 0.2 | 초 |
| ViewPunch 강도 | 0 | 1.0 | 0.3 | 배율 |
| AimPunch 강도 | 0 | 1.0 | 0 | 배율 (훈련 시 보통 비활성) |

### 6.3 무기 설정 데이터 구조

```typescript
interface WeaponConfig {
  // 기본 정보
  id: string;
  name: string;
  category: 'pistol' | 'smg' | 'rifle' | 'sniper' | 'shotgun' | 'custom';

  // 발사
  fireMode: 'single' | 'burst' | 'auto' | 'bolt';
  rpm: number;
  burstCount?: number;           // burst 모드 전용
  magazineSize: number;
  reloadTime: number;            // 초

  // 정확도
  firstShotAccuracy: number;     // 도
  baseSpread: number;            // 도
  movementSpreadMultiplier: number;

  // 반동
  recoilType: 'none' | 'fixed' | 'valorant' | 'bloom';
  recoilPattern?: { x: number; y: number }[];  // fixed/valorant용
  verticalRecoilStrength: number;
  horizontalRecoilStrength: number;
  recoilRandomDeviation: number; // σ

  // 블룸 (bloom 타입 전용)
  bloomPerShot?: number;
  bloomMax?: number;
  bloomRecoveryRate?: number;

  // 패턴 리셋
  patternResetTime: number;      // 초

  // ADS
  adsZoom: number;               // 1.0 = 줌 없음
  adsFireRateMultiplier: number;
  adsTransitionTime: number;     // 초
  adsSpreadReduction: number;    // 0~1

  // 시각적 피드백
  viewPunchStrength: number;     // 0~1
  aimPunchStrength: number;      // 0~1
  muzzleFlashScale: number;
  tracerEnabled: boolean;
  shellEjectionEnabled: boolean;
}
```

---

## 7. 4단계 구현 로드맵

### Phase 1: 핵심 사격 메커니즘 (2주)

**목표**: 기본적인 총기 발사 + 히트 판정 시스템

구현 항목:
- WeaponConfig 데이터 구조 및 JSON 스키마 정의
- 기본 발사 모드 구현 (싱글/풀오토)
- Raycaster 기반 히트 판정
- 발사 속도(RPM) 제어 — 타이머 기반 발사 간격
- 탄창 + 리로드 시스템
- 기본 크로스헤어 UI

기초 기술:
- `WeaponSystem` 클래스 (발사 상태 머신)
- `HitDetectionSystem` 클래스 (Raycaster + three-mesh-bvh)
- `WeaponConfigLoader` (JSON → WeaponConfig 변환)

검증 기준:
- 모든 발사 모드에서 정확한 RPM 유지 (±5% 오차 이내)
- 히트 판정 정확도 100% (정적 타겟 기준)

### Phase 2: 반동 시스템 + 기본 이펙트 (2주)

**목표**: 3가지 반동 유형 구현 + 시각적 피드백

구현 항목:
- CS2 스타일 고정 스프레이 패턴 시뮬레이터
- Valorant 스타일 하이브리드 반동 시뮬레이터
- Apex 스타일 블룸 시뮬레이터
- ViewPunch 시스템 (카메라 흔들림)
- 버스트/볼트액션 발사 모드 추가
- 기본 머즐 플래시 (Sprite 기반)
- 기본 트레이서 (Line 기반)
- FSA + 이동 정확도 패널티

검증 기준:
- 각 반동 유형이 실제 게임과 유사한 느낌 (플레이 테스트)
- 반동 보정 시 탄착군이 수렴하는지 확인

### Phase 3: 뷰모델 + 고급 이펙트 (3주)

**목표**: 1인칭 무기 모델 + 완전한 시각적 피드백

구현 항목:
- 프로시저럴 무기 모델 생성기 (5종: 권총/SMG/AR/스나이퍼/샷건)
- glTF 모델 임포트 지원
- View Bob + Weapon Sway
- 발사 킥백 애니메이션 (스프링 물리)
- 머즐 플래시 고도화 (PointLight + 랜덤)
- 탄피 배출 파티클 (오브젝트 풀링)
- 피격 이펙트 (스파크/더스트 + DecalGeometry 탄흔)
- 배럴 연기 파티클
- ADS 전환 애니메이션 (FOV + 위치 Lerp)
- 오디오 시스템 (Howler.js 기반 총성/장전/탄피)

검증 기준:
- 모든 이펙트 활성 상태에서 144FPS 유지 (프레임당 6.9ms 이하)
- 오브젝트 풀링으로 GC 스파이크 0 달성

### Phase 4: 훈련 시스템 + 커스터마이즈 (2주)

**목표**: 무기 프리셋 + 반동 보정 훈련 + 사용자 커스텀

구현 항목:
- 6종 무기 프리셋 (Flick Pistol, Tracking Rifle, Spray AR, Burst AR, Precision Sniper, Bloom SMG)
- 반동 보정 훈련 모드 (패턴 가이드 + 실시간 피드백)
- RecoilCompensationAnalyzer (정확도/일관성/등급 산출)
- 시각적 스프레이 분석 오버레이 (고스트 패턴 vs 실제 탄착)
- 커스텀 무기 에디터 UI (모든 파라미터 슬라이더)
- 커스텀 반동 패턴 에디터 (Aim Lab 스타일 시각적 편집)
- 무기 프리셋 저장/불러오기 (JSON export/import)
- AimPunch 시스템 (피격 시 에임 흔들림, 선택적 활성화)

검증 기준:
- 6종 프리셋 모두 훈련 목적에 부합하는 느낌 (사용자 피드백)
- 커스텀 무기 파라미터가 실시간 반영 (핫리로드)
- 반동 분석 점수가 실제 보정 능력과 상관관계 있음

---

## 부록: 가우시안 랜덤 유틸리티

```typescript
// Box-Muller 변환 기반 가우시안 난수 생성
function gaussianRandom(mean = 0, stdDev = 1): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stdDev + mean;
}
```

## 부록: 통합 무기 컨트롤러 아키텍처

```typescript
class WeaponController {
  private bob: WeaponBobController;
  private sway: WeaponSwayController;
  private kickback: FireKickbackController;
  private muzzleFlash: MuzzleFlashController;
  private casings: ShellCasingEjector;
  private ads: ADSController;
  private viewPunch: ViewPunchSystem;
  private aimPunch: AimPunchSystem;

  // 반동 시뮬레이터 (런타임 교체 가능)
  private recoilSim: CS2SpraySimulator | ValorantRecoilSimulator | ApexBloomSimulator;

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    weaponGroup: THREE.Group,
    config: WeaponConfig
  ) {
    this.bob = new WeaponBobController(weaponGroup);
    this.sway = new WeaponSwayController(weaponGroup);
    this.kickback = new FireKickbackController(weaponGroup);
    this.muzzleFlash = new MuzzleFlashController(weaponGroup, muzzleOffset);
    this.casings = new ShellCasingEjector(scene);
    this.ads = new ADSController(camera, weaponGroup);
    this.viewPunch = new ViewPunchSystem();
    this.aimPunch = new AimPunchSystem();

    this.setRecoilType(config);
  }

  fire(timestamp: number) {
    const recoilOffset = this.recoilSim.fire(timestamp);
    if (!recoilOffset) return; // 발사 간격 미충족

    this.kickback.fire();
    this.muzzleFlash.fire();
    this.casings.eject(this.muzzlePosition);
    this.viewPunch.applyRecoil(recoilOffset);
    // 히트 판정은 recoilOffset 적용 후 수행
  }

  update(dt: number, mouseMove: { x: number; y: number },
         isMoving: boolean, velocity: THREE.Vector3) {
    this.bob.update(dt, isMoving, velocity);
    this.sway.update(mouseMove.x, mouseMove.y);
    this.kickback.update(dt);
    this.casings.update(dt);
    this.ads.update();
    this.viewPunch.update();
    this.aimPunch.update(dt);
  }

  private setRecoilType(config: WeaponConfig) {
    switch (config.recoilType) {
      case 'fixed':
        this.recoilSim = new CS2SpraySimulator(/* ... */);
        break;
      case 'valorant':
        this.recoilSim = new ValorantRecoilSimulator(/* ... */);
        break;
      case 'bloom':
        this.recoilSim = new ApexBloomSimulator();
        break;
    }
  }
}
```

---

## 참고 자료

### 게임 메커니즘
- CS2 스프레이 패턴: tradeit.gg, dmarket.com, refrag.gg
- Valorant 무기 시스템: valorant.fandom.com, win.gg, bo3.gg
- Apex Legends 무기: apexlegends.fandom.com, liquipedia.net
- R6 Siege 반동: ubisoft.com (Weapon Recoil Overhaul 공식 문서)
- Overwatch 2 메커니즘: overwatch.fandom.com

### 에임 트레이너
- Aim Lab 커스텀 무기: steamcommunity.com/app/714010
- Kovaak's 무기 프로필: wiki.kovaaks.com

### Three.js 구현
- Three.js 공식 문서: threejs.org/docs
- 파티클 최적화: three.quarks (docs.quarks.art)
- 레이캐스팅 가속: three-mesh-bvh
- DecalGeometry: three.js examples
- 오브젝트 풀링: kingdavvid.hashnode.dev
- 인스턴스 렌더링: waelyasmina.net

### 오디오
- Howler.js: howlerjs.com
- Web Audio API: developer.mozilla.org
