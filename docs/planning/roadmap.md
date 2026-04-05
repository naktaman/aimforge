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
- P3 디자인 감사 — 키보드 방향키 네비게이션, 반응형 레이아웃, focus trap 등 (예정)
- 보안 개선 Phase 1 ✅ (2026-04-05) — CSP 강화, Capabilities 세분화, devTools 확인, audit 실행

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
