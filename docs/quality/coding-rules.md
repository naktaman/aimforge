# AimForge 코딩 규칙

---

## 언어 규칙
- 모든 함수, 복잡한 로직, 중요한 분기에 **한국어 주석** 필수
- 커밋 메시지 **한국어**로 작성
- UI 텍스트: 한국어 기본 (영어 병기 가능)

## 코드 스타일
- Rust: snake_case, `///` 한국어 doc comment
- TypeScript: Rust IPC 응답과 매칭되는 타입은 **snake_case** 유지 (serde 기본 동작)
- Frontend 자체 타입/변수: camelCase (React 관례)
- 스토어: Zustand, `use___Store` 네이밍

## 변경 프로세스
- 파일 수정 전 변경 내용 먼저 보고
- 돌이킬 수 없는 작업은 반드시 먼저 물어보기
- 버그 대응: **증거 먼저, 수정 나중. 한 번에 하나만 고치기**

## 빌드 & 검증
```bash
npx tauri dev          # 개발 서버
npx tauri build        # 프로덕션 빌드
cd src-tauri && cargo test  # Rust 테스트
npm run build          # 프론트엔드 빌드만 (tsc + vite)
```

## 세션 관리
- **컨텍스트 70-80% 차면 세션 교체 권고**
- 교체 전: MEMORY.md + `docs/progress/status.md` 업데이트 필수
- 변경된 docs/ 파일 목록 요약

## 파일 구조 관례
- Rust IPC 커맨드: `모듈/commands.rs` 분리
- DB 헬퍼: `db/mod.rs`에 집중
- React 컴포넌트: `src/components/` (단일 파일 컴포넌트)
- 스토어: `src/stores/` (기능별 분리)
- 타입 정의: `src/utils/types.ts` (중앙 관리)
