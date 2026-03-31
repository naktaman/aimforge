# AimForge — FPS 에임 교정/훈련 데스크탑 앱

> Tauri 2 (Rust + React + Three.js) 기반.
> GP Bayesian Optimization 감도 최적화, Aim DNA 분석, 크로스게임 변환.

---

## 필독 규칙
- 모든 함수, 복잡한 로직, 중요한 분기에 **한국어 주석** 필수
- 커밋 메시지 **한국어**로 작성
- 파일 수정 전 변경 내용 먼저 보고
- 돌이킬 수 없는 작업은 반드시 먼저 물어보기
- 버그 대응: 추측으로 코드 수정 금지. **증거 먼저, 수정 나중. 한 번에 하나만 고치기**
- **컨텍스트 70-80% 차면 세션 교체 권고** — 교체 전 MEMORY.md + `docs/progress/status.md` 업데이트 필수

## 빌드

```bash
npx tauri dev          # 개발 서버
npx tauri build        # 프로덕션 빌드
cd src-tauri && cargo test  # Rust 테스트
npm run build          # 프론트엔드 빌드만
```

---

## Docs Index
- **@docs/architecture/** — 시스템 설계, DB 스키마, 시나리오 시스템
  - [system-overview.md](docs/architecture/system-overview.md) — 기술 스택, 프로젝트 구조, 아키텍처 결정사항
  - [db-schema.md](docs/architecture/db-schema.md) — 26개 테이블 + IPC 커맨드
  - [scenarios.md](docs/architecture/scenarios.md) — 10종 시나리오, 메트릭 정의, 점수 공식
- **@docs/progress/** — 구현 진행 현황
  - [status.md](docs/progress/status.md) — Day별 완료 현황 + 다음 작업
- **@docs/quality/** — 코드 규칙
  - [coding-rules.md](docs/quality/coding-rules.md) — 코딩 규칙, 빌드 명령어, 세션 관리
- **@docs/planning/** — 로드맵
  - [roadmap.md](docs/planning/roadmap.md) — 30일 로드맵 참조, 설계 원칙, 프로파일 5축

---

## 프로젝트 구조 (요약)
- Rust: `src-tauri/src/{input, game_db, db, gp, calibration}/`
- React: `src/{components, stores, utils}/`
- Engine: `src/engine/{scenarios, metrics}/`
- 로드맵 원본: `C:\Users\ned78\Downloads\AIMPRO2\`

---

## 세션 종료 전
- `docs/progress/status.md` 업데이트
- MEMORY.md 업데이트
- 변경된 docs/ 파일 목록 요약
