# AimForge v0.3 — 태스크 트래커

> 각 Phase의 세부 태스크 진행 상태를 추적한다.
> 세션 완료 시마다 이 파일 업데이트.
> **마지막 업데이트**: 2026-04-07

---

## Phase 1: 게임 프로필 시스템

**상세 설계서**: `docs/planning/phase1-game-profile-system.md`

| # | 태스크 | 상태 | 세션 ID | 비고 |
|---|--------|------|---------|------|
| 1-1-B | gameProfileStore 재설계 (타입+IPC 매핑+activeProfileId) | ✅ 완료 | local_53151a30 | 커밋 3369328. GameProfile 타입 1:1 매핑, activeProfileId/activeProfile getter, IPC 파라미터 수정 |
| 1-1-A | GameProfileManager UI 재설계 (gameDatabase 연동+동적폼) | ✅ 완료 | local_7f4a3745 | 커밋 647b262. GameSelector분리(143줄), 동적sensFields, 이니셜아바타, cm/360미리보기 |
| 1-2 | 온보딩 → 프로필 자동 생성 | ✅ 완료 | local_369d7644 | 커밋 a091beb. handleComplete async화, createProfile+setActive 호출 |
| 1-3 | profile_id 하드코딩 제거 | ✅ 완료 | local_369d7644 | 커밋 7bed93b. 14곳 전부 user profiles.id(=1) 확인, TODO→명시주석, CalibrationProgress nextCm360 버그도 수정 |
| 1-4 | settingsStore ↔ gameProfileStore 동기화 | ✅ 완료 | local_369d7644 | 커밋 211eff7. syncProfileToSettings 추가, setActive+앱초기화에서 동기화 |

---

## Phase 2: GP 캘리브레이션 end-to-end

**상세 설계서**: 미작성 (Phase 1 완료 후 설계)

| # | 태스크 | 상태 | 세션 ID | 비고 |
|---|--------|------|---------|------|
| 2-1 | 캘리브레이션 플로우 검증 | ⏳ 대기 | — | start → trial loop → finalize → 결과 → 적용 |
| 2-2 | 줌 캘리브레이션 end-to-end | ⏳ 대기 | — | — |

---

## Phase 3: Aim DNA 배터리

**상세 설계서**: 미작성

| # | 태스크 | 상태 | 세션 ID | 비고 |
|---|--------|------|---------|------|
| 3-1 | 배터리 플로우 검증 (6개 시나리오) | ⏳ 대기 | — | — |
| 3-2 | DNA 히스토리 + 시계열 | ⏳ 대기 | — | — |

---

## Phase 4: 트레이닝 시스템

**상세 설계서**: 미작성

| # | 태스크 | 상태 | 세션 ID | 비고 |
|---|--------|------|---------|------|
| 4-1 | 프리셋 기반 트레이닝 | ⏳ 대기 | — | DNA 기반 자동 추천 |
| 4-2 | 훈련 처방 연동 | ⏳ 대기 | — | — |

---

## Phase 5: 인사이트 + 추천

**상세 설계서**: 미작성

| # | 태스크 | 상태 | 세션 ID | 비고 |
|---|--------|------|---------|------|
| 5-1 | 기어/자세 추천 | ⏳ 대기 | — | — |
| 5-2 | 정체기 감지 | ⏳ 대기 | — | — |

---

## Phase 6: 크로스게임 + 유틸리티

**상세 설계서**: 미작성

| # | 태스크 | 상태 | 세션 ID | 비고 |
|---|--------|------|---------|------|
| 6-1 | 크로스게임 감도 변환 | ⏳ 대기 | — | — |
| 6-2 | 세션 히스토리 | ⏳ 대기 | — | — |

---

## 버그/핫픽스 (Phase 무관)

| 항목 | 상태 | 비고 |
|------|------|------|
| CalibrationProgress.tsx nextCm360 중복 destructuring (line 21, 26) | ✅ 완료 | Task 1-3에서 같이 수정됨 (커밋 7bed93b) |
| commands.rs 디스크 truncation (140줄→183줄) | ✅ 완료 | Task 1-1-B 세션에서 복원됨 |

---

## 범례
- ✅ 완료
- 🔄 진행중
- ⏳ 대기
- ❌ 차단됨
- 🔁 재작업 필요
