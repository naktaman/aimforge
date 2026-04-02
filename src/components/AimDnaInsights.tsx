/**
 * Aim DNA 인사이트 엔진
 * 기어 선택(마우스 + 마우스패드) + DNA 프로파일을 조합해 맞춤 인사이트 생성
 *
 * 인사이트 규칙:
 * - 저감도 + 작은 패드 → 더 큰 패드 추천
 * - 고감도 + 무거운 마우스 → 가벼운 마우스 고려
 * - 팔 중심(저 wrist_arm_ratio) + 스피드 패드 → 컨트롤 패드 추천
 * - 달인급 유저(평균 DNA 점수 80+) → 비용 필터 해제, 모든 개선 방법 동등 제시
 */
import type { AimDnaProfile } from '../utils/types';
import type { GearSelection } from './AimDnaSensitivitySelector';
import { computeRadarAxes } from '../utils/radarUtils';

export interface Insight {
  id: string;
  /** info | warn | tip | expert */
  type: 'info' | 'warn' | 'tip' | 'expert';
  title: string;
  body: string;
  /** 우선순위 — 낮을수록 상단 표시 */
  priority: number;
}

/** DNA 레이더 축 평균 점수 계산 */
function avgDnaScore(dna: AimDnaProfile): number {
  const axes = computeRadarAxes(dna);
  if (axes.length === 0) return 0;
  return axes.reduce((s, a) => s + a.value, 0) / axes.length;
}

/** 달인급 유저 판별 기준: 레이더 평균 80 이상 */
const EXPERT_THRESHOLD = 80;

