# AimForge 30일 로드맵 요약

> 원본: `C:\Users\ned78\Downloads\AIMPRO2\00-roadmap-v5.md`

---

## Week 1 — Foundation (Day 1~7) ✅
Infrastructure, Three.js 엔진, GP Calibration, Go/No-Go 검증

## Week 2 — Scenarios + Game DB (Day 8~14) ✅
시나리오 확장, Game DB 10개, Landscape, Zoom Calibration, Comparator

## Week 3 — DNA + Cross-game + Movement (Day 15~21) ✅
- Day 15~17 ✅ — Aim DNA Engine + Cross-game DNA Comparator
- Day 18~19 ✅ — 훈련 처방 + 궤적 분석 + Progress Dashboard + Game Readiness
- Day 20~21 ✅ — Movement + FOV + Hardware

## Week 4 — Editors + Session + UX + Launch (Day 22~30) ✅
- Day 22~23 ✅ — Recoil/Movement Editor + Conversion Selector
- Day 24~25 ✅ — AI Session Planner + Population 인프라
- Day 26~27 ✅ — UX Polish (Simple/Advanced, 온보딩, 다크모드, i18n)
- Day 28~29 ✅ — 집중 테스트 (10개 플로우)
- Day 30 ✅ — Launch (.msi + GitHub + README)

## Post-Launch — UI 디자인 감사 + 품질 개선
- P0 디자인 감사 ✅ (2026-04-05) — 게임 그리드 이니셜 아바타+검색+필터 칩, 온보딩 전환 애니메이션+유효성 피드백
- P1 디자인 개선 ✅ (2026-04-05) — SVG 아이콘, 레이더 차트 d3 애니메이션, 탭 fade 전환, EmptyState 컴포넌트, 라이트 glow 강화
- P2 디자인 개선 ✅ (2026-04-05) — CSS 변수 체계화 (색상+폰트+weight+glow), ARIA 접근성, 히트맵 범례
- P3 디자인 감사 ✅ (2026-04-05) — 키보드 방향키 네비게이션 (useTabKeyboard 훅, 7개 tablist), EmptyState 적용 (4개 화면), 반응형 레이아웃 (minWidth 960px, 2개 breakpoint)
- 보안 개선 Phase 1 ✅ (2026-04-05) — CSP 강화, Capabilities 세분화, devTools 확인, audit 실행
- 보안 개선 Phase 2 ✅ (2026-04-05) — IPC 입력 검증 (DPI/sens/FOV/ID), PublicError 패턴 (내부 에러 차단), 주석 정리
- v0.2.0 릴리즈 준비 ✅ (2026-04-05) — CI 보안 감사 (cargo audit + npm audit), 버전 0.2.0 업데이트, CHANGELOG.md
- UX 라운드2 ✅ (2026-04-05) — WelcomeScreen 프로 게이밍 재디자인(스펙 스트립), 히어로스탯 게임감도 교체, Empty State SVG 일러스트, CATEGORY_COLORS CSS변수화, whileHover 정리, 의미없는 정보 제거
- B-3 Phase 2: 타겟 고급 움직임 시스템 ✅ (2026-04-07) — Perlin Noise 순수 구현(Classic 2D + FBM), ADAD Strafing 고도화(가속/감속/딜레이/페이크), 복합 패턴(ADAD+Perlin), 난이도 프리셋 4종(Easy/Medium/Hard/Extreme), TargetPresets.ts 신규
- B-4 Phase 2: 환경 이펙트 고도화 ✅ (2026-04-07) — UnrealBloomPass 포스트프로세싱 파이프라인, 파티클 시스템(스파크/먼지/앰비언트), 머즐 플래시 동적 라이팅, 네온 pulse 애니메이션
- B-1 Phase 4: 사운드 폴리시 ✅ (2026-04-07) — 5채널 볼륨 버스(master/hit/ui/gun/ambient), 히트 사운드 pitch±4st/gain±15% variation, 앰비언트 페이드 인/아웃, 노이즈 버퍼 프리로드, Mute/Unmute 즉시 반영, settingsStore 사운드 설정 통합

## v0.3 — 콘텐츠 확장 + UX 고도화

### A. 코어 개선 ✅
- A-1 ~ A-5 ✅ — 캘리브레이션/DNA/시나리오/트레이닝 E2E 버그 수정

### B. 콘텐츠 확장
- B-1 사운드 Phase 1 ✅ — Web Audio 기반 총기/히트/UI 사운드 시스템
- B-1 사운드 Phase 2~4 — HRTF 3D 오디오, 5레이어 총기음, 폴리시
- B-2 총기시스템 Phase 1 ✅ — 발사 모드 4종 + 탄창/리로드 + 블룸 + 시나리오 프리셋 6종
- B-2 Phase 2~4 — 반동 패턴 구현, 뷰모델 비주얼, 이펙트
- B-3 타겟시스템 딥리서치 ✅ (2026-04-07) — 기획서 저장 (docs/research/target-system-spec.md)
- B-3 타겟시스템 구현 — 기획서 기반 타겟 행동/외형/히트존 시스템
- B-4 환경/맵 — 딥리서치 필요

### C. 버그 수정 ✅
- C-1 ✅ — 캘리브레이션 감도 적용 + GP 관측점 DB 저장
- C-2 ✅ — Aim DNA IPC 파라미터 케이싱 불일치 수정
- C-3/C-4 ✅ — 시나리오·트레이닝 E2E 버그 수정

### D. UI 디자인 ✅
- Cold Forge 디자인 시스템 ✅ (2026-04-07) — 컬러 팔레트 + 타이포 + 전역 스타일 전면 교체
- 마이크로인터랙션 ✅ — Chrome Sweep, Press Stamp, 버튼 4종, 스크롤바

### E. 인사이트 + 크로스게임
- E-1 인사이트 시스템 ✅ (2026-04-07) — insightGenerator.ts + InsightPanel + ResultScreen 통합
- E-2 크로스게임 감도 비교 ✅ (2026-04-07) — CrossGameConverter 개선 (59개 게임 DB 연동) + SensitivityTab 연결

---

## 설계 원칙
1. argmax(score) — 높을수록 좋다
2. 재현성 필수 — 같은 데이터 → 같은 결과
3. overshoot penalty 명시 + click timing 분리
4. AI는 "분석" — 궤적만으로 진단
5. Fixed Sens가 메인 — 머슬메모리 보존
6. 투명성 — landscape, confidence band, 한계 고지
7. Cross-game DNA 비교가 핵심 가치

## 프로파일 5축
1. Sensitivity (cm/360)
2. Scenario Type + 각도/방향/운동체계별 분리
3. Movement Profile + movement_ratio
4. FOV (상시 + 배율별 k-parameter)
5. Hardware (mouse + pad combo)
