# AimForge v0.3 — 마스터 로드맵

> **작성일**: 2026-04-07 | **최종 업데이트**: 2026-04-07
> **원칙**: "감도를 깎으러 온 사람이 프로 수준의 게임 경험을 느끼게 한다"
> **기준**: 모든 요소를 프로젝트급으로 — 딥리서치 → 기획서 → 구현 → 검증

---

## 현재 상태 (2026-04-07)

**완료 블록:** A-1~A-5, B-1 Phase 1~3, B-2 Phase 1~4, B-3 Phase 1, B-4 Phase 1, C-1~C-4, D, E-1~E-2

**남은 작업:**
- B-1 Phase 4: 사운드 폴리시 (앰비언트 루프, 스폰 사운드, 볼륨 밸런스)
- B-3 Phase 2~4: 타겟 고도화 (Perlin 움직임, 인체형 glTF, 인스턴싱)
- B-4 Phase 2~3: 환경 고도화 (BloomPass 후처리, KTX2 텍스처, LOD)

---

## 로드맵 구조

각 블록은 독립적으로 완성 가능한 단위. 블록 내부는 세분화된 태스크로 나뉜다.
**모든 블록은**: 딥리서치(필요시) → 기획서 → 코드 세션(세분화) → 검증

---

## Block A: UI/UX 비주얼 완성 ✅ 완료

### A-1: 설정 화면 완성 ✅
- [x] Cold Forge :root 변수 전면 교체
- [x] 하드웨어 섹션
- [x] 감도 & 프로필 섹션

### A-2: 컴포넌트별 Cold Forge 스타일 적용 ✅
- [x] 버튼/입력/드롭다운/토글/탭/메뉴/화면전환/로딩/토스트/스크롤바

### A-3: 대시보드 레이아웃 개편 ✅
- [x] 상태 CTA 히어로, 도구 카드 그리드, 프리셋 우선

### A-4: Actionable Empty State 전면 적용 ✅
- [x] 모든 빈 화면에 "다음 할 일" 안내 + 실행 버튼

### A-5: 메뉴/네비게이션 정리 ✅
- [x] 탭명 변경, 도구 기능 맥락 노출 개선

---

## Block B: 인게임 경험

### B-1: 사운드 엔진 — Phase 1~3 ✅ / Phase 4 남음

**Phase 1 ✅** SpatialAudio 공간음향, SoundRecipes 3레이어 히트/총기음
**Phase 2 ✅** HRTF 공간 오디오, ConvolverNode 리버브 (4 프리셋), 3밴드 공기 흡수, 5레이어 발사음
**Phase 3 ✅** 무기 타입별 5레이어 총기음 분화 (Pistol/Rifle/SMG/Sniper), 연발 tail 오버랩

**Phase 4 — 사운드 폴리시 (미완):**
- [ ] 앰비언트 루프 (시나리오별)
- [ ] 타겟 스폰 사운드 (방향 힌트)
- [ ] 볼륨 밸런스 + 장시간 피로도 검증

### B-2: 총기 시스템 — Phase 1~4 ✅ 완료

**Phase 1 ✅** 발사 모드 4종, 프리셋 6종, 블룸 반동, 탄창/재장전
**Phase 2 ✅** 반동 패턴 시스템 (CS2/Valorant 프리셋), ViewPunch + AimPunch 분리, 무기 설정 연동
**Phase 3 ✅** WeaponViewModel 개선 (View Bob, Sway, ADS 줌 전환), 머즐 플래시/탄피 배출/트레이서/피격 이펙트 (WeaponEffects.ts, 오브젝트 풀링)
**Phase 4 ✅** 반동 패턴 시각화 오버레이 (RecoilOverlay), 무기 설정 UI (WeaponConfigPanel), 프리셋 드롭다운

### B-3: 타겟 시스템 — Phase 1~2 ✅ / Phase 3~4 남음

**Phase 1 ✅** 타겟 설정 UI, 히트존 4구역, 움직임 패턴 3종 (sine/random/figure8), 피격 피드백
**Phase 2 ✅** 타겟 고급 움직임 시스템
- Simplex Noise 기반 유기적 움직임 (PerlinNoise.ts 순수 구현)
- 고도화 ADAD Strafing (가속/감속 곡선, 방향전환 딜레이, 랜덤 타이밍 변동)
- 복합 패턴 (composite) — 복수 패턴 가중 결합
- 난이도 프리셋 4종 (Easy/Medium/Hard/Extreme)
- 타겟 프리셋 4종 추가 (perlin/adad/hard/extreme)

