# UX 재설계 피드백 기록

> 날짜: 2026-04-02

---

## 사용자 피드백 원문

### 1. 메뉴 구조 문제
- 크로스헤어 메뉴가 Training, Quick Play와 같은 라인에 있는 게 말이 안됨
- 전체 메뉴 배치 재점검 필요

### 2. 핵심 컨셉 미노출
- 어드밴스드로 들어왔는데 뭘 해야 할지 모르겠음
- 전체 감도 프로파일을 만드는 것이 메인인데, 프로파일 생성 메뉴가 전면에 없음
- 기본적으로 전체 점검 시나리오를 진행하게 해야 함 (사용자 프로파일 먼저 → 그 후 추천/감도 제안)
- "감도를 깎으러 온 사람"이라는 핵심 유저 페르소나를 잊으면 안 됨
- "Quick Play"라는 메뉴명 자체가 안 맞음

### 3. Tools 정리 안 됨
- 이것저것 기능들을 때려박아 놓음, 각각 무슨 기능인지 알기 어려움
- FOV 비교 같은 건 전체 감도 프로파일을 확인한 사람들이나 활용할 건데 별도로 갖다박아 놓는 게 부적절
- 핵심 컨셉을 메인으로 내세우고, 단순 훈련도 가능하게 하는 식이어야 함

### 4. UI 성의 없음
- 인라인 스타일 남발, 일관성 없음
- 모던 게이밍 UI 느낌 원함

---

## 변경사항

### Part A: 메뉴 구조 재설계

**Before:**
```
[Training] [Quick Play] [Crosshair] [Tools]
```

**After:**
```
[프로파일 점검] [훈련] [도구]
```

#### 탭 1: 프로파일 점검 (기본 탭)
- 전체 점검 (배터리) CTA를 최상단에 크게 배치
- "내 에임 프로파일을 만들어보세요" 안내 문구
- 배터리 프리셋 선택 + 큰 시작 버튼
- 감도 캘리브레이션 (Quick / Zoom)
- 내 프로파일 요약 카드 (Aim DNA + 진행 현황)

#### 탭 2: 훈련
- 서브탭: 훈련 카탈로그 / 커스텀 시나리오
- 카탈로그: Flick 3종 + Tracking 3종 + Switching 2종
- 커스텀: 기존 6개 시나리오 파라미터 조정
- 루틴 관리 바로가기 (Advanced)

#### 탭 3: 도구
- **분석**: 진행 대시보드, 훈련 처방, 궤적 분석, 스타일 전환
- **감도 변환**: 크로스게임 변환기, 상세 변환 선택기
- **장비/환경**: 무브먼트 에디터, FOV 비교, 하드웨어 비교, 듀얼 랜드스케이프
- **기타**: 히스토리, 크로스게임 비교, 크로스헤어 설정, 리코일 에디터

### Part B: UI 비주얼 폴리싱

1. **CSS 디자인 시스템 확장** — 70+ 새 변수 (색상, 타이포, 간격, 그림자, 전환, 블러)
2. **공용 컴포넌트 클래스** — glass-card, btn, input, badge, page, data-table, tab-group, stat, toast, spinner 등
3. **글래스모피즘 카드** — backdrop-filter + 반투명 배경 + hover glow
4. **모든 기존 CSS 클래스 모던화** — 메인 탭 (pill 스타일), 카탈로그, 버튼, 입력 필드
5. **10개 주요 컴포넌트 인라인 스타일 제거** — ~440개 inline style → CSS 클래스

### 수정 파일 목록
- `src/styles.css` — 디자인 시스템 + 컴포넌트 클래스 (~500줄 추가)
- `src/components/ScenarioSelect.tsx` — 메뉴 구조 전면 재작성
- `src/components/BackButton.tsx` — 인라인 → CSS 클래스
- `src/components/LoadingSpinner.tsx` — 인라인 → CSS 클래스
- `src/components/Toast.tsx` — 인라인 + 컬러맵 → CSS 클래스
- `src/components/ConversionSelector.tsx` — 43개 인라인 제거
- `src/components/CrossGameComparison.tsx` — 58개 인라인 제거
- `src/components/MovementEditor.tsx` — 56개 인라인 제거
- `src/components/StyleTransition.tsx` — 39개 인라인 제거
- `src/components/ProgressDashboard.tsx` — 29개 인라인 제거
- `src/components/FovComparison.tsx` — 30개 인라인 제거
- `src/components/HardwareCompare.tsx` — 30개 인라인 제거
- `src/components/TrajectoryAnalysis.tsx` — 30개 인라인 제거
- `src/components/RecoilEditor.tsx` — 31개 인라인 제거
- `src/components/TrainingPrescription.tsx` — 18개 인라인 제거

### 빌드 결과
- TS 에러: 0
- JS: 1,073 kB (인라인 제거로 ~10kB 감소)
- CSS: 56 kB (디자인 시스템 + 컴포넌트 클래스 추가)
