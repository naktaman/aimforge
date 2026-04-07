# AimForge v0.3 — 마스터 로드맵

> **작성일**: 2026-04-07
> **원칙**: "감도를 깎으러 온 사람이 프로 수준의 게임 경험을 느끼게 한다"
> **기준**: 모든 요소를 프로젝트급으로 — 딥리서치 → 기획서 → 구현 → 검증

---

## 현재 상태 (2026-04-07)

**완료된 것:**
- v0.2.0 릴리즈 (코드품질, 보안, i18n, CI)
- Phase 1 게임 프로필 시스템 (gameDatabase 59개 게임 연동, 온보딩 자동생성, 활성 프로필 동기화)
- Cold Forge 디자인 시스템 1차 적용 (:root 변수 전면 교체, 타이포 4종 폰트, 전역 스타일)
- UX-1 설정 하드웨어/감도 섹션 추가
- **Block A-2**: 컴포넌트별 Cold Forge 마이크로인터랙션 CSS 적용
- **Block A-3**: 대시보드 레이아웃 개편 (상태 CTA 히어로, 도구 카드 그리드, 프리셋 우선)
- **Block A-4**: Actionable Empty State 전면 적용
- **Block A-5**: 메뉴/네비게이션 정리 (탭명 변경)
- **Block B-1**: 사운드 엔진 Phase 1 MVP (SpatialAudio 공간음향, SoundRecipes 3레이어 히트, 총기음 개선)
- **Block B-2 Phase 1**: 총기 시스템 (발사 모드 4종, 프리셋 6종, 블룸 반동, 탄창/재장전)
- **Block C-1**: 캘리브레이션 E2E (감도 적용 연결, GP 관측점 DB 저장, game_category 동적화)
- **Block C-2**: Aim DNA 배터리 E2E (IPC 케이싱 불일치 4건 수정)
- **Block C-3**: 시나리오 시스템 E2E (zoom_composite 명시적 case 추가)
- **Block C-4**: 트레이닝 E2E (StageResult 케이싱 수정)
- **Block D**: 데이터 시각화 애니메이션 전면 적용 (useChartAnimation 훅, 9개 컴포넌트 D3 동적 모션)

**있지만 미완성 / 검증 안 된 것:**
- 엔진: GameEngine, SoundEngine(372줄, Phase 1 공간음향 완료), WeaponViewModel(418줄, 반동 애니메이션 있음), Environment(89줄, 기본 그리드+벽)
- 시나리오 20종 E2E 배선 검증됨 — 밸런싱/플레이테스트 미완
- zoom_composite: ZoomCompositeRunner 존재하나 Scenario 인터페이스 미구현, 배터리에서 더미 점수 기록
- 50+ UI 컴포넌트 존재 (대부분 Actionable Empty State 적용됨)

---

## 로드맵 구조

각 블록은 독립적으로 완성 가능한 단위. 블록 내부는 세분화된 태스크로 나뉜다.
**모든 블록은**: 딥리서치(필요시) → 기획서 → 코드 세션(세분화) → 검증

---

## Block A: UI/UX 비주얼 완성

### A-1: 설정 화면 완성 ✅ 부분 완료
- [x] Cold Forge :root 변수 전면 교체
- [x] 하드웨어 섹션
- [x] 감도 & 프로필 섹션
- [ ] 디스플레이 섹션 강화 (안티앨리어싱, 렌더품질 추가)
- [ ] 크로스헤어 섹션 (CrosshairSettings 연결)
- [ ] 사운드 섹션 강화 (마스터/효과음/히트 볼륨 슬라이더, 히트사운드 종류)
- [ ] HUD & 피드백 섹션
- [ ] 데이터 관리 강화 (가져오기, 초기화, 자동백업)
- [ ] 단축키 섹션

### A-2: 컴포넌트별 Cold Forge 스타일 적용 ✅ 완료
- [x] 버튼 인터랙션 (§2.3 Forged Action, Steel Press, Ghost, Rivet)
- [x] 입력 필드 포커스 애니메이션 (§2.8 Edge Ignition)
- [x] 드롭다운 애니메이션 (§2.9 Hatch Open)
- [x] 토글 스위치 (§2.10 Relay Switch)
- [x] 탭 전환 인디케이터 (§2.11 Rail Slide)
- [x] 메뉴 호버 (§2.1 Chrome Sweep)
- [x] 화면 전환 (§2.4 Plate Slide — Framer Motion)
- [x] 로딩 애니메이션 (§2.5 Quenching Process)
- [x] 토스트 알림 (§2.6 Steel Frame)
- [x] 커스텀 스크롤바 (§2.7 Precision Gear)

### A-3: 대시보드 레이아웃 개편 ✅ 완료
- [x] 상태 기반 CTA 히어로 영역 (프로필 없음/캘리브레이션 안함/완료 등)
- [x] 감도 탭: 도구 카드 그리드 2열 레이아웃
- [x] 훈련 탭: 프리셋 우선, 커스텀 접힌 상태
- [x] 분석 탭: Actionable Empty State

