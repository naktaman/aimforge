/**
 * Aim DNA 그립 가이드
 * Palm / Claw / Fingertip / Relaxed Claw 4가지 그립 바이오메카닉스 상세
 * SVG 일러스트 + 접촉점 / 장단점 / 감도 적합도 / 추천 마우스 형태 / 프로 비율
 */
import { useState } from 'react';
import { useTranslation } from '../i18n';
import type { AimDnaProfile } from '../utils/types';

type GripType = 'palm' | 'claw' | 'fingertip' | 'relaxed-claw';

/** 로케일별 텍스트를 담는 구조 */
interface LocaleText {
  ko: string[];
  en: string[];
}
interface LocaleSingle {
  ko: string;
  en: string;
}

interface GripData {
  id: GripType;
  /** i18n 키 (grip.palm, grip.claw 등) */
  nameKey: string;
  contactPoints: LocaleText;
  pros: LocaleText;
  cons: LocaleText;
  /** 고감도(<20cm/360) / 중감도(20-40) / 저감도(>40) 적합도 1-5 */
  sensMatch: { high: number; mid: number; low: number };
  /** 추천 마우스 형태 */
  recommendedShape: string[];
  /** 프로 선수 사용 비율 (%) */
  proPct: number;
  /** DNA 피처 연관성 설명 */
  dnaRelevance: LocaleSingle;
}

