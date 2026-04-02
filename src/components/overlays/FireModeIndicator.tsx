/**
 * 발사 모드 표시 오버레이
 * 뷰포트 좌측 하단에 현재 발사 모드 + RPM 표시
 */
import { useEngineStore } from '../../stores/engineStore';
import { useTranslation } from '../../i18n';
import type { FireMode } from '../../stores/engineStore';

/** 발사 모드별 i18n 키 */
const FIRE_MODE_KEYS: Record<FireMode, string> = {
  semi: 'scenario.fireSemiShort',
  auto: 'scenario.fireAutoShort',
  burst: 'scenario.fireBurstShort',
};

export function FireModeIndicator() {
  const fireMode = useEngineStore((s) => s.fireMode);
  const fireRpm = useEngineStore((s) => s.fireRpm);
  const pointerLocked = useEngineStore((s) => s.pointerLocked);
  const { t } = useTranslation();

  // 뷰포트(포인터 잠금) 상태에서만 표시
  if (!pointerLocked) return null;

  return (
    <div className="fire-mode-indicator">
      <span className="fire-mode-label">{t(FIRE_MODE_KEYS[fireMode])}</span>
      {fireMode !== 'semi' && (
        <span className="fire-mode-rpm">{fireRpm} RPM</span>
      )}
      <span className="fire-mode-hint">[B] {t('common.switch')}</span>
    </div>
  );
}