### A-4: Actionable Empty State 전면 적용 ✅ 완료
- [x] 모든 빈 화면에 "다음 할 일" 안내 + 실행 버튼
- [x] 세션 히스토리, 프로그레스 대시보드, DNA 결과, 처방, 감도 대시보드 등

### A-5: 메뉴/네비게이션 정리 ✅ 완료
- [x] 탭명 변경 (감도 프로파일 → 감도 최적화)
- [ ] 크로스헤어 설정으로 이동
- [x] 도구 기능 맥락 노출 방식 개선 (카드 그리드)

---

## Block B: 인게임 경험 (딥리서치 필요)

> 유저가 실제 "플레이"할 때 느끼는 모든 것. 가장 체감이 큰 블록.

### B-1: 사운드 엔진 Phase 1 MVP ✅ 완료
**구현 완료:**
- [x] PannerNode 기반 3D 공간 음향 (SpatialAudio.ts — equalpower, inverseDistance)
- [x] 거리 감쇠 모델 (inverseDistance + air absorption 고역 롤오프)
- [x] 총기 발사음 3레이어 합성 (SoundRecipes.ts — 저역 펀치 + 고역 크랙 + 잔향)
- [x] 3레이어 히트 사운드 (body/headshot/kill 차등 합성)
- [x] SoundEngine 리팩터 (420→372줄, SoundRecipes 분리 266줄)

**Phase 2 미완 (딥리서치 필요):**
- [ ] 환경 리버브 (ConvolverNode, 시나리오별)
- [ ] 타겟 스폰 사운드 (방향 힌트)
- [ ] 앰비언트 루프 (시나리오별)
- [ ] 볼륨 밸런스 + 장시간 피로도 검증

### B-2: 총기 시스템 고도화 — Phase 1 ✅ 완료 / Phase 2 [딥리서치 필요]
**Phase 1 완료:**
- [x] 발사 모드 4종 (single/burst/auto/bolt) + 시나리오 프리셋 6종
- [x] 탄창/재장전 상태머신 (MagazineState)
- [x] 블룸 반동 시스템 (Apex-style, 시간 기반 회복)
- [x] 가우시안 스프레드 (Box-Muller 변환)
- [x] WeaponPresets.ts 분리 (500줄 규칙)

**Phase 2 미완 (딥리서치 필요):**
- [ ] 머즐 플래시 이펙트 (PointLight + 파티클, 프레임 단위 수명)
- [ ] 탄피 이젝션 물리 (간단한 파티클)
- [ ] 반동 비주얼 개선 (스프레이 패턴 기반 크로스헤어 확산)
- [ ] 무기 스웨이/밥 (이동 시 미세한 흔들림)
- [ ] ADS(조준경) 전환 애니메이션

### B-3: 타겟 시스템 고도화 [딥리서치 필요]
**현재**: Target 177줄 (구체), HumanoidTarget 207줄 (인체형)
**목표**: 다양하고 시각적으로 명확한 타겟

