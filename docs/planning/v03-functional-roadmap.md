# AimForge v0.3 — 기능 완성 로드맵

> **목표**: 코드가 아닌 "유저가 실제 쓸 수 있는 앱"을 만든다.
> **원칙**: 감도를 깎으러 온 사람. 메인 플로우가 끊김 없이 돌아야 한다.
> **작성일**: 2026-04-07

---

## 메인 플로우 (이것이 앱의 존재 이유)

```
앱 시작 → 온보딩(게임 선택+감도 입력)
       → 메인 대시보드(게임 프로필 기반)
       → GP 캘리브레이션(최적 감도 탐색)
       → 결과 적용
       → Aim DNA 배터리(6축 능력 측정)
       → 인사이트(개선 방향 추천)
       → 트레이닝(약점 기반 훈련)
       → 반복 측정(성장 추적)
```

---

## Phase 1: 게임 프로필 시스템 (메인 플로우의 기반)

### 1-1. 게임 프로필 관리 재설계
**현재**: 텍스트 입력으로 게임명 수동 타이핑. gameDatabase 59개 게임 미연동.
**목표**: 게임 선택하면 yaw/FOV/감도범위 자동 입력. 게임별 고유 감도 필드 지원.

- [ ] GameProfileManager에 gameDatabase 드롭다운/자동완성 연동
- [ ] 게임 선택 시 기본 FOV, yaw, 감도 범위, 감도 필드(PUBG면 10개+) 자동 세팅
- [ ] 게임별 sensFields 동적 폼 렌더링 (gameDatabase의 sensFields 활용)
- [ ] 게임 아이콘/이니셜 아바타 표시

### 1-2. 온보딩 → 프로필 자동 생성
**현재**: 온보딩에서 게임 선택 + 감도 입력하지만, GameProfile DB에 저장 안 됨. settingsStore만 업데이트.
**목표**: 온보딩 완료 시 자동으로 GameProfile 생성 + 활성화.

- [ ] 온보딩 완료 시 createProfile IPC 호출
- [ ] 생성된 프로필을 active로 설정
- [ ] 메인 화면 진입 시 active 프로필 기준으로 모든 설정 동기화

### 1-3. profile_id 하드코딩 제거
**현재**: 캘리브레이션, 세션 시작 등에서 `profile_id: 1` 하드코딩.
**목표**: 현재 활성 프로필의 ID를 동적으로 사용.

- [ ] gameProfileStore에 activeProfileId getter 추가
- [ ] 모든 invoke에서 profile_id: 1 → activeProfileId 교체
- [ ] 프로필 없으면 프로필 생성 유도 (게임 프로필 관리로 이동)

---

## Phase 2: GP 캘리브레이션 end-to-end

### 2-1. 캘리브레이션 플로우 검증
**현재**: 트라이얼 루프 코드 배선 완료(useCalibrationHandlers). 실제 동작 미검증.
**목표**: start → trial loop → finalize → 결과 표시 → 감도 적용까지 전체 동작.

- [ ] 캘리브레이션 시작 시 active profile 연동 (Phase 1-3 의존)
- [ ] 트라이얼 루프 실행 확인: get_next_trial_sens → FlickScenario → submit → 반복
- [ ] 수렴 시 finalize → CalibrationResult 화면 정상 표시
- [ ] "감도 적용" 버튼 → settingsStore + GameProfile DB 모두 업데이트
- [ ] GP 곡선 + 관측점 실시간 표시 (PerformanceLandscape)

### 2-2. 줌 캘리브레이션 end-to-end
- [ ] 줌 캘리브레이션 트라이얼 루프 실행 확인
- [ ] K-fitting 결과 → MultiplierCurve 정상 표시
- [ ] Comparator 방식 비교 동작 확인

---

## Phase 3: Aim DNA 배터리

### 3-1. 배터리 플로우 검증
**현재**: useBatteryHandlers 코드 존재. 실동작 미확인.
**목표**: 6개 시나리오 순차 실행 → 점수 기록 → DNA 결과 표시.

- [ ] 배터리 시작 → 시나리오 리스트 표시 → 하나씩 실행 → 점수 기록
- [ ] 모든 시나리오 타입(flick, tracking, circular, stochastic, counter_strafe, micro_flick) 동작 확인
- [ ] BatteryResult 화면에서 6축 레이더 차트 표시
- [ ] AimDnaResult에서 DNA 상세 분석 표시

### 3-2. DNA 히스토리 + 시계열
- [ ] 매 측정마다 DNA 스냅샷 DB 저장
- [ ] AimDnaHistory 타임라인 차트 동작
- [ ] 기어/감도 변경점 마킹 + 전후 비교

---

## Phase 4: 트레이닝 시스템

### 4-1. 프리셋 기반 트레이닝
**현재**: 유저에게 시간/갯수 입력 요구.
**목표**: 시스템이 프리셋 제시 (DNA 기반 약점 훈련, 워밍업, 집중훈련).

- [ ] 트레이닝 프리셋 정의 (DNA 결과 기반 자동 추천)
- [ ] "시작" 버튼까지 최소 클릭
- [ ] 고급 커스텀은 접힌 상태로 제공

### 4-2. 훈련 처방 연동
- [ ] DNA 결과 → 자동 훈련 추천 (약한 축 집중)
- [ ] TrainingPrescription 화면 동작 확인

---

## Phase 5: 인사이트 + 추천

### 5-1. 기어/자세 추천
- [ ] DNA 분석 기반 그립/자세/패드 추천
- [ ] 달인급 유저 감지 → 비용 필터 해제, 모든 개선 가능성 제시
- [ ] AimDnaGripGuide, AimDnaPostureGuide 동작 확인

### 5-2. 정체기 감지
- [ ] 장기간 변화 없는 카테고리 자동 감지
- [ ] 새로운 개선 방향 제안

---

## Phase 6: 크로스게임 + 유틸리티

### 6-1. 크로스게임 감도 변환
- [ ] CrossGameComparison 동작 확인
- [ ] 게임간 감도/FOV 정확 변환

### 6-2. 세션 히스토리
- [ ] SessionHistory 화면 동작 확인
- [ ] 과거 세션 데이터 조회

---

## 실행 순서

1. **Phase 1** (게임 프로필) — 모든 것의 기반. 이거 없으면 나머지 다 무의미.
2. **Phase 2** (캘리브레이션) — 앱의 핵심 가치. 감도 최적화.
3. **Phase 3** (DNA 배터리) — 두 번째 핵심. 능력 측정.
4. **Phase 4** (트레이닝) — DNA 결과 기반 훈련.
5. **Phase 5** (인사이트) — 분석 결과 활용.
6. **Phase 6** (유틸리티) — 부가 기능.

각 Phase는 이전 Phase가 실제로 동작해야 의미가 있다. 코드 존재 ≠ 동작.
