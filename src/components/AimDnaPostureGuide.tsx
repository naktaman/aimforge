/**
 * Aim DNA 자세 가이드
 * cm/360 감도 대역에 따른 자세 / 피벗 포인트 / 패드 크기 / 팔꿈치 위치 가이드
 * DNA의 wrist_arm_ratio, effective_range를 참고해 자동 분류
 */
import { useTranslation } from '../i18n';
import type { AimDnaProfile } from '../utils/types';

/** 감도 대역 분류 */
type SensBand = 'high' | 'mid' | 'low';

/** 로케일별 텍스트 */
interface LocaleSingle { ko: string; en: string; }
interface LocaleArray { ko: string[]; en: string[]; }

interface PostureData {
  band: SensBand;
  /** i18n 키 (posture.highSens 등) */
  labelKey: string;
  cm360Range: string;
  pivotPoint: LocaleSingle;
  elbowPosition: LocaleSingle;
  wristUsage: LocaleSingle;
  padSizeRecommend: LocaleSingle;
  liftOffFrequency: LocaleSingle;
  armMovement: LocaleSingle;
  tips: LocaleArray;
  watchOut: LocaleArray;
}

const POSTURE_DATA: PostureData[] = [
  {
    band: 'high',
    labelKey: 'posture.highSens',
    cm360Range: '< 20 cm/360',
    pivotPoint: {
      ko: '손목 (손목이 패드 위의 고정점)',
      en: 'Wrist (wrist as pivot point on pad)',
    },
    elbowPosition: {
      ko: '팔꿈치는 책상 모서리 근처에 고정, 전완을 살짝 올려 손목이 자유롭게 회전',
      en: 'Elbow fixed near desk edge, forearm slightly raised for free wrist rotation',
    },
    wristUsage: {
      ko: '손목 주도 80% 이상 — 팔은 거의 이동하지 않음',
      en: 'Wrist-dominant 80%+ — arm barely moves',
    },
    padSizeRecommend: {
      ko: 'L (420×330mm) 이상이면 충분. XL은 불필요.',
      en: 'L (420×330mm) or larger is sufficient. XL unnecessary.',
    },
    liftOffFrequency: {
      ko: '낮음 — 손목 회전으로 대부분 해결',
      en: 'Low — mostly handled by wrist rotation',
    },
    armMovement: {
      ko: '손목 반경 이내. 전완은 고정 또는 미세 이동.',
      en: 'Within wrist radius. Forearm stays fixed or micro-moves.',
    },
    tips: {
      ko: [
        '손목이 마우스패드 위에서 미끄러지듯 회전해야 함 — 패드 표면 마찰이 일정해야 함',
        '클로 또는 핑거팁 그립 병행 시 시너지 최대',
        '손목 유연성 워밍업 5분이 퍼포먼스에 큰 영향',
        '스피드 계열 패드가 손목 피로 감소에 도움',
      ],
      en: [
        'Wrist should glide and rotate on the pad — consistent pad surface friction required',
        'Maximum synergy when combined with claw or fingertip grip',
        '5 minutes of wrist flexibility warmup significantly affects performance',
        'Speed-type pads help reduce wrist fatigue',
      ],
    },
    watchOut: {
      ko: [
        '오버슈트가 잦다면 감도를 10% 낮추는 것 고려',
        '손목 터널 증후군 위험 — 장시간 세션 사이 스트레칭 필수',
      ],
      en: [
        'If overshoot is frequent, consider lowering sensitivity by 10%',
        'Carpal tunnel risk — stretching between long sessions is essential',
      ],
    },
  },
  {
    band: 'mid',
    labelKey: 'posture.midSens',
    cm360Range: '20 ~ 40 cm/360',
    pivotPoint: {
      ko: '손목 + 전완 혼합 (자연스러운 복합 피벗)',
      en: 'Wrist + forearm hybrid (natural compound pivot)',
    },
    elbowPosition: {
      ko: '팔꿈치는 책상에 자연스럽게 올려두고, 전완이 자유롭게 이동 가능한 높이 유지',
      en: 'Elbow rests naturally on desk, maintain height for free forearm movement',
    },
    wristUsage: {
      ko: '손목 50% + 팔 50% — 대상 거리에 따라 자동 전환',
      en: 'Wrist 50% + arm 50% — auto-switches based on target distance',
    },
    padSizeRecommend: {
      ko: 'L (420×330mm) ~ XL (480×400mm). 가로 여유 충분히.',
      en: 'L (420×330mm) to XL (480×400mm). Ensure ample horizontal space.',
    },
    liftOffFrequency: {
      ko: '중간 — 큰 이동 시 가끔 리프트',
      en: 'Medium — occasional lift during large movements',
    },
    armMovement: {
      ko: '전완 20-30cm 범위 이동. 큰 플릭은 어깨까지 연계.',
      en: 'Forearm moves 20-30cm range. Large flicks engage up to shoulder.',
    },
    tips: {
      ko: [
        '손목-팔 전환 부드러움이 핵심 — 릴렉스드 클로 그립 추천',
        '팔꿈치가 자유롭게 슬라이딩 될 수 있는 책상 높이 확인',
        '컨트롤 계열 패드로 이동 중 정밀도 향상',
        '사격 직전 손목 고정 → 클릭 타이밍 일관성 향상',
      ],
      en: [
        'Smooth wrist-arm transition is key — relaxed claw grip recommended',
        'Ensure desk height allows elbow to slide freely',
        'Control-type pads improve precision during movement',
        'Lock wrist before shooting → improved click timing consistency',
      ],
    },
    watchOut: {
      ko: [
        '팔꿈치가 책상 모서리에 걸리면 이동 범위 제한 — 패드 위치 재조정',
        '고감도와 저감도 사이 불일치가 느껴지면 DPI 조정으로 중간점 탐색',
      ],
      en: [
        'If elbow catches desk edge, movement range is limited — readjust pad position',
        'If mismatch between high/low sens is felt, explore middle ground via DPI adjustment',
      ],
    },
  },
  {
    band: 'low',
    labelKey: 'posture.lowSens',
    cm360Range: '> 40 cm/360',
    pivotPoint: {
      ko: '어깨 + 팔꿈치 (팔 전체가 피벗 축)',
      en: 'Shoulder + elbow (entire arm acts as pivot)',
    },
    elbowPosition: {
      ko: '팔꿈치는 책상에서 들려있거나 살짝 올라가 있어야 함 — 팔 전체 이동 시 마찰 최소화',
      en: 'Elbow should be lifted or slightly raised from desk — minimize friction during full arm movement',
    },
    wristUsage: {
      ko: '손목 이동 20% 이하 — 팔 전체가 주도',
      en: 'Wrist movement under 20% — full arm dominant',
    },
    padSizeRecommend: {
      ko: 'XL (480×400mm) 최소. 데스크매트(900×400mm 이상) 적극 권장.',
      en: 'XL (480×400mm) minimum. Desk mat (900×400mm+) strongly recommended.',
    },
    liftOffFrequency: {
      ko: '빈번 — 팔 재배치 위한 리프트오프 일상적',
      en: 'Frequent — regular lift-offs for arm repositioning',
    },
    armMovement: {
      ko: '어깨부터 전완까지 50-80cm 범위 이동. 상체 자세 안정성이 중요.',
      en: 'Shoulder to forearm 50-80cm range movement. Upper body posture stability is critical.',
    },
    tips: {
      ko: [
        '의자 높이를 낮춰 팔이 책상 위로 자유롭게 이동 가능하게 조정',
        '데스크매트 사용 시 전체 책상을 에임 공간으로 활용',
        '팜 그립이 저감도에서 가장 안정적 — 손바닥 전체 지지',
        '큰 이동 후 정착 시간이 길어지므로 트래킹 중심 게임에 강점',
        '어깨 근육 이완 후 세션 시작 — 상체 긴장이 경직된 이동 패턴 유발',
      ],
      en: [
        'Lower chair height to allow free arm movement above desk',
        'With desk mat, use entire desk as aiming space',
        'Palm grip is most stable at low sensitivity — full palm support',
        'Longer settling time after large movements, so strong in tracking-focused games',
        'Start sessions after shoulder muscle relaxation — upper body tension causes rigid movement patterns',
      ],
    },
    watchOut: {
      ko: [
        '작은 마우스패드는 성능 병목 — 물리적 이동 제약',
        '스피드 패드에서 팔 브레이킹이 어려울 수 있음 — 컨트롤 패드 고려',
        '고감도 게임 전환 시 적응에 1-2주 소요',
      ],
      en: [
        'Small mousepad is a performance bottleneck — physical movement constraint',
        'Arm braking can be difficult on speed pads — consider control pads',
        'Switching to high-sens games requires 1-2 weeks adaptation',
      ],
    },
  },
];

