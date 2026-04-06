# VooChu 딥리서치 아카이브

> VooChu 프로젝트 관련 딥리서치 결과물. 이 파일은 VooChu 레포 docs/research/README.md로 이식 필요.

---

## 1. 화자 임베딩 모델 성능 비교

WeSpeaker ResNet34 (현재 사용) vs 상위 모델 벤치마크.

**핵심 결론**: WeSpeaker ResNet34 (EER 0.723%)은 이미 경쟁력 있음. EN 멤버끼리 뭉치는 원인은 모델 한계가 아니라 "같은 언어 = 분별 신호 부족" 때문.

| 모델 | EER (%) | 파라미터 |
|------|---------|----------|
| WeSpeaker ResNet34 (LM) | 0.723 | ~6.6M (현재) |
| WeSpeaker ResNet293 (LM) | 0.425 | 28.6M |
| WeSpeaker SimAM_ResNet100 (VoxBlink2) | 0.202 | 50.2M |
| WeSpeaker CAM++ | 0.659 | 7.18M (추론 2x 빠름) |
| NVIDIA TitaNet-Large | 0.66 | 25M |

**실질 권장**: ResNet293 또는 CAM++ 업그레이드, cross-filter 임계값 언어별 adaptive threshold 적용.

---

## 2. 하지메 자막 비교 분석

はじめ語 음운 변환 규칙 매핑 + VooChu 시스템 개선 전략.

**핵심 규칙**: サ行→タ行, ラ行→ダ行/ナ行, エ段 연모음화, 어말 모음 추가

**개선 전략 (우선순위순)**:
1. Haiku 번역 프롬프트에 역변환 규칙 명시 (즉시 적용, 비용 0)
2. known_misrecognitions.json 화자 조건부 확장 (~100줄)
3. Qwen3-ASR system prompt 동적 주입
4. hajime_reverse_phonology.py 규칙 기반 역변환 (~570줄)

**한계**: タ行이 원래 タ행인지 サ행 변환인지 음운만으로 구분 불가 → LLM 문맥 추론 병행 시 80-90%

---

## 3. 하지메 STT 개선 방안 리서치

7가지 방법 평가. **최종 권장: 방법 3+4 조합 (하이브리드 라우팅 + Haiku 프롬프트 보정)**.

| 방법 | 효과 | 복잡도 | 런칭 전 가능 |
|------|------|--------|-------------|
| 1. Qwen3-ASR LoRA | 10-20% WER↓ | 중-상 | 빠듯함 |
| 2. Hotword/Vocab Biasing | 낮음-중간 | 매우 낮음 | **즉시** |
| **3. 하이브리드 라우팅** | **15-24% WER↓** | **중간** | **가능 (3-4일)** |
| **4. Haiku 프롬프트 보정** | 낮음-중간 | **매우 낮음** | **즉시** |
| 5. Whisper initial_prompt | 매우 낮음 | 매우 낮음 | 즉시 |
| 6. N-best 재순위 | 높음 (60-70%) | 높음 | 아니오 |
| 7. 전용 소형 모델 | 매우 높음 | 높음 | 아니오 |

**라우팅 아키텍처**: 하지메 채널 → Whisper+LoRA, 나머지 → Qwen3-ASR
**VRAM**: 두 모델 동시 로딩 8-10GB/24GB (여유 충분)
**기존 코드 활용**: training/ 디렉토리 Whisper LoRA 코드 재개 가능

---

*마지막 업데이트: 2026-04-06*
