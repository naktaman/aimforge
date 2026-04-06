# AimForge — "Cold Forge" UI 리디자인 기획서

> **버전**: 1.0
> **작성일**: 2026-04-05
> **컨셉**: Cold Forge — 담금질 완료된 정밀 금속, 브러시드 스틸, 크롬 하이라이트
> **현재 스택**: React 50+ 컴포넌트, Framer Motion, Three.js, Web Audio API, CSS 변수 기반 디자인 시스템

---

## 1. 컬러 시스템

### 1.1 Core Palette

| 역할 | 토큰명 | HEX | 사용처 |
|------|--------|-----|--------|
| **Background (Deep)** | `--bg-deep` | `#0A0E14` | 앱 최외곽 배경, 전체 캔버스 |
| **Background (Base)** | `--bg-base` | `#0F1318` | 주요 콘텐츠 영역 배경 |
| **Background (Elevated)** | `--bg-elevated` | `#161B22` | 카드, 패널, 모달 배경 |
| **Surface (Low)** | `--surface-low` | `#1C2128` | 비활성 탭, 접힌 섹션 |
| **Surface (Mid)** | `--surface-mid` | `#242A33` | 활성 패널, 호버 상태 배경 |
| **Surface (High)** | `--surface-high` | `#2D3540` | 강조 카드, 선택된 항목 배경 |
| **Border (Subtle)** | `--border-subtle` | `#2A3140` | 카드 테두리, 구분선 |
| **Border (Default)** | `--border-default` | `#3B4455` | 입력 필드 테두리, 패널 경계 |
| **Border (Strong)** | `--border-strong` | `#4E5A6E` | 포커스 링, 강조 테두리 |

### 1.2 Metal & Chrome Palette

| 역할 | 토큰명 | HEX | 사용처 |
|------|--------|-----|--------|
| **Steel Dark** | `--metal-steel-dark` | `#3A4556` | 금속 패널 어두운 면 |
| **Steel Mid** | `--metal-steel-mid` | `#5A6A7E` | 브러시드 스틸 기본 톤 |
| **Steel Light** | `--metal-steel-light` | `#7E8FA3` | 금속 하이라이트, 테두리 상단 |
| **Chrome** | `--metal-chrome` | `#A8B8CC` | 크롬 반사광, 아이콘 하이라이트 |
| **Chrome Bright** | `--metal-chrome-bright` | `#C8D5E6` | 강한 금속 반사, 엣지 하이라이트 |
| **Silver White** | `--metal-silver-white` | `#E2E8F0` | 최고 밝기 반사광 포인트 |

### 1.3 Accent Colors

| 역할 | 토큰명 | HEX | 사용처 |
|------|--------|-----|--------|
| **Primary (Frost Blue)** | `--accent-primary` | `#4A9EDE` | 주요 CTA 버튼, 활성 탭, 진행률 바 |
| **Primary Hover** | `--accent-primary-hover` | `#5BB0F0` | Primary 호버 상태 |
| **Primary Muted** | `--accent-primary-muted` | `#4A9EDE26` | Primary 배경 틴트 (15% opacity) |
| **Secondary (Steel Blue)** | `--accent-secondary` | `#6B8DB5` | 보조 버튼, 링크, 보조 정보 |
| **Cyan Glow** | `--accent-cyan` | `#00D4FF` | 네온 강조, 크로스헤어, 실시간 데이터 하이라이트 |
| **Cyan Glow Muted** | `--accent-cyan-muted` | `#00D4FF1A` | 시안 글로우 배경 (10% opacity) |
| **Ice White** | `--accent-ice` | `#B8E6FF` | 선택 포인트, 작은 강조 요소 |

### 1.4 Semantic Colors

| 역할 | 토큰명 | HEX | 사용처 |
|------|--------|-----|--------|
| **Success** | `--semantic-success` | `#34D399` | 개선 수치, 완료 상태, 정확도 향상 |
| **Success BG** | `--semantic-success-bg` | `#34D39915` | Success 배경 틴트 |
| **Warning** | `--semantic-warning` | `#FBBF24` | 주의 필요, 중간 성과 |
| **Warning BG** | `--semantic-warning-bg` | `#FBBF2415` | Warning 배경 틴트 |
| **Error** | `--semantic-error` | `#F87171` | 실패, 성과 하락, 삭제 |
| **Error BG** | `--semantic-error-bg` | `#F8717115` | Error 배경 틴트 |
| **Info** | `--semantic-info` | `#60A5FA` | 안내, 팁, 정보성 메시지 |
| **Info BG** | `--semantic-info-bg` | `#60A5FA15` | Info 배경 틴트 |

### 1.5 Text Colors

| 역할 | 토큰명 | HEX | 사용처 |
|------|--------|-----|--------|
| **Text Primary** | `--text-primary` | `#E2E8F0` | 본문, 주요 레이블 |
| **Text Secondary** | `--text-secondary` | `#94A3B8` | 보조 텍스트, 설명 |
| **Text Tertiary** | `--text-tertiary` | `#64748B` | 비활성 텍스트, 플레이스홀더 |
| **Text Accent** | `--text-accent` | `#4A9EDE` | 링크, 강조 수치 |
| **Text On Accent** | `--text-on-accent` | `#FFFFFF` | 액센트 배경 위 텍스트 |

### 1.6 Gradient Definitions

```css
/* 금속 패널 그라디언트 — 위에서 아래로 빛 받는 금속판 */
--gradient-metal-panel: linear-gradient(
  180deg,
  #242A33 0%,
  #1C2128 40%,
  #161B22 100%
);

/* 크롬 엣지 하이라이트 — 패널 상단 테두리 */
--gradient-chrome-edge: linear-gradient(
  90deg,
  transparent 0%,
  #7E8FA350 30%,
  #A8B8CC80 50%,
  #7E8FA350 70%,
  transparent 100%
);

/* 시안 글로우 — 활성 요소 하단 */
--gradient-cyan-glow: linear-gradient(
  180deg,
  #00D4FF40 0%,
  #00D4FF00 100%
);

/* 금속 버튼 — 눌리지 않은 상태 */
--gradient-metal-button: linear-gradient(
  180deg,
  #2D3540 0%,
  #242A33 50%,
  #1C2128 100%
);

/* 금속 버튼 — 눌린 상태 (역전) */
--gradient-metal-button-pressed: linear-gradient(
  180deg,
  #1C2128 0%,
  #242A33 50%,
  #2D3540 100%
);
```

---

## 2. 마이크로인터랙션 전체 설계

