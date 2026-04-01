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

/** 우선순위 구간별 CSS modifier 반환 */
function priorityModifier(priority: number): string {
  if (priority > 70) return 'prescription-priority--high';
  if (priority > 40) return 'prescription-priority--mid';
  return 'prescription-priority--low';
}

export default function TrainingPrescription({ onBack, onTrainingStart, profileId }: Props) {
  const { prescriptions, isLoading, loadPrescriptions, selectPrescription } = useTrainingStore();
  const [sourceFilter, setSourceFilter] = useState<'all' | 'single_game' | 'cross_game'>('all');

  /** 초기 로드 */
  useEffect(() => {
    loadPrescriptions(profileId);
  }, [profileId, loadPrescriptions]);

  /** 필터 적용된 처방 목록 */
  const filtered = sourceFilter === 'all'
    ? prescriptions
    : prescriptions.filter(p => p.source_type === sourceFilter);

  return (
    <div className="page">
      {/* 헤더 */}
      <div className="page-header">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← 뒤로</button>
        <h2>훈련 처방</h2>
      </div>

      {/* 소스 필터 탭 + 새로고침 버튼 */}
      <div className="page-header">
        <div className="tab-group">
          {(['all', 'single_game', 'cross_game'] as const).map(tab => (
            <button
              key={tab}
              className={`tab-item${sourceFilter === tab ? ' active' : ''}`}
              onClick={() => setSourceFilter(tab)}
            >
              {tab === 'all' ? '전체' : tab === 'single_game' ? '단일 게임' : '크로스게임'}
            </button>
          ))}
        </div>
        <button
          className="btn btn--secondary btn--sm ml-auto"
          onClick={() => loadPrescriptions(profileId)}
          disabled={isLoading}
        >
          {isLoading ? '분석 중...' : '처방 새로고침'}
        </button>
      </div>

      {/* 빈 상태 */}
      {filtered.length === 0 && !isLoading && (
        <div className="empty-state">
          <p className="empty-state__text">
            처방 데이터가 없습니다. 먼저 Aim DNA 배터리를 실행하세요.
          </p>
        </div>
      )}

      {/* 처방 목록 */}
      <div className="prescription-list">
        {filtered.map((p, i) => (
          <div key={i} className="glass-card glass-card--compact prescription-card">
            {/* 우선순위 뱃지 */}
            <div className={`prescription-priority ${priorityModifier(p.priority)}`}>
              {Math.round(p.priority)}
            </div>

            {/* 내용 */}
            <div className="prescription-body">
              <div className="prescription-tags">
                <span className={`badge ${p.source_type === 'cross_game' ? 'badge--accent' : 'badge--info'}`}>
                  {p.source_type === 'cross_game' ? '크로스게임' : '단일 게임'}
                </span>
                <span className="badge badge--danger">
                  {WEAKNESS_LABELS[p.weakness] || p.weakness}
                </span>
              </div>
              <div className="text-base font-semibold">{p.description}</div>
              <div className="prescription-meta">
                시나리오: {p.scenario_type} · 예상 {p.estimated_min}분
              </div>
            </div>

            {/* 시작 버튼 */}
            <button
              className="btn btn--primary btn--sm"
              onClick={() => {
                selectPrescription(p);
                onTrainingStart(p.scenario_type, p.scenario_params);
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
