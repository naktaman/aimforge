# AimForge 트러블슈팅 가이드

> 개발 중 만난 이슈와 해결법 기록

---

## 프론트엔드

### motion (framer-motion) import 경로
- **증상**: `import { AnimatePresence } from 'framer-motion'` → 모듈 못 찾음
- **원인**: motion v12+에서 패키지명이 `motion`으로 변경됨
- **해결**: `import { AnimatePresence, motion } from 'motion/react'`

### GamePreset에 category 필드 없음
- **증상**: Rust `get_available_games` IPC가 반환하는 `GamePreset`에 `category` 필드가 없어 카테고리별 필터링 불가
- **원인**: Rust `GamePreset`은 최소 필드만 포함 (id, name, yaw, fov 등). 카테고리는 프론트엔드 `gameDatabase.ts`의 `GameEntry`에만 존재
- **해결**: `GAME_DATABASE.find(g => g.id === preset.id || g.name === preset.name)` 으로 매칭하여 카테고리 조회

### CSS 파싱 에러 — 닫는 괄호 누락
- **증상**: 빌드 시 스타일 깨짐, 특정 클래스 이후 모든 스타일 무시
- **원인**: CSS 블록의 `}` 하나가 빠져서 이후 전체 파싱 실패
- **해결**: CSS 수정 후 반드시 `npm run build`로 검증. 커밋 `7365346` 참조

### 게임 그리드 오버플로우
- **증상**: 50+개 게임 카드가 온보딩 카드를 넘침
- **해결**: `.game-grid`에 `max-height: 280px; overflow-y: auto;` 적용. 커밋 `bc55065` 참조

---

## Rust / Tauri

### Worktree에서 master checkout 불가
- **증상**: `git checkout master` → `fatal: 'master' is already used by worktree`
- **원인**: git worktree는 동일 브랜치를 동시에 체크아웃할 수 없음
- **해결**: 메인 리포 디렉토리에서 `git merge <worktree-branch>` 실행

### GP NaN 크래시 체인
- **증상**: 특정 입력에서 GP predict → NaN → cholesky assert panic
- **해결**: P0 Fix Sprint에서 수정 — assert → Result, expect → graceful fallback. 상세: `docs/health/` 참조