### 2.1 메뉴 호버 — "Chrome Sweep"

**컨셉**: 브러시드 스틸 표면 위로 빛 줄기가 스치듯 지나감

```
상태: idle → hover
Duration: 400ms
Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94)

[구현]
- 메뉴 아이템 배경에 pseudo-element(::before) 사용
- 45도 기울어진 linear-gradient (transparent → #A8B8CC15 → transparent)
- hover 시 translateX(-100%) → translateX(100%) 애니메이션
- 동시에 border-left: 2px solid가 transparent → --accent-cyan 전환 (200ms)
- 텍스트 color: --text-secondary → --text-primary 전환 (150ms)
```

```css
.menu-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(168, 184, 204, 0.08) 50%,
    transparent 60%
  );
  transform: translateX(-100%);
  transition: transform 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.menu-item:hover::before {
  transform: translateX(100%);
}

.menu-item {
  border-left: 2px solid transparent;
  transition: border-color 200ms ease, color 150ms ease;
}

.menu-item:hover {
  border-left-color: var(--accent-cyan);
  color: var(--text-primary);
  background: var(--surface-mid);
}
```

### 2.2 메뉴 클릭/선택 — "Press Stamp"

**컨셉**: 금속 프레스가 쾅 찍히는 임팩트. 살짝 눌리며 시안 글로우가 확산

```
상태: hover → active → selected

[active] Duration: 80ms
Easing: cubic-bezier(0.32, 0, 0.67, 0)
- scale(0.98) + translateY(1px) — 살짝 눌림
- border-left: 2px solid → 3px solid --accent-cyan
- box-shadow: inset 0 0 0 1px var(--accent-cyan-muted)
- 배경 flash: --surface-high → --accent-cyan-muted → --surface-high (80ms)

[selected] Duration: 200ms
Easing: cubic-bezier(0.33, 1, 0.68, 1)
- scale(1) 복귀
- border-left: 3px solid --accent-primary 유지
- background: --surface-mid
- 좌측에 시안 글로우 fade (box-shadow: -8px 0 16px -8px var(--accent-cyan-muted))
```

### 2.3 버튼 인터랙션 — Variant별

#### Primary Button ("Forged Action")

```
[idle]
background: --gradient-metal-button
border: 1px solid --accent-primary
color: --text-on-accent
box-shadow: 0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(168,184,204,0.1)

[hover] Duration: 200ms, ease-out
background: --accent-primary
border-color: --accent-primary-hover
box-shadow: 0 0 20px rgba(74,158,222,0.3), 0 4px 8px rgba(0,0,0,0.3)
transform: translateY(-1px)

[active] Duration: 60ms, ease-in
background: --accent-primary-hover
transform: translateY(0) scale(0.98)
box-shadow: 0 0 8px rgba(74,158,222,0.2), inset 0 2px 4px rgba(0,0,0,0.2)

[disabled]
background: --surface-low
border-color: --border-subtle
color: --text-tertiary
opacity: 0.6
```

#### Secondary Button ("Steel Press")

```
[idle]
background: transparent
border: 1px solid --border-default
color: --text-secondary

[hover] Duration: 200ms, ease-out
border-color: --metal-steel-light
color: --text-primary
background: --surface-mid
box-shadow: 0 0 12px rgba(126,143,163,0.1)

[active] Duration: 60ms
background: --surface-low
transform: scale(0.98)
box-shadow: inset 0 1px 3px rgba(0,0,0,0.2)
```

#### Ghost Button ("Etched")

```
[idle]
background: transparent
border: 1px solid transparent
color: --text-tertiary

[hover] Duration: 150ms, ease-out
color: --text-primary
border-color: --border-subtle
background: rgba(255,255,255,0.03)

[active] Duration: 60ms
background: rgba(255,255,255,0.06)
```

#### Icon Button ("Rivet")

```
[idle]
background: --surface-low
border-radius: 6px
border: 1px solid --border-subtle
color: --text-secondary

[hover] Duration: 150ms
background: --surface-mid
border-color: --border-default
color: --accent-cyan
transform: scale(1.05)

[active] Duration: 50ms
transform: scale(0.95)
background: --surface-low
```

### 2.4 화면 전환 — "Plate Slide"

**컨셉**: 금속판이 정밀하게 슬라이드되며 전환. 기계적 정확함

```
[Page Exit]
Duration: 200ms
Easing: cubic-bezier(0.4, 0, 1, 1)
- opacity: 1 → 0
- transform: translateX(0) → translateX(-20px)
- filter: brightness(1) → brightness(0.8)

[Page Enter]
Duration: 300ms (exit 완료 후)
Easing: cubic-bezier(0, 0, 0.2, 1)
- opacity: 0 → 1
- transform: translateX(20px) → translateX(0)
- 상단에서 1px 크롬 라인이 좌→우로 sweep (gradient-chrome-edge, 400ms)

[전환 중 오버레이]
- 20ms간 전체 화면에 #00D4FF05 flash
- 금속 '찰칵' 사운드 트리거 포인트
```

**Framer Motion 구현 가이드**:

```tsx
const pageTransition = {
  initial: { opacity: 0, x: 20 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0, 0, 0.2, 1] }
  },
  exit: {
    opacity: 0,
    x: -20,
    transition: { duration: 0.2, ease: [0.4, 0, 1, 1] }
  }
};
```

### 2.5 로딩 — "Quenching Process"

**컨셉**: 금속 담금질 과정. 뜨거운 선이 식으며 형태를 잡아감

```
[구현: 2단계 로딩 애니메이션]

Phase 1 — "Heat Line" (0~60%)
- 수평 라인이 --accent-cyan에서 시작
- 좌→우 진행하며 뒤에 --metal-steel-mid 색 트레일 남김
- 라인 끝에 미세한 글로우(box-shadow: 0 0 8px --accent-cyan)
- Duration per cycle: 1200ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1)

Phase 2 — "Cool Down" (60~100%)
- 진행률 바가 --accent-cyan → --accent-primary로 서서히 전환
- 글로우 intensity 감소 (box-shadow blur: 8px → 3px)
- 완료 시 전체 바가 한번 pulse (scale 1 → 1.02 → 1, 200ms)

[풀스크린 로딩]
- 중앙에 AimForge 로고 (금속 텍스처)
- 로고 아래 담금질 프로그레스 바
- 배경에 미세한 금속 파티클이 서서히 가라앉는 애니메이션
```

### 2.6 토스트/알림 — "Steel Frame Notification"

**컨셉**: 금속 프레임 안에 메시지. 리벳 느낌의 모서리