const GRIPS: GripData[] = [
  {
    id: 'palm',
    nameKey: 'grip.palm',
    contactPoints: {
      ko: [
        '손바닥 전체가 마우스 등면 접촉',
        '손가락 마디 전체가 버튼에 닿음',
        '손목은 패드에 고정되거나 가볍게 올라감',
      ],
      en: [
        'Entire palm rests on mouse back',
        'All finger joints touch the buttons',
        'Wrist rests on pad or slightly raised',
      ],
    },
    pros: {
      ko: [
        '피로감 가장 낮음 — 장시간 플레이에 유리',
        '팔 전체 이동이 자연스러워 저감도에 최적',
        '마우스 컨트롤 안정적, 떨림 억제',
        '큰 각도 플릭(90-180°) 정확도 우수',
      ],
      en: [
        'Lowest fatigue — ideal for long sessions',
        'Natural full-arm movement, optimal for low sensitivity',
        'Stable mouse control, suppresses tremor',
        'Excellent accuracy for wide-angle flicks (90-180°)',
      ],
    },
    cons: {
      ko: [
        '손가락 미세조정(마이크로 플릭) 불리',
        '고감도에서 오버슈트 발생 가능',
        '작은 마우스에서 불편함',
      ],
      en: [
        'Weak at finger micro-adjustments (micro flicks)',
        'Overshoot possible at high sensitivity',
        'Uncomfortable with small mice',
      ],
    },
    sensMatch: { high: 2, mid: 3, low: 5 },
    recommendedShape: ['ergonomic', 'semi-ergo'],
    proPct: 28,
    dnaRelevance: {
      ko: 'wrist_arm_ratio가 낮을수록(팔 중심) 팜 그립 적합성 증가. arm_accuracy 지표에 직접 반영.',
      en: 'Lower wrist_arm_ratio (arm-dominant) increases palm grip suitability. Directly reflected in arm_accuracy.',
    },
  },
  {
    id: 'claw',
    nameKey: 'grip.claw',
    contactPoints: {
      ko: [
        '손바닥 뒷부분과 마우스 뒤쪽만 접촉',
        '손가락은 1~2마디에서 굽혀 버튼 끝을 누름',
        '손목이 공중에 뜬 상태로 유지',
      ],
      en: [
        'Only back of palm contacts the mouse rear',
        'Fingers arched at 1st-2nd joint, pressing button tips',
        'Wrist stays elevated off the pad',
      ],
    },
    pros: {
      ko: [
        '클릭 반응속도 빠름 — 손가락이 짧게 이동',
        '손목+팔 혼합 이동 자유로움',
        '중·고감도 구간에서 정밀도 우수',
        '마이크로 플릭(5-15°) 강점',
      ],
      en: [
        'Fast click response — short finger travel distance',
        'Free wrist+arm hybrid movement',
        'Excellent precision at mid-high sensitivity',
        'Strong micro-flick capability (5-15°)',
      ],
    },
    cons: {
      ko: [
        '장시간 사용 시 손가락 피로 누적',
        '큰 마우스에서 불편함',
        '그립 일관성 유지가 팜보다 어려움',
      ],
      en: [
        'Finger fatigue accumulates over long sessions',
        'Uncomfortable with large mice',
        'Harder to maintain consistent grip than palm',
      ],
    },
    sensMatch: { high: 4, mid: 5, low: 3 },
    recommendedShape: ['symmetric', 'ergonomic'],
    proPct: 42,
    dnaRelevance: {
      ko: 'micro_freq(마이크로 플릭 빈도)가 높고 wrist_arm_ratio가 높은(손목 중심) 유저에 적합. finger_accuracy 향상에 기여.',
      en: 'Suited for users with high micro_freq and high wrist_arm_ratio (wrist-dominant). Contributes to finger_accuracy improvement.',
    },
  },
  {
    id: 'fingertip',
    nameKey: 'grip.fingertip',
    contactPoints: {
      ko: [
        '손가락 끝부분만 마우스에 접촉',
        '손바닥은 마우스에 닿지 않음',
        '손목은 완전히 공중에 뜸',
      ],
      en: [
        'Only fingertips contact the mouse',
        'Palm does not touch the mouse',
        'Wrist fully elevated',
      ],
    },
    pros: {
      ko: [
        '손가락 단독 미세조정 극대화',
        '고감도에서 오버슈트 교정 능력 탁월',
        '클릭 타이밍 정밀도 최고 수준',
        '리프트오프 후 재배치 빠름',
      ],
      en: [
        'Maximizes finger-only micro-adjustments',
        'Excellent overshoot correction at high sensitivity',
        'Top-tier click timing precision',
        'Fast repositioning after lift-off',
      ],
    },
    cons: {
      ko: [
        '큰 이동(저감도) 불리 — 팔 이동과 조합 어려움',
        '오래 쓰면 손가락 떨림 가능',
        '작은 마우스 필수 — 큰 마우스 부적합',
        '피로 관리 중요',
      ],
      en: [
        'Disadvantaged for large movements (low sens) — hard to combine with arm',
        'Finger tremor possible after prolonged use',
        'Requires small mouse — large mice unsuitable',
        'Fatigue management is critical',
      ],
    },
    sensMatch: { high: 5, mid: 3, low: 1 },
    recommendedShape: ['symmetric'],
    proPct: 18,
    dnaRelevance: {
      ko: 'finger_accuracy가 높고 effective_range가 좁은(고감도형) 유저에 최적. pre_aim_ratio도 높은 경향.',
      en: 'Optimal for users with high finger_accuracy and narrow effective_range (high-sens type). Tends to have high pre_aim_ratio.',
    },
  },
  {
    id: 'relaxed-claw',
    nameKey: 'grip.relaxedClaw',
    contactPoints: {
      ko: [
        '손바닥 뒤쪽이 마우스에 살짝 올라감',
        '손가락은 클로보다 적게 굽혀 버튼 중간을 누름',
        '손목은 낮게 유지하거나 살짝 부유',
      ],
      en: [
        'Back of palm lightly rests on the mouse',
        'Fingers less arched than claw, pressing mid-button',
        'Wrist kept low or slightly floating',
      ],
    },
    pros: {
      ko: [
        '팜과 클로의 장점을 결합한 하이브리드',
        '피로도와 정밀도 균형 우수',
        '가장 많은 유저가 자연스럽게 사용',
        '중감도 구간(20-40cm/360) 최적',
      ],
      en: [
        'Hybrid combining palm and claw advantages',
        'Excellent fatigue-precision balance',
        'Most naturally adopted by users',
        'Optimal for mid sensitivity (20-40cm/360)',
      ],
    },
    cons: {
      ko: [
        '특정 강점이 없는 올라운드형',
        '극고감도/극저감도 상황에선 전문화 그립보다 불리',
      ],
      en: [
        'All-rounder without a specific strength',
        'Disadvantaged vs specialized grips at extreme sensitivities',
      ],
    },
    sensMatch: { high: 3, mid: 5, low: 4 },
    recommendedShape: ['symmetric', 'ergonomic', 'semi-ergo'],
    proPct: 12,
    dnaRelevance: {
      ko: 'type_label이 hybrid인 유저에 가장 많이 관찰. wrist_arm_ratio 0.4-0.6 구간과 상관성 높음.',
      en: 'Most commonly observed in hybrid type_label users. High correlation with wrist_arm_ratio 0.4-0.6 range.',
    },
  },
];

