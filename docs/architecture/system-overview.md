# AimForge 시스템 아키텍처 개요

> Tauri 2 (Rust + React + Three.js) 기반 FPS 에임 교정/훈련 데스크탑 앱

---

## 기술 스택

| 레이어 | 기술 | 역할 |
|--------|------|------|
| Runtime | Tauri 2 (Rust) | 네이티브 래퍼, IPC, 파일 시스템 |
| Backend | Rust (src-tauri/src/) | GP 엔진, DNA 분석, 캘리브레이션, DB |
| Frontend | React 18 + TypeScript | UI 컴포넌트, 상태 관리 |
| 3D 엔진 | Three.js | 테스트 시나리오 렌더링 |
| 시각화 | D3.js | 레이더 차트, Landscape, 바 차트 |
| 오디오 | Web Audio API | 사격 피드백 사운드 |
| 상태 관리 | Zustand (12개 스토어) | 전역 상태 |
| DB | SQLite (rusqlite) | 모든 데이터 영구 저장 |
| Input | WinAPI raw input | sub-μs 마우스 캡처 |

---

## 프로젝트 구조

```
src-tauri/src/
├── aim_dna/          # Aim DNA 피처 추출 + 추세 분석 + 레퍼런스 감지
│   ├── mod.rs        # 23피처 계산, DataSufficiency, analyze_dna_trend, detect_reference_game
│   └── commands.rs   # IPC 7개
├── calibration/      # GP 캘리브레이션 엔진
│   ├── mod.rs        # 2-stage, 3-mode 캘리브레이션
│   ├── fatigue.rs    # 피로/워밍업 감지
│   └── go_no_go.rs   # 재현성 검증
├── crossgame/        # 크로스게임 DNA 비교 + 개선 플랜
│   ├── mod.rs        # compare_games, classify_gap_causes, generate_improvement_plan, predict_timeline
│   └── commands.rs   # IPC 4개
├── db/               # SQLite 스키마 + CRUD 헬퍼
│   ├── mod.rs        # 26+ 테이블, 50+ 헬퍼 함수
│   └── commands.rs   # DB IPC
├── game_db/          # 50+개 게임 프리셋 + 감도 변환 (Tier1 11개 교차검증)
├── gp/               # Gaussian Process (Matérn 5/2)
├── input/            # WinAPI raw mouse capture
├── training/         # 훈련 처방 + 스테이지 시스템
├── zoom_calibration/ # 줌 캘리브레이션 + k-피팅 + Comparator
└── lib.rs            # Tauri setup + invoke_handler

src/
├── components/       # React 컴포넌트 (32+ .tsx)
│   ├── ProfileWizard.tsx          # 8단계 가이드 플로우
│   ├── AimDnaResult.tsx           # DNA 레이더 + 상세표 + 재교정 배너
│   ├── CrossGameComparison.tsx    # 듀얼 레이더 + 델타 + 원인 + 타임라인
│   ├── BatteryResult.tsx          # 배터리 종합 점수
│   ├── CalibrationResult.tsx      # 캘리브레이션 결과
│   ├── overlays/
│   │   ├── ShootingFeedback.tsx   # 히트마커/미스마커/머즐플래시
│   │   └── FireModeIndicator.tsx  # 발사 모드 표시 UI
│   └── ...
├── stores/           # Zustand 스토어 (12+ .ts)
│   ├── engineStore.ts          # 화면 라우팅, 포인터 락
│   ├── profileWizardStore.ts   # 8단계 가이드 플로우 상태
│   ├── aimDnaStore.ts          # DNA + 추세 + 레퍼런스
│   ├── crossGameStore.ts       # 크로스게임 비교
│   ├── batteryStore.ts         # 배터리 시퀀스
│   └── ...
├── data/
│   └── gameDatabase.ts    # 50+ 게임 감도 메타데이터 (yaw, FOV, 엔진, ADS)
├── engine/           # Three.js 게임 엔진
│   ├── scenarios/    # 10종 시나리오 + 21 스테이지
│   ├── metrics/      # 메트릭 수집 + 점수 계산
│   ├── AudioManager.ts       # Web Audio API 사격 피드백
│   ├── FireModeController.ts # 단발/연발/점사 + RPM 제어
│   └── WeaponViewModel.ts    # Three.js 프로시저럴 총기 + 오버레이 씬
├── utils/            # 공용 유틸리티
│   ├── types.ts      # TypeScript 인터페이스 (820+ 라인)
│   ├── physics.ts    # DPI/cm/deg 변환, 6가지 감도 변환
│   └── radarUtils.ts # 레이더 축 계산 공용
└── App.tsx           # 메인 앱 (화면 라우팅)
```

---

## 핵심 데이터 흐름

```
Input (raw mouse) → Three.js 시나리오 → MetricsCollector → CompositeScore
  → Battery 완료 → compute_aim_dna → AimDnaProfile (23피처 + type_label)
    → aim_dna_history (시계열)
    → detect_reference_game (자동)
    → analyze_dna_trend (변화 감지)
  → compare_games (크로스게임)
    → classify_gap_causes (5가지 룰)
    → generate_improvement_plan (4 Phase)
    → predict_timeline (적응 기간)
```

---

## IPC 커맨드 현황

| 모듈 | 커맨드 수 | 주요 커맨드 |
|------|-----------|-------------|
| input | 5 | start/stop_mouse_capture, drain_mouse_batch |
| game_db | 4 | get_available_games, convert_sensitivity, convert_all_methods (50+ 게임 지원) |
| db | 12 | start_session, save_trial, create_game_profile 등 |
| calibration | 6 | start/finalize_calibration, submit_calibration_trial |
| zoom_calibration | 10 | start/finalize_zoom_calibration, start/finalize_comparator |
| aim_dna | 7 | compute_aim_dna_cmd, get_dna_trend_cmd, detect_reference_game_cmd |
| training | 5 | generate_training_prescriptions, get_stage_recommendations |
| crossgame | 4 | compare_game_dna, predict_crossgame_timeline, get_cross_game_history_cmd |
| db (통계) | 3 | weekly_stats, archive_old_trials, optimize_db |
