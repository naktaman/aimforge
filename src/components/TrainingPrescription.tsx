/**
 * 훈련 처방 화면
 * Aim DNA 약점 기반 시나리오 자동 추천 + 크로스게임 갭 처방
 */
import { useState, useEffect } from 'react';
import { useTrainingStore } from '../stores/trainingStore';
import { useTranslation } from '../i18n';

interface Props {
  onBack: () => void;
  /** 처방 시나리오 시작 콜백 */
  onTrainingStart: (stageType: string, params: Record<string, unknown>) => void;
  profileId: number;
}

/** 약점 i18n 키 매핑 */
const WEAKNESS_KEYS: Record<string, string> = {
  overshoot: 'prescription.overshoot',
  direction_bias: 'prescription.directionBias',
  tracking_mad: 'prescription.trackingPrecision',
  phase_lag: 'prescription.phaseLag',
  smoothness: 'prescription.smoothness',
  v_h_ratio: 'prescription.verticalWeakness',
  motor_transition: 'prescription.motorTransition',
  effective_range: 'prescription.effectiveRange',
  finger_accuracy: 'prescription.fingerAccuracy',
  fatigue: 'prescription.fatigue',
  sens_mismatch: 'prescription.sensMismatch',
  movement_unadapted: 'prescription.movementUnadapted',
  style_mismatch: 'prescription.styleMismatch',
  transition_narrowed: 'prescription.transitionNarrowed',
  vertical_weakness_exposed: 'prescription.verticalExposed',
};

/** 우선순위 구간별 CSS modifier 반환 */
function priorityModifier(priority: number): string {
  if (priority > 70) return 'prescription-priority--high';
  if (priority > 40) return 'prescription-priority--mid';
  return 'prescription-priority--low';
}

export default function TrainingPrescription({ onBack, onTrainingStart, profileId }: Props) {
  const { t } = useTranslation();
  const { prescriptions, isLoading, loadPrescriptions, selectPrescription } = useTrainingStore();
  const [sourceFilter, setSourceFilter] = useState<'all' | 'single_game' | 'cross_game'>('all');

  /** 초기 로드 */
  useEffect(() => {
    loadPrescriptions(profileId);
  }, [profileId, loadPrescriptions]);

  /** 필터 적용된 처방 목록 */
  const filtered = sourceFilter === 'all'
    ? prescriptions
    : prescriptions.filter(p => p.sourceType === sourceFilter);

  return (
    <div className="page">
      {/* 헤더 */}
      <div className="page-header">
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← {t('common.back')}</button>
        <h2>{t('prescription.title')}</h2>
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
              {tab === 'all' ? t('common.all') : tab === 'single_game' ? t('prescription.singleGame') : t('prescription.crossGame')}
            </button>
          ))}
        </div>
        <button
          className="btn btn--secondary btn--sm ml-auto"
          onClick={() => loadPrescriptions(profileId)}
          disabled={isLoading}
        >
          {isLoading ? t('prescription.refreshing') : t('prescription.refreshBtn')}
        </button>
      </div>

      {/* 빈 상태 */}
      {filtered.length === 0 && !isLoading && (
        <div className="empty-state">
          <p className="empty-state__text">
            {t('prescription.noData')}
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
                <span className={`badge ${p.sourceType === 'cross_game' ? 'badge--accent' : 'badge--info'}`}>
                  {p.sourceType === 'cross_game' ? t('prescription.crossGame') : t('prescription.singleGame')}
                </span>
                <span className="badge badge--danger">
                  {WEAKNESS_KEYS[p.weakness] ? t(WEAKNESS_KEYS[p.weakness]) : p.weakness}
                </span>
              </div>
              <div className="text-base font-semibold">{p.description}</div>
              <div className="prescription-meta">
                {t('prescription.scenario')}: {p.scenarioType} · {t('prescription.estimated')} {p.estimatedMin} {t('prescription.min')}
              </div>
            </div>

            {/* 시작 버튼 */}
            <button
              className="btn btn--primary btn--sm"
              onClick={() => {
                selectPrescription(p);
                onTrainingStart(p.scenarioType, p.scenarioParams);
              }}
            >
              {t('common.start')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