**Phase 3~4 — 타겟 고도화 (미완):**
- [ ] 인체형 glTF 모델 (현재 프로시저럴 박스 기반)
- [ ] InstancedMesh 대량 타겟 최적화
- [ ] 타겟 파괴 이펙트 (조각/페이드/폭발)

### B-4: 환경/맵 시스템 — Phase 1 ✅ / Phase 2~3 남음

**Phase 1 ✅** Cold Forge 테마 환경 시스템 전면 리팩터링
- 맵 프리셋 4종 (Open Forge / Circuit Forge / Pressure Forge / Corridor Forge)
- Cold Forge PBR 재질 6종 (금속 벽, 콘크리트, 천장, 네온 시안/마젠타)
- 3광원 조명 (Ambient + Hemisphere + Directional, PCF 소프트 그림자)
- 프로시저럴 금속 패널 벽 (분리선 + 네온 트림)
- 먼지 파티클 시스템 (AdditiveBlending)
- 네온 바닥 그리드 + 둘레 네온 트림
- 안개 (선형/지수, 프리셋별 최적화)
- EnvironmentPresets.ts (301줄) + EnvironmentEffects.ts (191줄) + Environment.ts (334줄) 분리

**Phase 2~3 — 환경 고도화 (미완):**
- [ ] UnrealBloomPass 후처리 (네온 글로우 강화)
- [ ] KTX2 텍스처 압축 (금속 패널 디테일)
- [ ] LOD 시스템 (원거리 장애물 단순화)
- [ ] 정적 지오메트리 머지 (draw call 최적화)

---

## Block C: 핵심 기능 end-to-end ✅ 완료

### C-1: GP 캘리브레이션 E2E ✅
- [x] 감도 적용 연결, GP 관측점 DB 저장, game_category 동적화

### C-2: Aim DNA 배터리 E2E ✅
- [x] IPC 케이싱 불일치 4건 수정, 6개 시나리오 순차 실행 배선 검증

### C-3: 시나리오 시스템 E2E ✅
- [x] zoom_composite 명시적 case 추가

### C-4: 트레이닝 E2E ✅
- [x] StageResult IPC 케이싱 수정

---

## Block D: 데이터 시각화 애니메이션 ✅ 완료

useChartAnimation 훅 7개, 9개 컴포넌트 D3 동적 모션, useReducedMotion 접근성 대응

---

## Block E: 인사이트 + 유틸리티 ✅ 완료

### E-1: 인사이트 ✅
- [x] DNA 기반 그립/자세/패드 추천
- [x] 정체기 감지 + 새 방향 제안

### E-2: 크로스게임 ✅
- [x] 게임간 감도/FOV 정확 변환
- [x] 세션 히스토리

---

## 실행 순서

**완료 (시간순):**
1. ~~A-1~A-5~~ ✅ UI/UX 비주얼 완성
2. ~~B-1 Phase 1~~ ✅ 사운드 엔진 MVP
3. ~~B-2 Phase 1~~ ✅ 총기 시스템 기본
4. ~~C-1~C-4~~ ✅ 핵심 기능 E2E 배선
5. ~~D~~ ✅ 데이터 시각화 애니메이션
6. ~~E-1~E-2~~ ✅ 인사이트 + 크로스게임
7. ~~B-1 Phase 2~~ ✅ HRTF + 리버브 + 5레이어 발사음
8. ~~B-2 Phase 2~~ ✅ 반동 패턴 시스템
9. ~~B-1 Phase 3~~ ✅ 무기별 총기음 분화
10. ~~B-2 Phase 3~~ ✅ 뷰모델 비주얼 + 발사 이펙트
11. ~~B-2 Phase 4~~ ✅ 반동 오버레이 + 무기 설정 UI
12. ~~B-3 Phase 1~~ ✅ 타겟 기본 시스템
13. ~~B-4 Phase 1~~ ✅ Cold Forge 환경 시스템
14. ~~B-3 Phase 2~~ ✅ 타겟 고급 움직임 (Perlin, ADAD 고도화, 난이도 프리셋)

**남은 작업:**
1. **B-1 Phase 4**: 사운드 폴리시 (앰비언트, 스폰 사운드, 볼륨 밸런스)
2. **B-3 Phase 3~4**: 타겟 고도화 (glTF, 인스턴싱, 파괴 이펙트)
3. **B-4 Phase 2~3**: 환경 고도화 (BloomPass, KTX2, LOD)

> 각 단계에서 딥리서치가 필요하면 선행. 기획서 없이 코드 세션 돌리지 않는다.
