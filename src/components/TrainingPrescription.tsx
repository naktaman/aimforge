/**
 * 훈련 처방 화면
 * Aim DNA 약점 기반 시나리오 자동 추천 + 크로스게임 갭 처방
 */
import { useState, useEffect } from 'react';
import { useTrainingStore } from '../stores/trainingStore';

interface Props {
  onBack: () => void;
  /** 처방 시나리오 시작 콜백 */
  onTrainingStart: (stageType: string, params: Record<string, unknown>) => void;
  profileId: number;
}

/** 약점 한국어 라벨 */
const WEAKNESS_LABELS: Record<string, string> = {
  overshoot: '오버슈팅',
  direction_bias: '방향 편향',
  tracking_mad: '트래킹 정밀도',
  phase_lag: '페이즈 래그',
  smoothness: '스무드니스',
  v_h_ratio: '수직 약점',
  motor_transition: '운동체계 전환',
  effective_range: '유효 사거리',
  finger_accuracy: '근접 정밀도',
  fatigue: '피로 저항',
  sens_mismatch: '감도 불일치',
  movement_unadapted: '무빙 미적응',
  style_mismatch: '스타일 불일치',
  transition_narrowed: '전환점 축소',
  vertical_weakness_exposed: '수직 약점 노출',
};

/** 우선순위별 색상 */
function priorityColor(priority: number): string {
  if (priority > 70) return '#e94560';
  if (priority > 40) return '#f5a623';
  return '#4ade80';
}

export default function TrainingPrescription({ onBack, onTrainingStart, profileId }: Props) {
  const { prescriptions, isLoading, loadPrescriptions, selectPrescription } = useTrainingStore();
  const [sourceFilter, setSourceFilter] = useState<'all' | 'single_game' | 'cross_game'>('all');

  // 초기 로드
  useEffect(() => {
    loadPrescriptions(profileId);
  }, [profileId, loadPrescriptions]);

  const filtered = sourceFilter === 'all'
    ? prescriptions
    : prescriptions.filter(p => p.source_type === sourceFilter);

  return (
    <div style={{ padding: 32, maxWidth: 900, margin: '0 auto', color: '#e0e0e0' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={btnStyle}>← 뒤로</button>
        <h2 style={{ margin: 0, fontSize: 22 }}>훈련 처방</h2>
      </div>

      {/* 소스 필터 탭 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['all', 'single_game', 'cross_game'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setSourceFilter(tab)}
            style={{
              ...tabStyle,
              background: sourceFilter === tab ? '#3b82f6' : '#2a2a3e',
              color: sourceFilter === tab ? '#fff' : '#aaa',
            }}
          >
            {tab === 'all' ? '전체' : tab === 'single_game' ? '단일 게임' : '크로스게임'}
          </button>
        ))}
        <button
          onClick={() => loadPrescriptions(profileId)}
          style={{ ...btnStyle, marginLeft: 'auto' }}
          disabled={isLoading}
        >
          {isLoading ? '분석 중...' : '처방 새로고침'}
        </button>
      </div>

      {/* 처방 목록 */}
      {filtered.length === 0 && !isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          처방 데이터가 없습니다. 먼저 Aim DNA 배터리를 실행하세요.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map((p, i) => (
          <div
            key={i}
            style={{
              background: '#1e1e30',
              borderRadius: 10,
              padding: 16,
              border: `1px solid ${priorityColor(p.priority)}33`,
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            {/* 우선순위 뱃지 */}
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: `${priorityColor(p.priority)}22`,
              border: `2px solid ${priorityColor(p.priority)}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: priorityColor(p.priority),
              flexShrink: 0,
            }}>
              {Math.round(p.priority)}
            </div>

            {/* 내용 */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: p.source_type === 'cross_game' ? '#8b5cf622' : '#3b82f622',
                  color: p.source_type === 'cross_game' ? '#a78bfa' : '#60a5fa',
                }}>
                  {p.source_type === 'cross_game' ? '크로스게임' : '단일 게임'}
                </span>
                <span style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 4,
                  background: '#ef444422', color: '#f87171',
                }}>
                  {WEAKNESS_LABELS[p.weakness] || p.weakness}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{p.description}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                시나리오: {p.scenario_type} · 예상 {p.estimated_min}분
              </div>
            </div>

            {/* 시작 버튼 */}
            <button
              onClick={() => {
                selectPrescription(p);
                onTrainingStart(p.scenario_type, p.scenario_params);
              }}
              style={{
                ...btnStyle,
                background: '#3b82f6',
                padding: '8px 20px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              시작
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#2a2a3e',
  color: '#e0e0e0',
  border: 'none',
  borderRadius: 6,
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 13,
};

const tabStyle: React.CSSProperties = {
  ...btnStyle,
  padding: '8px 16px',
  borderRadius: 8,
  fontWeight: 500,
};
