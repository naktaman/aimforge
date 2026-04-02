/**
 * Aim DNA 자세 가이드
 * cm/360 감도 대역에 따른 자세 / 피벗 포인트 / 패드 크기 / 팔꿈치 위치 가이드
 * DNA의 wrist_arm_ratio, effective_range를 참고해 자동 분류
 */
import type { AimDnaProfile } from '../utils/types';

/** 감도 대역 분류 */
type SensBand = 'high' | 'mid' | 'low';

interface PostureData {
  band: SensBand;
  label: string;
  cm360Range: string;
  pivotPoint: string;
  elbowPosition: string;
  wristUsage: string;
  padSizeRecommend: string;
  liftOffFrequency: string;
  armMovement: string;
  tips: string[];
  watchOut: string[];
}

const POSTURE_DATA: PostureData[] = [
  {
    band: 'high',
    label: '고감도',
    cm360Range: '< 20 cm/360',
    pivotPoint: '손목 (손목이 패드 위의 고정점)',
    elbowPosition: '팔꿈치는 책상 모서리 근처에 고정, 전완을 살짝 올려 손목이 자유롭게 회전',
    wristUsage: '손목 주도 80% 이상 — 팔은 거의 이동하지 않음',
    padSizeRecommend: 'L (420×330mm) 이상이면 충분. XL은 불필요.',
    liftOffFrequency: '낮음 — 손목 회전으로 대부분 해결',
    armMovement: '손목 반경 이내. 전완은 고정 또는 미세 이동.',
    tips: [
      '손목이 마우스패드 위에서 미끄러지듯 회전해야 함 — 패드 표면 마찰이 일정해야 함',
      '클로 또는 핑거팁 그립 병행 시 시너지 최대',
      '손목 유연성 워밍업 5분이 퍼포먼스에 큰 영향',
      '스피드 계열 패드가 손목 피로 감소에 도움',
    ],
    watchOut: [
      '오버슈트가 잦다면 감도를 10% 낮추는 것 고려',
      '손목 터널 증후군 위험 — 장시간 세션 사이 스트레칭 필수',
    ],
  },
  {
    band: 'mid',
    label: '중감도',
    cm360Range: '20 ~ 40 cm/360',
    pivotPoint: '손목 + 전완 혼합 (자연스러운 복합 피벗)',
    elbowPosition: '팔꿈치는 책상에 자연스럽게 올려두고, 전완이 자유롭게 이동 가능한 높이 유지',
    wristUsage: '손목 50% + 팔 50% — 대상 거리에 따라 자동 전환',
    padSizeRecommend: 'L (420×330mm) ~ XL (480×400mm). 가로 여유 충분히.',
    liftOffFrequency: '중간 — 큰 이동 시 가끔 리프트',
    armMovement: '전완 20-30cm 범위 이동. 큰 플릭은 어깨까지 연계.',
    tips: [
      '손목-팔 전환 부드러움이 핵심 — 릴렉스드 클로 그립 추천',
      '팔꿈치가 자유롭게 슬라이딩 될 수 있는 책상 높이 확인',
      '컨트롤 계열 패드로 이동 중 정밀도 향상',
      '사격 직전 손목 고정 → 클릭 타이밍 일관성 향상',
    ],
    watchOut: [
      '팔꿈치가 책상 모서리에 걸리면 이동 범위 제한 — 패드 위치 재조정',
      '고감도와 저감도 사이 불일치가 느껴지면 DPI 조정으로 중간점 탐색',
    ],
  },
  {
    band: 'low',
    label: '저감도',
    cm360Range: '> 40 cm/360',
    pivotPoint: '어깨 + 팔꿈치 (팔 전체가 피벗 축)',
    elbowPosition: '팔꿈치는 책상에서 들려있거나 살짝 올라가 있어야 함 — 팔 전체 이동 시 마찰 최소화',
    wristUsage: '손목 이동 20% 이하 — 팔 전체가 주도',
    padSizeRecommend: 'XL (480×400mm) 최소. 데스크매트(900×400mm 이상) 적극 권장.',
    liftOffFrequency: '빈번 — 팔 재배치 위한 리프트오프 일상적',
    armMovement: '어깨부터 전완까지 50-80cm 범위 이동. 상체 자세 안정성이 중요.',
    tips: [
      '의자 높이를 낮춰 팔이 책상 위로 자유롭게 이동 가능하게 조정',
      '데스크매트 사용 시 전체 책상을 에임 공간으로 활용',
      '팜 그립이 저감도에서 가장 안정적 — 손바닥 전체 지지',
      '큰 이동 후 정착 시간이 길어지므로 트래킹 중심 게임에 강점',
      '어깨 근육 이완 후 세션 시작 — 상체 긴장이 경직된 이동 패턴 유발',
    ],
    watchOut: [
      '작은 마우스패드는 성능 병목 — 물리적 이동 제약',
      '스피드 패드에서 팔 브레이킹이 어려울 수 있음 — 컨트롤 패드 고려',
      '고감도 게임 전환 시 적응에 1-2주 소요',
    ],
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
  high: '#e94560',
  mid:  '#f5a623',
  low:  '#4ecdc4',
};

export function AimDnaPostureGuide({ cm360, dna }: Props) {
  /** 실제 cm360이 있으면 그걸 우선, 없으면 DNA 추정 */
  const band: SensBand = cm360
    ? classifySensBand(cm360)
    : (estimateSensBand(dna ?? null) ?? 'mid');

  const posture = POSTURE_DATA.find(p => p.band === band)!;

  return (
    <div className="posture-guide">
      <h3 className="posture-guide-title">자세 가이드</h3>

      {/* 감도 대역 선택 탭 */}
      <div className="posture-band-tabs">
        {POSTURE_DATA.map(p => (
          <div
            key={p.band}
            className={`posture-band-tab ${p.band === band ? 'active' : ''}`}
            style={p.band === band ? { borderBottomColor: BAND_COLOR[p.band] } : undefined}
          >
            <span className="posture-band-label">{p.label}</span>
            <span className="posture-band-range">{p.cm360Range}</span>
          </div>
        ))}
      </div>

      {/* 자세 상세 */}
      <div className="posture-detail">
        {/* 핵심 지표 카드 */}
        <div className="posture-metrics">
          <div className="posture-metric-card">
            <div className="posture-metric-label">피벗 포인트</div>
            <div className="posture-metric-val">{posture.pivotPoint}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">팔꿈치 위치</div>
            <div className="posture-metric-val">{posture.elbowPosition}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">손목 사용 비중</div>
            <div className="posture-metric-val">{posture.wristUsage}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">추천 패드 크기</div>
            <div className="posture-metric-val">{posture.padSizeRecommend}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">리프트오프 빈도</div>
            <div className="posture-metric-val">{posture.liftOffFrequency}</div>
          </div>
          <div className="posture-metric-card">
            <div className="posture-metric-label">팔 이동 범위</div>
            <div className="posture-metric-val">{posture.armMovement}</div>
          </div>
        </div>

        {/* 팁 */}
        <section className="posture-section">
          <h4>개선 팁</h4>
          <ul className="posture-tips">
            {posture.tips.map(tip => <li key={tip}>{tip}</li>)}
          </ul>
        </section>

        {/* 주의사항 */}
        <section className="posture-section">
          <h4>주의사항</h4>
          <ul className="posture-watchout">
            {posture.watchOut.map(w => <li key={w}>{w}</li>)}
          </ul>
        </section>
      </div>
    </div>
  );
}