```
[진입] Duration: 300ms
Easing: cubic-bezier(0.34, 1.56, 0.64, 1) — slight overshoot
- 우상단에서 slideIn: translateX(120%) → translateX(0)
- 동시에 opacity: 0 → 1
- 진입 완료 시 상단 border에 chrome sweep 한번

[스타일]
background: var(--bg-elevated)
border: 1px solid var(--border-default)
border-top: 2px solid [시맨틱 컬러] — success/warning/error에 따라
border-radius: 4px
box-shadow:
  0 4px 12px rgba(0,0,0,0.4),
  inset 0 1px 0 rgba(168,184,204,0.05)
backdrop-filter: blur(8px)

[퇴장] Duration: 200ms, ease-in
- translateX(0) → translateX(120%)
- opacity: 1 → 0

[자동 dismiss]
- 하단에 1px 높이 progress bar (--accent-primary → transparent, 5000ms linear)
```

### 2.7 스크롤 — "Precision Gear"

**컨셉**: 정밀 기어처럼 정확한 스크롤. 스크롤바가 기계 부품 느낌

```
[커스텀 스크롤바]
width: 6px
track: var(--bg-base)
thumb: var(--metal-steel-dark)
thumb:hover: var(--metal-steel-mid)
thumb:active: var(--metal-steel-light)
border-radius: 3px
border: 1px solid var(--border-subtle)

[스크롤 인디케이터]
- 스크롤 가능 영역 상/하단에 fade gradient (8px)
- 상단: linear-gradient(var(--bg-elevated), transparent)
- 하단: linear-gradient(transparent, var(--bg-elevated))

[Momentum]
- scroll-behavior: smooth (CSS)
- 별도 custom scroll library 불필요 — 네이티브 활용
```

### 2.8 입력 필드 포커스 — "Edge Ignition"

**컨셉**: 금속 테두리가 차갑게 발광. 포커스 시 테두리에 시안 글로우

```
[idle]
background: var(--bg-base)
border: 1px solid var(--border-default)
border-radius: 4px
color: var(--text-primary)

[hover] Duration: 150ms
border-color: var(--border-strong)

[focus] Duration: 200ms, ease-out
border-color: var(--accent-primary)
box-shadow:
  0 0 0 3px var(--accent-primary-muted),
  0 0 12px rgba(74,158,222,0.1)
outline: none

[error]
border-color: var(--semantic-error)
box-shadow: 0 0 0 3px var(--semantic-error-bg)

[포커스 애니메이션 — 보더 드로잉]
- 포커스 진입 시 border가 좌상단부터 시계방향으로 그려지는 효과
- border를 4개 pseudo-element로 분리하여 각각 scaleX/scaleY 애니메이션
- 순서: top(0ms) → right(50ms) → bottom(100ms) → left(150ms)
- 각 segment duration: 150ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1)
```

### 2.9 드롭다운/셀렉트 — "Hatch Open"

```
[열기] Duration: 200ms
Easing: cubic-bezier(0, 0, 0.2, 1)
- origin: top center
- scaleY(0.95) + opacity(0) → scaleY(1) + opacity(1)
- 1px 상단 크롬 라인이 동시에 좌→우 sweep

[닫기] Duration: 150ms, ease-in
- scaleY(1) → scaleY(0.95), opacity → 0

[옵션 호버]
- Chrome Sweep과 동일 패턴 (단 200ms로 단축)
```

### 2.10 토글/스위치 — "Relay Switch"

```
[OFF]
track: var(--surface-low), border: 1px solid var(--border-default)
thumb: var(--metal-steel-mid)

[OFF→ON 전환] Duration: 250ms
Easing: cubic-bezier(0.34, 1.56, 0.64, 1)
- thumb translateX with overshoot
- track: --surface-low → --accent-primary-muted
- thumb: --metal-steel-mid → --accent-primary
- thumb에 글로우: box-shadow 0 0 8px var(--accent-primary-muted)
- 전환 중 thumb이 살짝 넓어짐 (scaleX 1 → 1.1 → 1)

[ON]
track: var(--accent-primary-muted), border: var(--accent-primary)
thumb: var(--accent-primary), 글로우 유지
```

### 2.11 탭 전환 — "Rail Slide"

```
[탭 인디케이터]
- 활성 탭 하단에 2px 높이 바
- 탭 전환 시 바가 이전 탭에서 새 탭으로 슬라이드
- Duration: 250ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1)
- 이동 중 바 너비가 살짝 늘어남 (중간 지점에서 +20%)

[탭 텍스트]
- 비활성: --text-tertiary
- 호버: --text-secondary (150ms)
- 활성: --text-primary + font-weight: 600
```

---

## 3. 타이포그래피

### 3.1 폰트 추천

| 용도 | 1순위 | 2순위 | 비고 |
|------|-------|-------|------|
| **UI (본문/레이블)** | **Inter** | Geist | 가독성 최우선. 금속 느낌은 컬러/질감으로 |
| **헤딩/타이틀** | **Chakra Petch** | Rajdhani | 기하학적 + 기계적, 태국 출신 산스세리프. 게이밍 무드 |
| **숫자/데이터** | **JetBrains Mono** | IBM Plex Mono | 고정폭. 수치가 정렬되며 기계적 정밀함 |
| **로고/히어로** | **Orbitron** | Michroma | 기하학적 디스플레이. 로고와 대형 타이틀에만 제한적 사용 |

### 3.2 Type Scale

```css
--font-ui: 'Inter', 'Geist', -apple-system, sans-serif;
--font-heading: 'Chakra Petch', 'Rajdhani', sans-serif;
--font-mono: 'JetBrains Mono', 'IBM Plex Mono', monospace;
--font-display: 'Orbitron', 'Michroma', sans-serif;

/* Scale — Major Third (1.25) */
--text-xs:    11px;  /* 메타 정보, 캡션 */
--text-sm:    12px;  /* 보조 텍스트, 레이블 */
--text-base:  14px;  /* 본문 기본 */
--text-md:    16px;  /* 중요 본문, 서브헤딩 */
--text-lg:    20px;  /* 섹션 제목 */
--text-xl:    24px;  /* 페이지 제목 */
--text-2xl:   32px;  /* 히어로 수치 */
--text-3xl:   40px;  /* 대시보드 핵심 수치 */
--text-4xl:   56px;  /* 히어로 타이틀 */

/* Line Height */
--leading-tight:  1.2;  /* 헤딩 */
--leading-normal: 1.5;  /* 본문 */
--leading-mono:   1.6;  /* 코드/데이터 */

/* Font Weight */
--weight-normal:  400;
--weight-medium:  500;
--weight-semi:    600;
--weight-bold:    700;

/* Letter Spacing */
--tracking-tight:   -0.01em;  /* 대형 텍스트 */
--tracking-normal:   0;
--tracking-wide:     0.02em;  /* 소형 레이블 */
--tracking-wider:    0.05em;  /* 올캡스 레이블 */
--tracking-widest:   0.1em;   /* 로고/디스플레이 */
```

