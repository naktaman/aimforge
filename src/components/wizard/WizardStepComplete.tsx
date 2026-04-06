/**
 * 위저드 Step 8: 완료
 * 최종 감도, Aim DNA 타입, 게임별 감도 변환 테이블, 저장 버튼
 */
import type { SensConversion } from '../../stores/profileWizardStore';
import type { AimDnaProfile } from '../../utils/types';

/** 완료 단계 Props */
export interface WizardStepCompleteProps {
  t: (key: string) => string;
  /** 최종 확정 cm/360 */
  finalCm360: number | null;
  /** Aim DNA 분석 결과 */
  aimDna: AimDnaProfile | null;
  /** 게임별 감도 변환 목록 */
  sensConversions: SensConversion[];
  /** 프로필 저장 핸들러 */
  handleComplete: () => Promise<void>;
  /** 위저드 닫기 핸들러 */
  onClose: () => void;
}

/** 완료 단계 — 최종 결과 표시 + 저장 */
export function WizardStepComplete({
  t, finalCm360, aimDna, sensConversions, handleComplete, onClose,
}: WizardStepCompleteProps) {
  return (
    <div className="pw-step">
      <h2>{t('wizard.profileComplete')}</h2>

      {/* 최종 감도 */}
      <div className="pw-final-result">
        <div className="pw-result-badge large">
          <span className="pw-result-value">{finalCm360?.toFixed(1) ?? '—'}</span>
          <span className="pw-result-unit">cm/360</span>
        </div>
      </div>

      {/* Aim DNA 타입 */}
      {aimDna?.typeLabel && (
        <div className="pw-type-badge large">{aimDna.typeLabel}</div>
      )}

      {/* 게임별 감도 변환 */}
      <div className="pw-conversions">
        <h3>{t('wizard.gameConversions')}</h3>
        <div className="pw-conversion-table">
          <div className="pw-conversion-header">
            <span>{t('wizard.game')}</span>
            <span>{t('wizard.convertedSens')}</span>
          </div>
          {sensConversions.map(c => (
            <div key={c.gameName} className="pw-conversion-row">
              <span className="pw-conversion-game">{c.gameName}</span>
              <span className="pw-conversion-sens">{c.convertedSens.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="pw-actions" style={{ marginTop: 24 }}>
        <button className="btn-primary" onClick={async () => {
          await handleComplete();
          onClose();
        }}>
          {t('wizard.saveAndComplete')}
        </button>
      </div>
    </div>
  );
}
