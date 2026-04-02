/**
 * Aim DNA 그립 가이드
 * Palm / Claw / Fingertip / Relaxed Claw 4가지 그립 바이오메카닉스 상세
 * SVG 일러스트 + 접촉점 / 장단점 / 감도 적합도 / 추천 마우스 형태 / 프로 비율
 */
import { useState } from 'react';
import type { AimDnaProfile } from '../utils/types';

type GripType = 'palm' | 'claw' | 'fingertip' | 'relaxed-claw';

interface GripData {
  id: GripType;
  name: string;
  nameKo: string;
  contactPoints: string[];
  pros: string[];
  cons: string[];
  /** 고감도(<20cm/360) / 중감도(20-40) / 저감도(>40) 적합도 1-5 */
  sensMatch: { high: number; mid: number; low: number };
  /** 추천 마우스 형태 */
  recommendedShape: string[];
  /** 프로 선수 사용 비율 (%) */
  proPct: number;
  /** DNA 피처 연관성 설명 */
  dnaRelevance: string;
}

const GRIPS: GripData[] = [
  {
    id: 'palm',
    name: 'Palm',
    nameKo: '팜 그립',
    contactPoints: [
      '손바닥 전체가 마우스 등면 접촉',
      '손가락 마디 전체가 버튼에 닿음',
      '손목은 패드에 고정되거나 가볍게 올라감',
    ],
    pros: [
      '피로감 가장 낮음 — 장시간 플레이에 유리',
      '팔 전체 이동이 자연스러워 저감도에 최적',
      '마우스 컨트롤 안정적, 떨림 억제',
      '큰 각도 플릭(90-180°) 정확도 우수',
    ],
    cons: [
      '손가락 미세조정(마이크로 플릭) 불리',
      '고감도에서 오버슈트 발생 가능',
      '작은 마우스에서 불편함',
    ],
    sensMatch: { high: 2, mid: 3, low: 5 },
    recommendedShape: ['ergonomic', 'semi-ergo'],
    proPct: 28,
    dnaRelevance: 'wrist_arm_ratio가 낮을수록(팔 중심) 팜 그립 적합성 증가. arm_accuracy 지표에 직접 반영.',
  },
  {
    id: 'claw',
    name: 'Claw',
    nameKo: '클로 그립',
    contactPoints: [
      '손바닥 뒷부분과 마우스 뒤쪽만 접촉',
      '손가락은 1~2마디에서 굽혀 버튼 끝을 누름',
      '손목이 공중에 뜬 상태로 유지',
    ],
    pros: [
      '클릭 반응속도 빠름 — 손가락이 짧게 이동',
      '손목+팔 혼합 이동 자유로움',
      '중·고감도 구간에서 정밀도 우수',
      '마이크로 플릭(5-15°) 강점',
    ],
    cons: [
      '장시간 사용 시 손가락 피로 누적',
      '큰 마우스에서 불편함',
      '그립 일관성 유지가 팜보다 어려움',
    ],
    sensMatch: { high: 4, mid: 5, low: 3 },
    recommendedShape: ['symmetric', 'ergonomic'],
    proPct: 42,
    dnaRelevance: 'micro_freq(마이크로 플릭 빈도)가 높고 wrist_arm_ratio가 높은(손목 중심) 유저에 적합. finger_accuracy 향상에 기여.',
  },
  {
    id: 'fingertip',
    name: 'Fingertip',
    nameKo: '핑거팁 그립',
    contactPoints: [
      '손가락 끝부분만 마우스에 접촉',
      '손바닥은 마우스에 닿지 않음',
      '손목은 완전히 공중에 뜸',
    ],
    pros: [
      '손가락 단독 미세조정 극대화',
      '고감도에서 오버슈트 교정 능력 탁월',
      '클릭 타이밍 정밀도 최고 수준',
      '리프트오프 후 재배치 빠름',
    ],
    cons: [
      '큰 이동(저감도) 불리 — 팔 이동과 조합 어려움',
      '오래 쓰면 손가락 떨림 가능',
      '작은 마우스 필수 — 큰 마우스 부적합',
      '피로 관리 중요',
    ],
    sensMatch: { high: 5, mid: 3, low: 1 },
    recommendedShape: ['symmetric'],
    proPct: 18,
    dnaRelevance: 'finger_accuracy가 높고 effective_range가 좁은(고감도형) 유저에 최적. pre_aim_ratio도 높은 경향.',
  },
  {
    id: 'relaxed-claw',
    name: 'Relaxed Claw',
    nameKo: '릴렉스드 클로 그립',
    contactPoints: [
      '손바닥 뒤쪽이 마우스에 살짝 올라감',
      '손가락은 클로보다 적게 굽혀 버튼 중간을 누름',
      '손목은 낮게 유지하거나 살짝 부유',
    ],
    pros: [
      '팜과 클로의 장점을 결합한 하이브리드',
      '피로도와 정밀도 균형 우수',
      '가장 많은 유저가 자연스럽게 사용',
      '중감도 구간(20-40cm/360) 최적',
    ],
    cons: [
      '특정 강점이 없는 올라운드형',
      '극고감도/극저감도 상황에선 전문화 그립보다 불리',
    ],
    sensMatch: { high: 3, mid: 5, low: 4 },
    recommendedShape: ['symmetric', 'ergonomic', 'semi-ergo'],
    proPct: 12,
    dnaRelevance: 'type_label이 hybrid인 유저에 가장 많이 관찰. wrist_arm_ratio 0.4-0.6 구간과 상관성 높음.',
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
  const suggested = suggestGrip(dna ?? null);
  const [selected, setSelected] = useState<GripType>(suggested ?? 'claw');

  const grip = GRIPS.find(g => g.id === selected)!;

  return (
    <div className="grip-guide">
      <h3 className="grip-guide-title">그립 가이드</h3>

      {/* DNA 추천 배너 */}
      {suggested && (
        <div className="grip-suggestion-banner">
          DNA 분석 기반 추천 그립:
          <strong> {GRIPS.find(g => g.id === suggested)?.nameKo}</strong>
        </div>
      )}

      {/* 그립 탭 선택 */}
      <div className="grip-tabs">
        {GRIPS.map(g => (
          <button
            key={g.id}
            className={`grip-tab ${selected === g.id ? 'active' : ''} ${suggested === g.id ? 'suggested' : ''}`}
            onClick={() => setSelected(g.id)}
          >
            {g.nameKo}
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
            프로 선수 {grip.proPct}% 사용
          </div>
        </div>

        <div className="grip-info">
          {/* 접촉점 */}
          <section className="grip-section">
            <h4>접촉점</h4>
            <ul>
              {grip.contactPoints.map(p => <li key={p}>{p}</li>)}
            </ul>
          </section>

          {/* 감도 적합도 */}
          <section className="grip-section">
            <h4>감도 적합도</h4>
            <div className="grip-match-grid">
              <div className="grip-match-row">
                <span>고감도 (&lt;20 cm/360)</span>
                <MatchBar score={grip.sensMatch.high} />
              </div>
              <div className="grip-match-row">
                <span>중감도 (20-40 cm/360)</span>
                <MatchBar score={grip.sensMatch.mid} />
              </div>
              <div className="grip-match-row">
                <span>저감도 (&gt;40 cm/360)</span>
                <MatchBar score={grip.sensMatch.low} />
              </div>
            </div>
          </section>

          {/* 추천 마우스 형태 */}
          <section className="grip-section">
            <h4>추천 마우스 형태</h4>
            <div className="grip-shape-tags">
              {grip.recommendedShape.map(s => (
                <span key={s} className="grip-shape-tag">
                  {s === 'symmetric' ? '시메트릭' : s === 'ergonomic' ? '에르고노믹' : '세미에르고'}
                </span>
              ))}
            </div>
          </section>

          {/* 장단점 */}
          <section className="grip-section">
            <h4>장점</h4>
            <ul className="grip-pros">
              {grip.pros.map(p => <li key={p}>{p}</li>)}
            </ul>
            <h4 style={{ marginTop: 8 }}>단점</h4>
            <ul className="grip-cons">
              {grip.cons.map(c => <li key={c}>{c}</li>)}
            </ul>
          </section>

          {/* DNA 연관성 */}
          <section className="grip-section grip-dna-note">
            <h4>DNA 연관 지표</h4>
            <p>{grip.dnaRelevance}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
