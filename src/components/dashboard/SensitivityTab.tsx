/**
 * 감도 프로파일 탭 — 3열 대시보드
 * 좌: 현재 감도 프로파일, 중앙: 캘리브레이션 허브, 우: 도구 & 프로파일
 */
import type { GamePreset } from '../../utils/types';
import { useEngineStore, RECOIL_PRESETS, type RecoilPreset, type FireMode } from '../../stores/engineStore';

/** 감도 탭 Props */
interface SensitivityTabProps {
  sensitivity: number;
  dpi: number;
  cm360: number | null;
  selectedGame: GamePreset | null;
  games: GamePreset[];
  selectGame: (game: GamePreset) => void;
  recoilEnabled: boolean;
  recoilPreset: RecoilPreset;
  toggleRecoil: () => void;
  setRecoilPreset: (preset: RecoilPreset) => void;
  fireMode: FireMode;
  fireRpm: number;
  setFireMode: (mode: FireMode) => void;
  setFireRpm: (rpm: number) => void;
  onCalibration?: () => void;
  onZoomCalibration?: () => void;
  mode: string;
  showAdvanced: boolean;
  setShowAdvanced: React.Dispatch<React.SetStateAction<boolean>>;
  t: (key: string) => string;
  getSensitivityLevel: (cm360: number, t: (key: string) => string) => string;
}

