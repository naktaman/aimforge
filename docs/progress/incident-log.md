# AimForge Incident Log

> 출시 후 발생한 이슈 및 수정 기록

---

## 2026-04-05: P0 디자인 감사 수정

| 항목 | 상태 |
|------|------|
| 심각도 | P0 (출시 전 반드시 수정) |
| 발견 | UI 디자인 감사 |
| 브랜치 | `claude/fervent-dewdney` → `master` (fast-forward) |
| 커밋 | `17bd437` |

### P0-1: 게임 선택 그리드

**문제**: 50+개 게임이 아이콘 없이 동일한 텍스트 카드로 나열. 검색/필터 없음.

**수정**:
- 카테고리별 색상 이니셜 아바타 (48×48 원형)
- 실시간 검색 필드 (한/영 매칭, GAME_DATABASE nameKo 포함)
- 카테고리 필터 칩 6종 (전체/FPS/전술/배틀로얄/TPS/기타)
- Onboarding.tsx + ProfileWizard.tsx 양쪽 적용

### P0-2: 온보딩 단계 전환 애니메이션

**문제**: 단계 간 전환이 즉시 교체. WelcomeScreen 직후 품질 낙차.

**수정**:
- motion AnimatePresence 슬라이드 전환 (방향 감지: next=좌→우, prev=우→좌)
- duration 0.25s, ease easeInOut
- DPI 100~32000 범위 유효성 + 감도 > 0 유효성 + 게임 미선택 피드백

### 수정 파일
- `src/components/Onboarding.tsx` — 전면 재작성
- `src/components/ProfileWizard.tsx` — 아바타+검색+필터 추가
- `src/styles.css` — 검색/필터/아바타/에러 스타일 추가
- `src/i18n/en.json`, `src/i18n/ko.json` — 11키 추가

### 검증
- `npm run build` 통과 (1,440 kB)
- `cargo check` 통과 (기존 경고만, 에러 없음)
- master 머지 후 재빌드 통과
