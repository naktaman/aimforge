# AimForge 사운드 엔진 기획서

> **프로 FPS 수준 사운드 시스템 구현을 위한 딥리서치 & 구현 스펙**
> 작성일: 2026-04-07

---

## 목차

1. [FPS 게임 사운드 엔진 분석](#1-fps-게임-사운드-엔진-분석)
2. [Web Audio API 구현 한계와 최적화](#2-web-audio-api-구현-한계와-최적화)
3. [총기 사운드 레이어 설계](#3-총기-사운드-레이어-설계)
4. [공간 음향 구현](#4-공간-음향-구현)
5. [환경 리버브](#5-환경-리버브)
6. [히트 사운드 디자인](#6-히트-사운드-디자인)
7. [에임 트레이너에서의 사운드 중요도](#7-에임-트레이너에서의-사운드-중요도)
8. [구현 우선순위 및 로드맵](#8-구현-우선순위-및-로드맵)

---

## 1. FPS 게임 사운드 엔진 분석

### 1.1 게임별 HRTF 구현

| 게임 | 사운드 엔진 | HRTF 방식 | 특징 |
|------|-----------|----------|------|
| **CS2** | Steam Audio (Source 2) | 물리 기반 HRTF, 기본 활성 | 수직 방향 인지 우수, 적응기간 15-20시간 |
| **Valorant** | 커스텀 (Patch 2.06+) | 해부학 모델 기반 단일 프로필 | 가청성(audibility) 우선, 스테레오 전용 |
| **Apex Legends** | Miles Sound System (RAD) | Miles 10 내장 공간화 | 수만 개 동시 음원 처리, 표면 재질 반영 |
| **Overwatch 2** | Dolby Atmos | HRTF + Dolby 렌더링 | Windows Sonic 대안 지원, 수직음향 우수 |

**핵심 인사이트**: CS2는 기술적 정확도(물리 기반), Valorant는 게임플레이 가청성을 우선시한다. AimForge는 에임 트레이너 특성상 **가청성 우선 + 선택적 HRTF**가 적합하다.

### 1.2 거리 감쇠 모델

**물리 기본**: 역제곱 법칙 — 거리 2배마다 **6dB 감쇠**

| 게임 | 감쇠 특성 | 설계 의도 |
|------|----------|----------|
| CS2 | 물리 기반 역거리 감쇠, 0~10,000 유닛 | 현실감 |
| Valorant | 의도적으로 평탄한 커브 | PC방 환경 대응, 가청성 보장 |
| Apex | 표면 의존적 변화 | 거리+재질+방향 복합 반영 |

**Steam Audio 3밴드 EQ 모델**:
- 저역 (≤800 Hz): 거리에 따른 감쇠 최소
- 중역 (800 Hz ~ 8 kHz): 중간 감쇠
- 고역 (>8 kHz): 공격적 감쇠

### 1.3 주파수 의존 감쇠

공기 중 고주파가 더 빨리 흡수되는 물리 현상을 시뮬레이션한다. 12 kHz 이상 감쇠는 믹스에서 고역 스태킹을 방지하는 역할도 한다.

**감쇠 커브 (구현용)**:
```
거리(m) → 로우패스 컷오프(Hz)
0m     → 20,000 Hz (풀 대역폭)
10m    → 10,000 Hz
20m    → 6,000 Hz
30m    → 4,000 Hz
50m    → 2,000 Hz
100m   → 800 Hz
```

### 1.4 오클루전/오브스트럭션

모든 분석 게임이 **레이캐스트 + 로우패스 필터링** 조합을 사용한다.

- **바이너리 모델**: 소스→리스너 레이캐스트, 차단 시 오클루전 팩터 = 1
- **로우패스 필터링**: 거리+차단도에 따라 컷오프 주파수 조정
- **Steam Audio**: 부분 오클루전(partial occlusion) 지원 — 소스가 부분적으로 보이면 부분 오클루전 적용
- **재질 속성**: 주파수 의존적 흡수 계수를 재질 DB에서 쿼리

> **AimForge 적용**: 에임 트레이너에서는 벽 뒤 소리가 거의 불필요하므로, 단순한 거리 기반 로우패스만 구현하면 충분하다.

### 1.5 리버브/반사 모델

**3-컴포넌트 구조**: 직접음 → 초기 반사 → 후기 리버브

- **초기 반사**: 직접음 이후 80-100ms 이내, 소스 위치 인지에 기여
- **후기 리버브**: 공간 특성 표현, 확산 반사장

**Steam Audio 하이브리드 리버브**:
1. **파라메트릭**: 피드백 딜레이 네트워크, CPU 효율적
2. **컨볼루션**: 풀 IR 사용, 야외 공간에 적합, CPU 비용 높음
3. **하이브리드** (권장): 초기 부분은 컨볼루션, 후기 부분은 파라메트릭

---

## 2. Web Audio API 구현 한계와 최적화

### 2.1 PannerNode HRTF 모드 성능

| 항목 | 수치 |
|------|------|
| HRTF 위치 변경 시 | 최대 **4개 컨볼버** 동시 동작 (보간용) |
| 고사양 데스크톱 | 256+ 동시 AudioWorklet 보이스 |
| 일반 데스크톱 | 50-100개 동시 노드 |
| 모바일 | 10-30개 권장 |

**노드별 CPU 비용 (높음→낮음)**:
1. ConvolverNode (긴 IR) — 가장 비쌈
2. PannerNode (HRTF) — 매우 비쌈
3. CompressorNode — 비쌈
4. WaveShaperNode — 중간
5. GainNode — 최소
6. PannerNode (equalpower) — 최소

### 2.2 ConvolverNode 실시간 리버브

| 브라우저 | IR 1초당 연산 시간 | 60fps 안전 IR 길이 |
|---------|-------------------|-------------------|
| Firefox | ~15ms | ~1초 |
| Chrome | ~35ms | ~0.5초 |

**최적화 전략**:
- IR 길이 2초 미만 유지
- 모노 IR 사용 (버퍼 50% 절감)
- 22.05kHz로 다운샘플링 (성능 모드)
- OfflineAudioContext로 사전 렌더링

### 2.3 AudioWorklet vs ScriptProcessorNode

| 항목 | AudioWorklet (권장) | ScriptProcessorNode (deprecated) |
|------|-------------------|--------------------------------|
| 스레드 | 전용 오디오 렌더링 스레드 | 메인 JS 스레드 |
| 프레임 크기 | 고정 128 샘플 | 128-2048 가변 |
| 레이턴시 | ~3ms (44.1kHz) / ~2.67ms (48kHz) | 높음, 불안정 |
| WASM 호환 | 가능 (GC-free) | 불가 |

**결론**: 모든 새 프로젝트는 반드시 AudioWorklet 사용. ScriptProcessorNode는 모든 브라우저에서 deprecated.

### 2.4 크로스 브라우저 호환성

| 기능 | Chrome | Firefox | Safari |
|------|--------|---------|--------|
| HRTF 지원 | O | O | O (2020.9+) |
| HRTF 로딩 | 무조건 로드 | 온디맨드 (최적화) | DB 로드 |
| AudioWorklet | 완전 지원 | 완전 지원 | 완전 지원 |
| outputLatency | 지원 (2025+) | 지원 | 제한적 |

**주의**: 브라우저마다 HRTF 데이터셋이 다르므로 동일 씬이 브라우저별로 약간 다르게 들린다.

### 2.5 레이턴시 최소화

```javascript
// 최적 게임 오디오 설정
const ctx = new AudioContext({ latencyHint: 'interactive' });

// 실제 레이턴시 측정 (2025+)
console.log(`Base: ${ctx.baseLatency * 1000}ms`);
console.log(`Output: ${ctx.outputLatency * 1000}ms`);
```

- `'interactive'`: 게임 오디오 필수 — 최저 레이턴시
- `'balanced'`: 레이턴시/전력 절충
- `'playback'`: 배터리 우선

### 2.6 AudioNode 풀링 & 메모리 관리

```javascript
// AudioBuffer는 재사용 가능 (풀링 대상)
const audioBuffer = ctx.createBuffer(channels, length, sampleRate);

// AudioBufferSourceNode는 1회용 — 매번 새로 생성
function playSound(buffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer; // 버퍼 재사용
  source.connect(ctx.destination);
  source.start();
  // 재생 완료 후 자동 GC
}
```

**핵심 규칙**:
- `AudioBuffer` → 풀링 (재사용)
- `AudioBufferSourceNode` → 매번 생성 (1회용)
- `GainNode`, `PannerNode` → 시작 시 사전 생성, 재사용
- 실시간 핫패스에서 JS 객체 할당 금지 → WebAssembly 사용

---

## 3. 총기 사운드 레이어 설계

### 3.1 프로 수준 5-레이어 아키텍처

| 레이어 | 역할 | 주파수 대역 | 지속시간 |
|--------|------|-----------|---------|
| **Body** | 풀 스펙트럼 발사음 | 500-2000 Hz | 200-500ms |
| **Transient** | 초기 어택/스냅 | 2-8 kHz | 50-80ms |
| **Sub/LFE** | 저역 충격감 | 60-200 Hz | 100-300ms |
| **Mechanical** | 슬라이드/볼트 동작 | 1-4 kHz | 100-300ms |
| **Tail** | 환경 잔향 | 전대역 (감쇠) | 500ms-2s |

### 3.2 라운드 로빈

**변형 수 기준**:
- 근거리 발사음: 4개
- 메카닉 레이어: 3개
- 테일 레이어: 4개
- 트랜지언트: 2-3개
- **조합 = 4×3×4×3 = 144+ 유니크 조합**

**보완 랜덤화**:
- 피치: ±10-50 cents
- 볼륨: ±2-6 dB
- 엔벨로프: 어택/릴리즈 미세 변동

### 3.3 단발 vs 연발

**단발 (1-2초 전체)**:
1. Initial Blast (50-200ms) — 메인 충격
2. Mechanical Action (100-300ms) — 슬라이드/배출
3. Tail/Reverb (500ms-1s) — 환경 잔향

**연발 (3단계 시퀀스)**:
1. **Ramp-Up (Pre-Fire)** (0-200ms): 첫 발 트랜지언트, 높은 주파수 강조
2. **Loop/Sustain** (발사 지속): 반복 패턴, 발사속도에 맞춤 (600-1200 RPM)
3. **Ramp-Down (Post-Fire)** (100-300ms): 소멸, 메카닉 소리 부각

### 3.4 프로시저럴 합성 (Web Audio API)

**아키텍처**:
```
White Noise (2-8kHz) ──┐
                       ├→ GainNode (엔벨로프) → LowPass (10kHz) ─┐
Sine Oscillator (1kHz) ─┘                                        ├→ Output
                       └→ GainNode (엔벨로프) → HighPass (50Hz) ─┘
```

**무기 타입별 파라미터**:

| 파라미터 | 권총 (9mm) | 소총 (5.56) | 샷건 (12G) | SMG (9mm 버스트) |
|---------|-----------|-----------|-----------|----------------|
| 사인 피치 시작 | 1.5-2.5 kHz | 800-1.2 kHz | 400-800 Hz | 1.2-1.8 kHz |
| 사인 피치 끝 | 200 Hz | 100 Hz | 50 Hz | 200 Hz |
| 피치 디케이 | 150ms | 250ms | 300ms | 100ms |
| 노이즈 대역 | 4-6 kHz | 3-5 kHz | 2-4 kHz | 5-7 kHz |
| 노이즈 지속 | 50-80ms | 80-120ms | 120-180ms | 40-60ms |
| 총 길이 | 400-600ms | 600-900ms | 800-1200ms | 60-80ms/발 |
| 어택 | 10ms | 8ms | 15ms | 5ms |
| 릴리즈 | 300ms | 500ms | 700ms | 50ms |

**구현 코드 스켈레톤**:
```javascript
function synthesizeGunshot(ctx, params) {
  const now = ctx.currentTime;

  // 1. 노이즈 버스트 (트랜지언트/크랙)
  const noiseBuffer = createWhiteNoise(ctx, params.noiseDuration);
  const noiseSource = ctx.createBufferSource();
  noiseSource.buffer = noiseBuffer;

  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = params.noiseCenter; // 예: 5000
  bandpass.Q.value = 1.0;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(1.0, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, now + params.noiseDuration / 1000);

  noiseSource.connect(bandpass).connect(noiseGain);

  // 2. 사인 오실레이터 (바디/펀치)
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(params.pitchStart, now);
  osc.frequency.exponentialRampToValueAtTime(params.pitchEnd, now + params.pitchDecay / 1000);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.8, now);
  oscGain.gain.setValueAtTime(0.8, now + params.attack / 1000);
  oscGain.gain.exponentialRampToValueAtTime(0.01, now + params.release / 1000);

  osc.connect(oscGain);

  // 3. 믹스 & 출력
  const mixGain = ctx.createGain();
  mixGain.gain.value = params.volume;

  noiseGain.connect(mixGain);
  oscGain.connect(mixGain);

  // 4. 랜덤화 (라운드 로빈 대체)
  const pitchVar = 1.0 + (Math.random() - 0.5) * 0.06; // ±3 반음
  osc.frequency.value *= pitchVar;
  mixGain.gain.value *= 1.0 + (Math.random() - 0.5) * 0.1; // ±3dB

  return { noiseSource, osc, output: mixGain };
}
```

---

## 4. 공간 음향 구현

### 4.1 PannerNode 최적 파라미터

| 파라미터 | 권장값 | 설명 |
|---------|-------|------|
| `panningModel` | `'HRTF'` (데스크톱) / `'equalpower'` (모바일) | 품질 vs 성능 |
| `distanceModel` | `'inverse'` | 물리 법칙 부합, FPS 표준 |
| `refDistance` | 2-3m | 이 거리 내에서 볼륨 최대 |
| `maxDistance` | 150-300m | 맵 스케일에 따라 |
| `rolloffFactor` | 1.0-1.4 | 1.0=물리적, 1.4=약간 공격적 |
| `coneInnerAngle` | 360° | 대부분 FPS 사운드 (전방향) |
| `coneOuterAngle` | 360° | 지향성 필요시만 변경 |
| `coneOuterGain` | 1.0 | 지향성 소스: 0.3-0.5 |

**distanceModel 비교**:
- `inverse` (권장): `refDistance / (refDistance + rolloff * (distance - refDistance))` — 역제곱 법칙 근사
- `linear`: `1 - rolloff * (distance - refDistance) / (maxDistance - refDistance)` — 대사/UI용
- `exponential`: `(distance / refDistance)^(-rolloff)` — 거의 사용 안 함

### 4.2 HRTF vs Equalpower

| 항목 | HRTF | Equalpower |
|------|------|-----------|
| 수직 방향 인지 | 우수 | 거의 없음 |
| 후방 인지 | 우수 | 보통 |
| CPU 비용 | 매우 높음 (컨볼루션) | 최소 |
| 메모리 | 상당 (HRTF DB) | 무시 가능 |
| 스피커 호환 | 헤드폰 전용 | 범용 |

**AimForge 전략**: 헤드폰 감지 시 HRTF, 스피커 시 equalpower 자동 전환. 중요 소스 1-2개만 HRTF, 나머지 equalpower.

### 4.3 고역 롤오프 (공기 흡수 시뮬레이션)

```javascript
const filter = ctx.createBiquadFilter();
filter.type = 'lowpass';
filter.Q.value = 0.7071; // Butterworth (최대 평탄)

function updateAirAbsorption(distance) {
  const maxFreq = 20000;
  const absorptionDist = 30; // 감쇠 특성 거리
  const cutoff = maxFreq * Math.exp(-distance / absorptionDist);
  filter.frequency.value = Math.max(500, cutoff);
}
```

**Q 팩터 가이드**:
- 0.7071: Butterworth (가장 투명한 롤오프, 권장)
- 0.5-1.0: 부드러운 감쇠
- 2.0 이상: 비자연스러운 공진 피크 발생 — 사용 금지

### 4.4 위치 업데이트

**주기**: `requestAnimationFrame` (60Hz) — 디스플레이 리프레시와 동기화

**보간 방법 (권장: 프레임당 선형 램프)**:
```javascript
function updateAudioPositions(deltaTime) {
  const t = ctx.currentTime + 0.016; // 다음 프레임

  // 리스너 (플레이어 카메라)
  ctx.listener.positionX.linearRampToValueAtTime(camera.x, t);
  ctx.listener.positionY.linearRampToValueAtTime(camera.y + 1.6, t); // 눈높이
  ctx.listener.positionZ.linearRampToValueAtTime(camera.z, t);

  ctx.listener.forwardX.linearRampToValueAtTime(camera.forward.x, t);
  ctx.listener.forwardY.linearRampToValueAtTime(camera.forward.y, t);
  ctx.listener.forwardZ.linearRampToValueAtTime(camera.forward.z, t);

  ctx.listener.upX.linearRampToValueAtTime(camera.up.x, t);
  ctx.listener.upY.linearRampToValueAtTime(camera.up.y, t);
  ctx.listener.upZ.linearRampToValueAtTime(camera.up.z, t);

  // 소스 위치
  panner.positionX.linearRampToValueAtTime(source.x, t);
  panner.positionY.linearRampToValueAtTime(source.y, t);
  panner.positionZ.linearRampToValueAtTime(source.z, t);

  // 에어 흡수 필터
  const dist = calculateDistance(camera, source);
  updateAirAbsorption(dist);
}
```

**주의**: `param.value` 직접 할당은 "지퍼 노이즈" 발생 — 반드시 `linearRampToValueAtTime` 사용.

---

## 5. 환경 리버브

### 5.1 프로시저럴 임펄스 응답 생성

**알고리즘**: 지수 감쇠 화이트 노이즈 (James A. Moorer 방식)

```javascript
function generateReverbIR(ctx, params) {
  const { decayTime, sampleRate, fadeInTime, lpFreqStart, lpFreqEnd } = params;
  const length = Math.ceil(sampleRate * decayTime);
  const buffer = ctx.createBuffer(2, length, sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      // 화이트 노이즈 × 지수 감쇠
      const noise = Math.random() * 2 - 1;
      const decay = Math.exp(-6.908 * t / decayTime); // -60dB at decayTime

      // 페이드인 (클릭 방지)
      const fadeIn = t < fadeInTime ? t / fadeInTime : 1.0;

      // 고역 감쇠 시뮬레이션 (간이)
      data[i] = noise * decay * fadeIn;
    }
  }
  return buffer;
}
```

### 5.2 시나리오별 리버브 파라미터

| 환경 | RT60 | decayTime | lpFreqStart | lpFreqEnd | fadeInTime | IR 길이 |
|------|------|-----------|-------------|-----------|-----------|---------|
| **소형 실내** (사무실) | 0.3-0.8s | 0.5s | 12,000 Hz | 2,000 Hz | 0.05s | 1-2s |
| **대형 실내** (홀) | 0.8-1.2s | 1.0s | 15,000 Hz | 1,500 Hz | 0.08s | 2-3s |
| **아레나/창고** | 1.0-2.0s | 1.5s | 15,000 Hz | 1,500 Hz | 0.05s | 3-5s |
| **야외** | <0.2s | 0.15s | 8,000 Hz | 800 Hz | 0.02s | 0.5-1s |

### 5.3 웨트/드라이 믹스 라우팅

```
[Source] ─┬→ [DryGain (0.6-0.8)] ──────────────────→ [Output]
          └→ [PreDelay (20-50ms)] → [Convolver] → [WetGain (0.2-0.4)] → [Output]
```

**프리딜레이**: DelayNode로 10-100ms 삽입 — 직접음과 리버브 분리
- 실내: 20-50ms
- 소형 공간: 5-20ms
- 야외: 없음

### 5.4 성능 최적화 티어

| 티어 | 샘플레이트 | 디케이 | 채널 | fadeIn | 용도 |
|------|-----------|--------|------|-------|------|
| **Quality** | 48kHz | 3-5s | 스테레오 | 0.1s | 고사양 데스크톱 |
| **Balanced** | 44.1kHz | 1.5-2s | 스테레오 | 0.05s | 일반 데스크톱 |
| **Performance** | 22.05kHz | 0.8s | 모노 | 0.02s | 모바일/저사양 |

---

## 6. 히트 사운드 디자인

### 6.1 에임 트레이너별 비교

| 트레이너 | 히트 사운드 특징 | 커스터마이즈 |
|---------|----------------|-------------|
| **Aim Lab** | 페이스 기반 피치 변화, WAV/OGG 임포트 | 완전 커스텀 가능 |
| **Kovaak's** | OGG 파일 교체, 쿨다운 0.02-0.08s | 파일 교체 + MBS 등급 시스템 |
| **CS2 딩크** | 1-3 kHz 금속성 핑, 24bit/48kHz | 게임 내 제한적 |

### 6.2 히트 사운드 설계 원칙

**기본 규격**:
- 지속시간: **< 100ms** (이상적: 50-80ms)
- 어택: **< 10ms** (빠른 트랜지언트)
- 디케이: **< 100ms** (후속 히트 마스킹 방지)

**주파수 분배**:
| 레이어 | 주파수 | 믹스 비중 | 역할 |
|--------|--------|----------|------|
| Bass | 60-250 Hz | 5-10% | 무게감/충격 |
| Mid | 250 Hz - 4 kHz | 60-70% | 선명도/존재감 |
| Treble | 4-12 kHz | 20-30% | 날카로움/"크랙" |
| Ultra-high | 12+ kHz | 최소 | 이어 피로 방지 |

**3-레이어 히트 사운드 레시피**:
1. 펀치 클릭: 2-4 kHz, 30ms
2. 금속 핑: 5-8 kHz, 40ms
3. 서브 (옵션): 80-150 Hz, 50ms, 매우 낮은 볼륨

### 6.3 콤보/스트릭 피치 에스컬레이션

**공식**: `frequency(N) = baseFreq × (2^(1/12))^N`

| 연속 히트 | 반음 상승 | 배율 | 예시 (1kHz 기준) |
|----------|----------|------|-----------------|
| 1 | +0 | 1.000 | 1000 Hz |
| 2 | +1 | 1.060 | 1060 Hz |
| 3 | +2 | 1.122 | 1122 Hz |
| 5 | +4 | 1.260 | 1260 Hz |
| 10 | +8 | 1.587 | 1587 Hz |

**구현 파라미터**:
- 증가폭: 히트 1-3회당 +1 반음
- 리셋: 미스 또는 0.5초 이상 정지 시
- 상한: +8 ~ +12 반음 (1 옥타브 제한)

```javascript
function getHitPitch(consecutiveHits, basePitch = 1.0) {
  const semitones = Math.min(consecutiveHits - 1, 12); // 최대 12반음
  return basePitch * Math.pow(2, semitones / 12);
}
```

### 6.4 심리음향학적 만족감 요인

1. **즉시 보상**: < 50ms 레이턴시로 정밀 히트 확인 → 도파민 방출
2. **고주파 콘텐츠**: 3-10 kHz → 경각심/날카로움 인지
3. **빠른 어택+짧은 디케이**: 사운드스케이프 혼잡 없이 주의 포착
4. **앰비언트 대비**: 게임 음악/SFX와 다른 주파수 대역
5. **점진적 변화**: 피치 에스컬레이션 → 습관화 방지, 참여 유지

---

## 7. 에임 트레이너에서의 사운드 중요도

### 7.1 에임 향상에 도움되는 사운드 피드백

| 피드백 유형 | 효과 | 근거 |
|-----------|------|------|
| **즉시 히트 확인** | 높음 | 20분/일 훈련 → 2개월 내 반응시간 20% 감소 |
| **공간 오디오 (HRTF)** | 매우 높음 | 바이노럴 > 스테레오 > 무음향 (타겟 감지) |
| **멀티모달 (오디오+비주얼)** | 최고 | 단일 모달리티 대비 인지 속도/유지력 우수 |
| **미스 사운드 (주기적)** | 높음 | 매 5번째 시행마다 피드백이 매번보다 장기 학습에 효과적 |
| **모션 소니피케이션** | 중간 | 속도→볼륨 매핑으로 트래킹 향상 |

**핵심 연구 결과**:
- 연속 피드백보다 **주기적 피드백** (5회당 1회)이 장기 기술 습득에 효과적
- 복잡한 운동 과제에서 **종결 피드백** (시행 후)이 동시 피드백보다 우수
- **멀티모달 보강 피드백** (오디오+비주얼+햅틱)이 단일 모달리티보다 인지 속도 및 유지력 모두 우수

### 7.2 과도한 사운드가 집중력을 해치는 사례

- **인지 과부하**: 복잡한 사운드스케이프 → 뇌의 필터링 부하 증가 → 피로 가속
- **이어 피로**: 15 kHz 이상 과도한 강조 + 장시간 세션 → 귀 피로
- **마스킹**: 배경음이 핵심 오디오 큐(발소리 등)를 가림
- **대응**: 25분 훈련 + 5분 휴식 (포모도로), 30분 무음 휴식으로 회복

### 7.3 볼륨 밸런스 권장값

| 오디오 요소 | 레벨 (dBFS) | 우선순위 |
|-----------|------------|---------|
| 히트 사운드 | -4 ~ -6 | 최고 — 즉시 피드백 |
| 무기 발사음 | -8 ~ -10 | 높음 — 게임 맥락 |
| 발소리 | -10 ~ -12 | 높음 — 공간 인지 (실전 대비) |
| 앰비언트/음악 | -16 ~ -20 | 낮음 — 분위기 |
| 보이스/커뮤니케이션 | -6 ~ -8 | 높음 — 팀 협동 |

**업계 표준**: 평균 라우드니스 -24 dB LKFS (ITU-R BS.1770), 피크 -1 dBFS 미만

**프로 선수 세팅 참고**:
- 전체 볼륨: 100%
- SFX: 100%
- 보이스오버: 50-60%
- 음악: 비활성화 또는 최소
- EQ: 2-4 kHz 부스트 (방향 인지 강화)

### 7.4 접근성 고려사항

- **시각적 대안**: 자막, 시각 사운드 인디케이터, 색상/투명도로 거리/위협 표시 (Fortnite 사례)
- **햅틱 피드백**: 보조적 역할 (단독으로는 새 운동 기술 습득 불충분)
- **핑 시스템**: 음성 없이 팀 커뮤니케이션 가능한 비언어적 콜아웃

---

## 8. 구현 우선순위 및 로드맵

### Phase 1: 핵심 (MVP)
1. **히트 사운드 시스템**: 3-레이어 합성 (펀치+핑+서브), 피치 에스컬레이션
2. **기본 공간 오디오**: PannerNode equalpower, 거리 감쇠 (inverse)
3. **총기 기본 발사음**: 2-레이어 프로시저럴 합성 (노이즈 버스트 + 사인 디케이)
4. **볼륨 밸런스**: 위 권장값 기반 마스터/개별 볼륨 컨트롤

### Phase 2: 몰입감
5. **HRTF 공간 오디오**: 헤드폰 감지 시 자동 전환
6. **공기 흡수 시뮬레이션**: BiquadFilter lowpass 거리 연동
7. **환경 리버브**: ConvolverNode + 프로시저럴 IR (실내/야외/아레나)
8. **총기 라운드 로빈**: 3-4개 변형 + 피치/볼륨 랜덤화

### Phase 3: 프로 수준
9. **5-레이어 총기 사운드**: Body/Transient/Sub/Mechanical/Tail 분리
10. **연발 시스템**: Pre-fire/Sustain/Post-fire 3단계
11. **멀티모달 피드백**: 오디오+비주얼 동기화 히트 이펙트
12. **사운드 커스터마이즈**: 유저 WAV/OGG 임포트, 히트 사운드 선택

### Phase 4: 폴리시
13. **오디오 프로파일링**: 성능 티어 자동 감지 (Quality/Balanced/Performance)
14. **접근성**: 시각 사운드 인디케이터, 자막
15. **프로 프리셋**: CS2/Valorant/Apex 스타일 사운드 프리셋

---

## 참고 자료

### FPS 사운드 엔진
- Steam Audio C API Documentation — valvesoftware.github.io
- Apex Legends Sound Design — asoundeffect.com
- Miles Sound System — radgametools.com
- Dolby Atmos for Gaming — professional.dolby.com

### Web Audio API
- MDN Web Audio API — developer.mozilla.org
- W3C Web Audio API 1.1 Spec — w3.org/TR/webaudio-1.1
- Web Audio API Performance Notes — padenot.github.io
- Chrome Audio Worklet Design Pattern — developer.chrome.com
- Spotify Web Audio Bench — github.com/spotify/web-audio-bench

### 사운드 디자인
- GDC Vault: Weapon Sound Design (2011) — gdcvault.com
- Procedural Synthesis of Gunshot Sounds — SpringerLink
- Modal Synthesis of Weapon Sounds — Queen Mary University
- How to Design Weapon Sound for Video Games — Splice

### 심리음향학 & 모터 러닝
- Augmented Feedback on Motor Learning Systematic Review — PMC
- Auditory Information Accelerates Visuomotor Reaction Speed — Frontiers
- Sonification as Concurrent Augmented Feedback — ResearchGate
- Continuous Auditory Feedback Promotes Fine Motor Skill Learning — eNeuro

### 히트 사운드
- Aim Lab Custom Hit Sounds — player.one
- Kovaak's Sound Settings — wiki.kovaaks.com
- CS2 Audio Settings Analysis — zleague.gg
