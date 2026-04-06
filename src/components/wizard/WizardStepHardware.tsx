/**
 * 위저드 Step 3: 하드웨어 설정
 * DPI, 모니터 해상도, 주사율 입력
 */

/** 하드웨어 단계 Props */
export interface WizardStepHardwareProps {
  t: (key: string) => string;
  /** 마우스 DPI */
  dpi: number;
  /** DPI 변경 핸들러 */
  setWizardDpi: (v: number) => void;
  /** 모니터 가로 해상도 */
  monitorWidth: number;
  /** 모니터 세로 해상도 */
  monitorHeight: number;
  /** 주사율 */
  refreshRate: number;
  /** 하드웨어 설정 일괄 업데이트 핸들러 */
  setHardware: (dpi: number, w: number, h: number, hz: number) => void;
}

/** 하드웨어 설정 단계 — DPI, 해상도, 주사율 입력 */
export function WizardStepHardware({
  t, dpi, setWizardDpi, monitorWidth, monitorHeight, refreshRate, setHardware,
}: WizardStepHardwareProps) {
  return (
    <div className="pw-step">
      <h2>{t('wizard.hardwareSettings')}</h2>
      <p className="pw-description">{t('wizard.hardwareDesc')}</p>

      <div className="pw-hardware-grid">
        <div className="pw-field">
          <label>{t('wizard.mouseDpi')}</label>
          <input
            type="number"
            min={100}
            max={32000}
            step={50}
            value={dpi}
            onChange={e => setWizardDpi(Number(e.target.value) || 800)}
          />
        </div>
        <div className="pw-field">
          <label>{t('wizard.monitorWidth')}</label>
          <input
            type="number"
            min={800}
            max={7680}
            value={monitorWidth}
            onChange={e => setHardware(
              dpi,
              Number(e.target.value) || 1920,
              monitorHeight,
              refreshRate,
            )}
          />
        </div>
        <div className="pw-field">
          <label>{t('wizard.monitorHeight')}</label>
          <input
            type="number"
            min={600}
            max={4320}
            value={monitorHeight}
            onChange={e => setHardware(
              dpi,
              monitorWidth,
              Number(e.target.value) || 1080,
              refreshRate,
            )}
          />
        </div>
        <div className="pw-field">
          <label>{t('wizard.refreshRate')}</label>
          <select
            value={refreshRate}
            onChange={e => setHardware(
              dpi,
              monitorWidth,
              monitorHeight,
              Number(e.target.value),
            )}
          >
            <option value={60}>60 Hz</option>
            <option value={75}>75 Hz</option>
            <option value={120}>120 Hz</option>
            <option value={144}>144 Hz</option>
            <option value={165}>165 Hz</option>
            <option value={240}>240 Hz</option>
            <option value={360}>360 Hz</option>
          </select>
        </div>
      </div>
    </div>
  );
}
