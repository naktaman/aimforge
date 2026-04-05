# Changelog

## [0.2.0] - 2026-04-05

### 코드 품질
- **unwrap() 정리**: 전체 Rust 코드에서 unwrap() 제거, 안전한 에러 처리로 전환
- **serde camelCase rename**: Rust↔JS 간 직렬화 일관성 확보
- **i18n 지원**: 전체 컴포넌트 en/ko 다국어 마이그레이션

### UI/디자인
- **P0**: 게임 선택 그리드 개선, 온보딩 전환 애니메이션
- **P1**: SVG 아이콘 시스템, 레이더 애니메이션, 탭 fade 전환, 라이트 glow 강화
- **P2**: CSS 변수 체계화, 접근성(WCAG 대비비), 히트맵 범례
- **P3**: 키보드 네비게이션 (Tab/Enter/Escape), EmptyState 컴포넌트, 반응형 레이아웃
- **Forge 테마**: 모던 게이밍 앱 디자인 전면 리뉴얼
- **웰컴 히어로**: 히어로 섹션 재설계 + 비주얼 퀄리티 향상

### 보안
- **Phase 1**: CSP(Content Security Policy) 강화, Tauri Capabilities 세분화
- **Phase 2**: IPC 입력 검증(validate.rs), PublicError 패턴(error.rs), 내부 경로 노출 방지
- **보안 감사 보고서**: 11개 항목 정적 분석 + 해결 현황 문서화

### 기능
- EmptyState 컴포넌트 (데이터 없음 상태 안내)
- 키보드 접근성 (포커스 관리, 단축키)
- DNA 히스토리 + 전후 비교 시스템
- 히트존 3구역 확장 (head/upper_body/lower_body)
- 기어 DB + 그립/자세 가이드 + 인사이트 엔진 통합
- 게임 50+ 목록 스크롤 지원

### CI/인프라
- GitHub Actions: cargo audit + npm audit 자동 실행 (push/PR/주간)

## [0.1.0] - 초기 릴리즈

- Tauri 2 + React + Three.js 기반 데스크탑 앱
- GP Bayesian Optimization 감도 최적화
- Aim DNA 5축 분석 시스템
- 크로스게임 감도 변환
- 10종 훈련 시나리오
- SQLite 데이터베이스 (26개 테이블)
