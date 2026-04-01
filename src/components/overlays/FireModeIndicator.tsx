/**
 * 발사 모드 표시 오버레이
 * 뷰포트 좌측 하단에 현재 발사 모드 + RPM 표시
 */
import { useEngineStore } from '../../stores/engineStore';
import type { FireMode } from '../../stores/engineStore';

/** 발사 모드별 한국어 라벨 */
const FIRE_MODE_LABELS: Record<FireMode, string> = {
  semi: '단발',
  auto: '연사',
  burst: '3점사',
};

export function FireModeIndicator() {
  const fireMode = useEngineStore((s) => s.fireMode);
  const fireRpm = useEngineStore((s) => s.fireRpm);
  const pointerLocked = useEngineStore((s) => s.pointerLocked);

  // 뷰포트(포인터 잠금) 상태에서만 표시
  if (!pointerLocked) return null;

  return (
    <div className="fire-mode-indicator">
      <span className="fire-mode-label">{FIRE_MODE_LABELS[fireMode]}</span>
      {fireMode !== 'semi' && (
        <span className="fire-mode-rpm">{fireRpm} RPM</span>
      )}
      <span className="fire-mode-hint">[B] 전환</span>
    </div>
  );
}