리서치 항목:
- 에임 트레이너(Aim Lab, Kovaak's)의 타겟 디자인 패턴
- 히트박스 시각화 기법
- 타겟 파괴 이펙트 레퍼런스

구현 항목:
- [ ] 타겟 히트 이펙트 (파티클 burst + 스케일 변화)
- [ ] 타겟 파괴 애니메이션 (조각나기/페이드/폭발)
- [ ] 히트 마커 오버레이 (방향 + 강도)
- [ ] 타겟 스폰 애니메이션 (페이드인/스케일업)
- [ ] 타겟 종류별 시각 구분 (색상/형태)

### B-4: 환경/맵 디자인 [딥리서치 필요]
**현재**: Environment 89줄 (그리드 + 벽 5개)
**목표**: 몰입감 있는 훈련 환경

구현 항목:
- [ ] 시나리오별 환경 테마 (실내/야외/아레나)
- [ ] 조명 시스템 (Cold Forge §5.3 기반)
- [ ] Metal Dust 파티클 배경 (Cold Forge §5.1)
- [ ] 바닥 텍스처/마테리얼 개선
- [ ] 후처리 이펙트 (Bloom, Vignette)

---

## Block C: 핵심 기능 end-to-end

### C-1: GP 캘리브레이션 E2E ✅ 완료
- [x] 감도 적용 연결 (settingsStore + GameProfile DB 동시 업데이트)
- [x] GP 관측점 DB 저장 동작 확인
- [x] game_category 동적화 (하드코딩 → 활성 프로필 기반)
- [ ] GP 곡선 + 관측점 실시간 표시 (애니메이션: 점이 찍히며 곡선 피팅)
- [ ] 수렴 감지 → finalize → 결과 화면 (바 올라가며 숫자 카운트업)

### C-2: Aim DNA 배터리 E2E ✅ 완료
- [x] IPC 케이싱 불일치 4건 수정 (aimDnaStore, progressStore, ProfileWizard, BatteryResult)
- [x] 6개 시나리오 순차 실행 → 점수 기록 배선 검증
- [ ] DNA 레이더 차트 (축 하나씩 펼쳐지는 애니메이션)
- [ ] DNA 결과 상세 분석 (강점/약점 시각화)
- [ ] DNA 히스토리 타임라인 (데이터 포인트 순차 등장)
- [ ] 기어/감도 변경 전후 비교

### C-3: 시나리오 시스템 E2E ✅ 완료
- [x] zoom_composite: 배터리/시나리오 핸들러에 명시적 case 추가 (silent fallthrough 제거)
- [ ] 타겟 스폰 간격/패턴 파라미터 검증 (딥리서치 필요)
- [ ] 랜덤 패턴 알고리즘 품질 확인
- [ ] 난이도 곡선 밸런싱
- [ ] 크기/거리/속도 밸런싱
- [ ] 실제 플레이 테스트

### C-4: 트레이닝 시스템 E2E ✅ 완료
- [x] StageResult IPC 케이싱 수정 (snake_case → camelCase)
- [ ] DNA 기반 약점 훈련 프리셋 자동 생성
- [ ] "시작" 버튼까지 최소 클릭
- [ ] 고급 커스텀은 접힌 상태

---

## Block D: 데이터 시각화 애니메이션 ✅ 완료

> 모든 차트/그래프/수치에 동적 모션 적용

**신규 인프라:** `src/hooks/useChartAnimation.ts` — 7개 재사용 훅/헬퍼 (useAnimatedValue, useCountUp, useStaggeredReveal, useDrawProgress, applyD3LineAnimation, applyD3PointAnimation, applyD3AreaFadeIn). 모든 훅 useReducedMotion() 접근성 대응.

- [x] 바 차트: 0→목표값 상승 + 숫자 카운트업 (ProgressDashboard 스킬바, TrajectoryAnalysis 히스토그램)
- [x] 레이더 차트: 원점→목표 폴리곤 펼침 (AimDnaHistory 비교 레이더, CrossGameComparison 듀얼 레이더)
- [x] 라인 차트: 점 순차 등장 + 선 그리기 (ProgressDashboard DNA차트, AimDnaHistory 5축 타임라인)
- [x] GP 곡선: 신뢰대역 페이드인 + 평균 곡선 드로우 + 관측점 순차 + 피크 스케일업 (PerformanceLandscape)
- [x] 배율 곡선: 피팅 곡선 드로우 + 측정/보간점 순차 등장 (MultiplierCurve)
- [x] 게이지: arc tween + 점수 카운트업 (ReadinessWidget)
- [x] 프로그레스 바: 부드러운 상승 애니메이션 (BatteryProgress, CalibrationProgress)

---

## Block E: 인사이트 + 유틸리티

### E-1: 인사이트
- [ ] DNA 기반 그립/자세/패드 추천
- [ ] 정체기 감지 + 새 방향 제안

### E-2: 크로스게임
- [ ] 게임간 감도/FOV 정확 변환
- [ ] 세션 히스토리

---

## 실행 순서 (업데이트: 2026-04-07)

**완료:**
1. ~~A-1 설정 기본 섹션~~ ✅
2. ~~A-2 컴포넌트 Cold Forge 스타일~~ ✅
3. ~~A-3 대시보드 레이아웃 개편~~ ✅
4. ~~A-4 Actionable Empty State~~ ✅
5. ~~A-5 메뉴/네비게이션 정리~~ ✅
6. ~~B-1 사운드 엔진 Phase 1~~ ✅
7. ~~D 데이터 시각화 애니메이션~~ ✅
8. ~~B-2 총기 시스템 Phase 1~~ ✅ (발사 모드 4종, 프리셋 6종, 블룸 반동)
9. ~~C-1 캘리브레이션 E2E~~ ✅ (감도 적용 연결, GP 관측점 DB 저장, game_category 동적화)
10. ~~C-2 Aim DNA 배터리 E2E~~ ✅ (케이싱 불일치 4건 수정)
11. ~~C-3 시나리오 시스템 E2E~~ ✅ (zoom_composite 명시적 case 추가)
12. ~~C-4 트레이닝 E2E~~ ✅ (StageResult 케이싱 수정)

**다음:**
1. **B-2 Phase 2 + B-3~B-4 인게임 비주얼** (딥리서치 → 구현)
2. **A-1 설정 나머지 섹션** (디스플레이, 크로스헤어, 사운드, HUD, 데이터, 단축키)
3. **B-1 사운드 Phase 2** (리버브, 앰비언트, 스폰 사운드)
4. **E-1/E-2 인사이트 + 크로스게임**

> 각 단계에서 딥리서치가 필요하면 선행. 기획서 없이 코드 세션 돌리지 않는다.
> 모든 구현은 세분화된 태스크 단위로 — 한 세션에 통째로 던지지 않는다.
