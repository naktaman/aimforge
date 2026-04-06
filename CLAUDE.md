# AimForge — FPS 에임 교정/훈련 데스크탑 앱

> Tauri 2 (Rust + React + Three.js). GP Bayesian Optimization 감도 최적화.

## 필독 규칙
- **한국어 주석** 필수 (함수, 복잡한 로직, 분기)
- 커밋 메시지 **한국어**
- 파일 수정 전 변경 내용 먼저 보고
- 돌이킬 수 없는 작업은 반드시 먼저 물어보기
- 버그: **증거 먼저, 수정 나중. 한 번에 하나만**
- 컨텍스트 70-80% 차면 세션 교체 — 교체 전 MEMORY.md + `docs/progress/status.md` 업데이트

## 빌드
```bash
npx tauri dev           # 개발 서버
npx tauri build         # 프로덕션 빌드
cd src-tauri && cargo test  # Rust 테스트
npm run build           # 프론트엔드만
```

## Docs
- `docs/architecture/` — 시스템 설계, DB 스키마, 시나리오
- `docs/progress/` — 진행 현황, 인시던트 로그
- `docs/quality/` — 코딩 규칙, 트러블슈팅, 감사 프레임워크
- `docs/planning/` — 로드맵, UI 리디자인 기획
- `docs/research/` — 딥리서치 아카이브 (docx)
- `docs/security-audit.md` — 보안 감사 보고서

## 세션 종료 전
- `docs/progress/status.md` + MEMORY.md 업데이트