/** 적합도 별점 렌더링 */
function MatchBar({ score }: { score: number }) {
  return (
    <div className="grip-match-bar">
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className={`grip-match-dot ${i < score ? 'active' : ''}`}
        />
      ))}
    </div>
  );
}

/** 그립 SVG 일러스트 — 간략한 손 실루엣 */
function GripSvg({ type }: { type: GripType }) {
  /** 각 그립에 따라 손 모양을 단순 SVG로 표현 */
  const configs: Record<GripType, { palmY: number; fingerCurve: number; label: string }> = {
    palm:           { palmY: 70, fingerCurve: 5,  label: '손바닥 전체 접촉' },
    claw:           { palmY: 85, fingerCurve: 25, label: '손가락 굽힘' },
    fingertip:      { palmY: 95, fingerCurve: 50, label: '손끝만 접촉' },
    'relaxed-claw': { palmY: 78, fingerCurve: 15, label: '중간 자세' },
  };
  const { palmY, fingerCurve, label } = configs[type];

  return (
    <svg viewBox="0 0 100 120" className="grip-svg" aria-label={label}>
      {/* 마우스 본체 */}
      <rect x="20" y="50" width="60" height="65" rx="14" fill="#2a2a3a" stroke="#444" strokeWidth="1.5" />
      {/* 왼쪽 버튼 */}
      <path d="M20,64 Q25,50 50,50 L50,80 L20,80 Z" fill="#1e1e2e" stroke="#555" strokeWidth="1" />
      {/* 오른쪽 버튼 */}
      <path d="M80,64 Q75,50 50,50 L50,80 L80,80 Z" fill="#232333" stroke="#555" strokeWidth="1" />
      {/* 휠 */}
      <rect x="44" y="55" width="12" height="18" rx="4" fill="#333" stroke="#666" strokeWidth="1" />

      {/* 손 — 손바닥 */}
      <ellipse
        cx="50" cy={palmY}
        rx="26" ry="18"
        fill="#c8a97e"
        opacity="0.85"
      />

      {/* 손가락 — 굽힘 정도를 fingerCurve로 표현 */}
      {[33, 41, 50, 59, 67].map((x, i) => {
        const baseY = palmY - 14;
        const tip = i === 4
          ? baseY - 12 + fingerCurve * 0.4   /* 엄지 */
          : baseY - 18 + fingerCurve;
        return (
          <path
            key={i}
            d={`M${x},${baseY} Q${x + (i === 4 ? -4 : 0)},${(baseY + tip) / 2} ${x},${tip}`}
            stroke="#c8a97e"
            strokeWidth={i === 4 ? 6 : 5}
            fill="none"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

/** DNA 기반 그립 추천 판단 */
function suggestGrip(dna: AimDnaProfile | null): GripType | null {
  if (!dna) return null;
  const war = dna.wristArmRatio ?? 0.5;
  const micro = dna.microFreq ?? 0;
  const fingerAcc = dna.fingerAccuracy ?? 0.5;

  // 팔 중심 + 낮은 마이크로 플릭 → 팜
  if (war < 0.35 && micro < 0.3) return 'palm';
  // 손목 중심 + 높은 마이크로 플릭 → 클로
  if (war > 0.6 && micro > 0.5) return 'claw';
  // 고감도형 + 높은 핑거 정확도 → 핑거팁
  if (fingerAcc > 0.75 && war > 0.7) return 'fingertip';
  // 그 외 → 릴렉스드 클로
  return 'relaxed-claw';
}

interface Props {
  dna?: AimDnaProfile | null;
}

export function AimDnaGripGuide({ dna }: Props) {
  const { t, locale } = useTranslation();
  const suggested = suggestGrip(dna ?? null);
  const [selected, setSelected] = useState<GripType>(suggested ?? 'claw');

  const grip = GRIPS.find(g => g.id === selected)!;
  /** 현재 로케일에 맞는 텍스트 선택 헬퍼 */
  const pick = (data: LocaleText) => locale === 'ko' ? data.ko : data.en;
  const pickS = (data: LocaleSingle) => locale === 'ko' ? data.ko : data.en;

  return (
    <div className="grip-guide">
      <h3 className="grip-guide-title">{t('grip.title')}</h3>

      {/* DNA 추천 배너 */}
      {suggested && (
        <div className="grip-suggestion-banner">
          {t('grip.dnaSuggestion')}
          <strong> {t(GRIPS.find(g => g.id === suggested)?.nameKey ?? '')}</strong>
        </div>
      )}

      {/* 그립 탭 선택 */}
      <div className="grip-tabs" role="tablist" aria-label={t('dna.gripGuide')}>
        {GRIPS.map(g => (
          <button
            key={g.id}
            role="tab"
            aria-selected={selected === g.id}
            className={`grip-tab ${selected === g.id ? 'active' : ''} ${suggested === g.id ? 'suggested' : ''}`}
            onClick={() => setSelected(g.id)}
          >
            {t(g.nameKey)}
            {suggested === g.id && <span className="grip-tab-star">★</span>}
          </button>
        ))}
      </div>

      {/* 선택된 그립 상세 */}
      <div className="grip-detail">
        {/* SVG + 메타 */}
        <div className="grip-visual">
          <GripSvg type={selected} />
          <div className="grip-pro-stat">
            {t('grip.proUsage')} {grip.proPct}%
          </div>
        </div>

        <div className="grip-info">
          {/* 접촉점 */}
          <section className="grip-section">
            <h4>{t('grip.contactPoints')}</h4>
            <ul>
              {pick(grip.contactPoints).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </section>

          {/* 감도 적합도 */}
          <section className="grip-section">
            <h4>{t('grip.sensCompatibility')}</h4>
            <div className="grip-match-grid">
              <div className="grip-match-row">
                <span>{t('grip.highSens')}</span>
                <MatchBar score={grip.sensMatch.high} />
              </div>
              <div className="grip-match-row">
                <span>{t('grip.midSens')}</span>
                <MatchBar score={grip.sensMatch.mid} />
              </div>
              <div className="grip-match-row">
                <span>{t('grip.lowSens')}</span>
                <MatchBar score={grip.sensMatch.low} />
              </div>
            </div>
          </section>

          {/* 추천 마우스 형태 */}
          <section className="grip-section">
            <h4>{t('grip.recommendedMouseShape')}</h4>
            <div className="grip-shape-tags">
              {grip.recommendedShape.map(s => (
                <span key={s} className="grip-shape-tag">
                  {s === 'symmetric' ? t('gear.symmetric') : s === 'ergonomic' ? t('gear.ergonomic') : t('gear.semiErgo')}
                </span>
              ))}
            </div>
          </section>

          {/* 장단점 */}
          <section className="grip-section">
            <h4>{t('grip.pros')}</h4>
            <ul className="grip-pros">
              {pick(grip.pros).map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <h4 style={{ marginTop: 8 }}>{t('grip.cons')}</h4>
            <ul className="grip-cons">
              {pick(grip.cons).map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </section>

          {/* DNA 연관성 */}
          <section className="grip-section grip-dna-note">
            <h4>{t('grip.dnaRelevance')}</h4>
            <p>{pickS(grip.dnaRelevance)}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
