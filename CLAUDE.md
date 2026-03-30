# AimForge — Claude Code 프로젝트 규칙

## 프로젝트 개요
FPS 에임 교정/훈련 데스크탑 앱. Tauri 2 (Rust + React + Three.js) 기반.
Gaussian Process Bayesian Optimization으로 감도 최적화, Aim DNA 분석, 크로스게임 변환.

## 기술 스택
- **백엔드**: Rust (Tauri 2), rusqlite (SQLite), windows crate (WinAPI)
- **프론트엔드**: React 19, TypeScript, Vite, Three.js (예정)
- **타겟**: Windows 10/11 (x86_64-pc-windows-msvc)

## 코딩 규칙

### 필수
- 모든 함수, 복잡한 로직, 중요한 분기에 **한국어 주석** 필수
- 커밋 메시지 **한국어**로 작성
- 파일 수정 전 변경 내용 먼저 보고
- 돌이킬 수 없는 작업은 반드시 먼저 물어보기
- 버그 대응: 추측으로 코드 수정 금지. **증거 먼저, 수정 나중. 한 번에 하나만 고치기**

### 구조
- Rust 모듈: `src-tauri/src/{input, game_db, db, gp, aim_dna, calibration, session, crossgame, readiness}/`
- React: `src/{components, hooks, stores, utils}/`
- 데이터: `data/{games, recoil, movement}/`

### 빌드
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

### 세션 관리
- 컨텍스트 70~80% 차면 세션 교체 권고
- 교체 전 MEMORY.md 업데이트 필수

## 로드맵 참조
전체 로드맵 및 태스크: `C:\Users\ned78\Downloads\AIMPRO2\`
- `00-roadmap-v5.md` — 30일 마스터 로드맵
- `01-infrastructure.md` — Day 1~2 인프라 (현재 진행 중)
- `02-threejs-test-engine.md` — Day 3~4 Three.js 엔진
- `03-gp-engine.md` — Day 5~6 GP 엔진
