/**
 * 위저드 Step 6: 결과 분석
 * Aim DNA 5축 레이더 요약 + 감도 제안 + 시나리오 점수 요약
 */
import { STAGE_DESCRIPTIONS } from '../../stores/profileWizardStore';
import type { StageType, AimDnaProfile } from '../../utils/types';

/** 점검 결과 항목 타입 */
interface AssessmentResult {
  stageType: StageType;
  score: number;
}

/** 분석 단계 Props */
export interface WizardStepAnalysisProps {
  t: (key: string) => string;
  /** Aim DNA 분석 결과 (null이면 미분석) */
  aimDna: AimDnaProfile | null;
  /** GP 기반 감도 제안 cm/360 */
  suggestedCm360: number | null;
  /** 전체 점검 결과 배열 */
  assessmentResults: AssessmentResult[];
  /** 분석 시작 핸들러 */
  handleAnalyze: () => void;
}

/** 분석 단계 — DNA 5축 + 감도 제안 + 점수 요약 */
export function WizardStepAnalysis({
  t, aimDna, suggestedCm360, assessmentResults, handleAnalyze,
}: WizardStepAnalysisProps) {
  return (
    <div className="pw-step">
      <h2>{t('wizard.dnaAnalysis')}</h2>
      <p className="pw-description">
        {t('wizard.dnaAnalysisDesc')}
      </p>

      {!aimDna ? (
        <div className="pw-analysis-start">
          <button className="btn-primary" onClick={handleAnalyze}>
            {t('wizard.startAnalysis')}
          </button>
        </div>
      ) : (
        <div className="pw-analysis-result">
          {/* 레이더 차트 간소화 — 5축 점수 표시 */}
          <div className="pw-radar-summary">
            <h3>{t('wizard.aimSummary')}</h3>
            {aimDna.typeLabel && (
              <div className="pw-type-badge">{aimDna.typeLabel}</div>
            )}
            <div className="pw-radar-grid">
              <div className="pw-radar-axis">
                <span className="pw-radar-label">{t('wizard.flickSpeed')}</span>
                <div className="pw-radar-bar">
                  <div
                    className="pw-radar-fill"
                    style={{ width: `${Math.min((aimDna.flickPeakVelocity ?? 0) / 10 * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="pw-radar-axis">
                <span className="pw-radar-label">{t('wizard.trackingAccuracy')}</span>
                <div className="pw-radar-bar">
                  <div
                    className="pw-radar-fill"
                    style={{ width: `${Math.max(100 - (aimDna.trackingMad ?? 5) * 20, 0)}%` }}
                  />
                </div>
              </div>
              <div className="pw-radar-axis">
                <span className="pw-radar-label">{t('wizard.smoothnessLabel')}</span>
                <div className="pw-radar-bar">
                  <div
                    className="pw-radar-fill"
                    style={{ width: `${(aimDna.smoothness ?? 0) * 100}%` }}
                  />
                </div>
              </div>
              <div className="pw-radar-axis">
                <span className="pw-radar-label">{t('wizard.overshootSuppression')}</span>
                <div className="pw-radar-bar">
                  <div
                    className="pw-radar-fill"
                    style={{ width: `${Math.max(100 - (aimDna.overshootAvg ?? 5) * 10, 0)}%` }}
                  />
                </div>
              </div>
              <div className="pw-radar-axis">
                <span className="pw-radar-label">{t('wizard.velocityMatching')}</span>
                <div className="pw-radar-bar">
                  <div
                    className="pw-radar-fill"
                    style={{ width: `${(aimDna.velocityMatch ?? 0) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 감도 제안 */}
          {suggestedCm360 && (
            <div className="pw-sens-suggestion">
              <h3>{t('wizard.sensSuggestion')}</h3>
              <div className="pw-result-badge">
                <span className="pw-result-value">{suggestedCm360.toFixed(1)}</span>
                <span className="pw-result-unit">cm/360</span>
              </div>
            </div>
          )}

          {/* 점검 점수 요약 */}
          <div className="pw-scores-summary">
            <h3>{t('wizard.scenarioScores')}</h3>
            <div className="pw-scores-grid">
              {assessmentResults.map(r => (
                <div key={r.stageType} className="pw-score-item">
                  <span className="pw-score-name">
                    {STAGE_DESCRIPTIONS[r.stageType]?.name ?? r.stageType}
                  </span>
                  <span className={`pw-score-value ${r.score < (Math.max(...assessmentResults.map(x => x.score)) * 0.7) ? 'weak' : ''}`}>
                    {r.score.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
