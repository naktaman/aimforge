/**
 * 위저드 Step 4: 감도 캘리브레이션
 * 캘리브레이션 시작/건너뛰기 + 결과 표시
 */

/** 캘리브레이션 단계 Props */
export interface WizardStepCalibrationProps {
  t: (key: string) => string;
  /** 캘리브레이션 결과 cm/360 (null이면 미완료) */
  calibratedCm360: number | null;
  /** 현재 감도 cm/360 (건너뛰기 시 사용) */
  cmPer360: number;
  /** 캘리브레이션 시작 핸들러 */
  onStartCalibration: () => void;
  /** 캘리브레이션 결과 설정 핸들러 */
  setCalibrationResult: (cm360: number) => void;
}

/** 캘리브레이션 단계 — 감도 측정 또는 건너뛰기 */
export function WizardStepCalibration({
  t, calibratedCm360, cmPer360, onStartCalibration, setCalibrationResult,
}: WizardStepCalibrationProps) {
  return (
    <div className="pw-step">
      <h2>{t('wizard.sensCalibration')}</h2>
      <p className="pw-description">
        {t('wizard.sensCalDesc')}
      </p>
      {calibratedCm360 ? (
        <div className="pw-calibration-done">
          <div className="pw-result-badge">
            <span className="pw-result-value">{calibratedCm360.toFixed(1)}</span>
            <span className="pw-result-unit">cm/360</span>
          </div>
          <p>{t('wizard.calDone')}</p>
        </div>
      ) : (
        <div className="pw-calibration-start">
          <p>{t('wizard.notCalibrated')}</p>
          <button className="btn-primary" onClick={onStartCalibration}>
            {t('wizard.startCal')}
          </button>
          <button
            className="btn-secondary"
            style={{ marginTop: 12 }}
            onClick={() => {
              /** 캘리브레이션 건너뛰기 — 현재 감도 사용 */
              setCalibrationResult(cmPer360);
            }}
          >
            {t('wizard.skipCal')}
          </button>
        </div>
      )}
    </div>
  );
}