### 3.3 특수 타이포 스타일

**데이터 수치 (대시보드)**:
- Font: JetBrains Mono, `--text-2xl` ~ `--text-3xl`
- Color: `--accent-cyan` (실시간) / `--text-primary` (정적)
- Tabular nums: `font-variant-numeric: tabular-nums`
- 변화 시 색상 flash: 증가 `--semantic-success` / 감소 `--semantic-error`, 600ms fade

**메뉴/네비게이션 레이블**:
- Font: Chakra Petch, `--text-sm`, `--weight-medium`
- Letter-spacing: `--tracking-wide`
- text-transform: uppercase
- Color: `--text-secondary` (idle) / `--text-primary` (active)

**카드 타이틀**:
- Font: Chakra Petch, `--text-md`, `--weight-semi`
- Color: `--text-primary`

---

## 4. 레이아웃/구조 — 고밀도 정보 원칙

### 4.1 핵심 원칙: "No Wasted Space"

> AimForge는 데이터 집약적 게이밍 앱이다. 모든 픽셀은 유용한 정보를 전달해야 한다.
> EVE Online, Star Citizen의 정보 밀도를 벤치마크로 삼는다.

**밀도 규칙**:

1. **최소 여백 원칙**: 섹션 간 간격은 최대 12px. 카드 간 간격은 8px. 기존 24px+ 여백은 모두 축소
2. **카드 내부 패딩**: 최대 12px (기존 16~24px에서 축소). 데이터 카드는 8px까지 허용
3. **빈 상태(Empty State) 최소화**: 데이터 없을 때도 가이드/팁/추천 콘텐츠로 채움
4. **사이드바 활용**: 좌측 사이드바를 접힌 아이콘 모드(48px)와 확장 모드(200px)로 이원화
5. **대시보드는 "Control Room"**: 모든 핵심 수치가 한 화면에 보여야 함. 스크롤 최소화

### 4.2 Grid System

```css
/* 메인 레이아웃 */
--sidebar-collapsed: 48px;
--sidebar-expanded: 200px;
--header-height: 44px;    /* 기존 56px → 44px 축소 */
--content-padding: 12px;  /* 기존 24px → 12px 축소 */

/* 대시보드 그리드 */
display: grid;
grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
gap: 8px;

/* 카드 내부 — Compact Mode */
.card-compact {
  padding: 8px;
}
.card-compact .card-title {
  font-size: var(--text-sm);
  margin-bottom: 4px;
}
.card-compact .card-value {
  font-size: var(--text-2xl);
  line-height: 1;
}
```

### 4.3 대시보드 레이아웃 — "Control Room"

```
┌─────────────────────────────────────────────────────────┐
│ [48px 사이드바]  │  [헤더: 44px — 모드선택 탭 + 빠른 액션]  │
│ ┌─────┐         ├─────────────────────────────────────────│
│ │ 아  │         │ ┌──────┬──────┬──────┬──────────────┐  │
│ │ 이  │         │ │ Acc  │ TTK  │ Score│  세션 그래프   │  │
│ │ 콘  │         │ │ 72.4%│ 0.84s│ 2,847│  (스파크라인) │  │
│ │     │         │ ├──────┴──────┴──────┤              │  │
│ │ 메  │         │ │  Hits/Misses 차트  │              │  │
│ │ 뉴  │         │ │  (실시간 막대)      ├──────────────┤  │
│ │     │         │ ├──────────────┬─────┤ 최근 세션    │  │
│ │     │         │ │ 히트맵/히트존│ 무기│ 히스토리     │  │
│ │     │         │ │              │ 통계│ (컴팩트 리스트)│  │
│ │     │         │ ├──────────────┴─────┴──────────────┤  │
│ │     │         │ │  하단: 빠른 시작 / 추천 시나리오    │  │
│ └─────┘         │ └──────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### 4.4 밀도 비교 (Before → After)

| 요소 | Before | After |
|------|--------|-------|
| 헤더 높이 | 56px | 44px |
| 카드 간격 | 16~24px | 8px |
| 카드 패딩 | 16~24px | 8~12px |
| 사이드바 | 항상 펼침 240px | 접힘 48px / 펼침 200px |
| 대시보드 빈 공간 | ~40% | 목표 <10% |
| 메인 콘텐츠 패딩 | 24px | 12px |
| 한 화면 표시 정보량 | ~6 메트릭 | 12+ 메트릭 |

### 4.5 반응형 밀도 조절

```css
/* 1920px+ — Ultra Dense */
@media (min-width: 1920px) {
  --content-padding: 16px;
  --card-gap: 8px;
  /* 4열 이상 그리드 */
  grid-template-columns: repeat(4, 1fr);
}

/* 1440px — Standard Dense */
@media (min-width: 1440px) and (max-width: 1919px) {
  --content-padding: 12px;
  --card-gap: 8px;
  grid-template-columns: repeat(3, 1fr);
}

/* 1024px — Compact */
@media (max-width: 1439px) {
  --content-padding: 8px;
  --card-gap: 6px;
  grid-template-columns: repeat(2, 1fr);
  /* 사이드바 항상 접힘 */
}
```

---

## 5. Three.js / 배경 비주얼

### 5.1 배경 파티클 시스템 — "Metal Dust"

**컨셉**: 담금질 후 공기 중에 떠다니는 미세한 금속 분진. 느리게 부유하며 빛을 반사

```
[파라미터]
- 파티클 수: 800~1200
- 크기: 0.5px ~ 2px (랜덤)
- 색상: --metal-chrome (80%), --accent-cyan (15%), --metal-silver-white (5%)
- 이동 속도: 0.01 ~ 0.05 units/frame
- 이동 패턴: Perlin noise 기반 부드러운 부유
- Opacity: 0.1 ~ 0.4
- 카메라 마우스 반응: 미세한 시차(parallax), 감도 0.02
- Z-depth: -20 ~ -5 (배경에 머물도록)