/** 감도 프로파일 탭 컴포넌트 */
export function SensitivityTab({
  sensitivity, dpi, cm360, selectedGame,
  recoilEnabled, recoilPreset, toggleRecoil, setRecoilPreset,
  fireMode, fireRpm, setFireMode, setFireRpm,
  onCalibration, onZoomCalibration,
  mode, showAdvanced, setShowAdvanced, t, getSensitivityLevel,
}: SensitivityTabProps) {
  return (
    <div className="dash-grid-3col">
      {/* 좌측 25% — 현재 감도 프로파일 */}
      <div className="dash-col-left">
        <div className="dash-section-label">{t('dash.currentProfile')}</div>
        {/* 게임 감도 — 히어로 카드 (accent) */}
        <div className="dash-stat-card dash-stat-accent">
          <span className="dash-stat-label">{t('settings.sensitivity')}</span>
          <span className="dash-stat-value">{sensitivity}</span>
          <span className="dash-stat-sub">{selectedGame ? selectedGame.name : t('dash.noGame')}</span>
        </div>
        {/* DPI 카드 */}
        <div className="dash-stat-card">
          <span className="dash-stat-label">DPI</span>
          <span className="dash-stat-value">{dpi}</span>
          <span className="dash-stat-sub">{t('dash.mouseHardware')}</span>
        </div>
        {/* cm/360 서브 카드 */}
        <div className="dash-stat-card">
          <span className="dash-stat-label">cm/360</span>
          <span className="dash-stat-value">{cm360 ? cm360.toFixed(1) : '\u2014'}</span>
          <span className="dash-stat-sub">{cm360 ? getSensitivityLevel(cm360, t) : t('dash.noGame')}</span>
        </div>

        {/* 사격 설정 컴팩트 */}
        <div className="dash-section-label" style={{ marginTop: 'var(--space-3)' }}>{t('scenario.fireMode')}</div>
        <div className="dash-fire-config">
          <div className="dash-fire-row">
            <label className="dash-mini-toggle">
              <input type="checkbox" checked={recoilEnabled} onChange={toggleRecoil} />
              {t('scenario.recoil')}
            </label>
            {recoilEnabled && (
              <select className="dash-mini-select" value={recoilPreset} onChange={(e) => setRecoilPreset(e.target.value as RecoilPreset)}>
                {(Object.entries(RECOIL_PRESETS) as [RecoilPreset, typeof RECOIL_PRESETS[RecoilPreset]][]).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            )}
          </div>
          <div className="dash-fire-row">
            <select className="dash-mini-select" value={fireMode} onChange={(e) => setFireMode(e.target.value as FireMode)}>
              <option value="semi">{t('scenario.fireSemiShort')}</option>
              <option value="auto">{t('scenario.fireAutoShort')}</option>
              <option value="burst">{t('scenario.fireBurstShort')}</option>
            </select>
            {fireMode !== 'semi' && (
              <div className="dash-rpm-field">
                <input type="number" className="dash-compact-input" min={60} max={1200} step={30} value={fireRpm} onChange={(e) => setFireRpm(Number(e.target.value))} />
                <span className="dash-rpm-unit">RPM</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 중앙 45% — 캘리브레이션 허브 */}
      <div className="dash-col-center">
        <div className="dash-section-label">{t('dash.sensitivityCalibration')}</div>
        {/* 히어로 CTA */}
        <div className="dash-hero">
          <div className="dash-hero-icon">
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
          <h3 className="dash-hero-title">{t('scenario.findOptimalSens')}</h3>
          <p className="dash-hero-desc">{t('scenario.findOptimalSensDesc')}</p>
          <div className="dash-hero-actions">
            {onCalibration && (
              <button className="btn-primary btn-lg" onClick={onCalibration} disabled={!selectedGame}>
                {t('dash.startCalibration')}
              </button>
            )}
          </div>
        </div>

        {/* 줌 감도 설정 섹션 */}
        <div className="dash-zoom-section">
          <div className="dash-zoom-title">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="8" cy="8" r="5" />
              <line x1="12" y1="12" x2="16" y2="16" />
            </svg>
            {t('dash.zoomSensitivity')}
          </div>
          <p className="dash-zoom-desc">{t('dash.zoomSensDesc')}</p>
          {onZoomCalibration && (
            <button className="btn-secondary" onClick={onZoomCalibration} disabled={!selectedGame}>
              {t('scenario.zoomCalibration')}
            </button>
          )}
        </div>

        {/* 캘리브레이션 히스토리 — 데이터 없으면 empty state */}
        <div className="dash-chart">
          <div className="dash-chart-header">
            <span className="dash-chart-title">{t('dash.calibrationTrend')}</span>
          </div>
          <div className="dash-empty-state">
            <svg className="dash-empty-icon" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25">
              <rect x="4" y="4" width="32" height="32" rx="4" />
              <polyline points="10,28 16,20 22,24 28,14 34,18" />
              <circle cx="16" cy="20" r="1.5" fill="currentColor" />
              <circle cx="22" cy="24" r="1.5" fill="currentColor" />
              <circle cx="28" cy="14" r="1.5" fill="currentColor" />
            </svg>
            <span className="dash-empty-text">{t('empty.calibrationData')}</span>
            <button className="btn-secondary btn-sm" onClick={onCalibration}>
              {t('empty.calibrationAction')}
            </button>
          </div>
        </div>
      </div>

      {/* 우측 30% — 도구 & 프로파일 */}
      <div className="dash-col-right">
        <div className="dash-section-label">{t('nav.gameProfile')}</div>
        <div className="dash-tool-list">
          <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('game-profiles')}>
            <span className="dash-tool-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="2" /><line x1="5" y1="7" x2="11" y2="7" /><line x1="5" y1="10" x2="9" y2="10" /></svg>
            </span>
            <span className="dash-tool-name">{t('nav.gameProfile')}</span>
          </button>
          <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('conversion-selector')}>
            <span className="dash-tool-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4-4 4 4M4 10l4 4 4-4" /></svg>
            </span>
            <span className="dash-tool-name">{t('nav.conversion')}</span>
          </button>
          {mode === 'advanced' && (
            <>
              <button
                className="dash-advanced-toggle"
                onClick={() => setShowAdvanced(prev => !prev)}
                aria-expanded={showAdvanced}
              >
                {t('dash.advancedTools')} {showAdvanced ? '\u25B2' : '\u25BC'}
              </button>
              {showAdvanced && (
                <>
                  <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('fov-comparison')}>
                    <span className="dash-tool-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 8 L8 2 L15 8" /><line x1="8" y1="2" x2="8" y2="14" /></svg>
                    </span>
                    <span className="dash-tool-name">{t('tool.fovComparison')}</span>
                  </button>
                  <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('hardware-compare')}>
                    <span className="dash-tool-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="6" width="6" height="8" rx="1" /><rect x="9" y="2" width="6" height="12" rx="1" /></svg>
                    </span>
                    <span className="dash-tool-name">{t('tool.hardwareCompare')}</span>
                  </button>
                  <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('dual-landscape')}>
                    <span className="dash-tool-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 2 Q12 6 8 14 Q4 6 8 2" /></svg>
                    </span>
                    <span className="dash-tool-name">{t('tool.dualLandscape')}</span>
                  </button>
                  <button className="dash-tool-item" onClick={() => useEngineStore.getState().setScreen('movement-editor')}>
                    <span className="dash-tool-icon">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14 L6 6 L10 10 L14 2" /></svg>
                    </span>
                    <span className="dash-tool-name">{t('tool.movementEditor')}</span>
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* 하단: 카테고리 카드 3개 */}
      <div className="dash-bottom-cards">
        <button className="dash-cat-card" onClick={onCalibration} disabled={!selectedGame || !onCalibration}>
          <span className="dash-cat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
            </svg>
          </span>
          <span className="dash-cat-label">{t('dash.calibration')}</span>
        </button>
        <button className="dash-cat-card" onClick={() => useEngineStore.getState().setScreen('game-profiles')}>
          <span className="dash-cat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="16" rx="3" /><line x1="7" y1="9" x2="17" y2="9" /><line x1="7" y1="13" x2="14" y2="13" />
            </svg>
          </span>
          <span className="dash-cat-label">{t('nav.gameProfile')}</span>
        </button>
        <button className="dash-cat-card" onClick={() => useEngineStore.getState().setScreen('conversion-selector')}>
          <span className="dash-cat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
            </svg>
          </span>
          <span className="dash-cat-label">{t('nav.conversion')}</span>
        </button>
      </div>
    </div>
  );
}
