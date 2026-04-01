# AimForge

> FPS 에임 교정/훈련 데스크탑 앱 — Tauri 2 (Rust + React + Three.js)

Gaussian Process 기반 감도 최적화, 23피처 Aim DNA 분석, 크로스게임 감도 변환을 제공하는 올인원 에임 트레이너입니다.

---

## 주요 기능

### 감도 최적화
- **GP Bayesian Optimization** (Matérn 5/2 커널) 기반 최적 감도 탐색
- 2-stage 캘리브레이션 (탐색 → 수렴), 3가지 모드 (speed/balanced/precision)
- 피로/워밍업 자동 감지, Click timing 보정
- Go/No-Go 5회 반복 재현성 검증

### Aim DNA 분석
- **23피처 프로파일링** — Fitts' Law, motor 분석, direction bias, 운동체계 분류
- 시계열 변화 감지 (`analyze_dna_trend`)
- 데이터 충분성 검증 (피처별 최소 threshold)
- 레이더 차트 + 상세표 시각화

### 10종 시나리오
- **Flick**: Static, Micro, Medium, Macro, Multi-Flick
- **Tracking**: Linear, Circular, Stochastic
- **Switching**: Close, Wide
- **Zoom**: 3-Phase (zoom-in → hold → zoom-out)
- **Counter-Strafe Flick**, 배터리 시스템 (4개 프리셋)

### 크로스게임 감도 변환
- **10개 게임** 프리셋 (Valorant, CS2, Overwatch 2, Apex, Fortnite 등)
- **6가지 변환 방식** (MDM 0/56.25/75/100%, Viewspeed H/V)
- k-parameter 피팅, sens_step 스냅
- DNA 기반 게임 간 갭 원인 분석 + 개선 플랜

### 훈련 시스템
- DNA 기반 자동 훈련 처방 (갭 원인 → 시나리오 매핑)
- Game Readiness Score (컨디션 기반 4단계 어드바이스)
- Style Transition 4단계 (initial → adaptation → consolidation → mastery)
- Progress Dashboard (일별 통계, 스킬 진행, DNA 시계열)

### 프로파일링
- **FOV**: 시야각별 peripheral/center 분리 비교 + 추천
- **Hardware**: DNA 23피처 델타 비교, cm/360 이동 분석
- **Movement**: 10개 게임 이동 프리셋, 가중 추천, 실측 캘리브레이션
- **Zoom**: Dual-phase GP + k 피팅, Comparator (방식별 비교)

### UX
- Simple/Advanced 모드 전환
- 다크/라이트 테마
- 한국어/영어 i18n
- 5단계 온보딩 위자드
- Routine Builder (커스텀 훈련 루틴)
- Recoil Editor (SVG 패턴 편집, 스프레이 미리보기)

---

## 기술 스택

| 레이어 | 기술 | 역할 |
|--------|------|------|
| Runtime | Tauri 2 (Rust) | 네이티브 래퍼, IPC, 파일 시스템 |
| Backend | Rust | GP 엔진, DNA 분석, 캘리브레이션, DB |
| Frontend | React 19 + TypeScript | UI 컴포넌트, 상태 관리 |
| 3D 엔진 | Three.js | 시나리오 렌더링 |
| 시각화 | D3.js | 레이더 차트, Landscape, 게이지 |
| 상태 관리 | Zustand | 전역 상태 (18개 스토어) |
| DB | SQLite (rusqlite) | 26개 테이블, 로컬 데이터 영구 저장 |
| Input | WinAPI raw input | sub-μs 마우스 캡처 |

---

## 설치

### Windows (10/11 64-bit)

[Releases](https://github.com/naktaman/aimforge/releases) 페이지에서 최신 버전을 다운로드하세요:

- **AimForge_x.x.x_x64_en-US.msi** — MSI 인스톨러
- **AimForge_x.x.x_x64-setup.exe** — NSIS 인스톨러

> **참고**: 코드 서명이 없어 Windows SmartScreen 경고가 표시될 수 있습니다. "추가 정보" → "실행"을 클릭하세요.

---

## 개발 환경 설정

### 필수 요구사항
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.77+
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 빌드 명령어

```bash
# 개발 서버
npx tauri dev

# 프로덕션 빌드
npx tauri build

# Rust 테스트
cd src-tauri && cargo test

# 프론트엔드 빌드만
npm run build
```

---

## 프로젝트 구조

```
src-tauri/src/
├── aim_dna/          # Aim DNA 23피처 추출 + 추세 분석
├── calibration/      # GP Bayesian 캘리브레이션
├── crossgame/        # 크로스게임 DNA 비교 + 개선 플랜
├── db/               # SQLite 스키마 + CRUD (26개 테이블)
├── fov_profile/      # FOV 프로파일 비교
├── game_db/          # 10개 게임 프리셋 + 감도 변환
├── gp/               # Gaussian Process (Matérn 5/2)
├── hardware/         # 하드웨어 비교
├── input/            # WinAPI raw mouse capture
├── movement/         # 이동 프로파일
├── training/         # 훈련 처방 + 스테이지 시스템
├── trajectory/       # 궤적 분석 (GMM + 감도 진단)
├── zoom_calibration/ # 줌 캘리브레이션 + Comparator
└── lib.rs            # Tauri setup + IPC 등록

src/
├── components/       # React 컴포넌트 (44개)
├── stores/           # Zustand 스토어 (18개)
├── engine/           # Three.js 시나리오 엔진
│   ├── scenarios/    # 10종 시나리오 + 21 스테이지
│   └── metrics/      # 메트릭 수집 + 점수 계산
├── utils/            # 타입 정의, 물리 변환, IPC 래퍼
└── i18n/             # 한국어/영어 번역
```

---

## 라이선스

[MIT](LICENSE)