/** 인사이트 생성 메인 함수 */
export function generateInsights(
  dna: AimDnaProfile,
  gear: GearSelection,
): Insight[] {
  const insights: Insight[] = [];
  const { mouse, mousepad } = gear;
  const isExpert = avgDnaScore(dna) >= EXPERT_THRESHOLD;

  // ── 기어 미선택 안내 ──────────────────────────────────────────────
  if (!mouse && !mousepad) {
    insights.push({
      id: 'no-gear',
      type: 'info',
      title: '기어 정보를 입력하면 더 정확한 인사이트를 제공합니다',
      body: '마우스와 마우스패드를 선택하면 기어 궁합과 개선 방향을 분석합니다.',
      priority: 99,
    });
    return insights;
  }

  // ── 패드 크기 vs 감도 궁합 ────────────────────────────────────────
  if (mousepad) {
    const padIsSmall = mousepad.size === 'large';
    const padIsTiny = !['xl', 'xxl', 'desk'].includes(mousepad.size);
    const effectiveRange = dna.effective_range ?? 90;
    const isLowSens = effectiveRange > 120;
    const isMidLowSens = effectiveRange > 90;

    if (isLowSens && padIsTiny) {
      insights.push({
        id: 'pad-too-small-low-sens',
        type: 'warn',
        title: '마우스패드가 저감도 플레이스타일에 비해 작습니다',
        body: `현재 ${mousepad.name}(${mousepad.dimensions_mm}mm)는 팔 전체 이동 저감도 플레이에 물리적 제약이 됩니다. XL(480×400mm) 이상 패드로 이동 범위를 확보하세요.`,
        priority: 1,
      });
    } else if (isMidLowSens && padIsSmall && !isExpert) {
      insights.push({
        id: 'pad-upgrade-mid-low',
        type: 'tip',
        title: '넓은 마우스패드가 중저감도 플레이에 유리합니다',
        body: 'XL 크기 패드는 팔 재배치 시 패드 경계 걱정 없이 자유롭게 이동할 수 있어 안정적인 플레이를 지원합니다.',
        priority: 10,
      });
    }
  }

  // ── 마우스 무게 vs 감도 궁합 ──────────────────────────────────────
  if (mouse) {
    const wristRatio = dna.wrist_arm_ratio ?? 0.5;
    const isHighSens = wristRatio > 0.6;
    const isHeavy = mouse.weight_g > 90;
    const isModerateHeavy = mouse.weight_g > 70;

    if (isHighSens && isHeavy) {
      insights.push({
        id: 'mouse-too-heavy-high-sens',
        type: 'warn',
        title: '고감도 손목 중심 플레이에 마우스가 무겁습니다',
        body: `${mouse.name}(${mouse.weight_g}g)은 손목 피로를 가중시킵니다. 60g 이하 경량 마우스(Logitech G Pro X Superlight 2, Finalmouse UltralightX 등)를 고려해보세요.`,
        priority: 2,
      });
    } else if (isHighSens && isModerateHeavy && isExpert) {
      insights.push({
        id: 'expert-mouse-weight',
        type: 'expert',
        title: '[달인] 마우스 무게 최적화 — 소폭 성능 향상 가능',
        body: `현재 ${mouse.weight_g}g에서 50g 이하로 전환 시 손목 가속도 응답에 미세한 이점이 발생할 수 있습니다. 테스트 후 결정하세요.`,
        priority: 20,
      });
    }
  }

  // ── 팔 중심 + 스피드 패드 불일치 ─────────────────────────────────
  if (mouse && mousepad) {
    const wristRatio = dna.wrist_arm_ratio ?? 0.5;
    const isArmDominant = wristRatio < 0.35;
    const isSpeedPad = mousepad.surface === 'speed';

    if (isArmDominant && isSpeedPad) {
      insights.push({
        id: 'arm-dominant-speed-pad',
        type: 'warn',
        title: '팔 중심 저감도 플레이에 스피드 패드는 브레이킹이 어렵습니다',
        body: `${mousepad.name}(스피드)은 팔 전체를 사용하는 저감도 플레이스타일에서 정지 직전 제어가 어렵습니다. 컨트롤 계열(Artisan Zero, LGG Saturn Pro, Zowie G-SR II 등)을 권장합니다.`,
        priority: 3,
      });
    }

    // 마우스 형태 vs 사용 패턴 불일치
    const isErgonomic = mouse.shape === 'ergonomic';
    const microFreq = dna.micro_freq ?? 0;
    const isHighMicro = microFreq > 0.5;

    if (isErgonomic && isHighMicro) {
      insights.push({
        id: 'ergonomic-vs-micro-flick',
        type: 'tip',
        title: '마이크로 플릭 빈도가 높습니다 — 시메트릭 마우스 고려',
        body: '에르고노믹 마우스는 손끝 미세 조작 시 손가락 위치 일관성이 시메트릭보다 떨어질 수 있습니다. 마이크로 플릭 빈도가 높은 플레이스타일엔 시메트릭/소형 마우스가 유리합니다.',
        priority: 8,
      });
    }
  }

  // ── 오버슈트 높음 ─────────────────────────────────────────────────
  if (dna.overshoot_avg !== null && dna.overshoot_avg > 0.04) {
    const war = dna.wrist_arm_ratio ?? 0.5;
    if (war > 0.6) {
      insights.push({
        id: 'overshoot-high-sens',
        type: 'warn',
        title: '오버슈트가 높습니다 — 감도를 10% 낮추는 것을 권장합니다',
        body: '손목 중심 고감도 플레이에서 지속적인 오버슈트는 근육 메모리 왜곡을 일으킵니다. 5-10% 감도 하향 후 2주간 적응하면 오버슈트가 감소하는 경향이 있습니다.',
        priority: 4,
      });
    }
  }

  // ── 피로 감쇠 높음 ────────────────────────────────────────────────
  if (dna.fatigue_decay !== null && dna.fatigue_decay > 0.05) {
    insights.push({
      id: 'fatigue-decay-high',
      type: 'info',
      title: '세션 후반 퍼포먼스 저하 감지 — 피로 관리 필요',
      body: '피로 감쇠 지수가 높습니다. 30분 세션 + 5분 스트레칭 사이클을 유지하고, 워밍업 루틴을 5분 이상 확보하세요.',
      priority: 15,
    });
  }

  // ── 방향 편향 ─────────────────────────────────────────────────────
  if (dna.direction_bias !== null && Math.abs(dna.direction_bias) > 0.1) {
    const dir = dna.direction_bias > 0 ? '오른쪽' : '왼쪽';
    insights.push({
      id: 'direction-bias',
      type: 'tip',
      title: `방향 편향 감지 — ${dir} 방향 플릭에 의존적`,
      body: `V/H 불균형이 있습니다. 반대 방향 플릭 드릴을 주 2회 추가하면 균형이 개선됩니다. 마우스패드를 살짝 회전시켜 자연스러운 스윙 각도를 맞추는 것도 도움이 됩니다.`,
      priority: 12,
    });
  }

  // ── 달인급 전용 — 추가 최적화 제안 ──────────────────────────────
  if (isExpert) {
    insights.push({
      id: 'expert-general',
      type: 'expert',
      title: '[달인] 모든 최적화 방법이 동등하게 유효합니다',
      body: '평균 DNA 점수 80+ 달성. 이 레벨에서는 기어 업그레이드, 감도 미세조정, 그립 전환 어느 것도 동등한 개선 가능성을 가집니다. 각 변수를 하나씩 격리 테스트하며 최적점을 탐색하세요.',
      priority: 5,
    });

    if (mouse && mouse.weight_g <= 60) {
      insights.push({
        id: 'expert-sensor-dpi',
        type: 'expert',
        title: '[달인] DPI 최적화 — 센서 LOD 튜닝 고려',
        body: `${mouse.name}의 센서(${mouse.sensor})에서 최적 DPI는 native 해상도 배수입니다. PAW3395 기반이면 800/1600/3200DPI가 네이티브. 다른 DPI는 내부 보간이 발생합니다.`,
        priority: 18,
      });
    }

    if (mousepad && mousepad.surface === 'hybrid') {
      insights.push({
        id: 'expert-pad-surface',
        type: 'expert',
        title: '[달인] 하이브리드 패드 — 마모 후 특성 변화 주의',
        body: '하이브리드 패드는 초기 스피드 → 사용 후 컨트롤 성향으로 변화합니다. 6개월 사용 후 동일 감도가 달리 느껴진다면 패드 교체 시점입니다.',
        priority: 25,
      });
    }
  }

  // 우선순위 오름차순 정렬
  return insights.sort((a, b) => a.priority - b.priority);
}

