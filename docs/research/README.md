# 딥리서치 아카이브

> AimForge 개발 과정에서 수행한 딥리서치 결과물 인덱스.
> 각 항목은 세션에서 수집한 핵심 결론 요약이며, 상세 원본은 별도 파일로 보관.

---

## 목차

- [에임 이론 & DNA](#에임-이론--dna)
- [감도 & 변환](#감도--변환)
- [UI/UX 디자인](#uiux-디자인)
- [게임 데이터](#게임-데이터)
- [보안 & 품질](#보안--품질)

---

## 에임 이론 & DNA

### 1. [에임 측정 이론 기초](aim-assessment-theory.md)
28개 학술 논문 기반, 6개 영역 정리.
- **Motor Control**: Fitts's Law 3가지 formulation, SAT 커브 3-파라미터 모델, Optimized Submovement Model
- **정확도**: Bivariate normal 히트맵, CEP ≈ 1.18σ, ISO 9241-9 Throughput
- **트래킹**: SPARC/LDLJ smoothness, 교차상관 기반 예측/반응 분리
- **일관성**: CV 해석, Power Law of Practice, Quiet Eye 이론
- **감도 최적화**: C-D Gain 연구 (최적 0.45-1.8°/mm), cm/360 생체역학 근거
- **타겟 설계**: 히트박스 각도 0.5-2.5°, 75% 정확도 최적 (심리물리학)

### 2. [Aim DNA 피처 설계](aim-dna-feature-design.md)
경쟁사(KovaaK's/Aimlabs/Aiming.Pro/3D Aim Trainer/Voltaic) 벤치마킹 + 25개 피처 수학적 정의.
- **레이더 6축 최적**: Click Accuracy, Click Speed, Precise Tracking, Reactive Tracking, Target Switching, Stability
- **PCA**: 3개 잠재 요인 (Motor Acuity, Accuracy, Stability) → 70-80% 분산 설명
- **5개 타입 아이덴티티**: Lightning/Current/Surgeon/Spark/Spectrum (FIFA 카드 + 16Personalities 접근)
- **Voltaic**: 하모닉 평균 기반 랭킹, 12단계 등급 (Iron→Celestial)

### 3. [Aim DNA 대시보드 기획](aim-dna-dashboard.md)
23개 피처 → 6개 카테고리 그룹핑, 레이더 차트 애니메이션 스펙, 강점/약점 인사이트 자동 추출.
- 3단계 입장 애니메이션 (그리드→폴리곤→포인트)
- 비교 오버레이 모드 (You vs Average, Before vs After)
- 퍼센타일 기반 자동 인사이트 + 약점→시나리오 매핑

### 4. [감도별 자세/그립 가이드](sensitivity-posture-grip.md)
1,169줄, 60+ 출처. 6가지 그립 바이오메카닉스 + 마우스 형태 호환 매트릭스.
- 그립별 MCP/PIP/DIP 관절 각도, 접촉면적 %, 관여 근육
- 마우스 형태(에르고/심메트리컬) × 그립 호환 매트릭스
- 기어 체크리스트: 프로 2,239명 데이터 기반 (무게/패드/피트/번지/모니터)
- 그립 전환 가이드: 운동 학습 3단계 타임라인

---

## 감도 & 변환

### 5. [FOV/줌감도 종합 분석](fov-zoom-sensitivity.md)
Monitor Distance Matching 방식별 특성, 줌 깊이별 k값 필요성.
- Linear Scaling: 8x+ 극단 줌에서 체감 불일치
- Logarithmic Scaling: 인간 인식 체계와 일치
- 4개 보완 항목 식별 (FOV 변화폭 diverge, tan() 비선형성, 줌별 k, 프로 튜닝 근거)

### 6. [줌감도 역산 딥리서치](zoom-sensitivity-reverse-engineering.md)
139명 프로 설정 역산. 배율별 독립 k값 시스템 필수 결론.
- **CS2** (49명): 73.5% zoom_sens=1.0 (MDM 100%), AWPer만 0.80-0.90
- **Valorant** (35명): 97.1% scope_sens=1.0
- **OW2** (25명): 기본값 38 = FLS k≈1.0 (MDM 0%)
- **R6S** (8명×8배율): 줌 깊이↔보상 양의 상관관계 직접 확인
- **핵심**: 단일 최적 변환 없음, 배율별 독립 k값 필수

### 7. [게임 감도 변환 데이터 수집](game-sensitivity-data.md)
10개 메이저 FPS Yaw 값 교차검증 + 변환 매트릭스.
- CS2 0.022, Valorant 0.07, OW2 0.0066, Tarkov 0.125, Deadlock 0.044 등
- 5건 소스 간 불일치 발견 및 판단 기재 (예: OW2 스코프 49.46% vs 37.89%)
- 저작권: Yaw값은 수학적 사실 (Feist v. Rural 판례)

### 8. [FPS 게임 데이터 대규모 수집](fps-game-data-collection.md)
10개 게임 수학적 데이터: Yaw, FOV, 줌감도, 이동속도, 히트박스, MDM 공식.
- Apex 스코프별 FOV 스케일 (1x~10x)
- CS2/Apex/R6S 이동속도 상세
- Apex 레전드별 히트박스 픽셀 데이터

### 9. [이동 입력 심층 분석](movement-input-analysis.md)
경쟁사 이동 구현 현황 + Phase 분리 접근법 권장.
- 고정 위치 에임이 업계 75-90% (Aim Lab 85-90%, KovaaK's 75-80%)
- PNAS Nexus: 고정→이동 전이 상관관계 높음
- **권장**: Phase 1 고정 유지 → Phase 2 Automove → 범용 WASD 점진 도입

---

## UI/UX 디자인

### 10. [게이밍 앱 UI 디자인](gaming-ui-design.md)
Aimlabs/KovaaK's/Aimbeast 경쟁사 UI 분석, 디자인 트렌드, CSS/React 구현 가이드.
- 글래스모피즘 + 네온 글로우 주류, 오로라 그래디언트 상승
- Forge Theme 색상 (#FF6B35 Primary, #00F5FF Secondary)
- $10 게임 MVP Polish 체크리스트, 환불 유발 패턴

### 11. [결과화면 감정 디자인](results-screen-design.md)
Valorant/OW2/CS2/Apex 결과화면 분석, 3-Zone 레이아웃, 애니메이션 타임라인.
- 0.0s~4.0s 시퀀스, 등급별 색상/glow/celebration 스펙
- 감도 점수, DNA 기여도, 오버슈트/언더슈트 분석
- 15개 요소 우선순위 매트릭스 + 4-Phase 로드맵

### 12. [스플래시/웰컴 화면](splash-welcome-screen.md)
스플래시 2초 이내 최적 (UX 리서치), Valorant "브랜드 계층" 모델.
- 4프레임 시퀀스: 암전→파티클→로고→전환
- 재방문 플로우: 스플래시→메인허브 직행 + 개인화 환영
- Three.js 파티클 + CSS 로고 애니메이션 하이브리드

### 13. [화면전환 애니메이션](screen-transitions.md)
Motion (framer-motion v12+) 추천, 300ms 이내 원칙.
- View Transitions API: Tauri macOS/Linux 불안정 → 비추천
- 3계층 아키텍처: Page → Scene → Element
- GPU 가속 속성만 사용, prefers-reduced-motion 필수

### 14. [감도최적화 대시보드](sensitivity-dashboard.md)
GP 시각화 스펙 (D3 curveMonotoneX + Framer Motion), 수렴 진행률 공식.
- GP mean curve, confidence band, EI 추천 시각화 hex/스타일
- 수렴률: `1 - (current_max_σ / initial_max_σ)`
- FEAT 프레임워크 기반 최종 결과 세레모니

### 15. [인게임 HUD](ingame-hud.md)
KovaaK's/Aimlabs/3D Aim Trainer HUD 분석 + FPS 레퍼런스.
- 4단계 정보 계층 (Tier 1→4)
- 중앙 20-30% Sacred Zone, 4.5:1 대비율
- 4가지 HUD 모드: Minimal/Standard/Full/Sensitivity Optimization

### 16. [게임 피드백/주스 베스트사례](game-juice-feedback.md)
Web Audio API 프로그래매틱 사운드 + 시각 피드백 수치.
- 히트: sine 1kHz/150ms, 헤드샷: triangle 1.2kHz/80ms, 킬: 800→200Hz sweep/400ms
- 반응성 <100ms, 히트마커 ~133ms(8프레임)
- 스크린 셰이크: trauma² + Perlin noise 업계 표준
- 오디오-비주얼 동기화 ±40ms 이내

### 17. [사람타겟 리서치](humanoid-target.md)
히트박스 2단계(머리+몸통) 표준, 사람타겟→실전 전이효과 우수.
- KovaaK's: Body/Head Radius 독립, Dodge Profiles (AD스팸, 지글피크)
- 부족 시나리오: Peek Shot, Jiggle Peek Counter, Spray Transfer
- **권장**: 시나리오 내 타겟 형태 선택 가능

---

## 게임 데이터

### 18. [FPS 기어 DB](fps-gear-database.md)
마우스 109개 (30브랜드) + 마우스패드 65개 (25브랜드) JSON 데이터.
- 무게 31g (UltralightX Small) ~ 121g (G502 HERO), 평균 63.2g
- 무선 87/유선 22
- 패드: balanced 29/control 17/speed 12/glass 4/hybrid 3
- Artisan 전 라인업 포함

---

## 보안 & 품질

### 19. [Tauri+React 보안 가이드](tauri-security.md)
6개 영역 보안 딥리서치. P0 즉시 필수 항목 정리.
- CSP `unsafe-*` 금지, Release devTools 비활성화
- IPC 입력 serde 타입 + 범위 검증
- 게임 프로세스 메모리 접근 절대 금지 (VAC 밴)
- 점수 계산 Rust 백엔드 전용

### 20. [코드퀄리티 감사 프레임워크](../quality/audit-framework.md)
12카테고리 감사기준 + ISO 25010/SonarQube 매핑 + LLM 편향 분석.
- Risk-Weighted 가중치: Security x1.5 > Error Handling x1.3 > Code Structure x1.2
- LLM 편향 3종: Verbosity, Positional, Self-Preference
- 하이브리드 채점 (정량 도구 + 정성 평가)

---

## 총기/시스템 설계

### 21. [총기그래픽/리코일/모션 설계](weapon-system-design.md)
가짜 리코일 2축 (Screen Shake + Crosshair Kick), 4단계 강도 프리셋.
- Three.js r128 분리 카메라, 스프링 물리 반동
- DNA 격리 아키텍처: Input Layer vs Visual Layer 물리적 분리
- 성능: 전체 시스템 ON 시 프레임당 0.5-1.0ms (버짓 3-6%)
- P0→P1→P2→P3, 총 13-16일

---

*마지막 업데이트: 2026-04-06*
