/**
 * 위저드 Step 5: 전체 점검 (풀 어세스먼트)
 * 5종 시나리오 순차 실행 + 점수 표시
 */
import {
  ASSESSMENT_STAGES,
  STAGE_DESCRIPTIONS,
} from '../../stores/profileWizardStore';
import type { StageType } from '../../utils/types';

/** 점검 결과 항목 타입 */
interface AssessmentResult {
  stageType: StageType;
  score: number;
}

/** 전체 점검 단계 Props */
export interface WizardStepAssessmentProps {
  t: (key: string) => string;
  /** 점검 진행 중 여부 */
  assessmentRunning: boolean;
  /** 완료된 점검 결과 배열 */
  assessmentResults: AssessmentResult[];
  /** 현재 진행 중인 시나리오 인덱스 */
  assessmentIndex: number;
  /** 현재 점검 시나리오 타입 (null이면 대기 중) */
  currentAssessmentStage: StageType | null;
  /** 점검 시작 핸들러 */
  handleStartAssessment: () => void;
  /** 시나리오 훈련 시작 핸들러 */
  onStartTraining: (stageType: StageType) => void;
}

/** 전체 점검 단계 — 시나리오 순차 실행 및 점수 수집 */
export function WizardStepAssessment({
  t, assessmentRunning, assessmentResults, assessmentIndex,
  currentAssessmentStage, handleStartAssessment, onStartTraining,
}: WizardStepAssessmentProps) {
  return (
    <div className="pw-step">
      <h2>{t('wizard.fullAssessment')}</h2>
      <p className="pw-description">
        {t('wizard.fullAssessmentDesc')}
      </p>

      {/* 시나리오 목록 */}
      <div className="pw-assessment-list">
        {ASSESSMENT_STAGES.map((stage, i) => {
          const info = STAGE_DESCRIPTIONS[stage];
          const result = assessmentResults.find(r => r.stageType === stage);
          const isCurrent = assessmentRunning && i === assessmentIndex;
          return (
            <div
              key={stage}
              className={`pw-assessment-item ${result ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
            >
              <div className="pw-assessment-num">{i + 1}</div>
              <div className="pw-assessment-info">
                <span className="pw-assessment-name">{info?.name ?? stage}</span>
                <span className="pw-assessment-desc">{info?.description ?? ''}</span>
              </div>
              {result && (
                <span className="pw-assessment-score">{result.score.toFixed(0)}pts</span>
              )}
              {isCurrent && !result && (
                <span className="pw-assessment-badge">{t('common.inProgress')}</span>
              )}
            </div>
          );
        })}
      </div>

      {/* 점검 컨트롤 */}
      {!assessmentRunning && assessmentResults.length === 0 && (
        <button className="btn-primary" onClick={handleStartAssessment}>
          {t('wizard.startAssessment')}
        </button>
      )}

      {/* 현재 시나리오 시작 프롬프트 */}
      {assessmentRunning && currentAssessmentStage && (
        <div className="pw-current-scenario">
          <h3>{STAGE_DESCRIPTIONS[currentAssessmentStage]?.name}</h3>
          <p>{STAGE_DESCRIPTIONS[currentAssessmentStage]?.description}</p>
          <button
            className="btn-primary"
            onClick={() => onStartTraining(currentAssessmentStage)}
          >
            {t('wizard.startScenario')}
          </button>
        </div>
      )}

      {/* 전체 완료 */}
      {!assessmentRunning && assessmentResults.length >= ASSESSMENT_STAGES.length && (
        <div className="pw-assessment-done">
          <p>{t('wizard.assessmentDone')}</p>
        </div>
      )}
    </div>
  );
}
