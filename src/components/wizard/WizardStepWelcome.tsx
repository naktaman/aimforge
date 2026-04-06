/**
 * 위저드 Step 1: 환영 화면
 * 프로파일 생성 플로우 소개 및 단계 미리보기
 */

/** 번역 함수 타입 */
interface WizardStepWelcomeProps {
  t: (key: string) => string;
}

/** 환영 단계 — 5단계 플로우 미리보기 표시 */
export function WizardStepWelcome({ t }: WizardStepWelcomeProps) {
  return (
    <div className="pw-step">
      <h2>{t('wizard.createProfile')}</h2>
      <p className="pw-description">
        {t('wizard.profileDesc')}
      </p>
      <div className="pw-flow-preview">
        <div className="pw-flow-item">
          <span className="pw-flow-num">1</span>
          <span>{t('wizard.step1')}</span>
        </div>
        <div className="pw-flow-item">
          <span className="pw-flow-num">2</span>
          <span>{t('wizard.step2')}</span>
        </div>
        <div className="pw-flow-item">
          <span className="pw-flow-num">3</span>
          <span>{t('wizard.step3')}</span>
        </div>
        <div className="pw-flow-item">
          <span className="pw-flow-num">4</span>
          <span>{t('wizard.step4')}</span>
        </div>
        <div className="pw-flow-item">
          <span className="pw-flow-num">5</span>
          <span>{t('wizard.step5')}</span>
        </div>
      </div>
      <p className="pw-note">
        {t('wizard.timeEstimate')}
      </p>
    </div>
  );
}
