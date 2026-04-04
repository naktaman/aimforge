# AimForge 보안 코드 감사 보고서

> 감사일: 2026-04-05
> 범위: src-tauri/src/**, src/**, 설정 파일, 의존성
> 방법: 정적 분석 (읽기 전용)

---

## 1. Tauri IPC 커맨드

### 커맨드 목록 (총 44개)

| 모듈 | 커맨드 | 파일 |
|------|--------|------|
| lib | `get_app_info` | `src-tauri/src/lib.rs:36` |
| game_db | `get_available_games`, `convert_sensitivity`, `convert_all_methods`, `snap_sensitivity` | `src-tauri/src/game_db/commands.rs` |
| calibration | `start_calibration`, `get_next_trial_sens`, `submit_calibration_trial`, `get_calibration_status`, `finalize_calibration`, `cancel_calibration` | `src-tauri/src/calibration/commands.rs` |
| input | `get_mouse_acceleration_status`, `check_dpi`, `start_mouse_capture`, `stop_mouse_capture`, `drain_mouse_batch` | `src-tauri/src/input/commands.rs` |
| crossgame | `compare_game_dna`, `predict_crossgame_timeline`, `record_crossgame_progress`, `get_cross_game_history_cmd`, `generate_crossgame_prescriptions_cmd` | `src-tauri/src/crossgame/commands.rs` |
| hardware | `save_hardware_combo`, `get_hardware_combos`, `update_hardware_combo`, `delete_hardware_combo`, `compare_hardware_combos` | `src-tauri/src/hardware/commands.rs` |
| db | `start_session`, `save_trial`, `end_session`, `log_crash`, `get_crash_logs`, `get_daily_stats`, `get_skill_progress`, `save_user_setting`, `get_user_setting`, `get_all_user_settings`, `create_game_profile`, `get_game_profiles`, `update_game_profile`, `delete_game_profile`, `set_active_game_profile`, `create_routine`, `get_routines`, `delete_routine`, `add_routine_step`, `get_routine_steps`, `remove_routine_step`, `swap_routine_step_order`, `export_database`, `get_weekly_stats`, `archive_old_trials`, `optimize_database` | `src-tauri/src/db/commands.rs` |
| movement | `export_movement_profile`, `import_movement_profile_from_string` | `src-tauri/src/movement/commands.rs` |
| (aim_dna, training, trajectory, zoom_calibration, fov_profile 등 추가 모듈) | 별도 커맨드 다수 | 각 모듈 commands.rs |

### 입력 검증

- **상태**: 주의 (Medium)
- Tauri의 serde 역직렬화가 타입 레벨 검증 역할을 수행 (i64, f64, String)
- 그러나 String 파라미터에 대한 **길이 제한, 범위 검증, 정규식 필터**가 없음
  - `mode`, `session_type`, `scenario_type`, `error_message`, `stack_trace` 등 무제한 문자열 입력 가능
  - `save_trial`의 `raw_metrics`, `mouse_trajectory` — 대용량 JSON 문자열 제한 없음
- `movement/commands.rs:177` — `safe_name` 생성 시 `replace(|c: char| !c.is_alphanumeric() && c != '_', "_")` sanitization 적용 (양호)

### Capabilities/Permissions

- **상태**: 안전 (Info)
- `src-tauri/capabilities/default.json`: `"core:default"` 권한만 허용
- 파일시스템, 셸, HTTP 등 추가 플러그인 권한 없음
- Tauri 2의 capability 시스템에 의해 커맨드 접근은 로컬 WebView로 제한

---

## 2. SQLite 인젝션

- **상태**: 안전 (Info)
- `src-tauri/src/db/mod.rs` 전체 (1200+ 줄) 검토 완료
- **모든 쿼리가 `rusqlite::params![]` 파라미터 바인딩 사용** — `?1`, `?2` ... 패턴 일관 적용
- `format!()` 기반 SQL 문자열 포맷팅: **0건 발견** (grep 결과 확인)
- 동적 쿼리 (`get_aim_dna_history`, `get_stage_results`): `Option` 분기로 SQL 문자열을 선택하되, 값은 모두 파라미터 바인딩
- WAL 모드 + foreign_keys 활성화 (`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;`)

---

## 3. 프론트엔드 XSS

### innerHTML 사용

- **상태**: 주의 (Low)
- **1건 발견**: `src/components/PerformanceLandscape.tsx:286`
  ```js
  tooltipRef.current.innerHTML = `
    <strong>${closest.x.toFixed(1)} cm/360</strong><br/>
    score: ${closest.mean.toFixed(3)}<br/>
    σ: ${Math.sqrt(closest.variance).toFixed(3)}
  `;
  ```
- 삽입 데이터: `closest.x`, `closest.mean`, `closest.variance` — 모두 **숫자 → `.toFixed()` 변환** 후 삽입
- 사용자 입력이 직접 들어가지 않으므로 실질적 XSS 위험은 매우 낮음
- `dangerouslySetInnerHTML`: 0건
- `eval()`: 0건

### CSP (Content Security Policy)

- **상태**: 위험 (High)
- `src-tauri/tauri.conf.json:26`: `"csp": null`
- CSP가 비활성화되어 있어, WebView 내부에서 인라인 스크립트/외부 리소스 로딩이 무제한
- Tauri 앱은 로컬 전용이므로 네트워크 공격 벡터는 제한적이나, **CSP 설정을 권장**

---

## 4. 시크릿 / API 키

- **상태**: 안전 (Info)
- `.env` 파일: 존재하지 않음 (`.gitignore`에 `.env`, `.env.local` 포함)
- `server.env.example`: 파일 부재 (Git에 빈 example만 추적)
- Rust 코드에 하드코딩된 API 키/시크릿: **0건**
- 프론트엔드: JWT 토큰은 `authStore.ts`에서 메모리(zustand state)로 관리
  - `localStorage`에 토큰 저장 코드: **미발견** (토큰은 메모리에만 존재)
  - `localStorage` 사용: 테마 설정(`uiStore.ts:44`)과 PB 점수(`ResultScreen.tsx:23`) — 민감정보 아님
- `apiClient.ts:6`: `DEFAULT_BASE_URL = 'http://localhost:8000'` — 개발용 로컬 URL (하드코딩이나 위험도 낮음)

---

## 5. 파일시스템 보안

### Path Traversal

- **상태**: 안전 (Info)
- DB 경로: `app.path().app_data_dir()` + `"aimforge.db"` — Tauri API 경유, 사용자 입력 미포함 (`lib.rs:61`)
- 파일 내보내기: `movement/commands.rs:171-184`
  - 경로: `app_data_dir/exports/` 고정
  - 파일명 sanitization: `params.name.replace(|c: char| !c.is_alphanumeric() && c != '_', "_")` 적용 (`commands.rs:177`)
  - **path traversal(`../`) 불가** — 특수문자가 `_`로 치환됨
- `export_database`: DB 파일 **경로 문자열만 반환**, 파일 내용은 노출하지 않음

### 임시 파일

- 별도 임시 파일 사용: 없음
- 모든 데이터는 SQLite DB 또는 `app_data_dir` 하위에 저장

---

## 6. 의존성 감사

### npm audit

- **상태**: 안전
- 결과: `found 0 vulnerabilities`

### cargo audit

- **상태**: 미확인 (Info)
- `cargo-audit` 미설치 (`error: no such command: 'audit'`)
- `cargo install cargo-audit` 후 재실행 필요
- 권장: CI 파이프라인에 `cargo audit` 추가

---

## 7. 데이터 프라이버시

### 로컬 저장

- **상태**: 안전 (Info)
- 모든 사용자 데이터는 **로컬 SQLite DB** (`app_data_dir/aimforge.db`)에만 저장
- 외부 서버 전송: `apiClient.ts` 존재하나, **서버 미구축 상태** (localhost:8000, 오프라인 시 null 반환)
- 전송 데이터: Steam 인증 토큰, 유저 정보 — 서버 활성화 시에만

### 크래시 로그

- **상태**: 주의 (Low)
- `log_crash` 커맨드: `error_message`, `stack_trace`, `context` 무제한 저장
- 스택 트레이스에 민감 경로 정보 포함 가능 (사용자 이름 등)
- 현재 로컬 전용이므로 위험도 낮음. 서버 전송 시 sanitization 필요

### 로그

- **상태**: 안전
- `tauri_plugin_log`: **debug 빌드에서만 활성화** (`cfg!(debug_assertions)`, `lib.rs:47`)
- 프로덕션 빌드에서는 로그 플러그인 비활성

---

## 요약 테이블

| # | 항목 | 상태 | 심각도 | 위치 | 설명 |
|---|------|------|--------|------|------|
| 1 | CSP 비활성화 | 위험 | **High** | `tauri.conf.json:26` | `"csp": null` — WebView 보호 미비 |
| 2 | IPC 문자열 길이 무제한 | 주의 | **Medium** | `db/commands.rs` 전체 | String 파라미터 길이/범위 검증 없음 |
| 3 | innerHTML 사용 | 주의 | **Low** | `PerformanceLandscape.tsx:286` | 숫자 `.toFixed()` 후 삽입이라 실질 위험 낮음 |
| 4 | 크래시 로그 민감정보 | 주의 | **Low** | `db/commands.rs:105` | 스택 트레이스에 경로 포함 가능 |
| 5 | cargo audit 미실행 | 정보 | **Info** | — | `cargo-audit` 설치 후 실행 필요 |
| 6 | SQL 인젝션 | 안전 | **Info** | `db/mod.rs` 전체 | 100% 파라미터 바인딩 |
| 7 | API 키 하드코딩 | 안전 | **Info** | — | 미발견 |
| 8 | Path Traversal | 안전 | **Info** | `movement/commands.rs:177` | 파일명 sanitization 적용 |
| 9 | npm 취약점 | 안전 | **Info** | — | 0 vulnerabilities |
| 10 | Tauri Permissions | 안전 | **Info** | `capabilities/default.json` | core:default만 허용 |

---

## 권장 조치

### High Priority
1. **CSP 설정 활성화** — `tauri.conf.json`에서 `"csp": "default-src 'self'; script-src 'self'"` 등 적절한 정책 설정

### Medium Priority
2. **IPC 입력 검증 강화** — 문자열 길이 상한 (예: raw_metrics 10MB, error_message 10KB)
3. **cargo-audit 설치 및 CI 연동** — `cargo install cargo-audit && cargo audit`

### Low Priority
4. **innerHTML → textContent/React 렌더링** — PerformanceLandscape 툴팁을 React 컴포넌트로 전환 검토
5. **크래시 로그 sanitization** — 서버 전송 구현 시 경로 정보 마스킹
