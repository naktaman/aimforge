/**
 * 상태 기반 CTA 히어로 영역
 * 사용자 진행 단계에 따라 다음 행동을 안내하는 컨텍스트 적응형 히어로
 *
 * 상태 우선순위:
 * 1. 프로필 없음 → "게임 프로필 만들기"
 * 2. 캘리브레이션 안함 → "감도 캘리브레이션 시작"
 * 3. 캘리브레이션 완료 → "오늘의 훈련 시작" / DNA 배터리
 */
import { useGameProfileStore } from '../../stores/gameProfileStore';
import { useCalibrationStore } from '../../stores/calibrationStore';
import { useEngineStore } from '../../stores/engineStore';

/** 히어로 단계 */
type HeroStage = 'no-profile' | 'no-calibration' | 'ready';

interface DashboardHeroProps {
  t: (key: string) => string;
  onCalibration?: () => void;
  onTrainingStart?: () => void;
  onBattery?: () => void;
  hasSelectedGame: boolean;
}

/** 사용자 상태 판단 */
function useHeroStage(): HeroStage {
  const activeProfile = useGameProfileStore((s) => s.activeProfile);
  const calResult = useCalibrationStore((s) => s.result);

  if (!activeProfile()) return 'no-profile';
  if (!calResult) return 'no-calibration';
  return 'ready';
}

/** 상태 기반 CTA 히어로 */
export function DashboardHero({
  t, onCalibration, onTrainingStart, onBattery, hasSelectedGame,
}: DashboardHeroProps): React.JSX.Element {
  const stage = useHeroStage();

  return (
    <div className="dash-hero dash-hero-cta">
      {stage === 'no-profile' && (
        <>
          <div className="dash-hero-icon">
            {/* 프로필 생성 아이콘 */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="8" y="6" width="32" height="36" rx="4" opacity="0.3" />
              <circle cx="24" cy="18" r="6" />
              <path d="M14 36 C14 30 34 30 34 36" />
              <line x1="36" y1="14" x2="36" y2="22" opacity="0.7" />
              <line x1="32" y1="18" x2="40" y2="18" opacity="0.7" />
            </svg>
          </div>
          <h3 className="dash-hero-title">{t('cta.createProfileTitle')}</h3>
          <p className="dash-hero-desc">{t('cta.createProfileDesc')}</p>
          <div className="dash-hero-actions">
            <button
              className="btn-primary btn-lg"
              onClick={() => useEngineStore.getState().setScreen('game-profiles')}
            >
              {t('cta.createProfileBtn')}
            </button>
          </div>
        </>
      )}

      {stage === 'no-calibration' && (
        <>
          <div className="dash-hero-icon">
            {/* 캘리브레이션 타겟 아이콘 */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="24" cy="24" r="20" opacity="0.3" />
              <circle cx="24" cy="24" r="13" opacity="0.5" />
              <circle cx="24" cy="24" r="6" />
              <line x1="24" y1="0" x2="24" y2="10" />
              <line x1="24" y1="38" x2="24" y2="48" />
              <line x1="0" y1="24" x2="10" y2="24" />
              <line x1="38" y1="24" x2="48" y2="24" />
            </svg>
          </div>
          <h3 className="dash-hero-title">{t('cta.calibrateTitle')}</h3>
          <p className="dash-hero-desc">{t('cta.calibrateDesc')}</p>
          <div className="dash-hero-actions">
            {onCalibration && (
              <button
                className="btn-primary btn-lg"
                onClick={onCalibration}
                disabled={!hasSelectedGame}
              >
                {t('cta.calibrateBtn')}
              </button>
            )}
          </div>
        </>
      )}

      {stage === 'ready' && (
        <>
          <div className="dash-hero-icon">
            {/* 훈련 시작 화살표 아이콘 */}
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polygon points="16,8 40,24 16,40" fill="none" opacity="0.5" />
              <polygon points="18,14 36,24 18,34" fill="currentColor" opacity="0.15" />
              <line x1="8" y1="24" x2="36" y2="24" />
            </svg>
          </div>
          <h3 className="dash-hero-title">{t('cta.readyTitle')}</h3>
          <p className="dash-hero-desc">{t('cta.readyDesc')}</p>
          <div className="dash-hero-actions">
            {onTrainingStart && (
              <button
                className="btn-primary btn-lg"
                onClick={onTrainingStart}
                disabled={!hasSelectedGame}
              >
                {t('cta.startTrainingBtn')}
              </button>
            )}
            {onBattery && (
              <button
                className="btn-secondary"
                onClick={onBattery}
                disabled={!hasSelectedGame}
              >
                {t('cta.dnaTestBtn')}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
