/**
 * 위저드 Step 7: 약한 영역 재테스트
 * 하위 30% 시나리오 재실행 + 건너뛰기 + 추가 라운드
 */
import {
  STAGE_DESCRIPTIONS,
  type SensConversion,
  type WizardStep,
} from '../../stores/profileWizardStore';
import type { StageType } from '../../utils/types';

/** 재테스트 결과 항목 타입 */
interface RetestResult {
  stageType: StageType;
  score: number;
}

/** 재테스트 단계 Props */
export interface WizardStepRetestProps {
  t: (key: string) => string;
  /** 약한 영역 시나리오 타입 배열 */
  weakStages: StageType[];
  /** 현재 재테스트 라운드 번호 */
  retestRound: number;
  /** 재테스트 결과 배열 */
  retestResults: RetestResult[];
  /** 재테스트 시작/약한 영역 판별 핸들러 */
  handleStartRetest: () => void;
  /** 시나리오 훈련 시작 핸들러 */
  onStartTraining: (stageType: StageType) => void;
  /** GP 기반 감도 제안 cm/360 */
  suggestedCm360: number | null;
  /** 캘리브레이션 결과 cm/360 */
  calibratedCm360: number | null;
  /** 현재 감도 cm/360 */
  cmPer360: number;
  /** 프로파일 최종 확정 핸들러 */
  finalize: (cm360: number, conversions: SensConversion[]) => void;
  /** 감도 변환 계산 헬퍼 */
  computeConversions: (cm360: number) => SensConversion[];
  /** 특정 단계로 이동 핸들러 */
  goToStep: (step: WizardStep) => void;
}

/** 재테스트 단계 — 약한 영역 재실행 또는 건너뛰기 */
export function WizardStepRetest({
  t, weakStages, retestRound, retestResults,
  handleStartRetest, onStartTraining,
  suggestedCm360, calibratedCm360, cmPer360,
  finalize, computeConversions, goToStep,
}: WizardStepRetestProps) {
  return (
    <div className="pw-step">
      <h2>{t('wizard.weakRetest')}</h2>
      <p className="pw-description">
        {t('wizard.weakRetestDesc')}
      </p>

      {weakStages.length === 0 ? (
        <div className="pw-retest-start">
          <p>{t('wizard.analyzingWeak')}</p>
          <button className="btn-primary" onClick={handleStartRetest}>
            {t('wizard.identifyWeak')}
          </button>
          <button
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              /** 재테스트 건너뛰기 */
              const finalCm = suggestedCm360 ?? calibratedCm360 ?? cmPer360;
              finalize(finalCm, computeConversions(finalCm));
              goToStep('complete');
            }}
          >
            {t('common.skip')}
          </button>
        </div>
      ) : (
        <div className="pw-retest-progress">
          <p>{t('style.retestRound')} {retestRound} — {weakStages.length} {t('style.areas')}</p>
          <div className="pw-assessment-list">
            {weakStages.map((stage, i) => {
              const result = retestResults.find(r => r.stageType === stage);
              const isCurrent = !result && retestResults.length === i;
              return (
                <div
                  key={stage}
                  className={`pw-assessment-item ${result ? 'completed' : ''} ${isCurrent ? 'current' : ''}`}
                >
                  <div className="pw-assessment-num">{i + 1}</div>
                  <div className="pw-assessment-info">
                    <span className="pw-assessment-name">
                      {STAGE_DESCRIPTIONS[stage]?.name ?? stage}
                    </span>
                  </div>
                  {result && (
                    <span className="pw-assessment-score">{result.score.toFixed(0)}pts</span>
                  )}
                  {isCurrent && (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() => onStartTraining(stage)}
                    >
                      {t('common.start')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* 재테스트 완료 시 결과 보기 / 추가 라운드 */}
          {retestResults.length >= weakStages.length && (
            <div className="pw-retest-done">
              <p>{t('wizard.retestDone')}</p>
              <button
                className="btn-primary"
                onClick={() => {
                  const finalCm = suggestedCm360 ?? calibratedCm360 ?? cmPer360;
                  finalize(finalCm, computeConversions(finalCm));
                  goToStep('complete');
                }}
              >
                {t('wizard.viewResult')}
              </button>
              <button
                className="btn-secondary"
                style={{ marginLeft: 8 }}
                onClick={handleStartRetest}
              >
                {t('wizard.oneMoreTest')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