[성능 최적화]
- THREE.Points + BufferGeometry 사용 (개별 Mesh 아님)
- 화면 밖 파티클은 반대편에서 재생성
- requestAnimationFrame 내에서 position attribute만 업데이트
- GPU 인스턴싱으로 드로콜 1회
- 대시보드/훈련 모드에서 파티클 수 50% 감소 (성능)
```

### 5.2 앰비언트 라이팅 — "Forge Ambience"

```
[조명 설정]
- Ambient Light: #1a2030, intensity 0.3
- Directional Light (메인): #B8E6FF, intensity 0.6, position (5, 8, 5)
  → 차가운 상방 조명, 금속에 블루 틴트
- Point Light (강조): #00D4FF, intensity 0.2, position 마우스 추적
  → 마우스 근처 미세한 시안 글로우
- Hemisphere Light: sky #1C2128 / ground #0A0E14, intensity 0.4
```

### 5.3 크로스헤어/스코프 UI

```
[기본 크로스헤어 스타일링]
- 색상: --accent-cyan (#00D4FF)
- 외곽선: 1px --bg-deep (가시성 확보)
- 두께: 1.5px
- 갭(중앙 빈 공간): 4px (조절 가능)
- 길이: 8px (조절 가능)
- 센터 도트: 2px 원, --accent-ice

[히트 피드백]
- Hit: 크로스헤어가 100ms간 --semantic-success로 flash + 살짝 축소(scale 0.9 → 1)
- Kill: 크로스헤어 X자로 300ms 전환 + --semantic-success
- Miss: 변화 없음 (주의 분산 방지)

[스코프 오버레이]
- 원형 비네트 — 중앙 투명, 외곽 #0A0E14
- 스코프 테두리: --metal-steel-dark, 2px, 미세한 크롬 하이라이트
- 배율 표시: JetBrains Mono, --text-xs, 우하단
```

### 5.4 메인 메뉴 3D 배경

```
[장면 구성]
- 중앙에 추상적 금속 구조물 (낮은 폴리곤 앤빌 또는 기하학적 금속 블록)
- MeshStandardMaterial: metalness 0.9, roughness 0.3, color #5A6A7E
- 느리게 회전: rotationY += 0.001/frame
- 환경맵: HDRI 또는 cube map — 어두운 산업 환경
- 후처리: Bloom (threshold 0.8, intensity 0.3), Vignette
```

---

## 6. 사운드 디자인

### 6.1 사운드 컨셉

> 모든 사운드는 **금속성**이되 절제된 톤. 과도한 사운드 이펙트는 훈련 집중도를 해침.
> 볼륨은 작게, 피드백은 정확하게.

### 6.2 Web Audio API 구현 방향

#### 호버 사운드 — "Brush"

```javascript
// 브러시드 메탈 위를 손끝이 스치는 느낌
function createHoverSound(audioCtx) {
  const duration = 0.06;
  const noise = createFilteredNoise(audioCtx, {
    type: 'bandpass',
    frequency: 3500,
    Q: 2.0,
    duration: duration
  });
  // Envelope: 즉시 시작 → 빠른 감쇠
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  return { noise, gain };
}
```

#### 클릭 사운드 — "Tap"

```javascript
// 금속판을 가볍게 두드리는 느낌
function createClickSound(audioCtx) {
  // 1. 임팩트: 짧은 사인파 burst
  const osc = audioCtx.createOscillator();
  osc.frequency.setValueAtTime(800, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.05);

  // 2. 금속 잔향: 필터된 노이즈
  const noise = createFilteredNoise(audioCtx, {
    type: 'highpass',
    frequency: 2000,
    Q: 1.0,
    duration: 0.08
  });

  // 3. 합산, 볼륨 0.05
  const masterGain = audioCtx.createGain();
  masterGain.gain.setValueAtTime(0.05, audioCtx.currentTime);
  masterGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
  return { osc, noise, masterGain };
}
```

#### 화면 전환 사운드 — "Slide Lock"

```javascript
// 금속 부품이 '찰칵' 맞물리는 느낌
function createTransitionSound(audioCtx) {
  const t = audioCtx.currentTime;

  // 1. 슬라이드: filtered noise sweep (100ms)
  const slideNoise = createFilteredNoise(audioCtx, {
    type: 'bandpass',
    frequency: 1500, // 시작 → sweep up to 4000
    Q: 3.0,
    duration: 0.1
  });

  // 2. 락 임팩트: 짧은 클릭 (슬라이드 끝에)
  const lockOsc = audioCtx.createOscillator();
  lockOsc.frequency.setValueAtTime(1200, t + 0.08);
  lockOsc.frequency.exponentialRampToValueAtTime(400, t + 0.12);

  // 3. 잔향: 짧은 reverb tail (convolver 또는 delay)
  const delay = audioCtx.createDelay();
  delay.delayTime.setValueAtTime(0.02, t);

  // Master: 0.04
  return { slideNoise, lockOsc, delay };
}
```

#### 성공/완료 사운드 — "Forge Complete"

```javascript
// 담금질 완료 — 맑은 금속음 2음
function createSuccessSound(audioCtx) {
  const t = audioCtx.currentTime;

  // 음 1: E5 (659Hz)
  const osc1 = audioCtx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.value = 659;

  // 음 2: B5 (988Hz), 80ms 후
  const osc2 = audioCtx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.value = 988;

  // Metallic shimmer 추가
  const highShimmer = createFilteredNoise(audioCtx, {
    type: 'bandpass',
    frequency: 6000,
    Q: 8.0,
    duration: 0.3
  });

  // 볼륨: 0.04
}
```

### 6.3 사운드 볼륨 가이드

| 이벤트 | Gain | Duration | 비고 |
|--------|------|----------|------|
| 호버 | 0.03 | 60ms | 반복 호버 시 100ms 쿨다운 |
| 클릭 | 0.05 | 100ms | |
| 화면전환 | 0.04 | 150ms | |
| 성공 | 0.04 | 300ms | |
| 에러 | 0.05 | 200ms | 낮은 톤(200Hz) 금속음 |
| 토스트 | 0.03 | 80ms | |
| 사격/히트 | 별도 설정 | 별도 설정 | 게임플레이 사운드는 별도 시스템 |

### 6.4 사운드 설정 UI

- 마스터 볼륨 슬라이더
- UI 사운드 ON/OFF 토글
- 카테고리별 볼륨 (UI / 게임플레이 / 앰비언트) — 별도 슬라이더

---

## 7. 구현 우선순위

### Phase 1: Foundation — CSS 변수 + 컬러 (1~2주)

**목표**: 가장 빠르게 시각적 변화를 체감. 기존 오렌지 → 쿨톤 전환

| 작업 | 상세 | 예상 시간 |
|------|------|----------|
| CSS 변수 교체 | `src/styles.css`의 모든 CSS 변수를 새 컬러로 교체 | 4h |
| 그라디언트 정의 추가 | gradient 변수 추가 | 2h |
| 폰트 적용 | Google Fonts import + font-family 변수 교체 | 2h |
| 기본 Surface 스타일 | 카드, 패널, 모달의 background/border 일괄 업데이트 | 4h |
| 시맨틱 컬러 교체 | success/warning/error 색상 교체 | 2h |
| 텍스트 컬러 교체 | 전체 텍스트 컬러 교체 | 2h |
| **QA & 검증** | 50+ 컴포넌트 전수 확인, 컬러 대비 접근성 검증 | 4h |

**Phase 1 완료 체크**: WCAG AA 대비율 충족 (텍스트 4.5:1 이상), 전체 화면 스크린샷 비교

### Phase 2: Interactions — 마이크로인터랙션 + 전환 (2~3주)

| 작업 | 상세 | 예상 시간 |
|------|------|----------|
| Chrome Sweep 메뉴 호버 | pseudo-element 애니메이션 구현 | 6h |
| Press Stamp 클릭 | active/selected 상태 인터랙션 | 4h |
| 버튼 Variant 스타일링 | Primary/Secondary/Ghost/Icon 4종 | 8h |
| Edge Ignition 입력 필드 | 포커스 애니메이션 구현 | 4h |
| Plate Slide 페이지 전환 | Framer Motion AnimatePresence 업데이트 | 6h |
| 토스트 재설계 | Steel Frame 토스트 구현 | 4h |
| 기타 컴포넌트 | 드롭다운, 토글, 탭, 스크롤바 | 8h |
| 레이아웃 밀도 리팩터 | 여백 축소, 그리드 재구성, 대시보드 "Control Room" | 12h |
| **QA & 튜닝** | 애니메이션 성능 프로파일링, 60fps 보장, 밀도 검증 | 6h |

### Phase 3: Immersion — 3D 배경 + 사운드 (2~3주)

| 작업 | 상세 | 예상 시간 |
|------|------|----------|
| Metal Dust 파티클 | Three.js Points 시스템 구현 | 8h |
| 앰비언트 라이팅 | 조명 세팅 + 환경맵 | 4h |
| 크로스헤어 리스킨 | 시안/크롬 스타일링 | 4h |
| 메인 메뉴 3D 장면 | 금속 구조물 + 후처리 | 8h |
| 사운드 엔진 | Web Audio API 사운드 생성 시스템 | 8h |
| 사운드 통합 | 이벤트별 사운드 바인딩 | 6h |
| 성능 최적화 | GPU 프로파일링, 파티클 LOD | 6h |
| **QA** | 전체 통합 테스트, 사운드 밸런스 | 4h |

### Phase 4: Polish — 디테일 (1~2주)

| 작업 | 상세 | 예상 시간 |
|------|------|----------|
| 금속 텍스처 | CSS에 미세 노이즈 텍스처 오버레이 | 4h |
| 엣지 하이라이트 | 카드/패널 상단 크롬 라인 일괄 적용 | 4h |
| 데이터 수치 애니메이션 | 숫자 변화 시 카운트업 + 컬러 flash | 4h |
| 로딩 스크린 | Quenching Process 풀스크린 로딩 | 6h |
| Empty State 디자인 | 빈 화면에 가이드/팁 콘텐츠 | 4h |
| 다크/라이트 지원 검토 | 라이트 모드가 필요한지 결정, 필요 시 라이트 팔레트 | 4h |
| 접근성 최종 검증 | 키보드 네비게이션, 스크린 리더, 대비율 | 4h |
| **최종 QA** | 전체 플로우 워크스루 | 4h |

---

## 8. 레퍼런스

### 8.1 게임 UI 레퍼런스

| 게임 | 참고 포인트 | 핵심 요소 |
|------|-----------|----------|
| **Armored Core VI: Fires of Rubicon** | 기계적 정밀함, HUD 레이아웃, 금속 프레임 | 정보 밀도, 메카닉 UI, 금속 텍스처 |
| **Star Citizen** | 홀로그래픽 + 금속 UI, mobiGlas 인터페이스 | 고밀도 정보 표시, 블루 계열 색조, 3D UI |
| **EVE Online** | 극한의 정보 밀도, 다중 패널 레이아웃 | 빈 공간 없는 데이터 대시보드, 스페이스 블루 |
| **Escape from Tarkov** | 밀리터리/산업 미학, 인벤토리 시스템 | 금속 텍스처, 그리드 기반 레이아웃, 다크 톤 |
| **Warframe** | 모던 SF UI, 메뉴 전환 | 슬릭한 전환 애니메이션, 시안 액센트, 깔끔한 패널 |
| **Destiny 2** | Director/Orbit UI | 우주적 스케일 + 정밀한 정보 표시 |
| **Elite Dangerous** | 콕핏 HUD, 홀로그래픽 패널 | 오렌지→블루 전환 사례 (커스텀 HUD 컬러), 금속 프레임 |

### 8.2 웹/앱 레퍼런스

| 이름 | 참고 포인트 |
|------|-----------|
| **Linear** | 다크 UI, 미니멀한 인터랙션, 정보 밀도 |
| **Vercel Dashboard** | 다크 모드 + 깔끔한 데이터 표현 |
| **Figma** | 다크 테마 패널 레이아웃, 밀도 높은 UI |
| **Bloomberg Terminal** | 극한의 정보 밀도 (벤치마크) |

### 8.3 디자인 리소스

| 리소스 | URL | 용도 |
|--------|-----|------|
| Game UI Database | https://www.gameuidatabase.com | 게임 UI 스크린샷 55,000+ |
| HUDS+GUIS | https://www.hudsandguis.com | SF/게임 HUD 디자인 분석 |
| Dribbble (Metal UI) | https://dribbble.com/tags/brushed%20metal | 메탈 UI 디자인 레퍼런스 |
| GraphicRiver (Metal UI) | https://graphicriver.net/metal+ui-in-graphics | 메탈 UI 에셋 |

---

## 9. Variant.ai 프롬프트 — Cold Forge UI 생성용

> Variant.ai에서 직접 입력하여 "Cold Forge" 컨셉의 FPS aim trainer UI 레퍼런스 이미지를 생성하는 프롬프트.
> 각 프롬프트는 서로 다른 화면/요소에 초점을 맞춤.

### 9.1 대시보드 / 메인 화면

**Prompt 1 — 전체 대시보드**
```
Dark metallic FPS aim training desktop app dashboard, brushed steel panel surfaces, chrome edge highlights, cool blue-silver color palette with cyan accent data points, dense information layout with no wasted space, multiple stat cards showing accuracy percentage and reaction time metrics, real-time line charts and bar graphs filling every available space, compact sidebar with metal icons, steel blue glow on active elements, industrial precision aesthetic, 1920x1080 UI screenshot, dark background #0A0E14, professional gaming software
```

**Prompt 2 — 데이터 집약 대시보드**
```
Information-rich gaming analytics dashboard UI, cold forged metal aesthetic, brushed aluminum card backgrounds with chrome borders, dense grid layout with 12+ metric tiles, sparkline charts in every card, no empty space, EVE Online level information density, steel blue and cyan color scheme on near-black background, monospace numbers in cool white, metallic gradient headers, performance stats for aim training app, desktop application screenshot
```

**Prompt 3 — 다크 미니멀 메탈**
```
Minimalist dark steel desktop application UI for FPS aim trainer, gun-metal grey surfaces with subtle brushed texture, single cyan accent color #00D4FF for highlights, extremely dense data layout, compact navigation rail on left, main content area packed with charts graphs and numeric displays, cold industrial lighting effect, chrome-like border highlights on top of each card, no decorative elements only functional UI, screenshot 1920x1080
```

### 9.2 설정 / 메뉴 화면

**Prompt 4 — 설정 패널**
```
Settings panel UI for dark metallic gaming application, brushed steel background with chrome dividers, dense form layout with toggle switches sliders and dropdowns packed tightly, cold blue-silver accent on active controls, metal frame around each settings group, no wasted space between form elements, compact typography, industrial machine control panel aesthetic, sidebar navigation with metal icons, dark theme UI design screenshot
```

**Prompt 5 — 사이드 네비게이션**
```
Dark gaming app sidebar navigation expanded view, cold forged steel aesthetic, brushed metal menu items with chrome highlight on hover, cyan glow indicator on active item, compact icon-and-label layout, dense submenu structure, metallic gradient background, information-rich status indicators next to each menu item, industrial precision design, cool blue-silver palette, desktop application UI screenshot
```

### 9.3 훈련 모드 / 게임플레이 UI

**Prompt 6 — 훈련 화면 HUD**
```
FPS aim trainer in-game HUD overlay, cold metal frame crosshair in cyan, dark steel information panels at edges of screen showing real-time stats, brushed metal mini-map frame, compact score and accuracy display in top-right with chrome border, dense stat readout at bottom, metallic timer display, cool blue-silver color scheme, targets visible in 3D training arena, professional esports training software aesthetic
```

**Prompt 7 — 훈련 결과 화면**
```
Post-training results screen for FPS aim trainer, dark metallic UI with brushed steel card panels, dense data visualization with accuracy heatmap hit distribution chart reaction time histogram and score breakdown all visible simultaneously, chrome edge highlights, cool blue and cyan data visualizations on dark #0F1318 background, no empty space every pixel shows useful data, compact performance summary cards, industrial precision design
```

### 9.4 컴포넌트 디테일

**Prompt 8 — 버튼/카드 컴포넌트**
```
UI component sheet for dark metallic gaming app, collection of buttons cards toggles and input fields, brushed steel surface texture on all elements, chrome highlight on top edge of each card, cool blue primary button with metal sheen, ghost button with steel border, compact card designs with minimal padding, cyan glow on focused input fields, metal toggle switches, dark background, component library reference sheet, dense layout
```

**Prompt 9 — 데이터 시각화**
```
Data visualization components for dark metallic gaming dashboard, line charts bar charts radar charts and sparklines in cool blue cyan and steel grey on near-black background, brushed metal chart container frames with chrome borders, dense legend compact axis labels, metallic gradient fills on chart areas, real-time data feel with glowing data points, gaming performance metrics theme, no wasted space, professional dark UI
```

### 9.5 전체 앱 느낌

**Prompt 10 — 풀 앱 목업**
```
Complete desktop application screenshot of FPS aim training software, cold forge industrial design language, entire UI built from dark brushed steel panels with chrome accents, collapsed sidebar rail on left with metallic icons, dense header bar with mode tabs, main content showing training scenario selection grid packed with thumbnail cards, every card showing difficulty rating and stats, cyan highlights on hover states, information-dense layout inspired by Star Citizen and EVE Online UI, cool blue-silver palette, 1920x1080
```

**Prompt 11 — 로딩/스플래시**
```
Loading screen for dark metallic FPS aim trainer app, centered logo in chrome and steel blue on near-black background, subtle brushed metal texture, quenching-style progress bar with cool cyan glow transitioning to steel blue, floating metallic dust particles in background, cold forge industrial branding, minimal but impactful, professional gaming software splash screen
```

**Prompt 12 — 리더보드/랭킹**
```
Leaderboard ranking screen for competitive FPS aim trainer, dark brushed steel table rows with chrome separator lines, dense ranking list showing rank avatar name score accuracy and badges in compact columns, cyan highlight on user's own row, steel blue header with metallic gradient, no empty space in table cells, compact row height, cold industrial aesthetic, information-rich competitive gaming UI, dark background
```

**Prompt 13 — 모바일/컴팩트 뷰**
```
Compact tablet view of FPS aim training dashboard, cold forged metal UI adapted for smaller screen, ultra-dense card grid with 6+ metric tiles visible, brushed steel surface textures, chrome accents, collapsed navigation, compact charts and micro-visualizations, cyan data highlights, every pixel utilized for information display, professional dark gaming UI, 1024x768
```

### 9.6 Variant.ai 추천 태그/키워드

프롬프트에 조합해서 사용할 수 있는 추가 키워드:

- **소재**: `brushed steel`, `chrome`, `gun-metal`, `titanium`, `anodized aluminum`, `cold-rolled steel`
- **질감**: `brushed texture`, `fine metal grain`, `machined surface`, `knurled grip`
- **조명**: `cold rim light`, `chrome reflection`, `edge highlight`, `ambient occlusion`, `cool blue backlight`
- **밀도**: `dense layout`, `information-rich`, `no wasted space`, `compact grid`, `data-packed`, `Bloomberg-style density`
- **분위기**: `industrial precision`, `cold forge`, `quenched metal`, `machine shop`, `CNC precision`
- **게이밍**: `esports UI`, `competitive gaming`, `FPS training`, `aim trainer`, `pro gaming software`
- **컬러**: `steel blue`, `cool silver`, `cyan accent`, `frost blue`, `ice white on dark`
- **기술적**: `desktop application`, `1920x1080 screenshot`, `UI design`, `dark theme`, `flat design with depth`

---

## 10. Variant 기반 디자인 워크플로우

### 10.1 왜 Variant 기반인가

직접 디자인을 처음부터 만드는 대신, AI 이미지 생성 도구(Variant.ai 등)로 레퍼런스를 먼저 뽑고 그것을 기반으로 구현하는 워크플로우를 권장한다.

**장점**:
- 컨셉 탐색이 압도적으로 빠름 (프롬프트 하나당 수초)
- 팀원 간 시각적 합의를 이미지로 도출 가능
- "이 느낌이야!" 하는 순간을 빨리 찾을 수 있음
- 구현 전에 여러 방향을 시각적으로 비교 검토 가능
- 개발자가 픽셀 단위 레퍼런스를 보면서 구현하면 완성도 상승

### 10.2 권장 워크플로우

```
Step 1: Prompt Exploration (1~2시간)
├── 섹션 9의 프롬프트 13종을 Variant에 입력
├── 각 프롬프트당 4~8장 생성
├── 마음에 드는 방향 3~5장 선별
└── 팀/본인이 "이거다" 싶은 이미지 확정

Step 2: Prompt Refinement (30분~1시간)
├── 선별된 이미지 기반으로 프롬프트 수정
├── 더 구체적 요소 추가/제거
├── 특정 화면별로 세분화된 프롬프트 작성
└── 최종 레퍼런스 이미지 세트 확정 (화면당 1~2장)

Step 3: Design Token Extraction (1시간)
├── 레퍼런스 이미지에서 컬러 스포이드로 추출
├── 본 기획서의 컬러 팔레트와 비교/조정
├── 간격, 비율, 레이아웃 비율 측정
└── 수정된 디자인 토큰 확정

Step 4: Component Implementation (Phase 1~4)
├── 레퍼런스 이미지를 모니터 한쪽에 띄워놓고 구현
├── 컴포넌트 단위로 레퍼런스 대비 검증
├── 차이점 발견 시 레퍼런스 또는 구현 조정
└── 화면 단위 스크린샷 비교

Step 5: Iteration
├── 구현 결과물 스크린샷 → Variant에 img2img로 개선안 탐색
├── 디테일 수정 반복
└── 최종 폴리시
```

### 10.3 Variant 외 대안 도구

| 도구 | 장점 | 사용 시점 |
|------|------|----------|
| **Variant.ai** | UI 특화, 일관된 스타일 유지 | 메인 워크플로우 |
| **Midjourney** | 높은 비주얼 퀄리티, 분위기 탐색 | 초기 무드보드, 3D 배경 컨셉 |
| **DALL-E 3** | 텍스트 렌더링, 빠른 프로토타이핑 | 아이콘, 로고 컨셉 |
| **Figma + AI 플러그인** | 실제 벡터 UI 생성 | 프롬프트 → 구현 중간 단계 |
| **Screenshot.rocks** | 목업 프레임 | 레퍼런스 프레젠테이션용 |

### 10.4 팁

- Variant 프롬프트에 `UI screenshot`, `desktop application`, `1920x1080`을 항상 포함하면 실제 앱처럼 나옴
- `no text`, `no watermark` 추가하면 깔끔한 결과
- 특정 영역만 필요하면 `close-up of sidebar navigation` 같이 크롭 지시
- 색상을 정확히 원하면 HEX 값을 프롬프트에 포함 (예: `primary color #00D4FF`)
- `in the style of [게임 이름]`을 추가하면 특정 게임 UI 느낌 유도 가능

---

## 부록 A: CSS 변수 마이그레이션 맵

기존 `src/styles.css` 오렌지 기반 변수에서 Cold Forge 변수로의 1:1 매핑:

```css
/* === BEFORE → AFTER === */

/* Primary Accent */
--color-primary: #f0913a       → --accent-primary: #4A9EDE
--color-primary-hover: #f5a55a → --accent-primary-hover: #5BB0F0

/* Backgrounds */
--color-bg-dark: [기존값]      → --bg-deep: #0A0E14
--color-bg-main: [기존값]      → --bg-base: #0F1318
--color-bg-card: [기존값]      → --bg-elevated: #161B22

/* Borders */
--color-border: [기존값]       → --border-default: #3B4455

/* Text */
--color-text-primary: [기존값] → --text-primary: #E2E8F0
--color-text-secondary: [기존값] → --text-secondary: #94A3B8

/* Semantic */
--color-success: [기존값]      → --semantic-success: #34D399
--color-warning: [기존값]      → --semantic-warning: #FBBF24
--color-error: [기존값]        → --semantic-error: #F87171
```

## 부록 B: 금속 노이즈 텍스처 CSS

```css
/* 미세한 금속 노이즈 — SVG filter 기반 (이미지 불필요) */
.metal-texture::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.03;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-repeat: repeat;
  background-size: 256px 256px;
  mix-blend-mode: overlay;
}

/* 브러시드 스틸 방향성 텍스처 */
.brushed-steel::after {
  content: '';
  position: absolute;
  inset: 0;
  opacity: 0.02;
  pointer-events: none;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    rgba(168, 184, 204, 0.03) 1px,
    transparent 2px
  );
}
```

## 부록 C: 접근성 대비율 검증

| 조합 | 전경 | 배경 | 대비율 | WCAG AA |
|------|------|------|--------|---------|
| 본문 텍스트 | #E2E8F0 | #0F1318 | 14.2:1 | Pass |
| 보조 텍스트 | #94A3B8 | #0F1318 | 7.1:1 | Pass |
| 비활성 텍스트 | #64748B | #0F1318 | 4.5:1 | Pass (경계) |
| 액센트 on 카드 | #4A9EDE | #161B22 | 5.8:1 | Pass |
| 시안 on 카드 | #00D4FF | #161B22 | 8.9:1 | Pass |
| Success | #34D399 | #0F1318 | 9.4:1 | Pass |
| Warning | #FBBF24 | #0F1318 | 10.8:1 | Pass |
| Error | #F87171 | #0F1318 | 6.2:1 | Pass |

---

*끝. 이 기획서를 기반으로 Phase 1부터 순차적으로 구현을 시작하세요.*
*Variant.ai로 레퍼런스를 먼저 뽑고, 이미지를 보면서 구현하면 완성도가 크게 올라갑니다.*