/** 인사이트 타입별 아이콘 */
const TYPE_ICON: Record<Insight['type'], string> = {
  info:   'ℹ',
  warn:   '⚠',
  tip:    '💡',
  expert: '★',
};

/** 인사이트 타입별 CSS 클래스 */
const TYPE_CLASS: Record<Insight['type'], string> = {
  info:   'insight-info',
  warn:   'insight-warn',
  tip:    'insight-tip',
  expert: 'insight-expert',
};

interface Props {
  dna: AimDnaProfile;
  gear: GearSelection;
}

export function AimDnaInsights({ dna, gear }: Props) {
  const insights = generateInsights(dna, gear);
  const avgScore = avgDnaScore(dna);
  const isExpert = avgScore >= EXPERT_THRESHOLD;

  return (
    <div className="aim-insights">
      <h3 className="aim-insights-title">
        인사이트
        {isExpert && <span className="expert-badge">달인급</span>}
      </h3>

      {isExpert && (
        <div className="expert-banner">
          평균 DNA 점수 {avgScore.toFixed(0)}점 — 달인급 분석 모드. 모든 개선 가능성이 동등하게 제시됩니다.
        </div>
      )}

      {insights.length === 0 ? (
        <p className="aim-insights-empty">현재 프로파일과 기어 조합에서 특이사항이 없습니다.</p>
      ) : (
        <ul className="aim-insights-list">
          {insights.map(ins => (
            <li key={ins.id} className={`insight-card ${TYPE_CLASS[ins.type]}`}>
              <div className="insight-header">
                <span className="insight-icon">{TYPE_ICON[ins.type]}</span>
                <strong className="insight-title">{ins.title}</strong>
              </div>
              <p className="insight-body">{ins.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