/** cm/360로 감도 대역 분류 */
function classifySensBand(cm360: number): SensBand {
  if (cm360 < 20) return 'high';
  if (cm360 <= 40) return 'mid';
  return 'low';
}

/** DNA에서 추정 cm/360 범위 도출 */
function estimateSensBand(dna: AimDnaProfile | null): SensBand | null {
  if (!dna) return null;
  // effectiveRange가 넓으면 저감도, 좁으면 고감도
  const range = dna.effectiveRange;
  if (range !== null) {
    if (range > 120) return 'low';
    if (range < 60) return 'high';
    return 'mid';
  }
  // wristArmRatio: 높으면 고감도, 낮으면 저감도
  const war = dna.wristArmRatio;
  if (war !== null) {
    if (war > 0.6) return 'high';
    if (war < 0.35) return 'low';
    return 'mid';
  }
  return 'mid';
}

interface Props {
  /** 현재 cm/360 — 알면 직접 넘김 */
  cm360?: number | null;
  /** DNA 프로파일 — cm360 없을 때 추정에 사용 */
  dna?: AimDnaProfile | null;
}

const BAND_COLOR: Record<SensBand, string> = {
  high: '#f87171',
  mid:  '#8A9AB5',
  low:  '#4ecdc4',
};

export function AimDnaPostureGuide({ cm360, dna }: Props) {
  const { t, locale } = useTranslation();

  /** 실제 cm360이 있으면 그걸 우선, 없으면 DNA 추정 */
  const band: SensBand = cm360
    ? classifySensBand(cm360)
    : (estimateSensBand(dna ?? null) ?? 'mid');

  const posture = POSTURE_DATA.find(p => p.band === band)!;

  /** 현재 로케일에 맞는 텍스트 선택 헬퍼 */
  const pickS = (data: LocaleSingle) => locale === 'ko' ? data.ko : data.en;
  const pickA = (data: LocaleArray) => locale === 'ko' ? data.ko : data.en;

  return (
    <div className="posture-guide">
      <h3 className="posture-guide-title">{t('posture.title')}</h3>

      {/* 감도 대역 선택 탭 */}
      <div className="posture-band-tabs" role="tablist" aria-label={t('posture.title')}>
        {POSTURE_DATA.map(p => (
          <div
            key={p.band}
            role="tab"
            aria-selected={p.band === band}
            className={`posture-band-tab ${p.band === band ? 'active' : ''}`}
            style={p.band === band ? { borderBottomColor: BAND_COLOR[p.band] } : undefined}
          >
            <span className="posture-band-label">{t(p.labelKey)}</span>
            <span className="posture-band-range">{p.cm360Range}</span>
          </div>
        ))}
      </div>

      {/* 자세 상세 */}
      <div className="posture-detail">
        {/* 핵심 지표 카드 */}
        <div className="posture-metrics">
          <div className="posture-metric-card">
            <div className="posture-metric-label">{t('posture.pivotPoint')}</div>
            <div className="posture-metric-val">{pickS(posture.pivotPoint)}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">{t('posture.elbowPosition')}</div>
            <div className="posture-metric-val">{pickS(posture.elbowPosition)}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">{t('posture.wristUsage')}</div>
            <div className="posture-metric-val">{pickS(posture.wristUsage)}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">{t('posture.padSizeRecommend')}</div>
            <div className="posture-metric-val">{pickS(posture.padSizeRecommend)}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">{t('posture.liftOffFrequency')}</div>
            <div className="posture-metric-val">{pickS(posture.liftOffFrequency)}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">{t('posture.armMovement')}</div>
            <div className="posture-metric-val">{pickS(posture.armMovement)}</div>
          </div>
        </div>

        {/* 팁 */}
        <section className="posture-section">
          <h4>{t('posture.tips')}</h4>
          <ul className="posture-tips">
            {pickA(posture.tips).map((tip, i) => <li key={i}>{tip}</li>)}
          </ul>
        </section>

        {/* 주의사항 */}
        <section className="posture-section">
          <h4>{t('posture.watchOut')}</h4>
          <ul className="posture-watchout">
            {pickA(posture.watchOut).map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
