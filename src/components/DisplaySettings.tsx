/**
 * 설정 화면 — 하드웨어 / 감도&프로필 / 디스플레이 / 언어 / 사운드 / 데이터 관리 / 앱 정보
 * 섹션별로 분리된 통합 설정 UI
 */
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToastStore } from '../stores/toastStore';
import { useUiStore, type AppLocale } from '../stores/uiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useGameProfileStore } from '../stores/gameProfileStore';
import { useEngineStore } from '../stores/engineStore';
import { useTranslation } from '../i18n';

/** 디스플레이 모드 */
type DisplayMode = 'windowed' | 'borderless' | 'fullscreen';

/** 디스플레이 설정 상태 */
interface DisplaySettingsState {
  displayMode: DisplayMode;
  targetRefreshRate: number;
  vsyncEnabled: boolean;
  renderScale: number;
}

const DEFAULT_SETTINGS: DisplaySettingsState = {
  displayMode: 'windowed',
  targetRefreshRate: 0,
  vsyncEnabled: false,
  renderScale: 100,
};

/** 일반적인 리프레시 레이트 옵션 */
const REFRESH_RATES = [0, 60, 75, 120, 144, 165, 240, 360];

/** 폴링레이트 옵션 (Hz) */
const POLLING_RATES = [125, 250, 500, 1000, 2000, 4000, 8000];

/** 감도 단위 옵션 */
type SensUnit = 'cm360' | 'inch360' | 'edpi';

/** 현재 활성 설정 섹션 */
type SettingsSection = 'hardware' | 'sensitivity' | 'display' | 'language' | 'sound' | 'data' | 'about';

interface DisplaySettingsProps {
  onBack: () => void;
}

export function DisplaySettings({ onBack }: DisplaySettingsProps): React.JSX.Element {
  const [settings, setSettings] = useState<DisplaySettingsState>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<SettingsSection>('hardware');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [exportStatus, setExportStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const [sensUnit, setSensUnit] = useState<SensUnit>('cm360');

  /* 하드웨어 설정 — settingsStore에서 초기값, DB에서도 로드 */
  const [mouseAccel, setMouseAccel] = useState(false);
  const [rawInput, setRawInput] = useState(true);

  const { locale, setLocale } = useUiStore();
  const { dpi, pollingRate, setDpi, setPollingRate } = useSettingsStore();
  const { t } = useTranslation();

  /** 활성 프로필 구독 */
  const profiles = useGameProfileStore(s => s.profiles);
  const activeProfile = profiles.find(p => p.isActive) ?? null;

  /** 저장된 설정 로드 */
  useEffect(() => {
    (async () => {
      try {
        const allSettings = await invoke<Array<{ key: string; value: string }>>('get_all_user_settings');
        const map = new Map(allSettings.map(s => [s.key, s.value]));
        setSettings({
          displayMode: (map.get('display_mode') as DisplayMode) || 'windowed',
          targetRefreshRate: parseInt(map.get('target_refresh_rate') || '0', 10),
          vsyncEnabled: map.get('vsync_enabled') === 'true',
          renderScale: parseInt(map.get('render_scale') || '100', 10),
        });
        /* 사운드 설정 로드 */
        const sound = map.get('sound_enabled');
        if (sound === 'false') setSoundEnabled(false);
        /* 하드웨어 설정 로드 */
        const accel = map.get('mouse_accel');
        if (accel === 'true') setMouseAccel(true);
        const raw = map.get('raw_input');
        if (raw === 'false') setRawInput(false);
      } catch (e) {
        console.warn('[Settings] 설정 로드 실패:', e);
        useToastStore.getState().addToast(t('settings.loadFailed'), 'warning');
      }
    })();
  }, []);

  /** 개별 설정 저장 */
  const saveSetting = useCallback(async (key: string, value: string) => {
    try {
      await invoke('save_user_setting', { key, value });
    } catch (e) {
      console.warn('[Settings] 설정 저장 실패:', key, e);
      useToastStore.getState().addToast(t('settings.saveFailed'), 'warning');
    }
  }, [t]);

  /** 디스플레이 설정 저장 */
  const handleSaveDisplay = useCallback(async () => {
    await Promise.all([
      saveSetting('display_mode', settings.displayMode),
      saveSetting('target_refresh_rate', String(settings.targetRefreshRate)),
      saveSetting('vsync_enabled', String(settings.vsyncEnabled)),
      saveSetting('render_scale', String(settings.renderScale)),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings, saveSetting]);

  /** 사운드 토글 */
  const handleSoundToggle = useCallback(async (enabled: boolean) => {
    setSoundEnabled(enabled);
    await saveSetting('sound_enabled', String(enabled));
  }, [saveSetting]);

  /** 데이터 내보내기 */
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportStatus(t('data.exporting'));
    try {
      const result = await invoke<string>('export_database');
      setExportStatus(`${t('data.exportComplete')}: ${result}`);
    } catch (e) {
      setExportStatus(`${t('data.exportFailed')}: ${e}`);
    } finally {
      setExporting(false);
    }
  }, [t]);

  /* ── 하드웨어 핸들러 (즉시 저장) ── */

  /** DPI 변경 — settingsStore + DB 동시 저장 */
  const handleDpiChange = useCallback((value: number) => {
    const clamped = Math.max(100, Math.min(32000, value));
    setDpi(clamped);
    saveSetting('dpi', String(clamped));
  }, [setDpi, saveSetting]);

  /** 폴링레이트 변경 */
  const handlePollingRateChange = useCallback((value: number) => {
    setPollingRate(value);
    saveSetting('polling_rate', String(value));
  }, [setPollingRate, saveSetting]);

  /** 마우스 가속 토글 */
  const handleMouseAccelChange = useCallback((enabled: boolean) => {
    setMouseAccel(enabled);
    saveSetting('mouse_accel', String(enabled));
  }, [saveSetting]);

  /** Raw Input 토글 */
  const handleRawInputChange = useCallback((enabled: boolean) => {
    setRawInput(enabled);
    saveSetting('raw_input', String(enabled));
  }, [saveSetting]);

  /** 감도 단위 변환 — cm/360 기준 */
  const formatSensValue = useCallback((cm360: number): string => {
    switch (sensUnit) {
      case 'inch360': return (cm360 / 2.54).toFixed(2);
      case 'edpi': return (2.54 * 360 / cm360).toFixed(0); // 근사 eDPI
      default: return cm360.toFixed(2);
    }
  }, [sensUnit]);

  /** 감도 단위 라벨 */
  const sensUnitLabel = sensUnit === 'cm360' ? 'cm/360'
    : sensUnit === 'inch360' ? 'inch/360' : 'eDPI';

  /** 섹션 탭 목록 */
  const SECTIONS: Array<{ key: SettingsSection; label: string }> = [
    { key: 'hardware', label: t('settings.sectionHardware') },
    { key: 'sensitivity', label: t('settings.sectionSensitivity') },
    { key: 'display', label: t('settings.sectionDisplay') },
    { key: 'language', label: t('settings.sectionLanguage') },
    { key: 'sound', label: t('settings.sectionSound') },
    { key: 'data', label: t('settings.sectionData') },
    { key: 'about', label: t('settings.sectionAbout') },
  ];

  return (
    <div className="display-settings">
      <div className="section-header">
        <h2>{t('settings.title')}</h2>
        <button className="btn-secondary" onClick={onBack}>{t('common.back')}</button>
      </div>

      {/* 섹션 탭 네비게이션 */}
      <div className="settings-tabs">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`settings-tab ${section === key ? 'active' : ''}`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ─── 하드웨어 섹션 ─── */}
      {section === 'hardware' && (
        <div className="settings-grid">
          <h3 className="settings-section-heading">{t('settings.sectionHardware')}</h3>

          {/* DPI 입력 */}
          <div className="setting-row">
            <label>{t('hardware.dpi')}</label>
            <input
              type="number"
              className="dpi-input"
              min={100}
              max={32000}
              step={50}
              value={dpi}
              onChange={(e) => handleDpiChange(parseInt(e.target.value, 10) || 100)}
            />
          </div>

          {/* 폴링레이트 드롭다운 */}
          <div className="setting-row">
            <label>{t('hardware.pollingRate')}</label>
            <select
              value={pollingRate}
              onChange={(e) => handlePollingRateChange(parseInt(e.target.value, 10))}
            >
              {POLLING_RATES.map(rate => (
                <option key={rate} value={rate}>{rate} Hz</option>
              ))}
            </select>
          </div>

          {/* 마우스 가속 체크박스 */}
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={mouseAccel}
                onChange={(e) => handleMouseAccelChange(e.target.checked)}
              />
              {' '}{t('hardware.mouseAccel')}
            </label>
            <span className="setting-hint">{t('hardware.mouseAccelHint')}</span>
          </div>

          {/* Raw Input 체크박스 */}
          <div className="setting-row">
            <label>
              <input
                type="checkbox"
                checked={rawInput}
                onChange={(e) => handleRawInputChange(e.target.checked)}
              />
              {' '}{t('hardware.rawInput')}
            </label>
          </div>
        </div>
      )}

      {/* ─── 감도 & 프로필 섹션 ─── */}
      {section === 'sensitivity' && (
        <div className="settings-grid">
          <h3 className="settings-section-heading">{t('settings.sectionSensitivity')}</h3>

          {/* 활성 프로필 카드 또는 생성 유도 */}
          {activeProfile ? (
            <div className="profile-card">
              <div className="profile-card-info">
                <span className="profile-card-game">{activeProfile.gameName}</span>
                <span className="profile-card-sens">
                  {t('sensitivity.sens')}: {activeProfile.customSens}
                </span>
                <span className="profile-card-cm360">
                  {formatSensValue(activeProfile.customCm360)} {sensUnitLabel}
                </span>
              </div>
            </div>
          ) : (
            <div className="profile-empty">
              <p>{t('sensitivity.noProfile')}</p>
              <button
                className="btn-primary"
                onClick={() => useEngineStore.getState().setScreen('game-profiles')}
              >
                {t('sensitivity.createProfile')}
              </button>
            </div>
          )}

          {/* 감도 단위 드롭다운 */}
          <div className="setting-row">
            <label>{t('sensitivity.unit')}</label>
            <select
              value={sensUnit}
              onChange={(e) => setSensUnit(e.target.value as SensUnit)}
            >
              <option value="cm360">cm/360</option>
              <option value="inch360">inch/360</option>
              <option value="edpi">eDPI</option>
            </select>
          </div>

          {/* 게임 프로필 관리 버튼 */}
          <div className="settings-actions">
            <button
              className="btn-secondary"
              onClick={() => useEngineStore.getState().setScreen('game-profiles')}
            >
              {t('sensitivity.manageProfiles')}
            </button>
          </div>
        </div>
      )}

      {/* ─── 디스플레이 섹션 ─── */}
      {section === 'display' && (
        <div className="settings-grid">
          <div className="setting-row">
            <label>{t('display.mode')}</label>
            <select
              value={settings.displayMode}
              onChange={(e) => setSettings(s => ({ ...s, displayMode: e.target.value as DisplayMode }))}
            >
              <option value="windowed">{t('display.windowed')}</option>
              <option value="borderless">{t('display.borderless')}</option>
              <option value="fullscreen">{t('display.fullscreen')}</option>
            </select>
          </div>
          <div className="setting-row">
            <label>{t('display.fpsLimit')}</label>
            <select
              value={settings.targetRefreshRate}
              onChange={(e) => setSettings(s => ({ ...s, targetRefreshRate: parseInt(e.target.value, 10) }))}
            >
              {REFRESH_RATES.map(rate => (
                <option key={rate} value={rate}>
                  {rate === 0 ? t('display.unlimited') : `${rate} FPS`}
                </option>
              ))}
            </select>
          </div>
          <div className="setting-row">
            <label>{t('display.vsync')}</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="vsync-toggle"
                checked={settings.vsyncEnabled}
                onChange={(e) => setSettings(s => ({ ...s, vsyncEnabled: e.target.checked }))}
              />
              <label htmlFor="vsync-toggle" className="toggle-label">
                {settings.vsyncEnabled ? 'ON' : 'OFF'}
              </label>
            </div>
            <span className="setting-hint">{t('display.vsyncHint')}</span>
          </div>
          <div className="setting-row">
            <label>{t('display.renderScale')}: {settings.renderScale}%</label>
            <input
              type="range"
              min={50}
              max={200}
              step={10}
              value={settings.renderScale}
              onChange={(e) => setSettings(s => ({ ...s, renderScale: parseInt(e.target.value, 10) }))}
            />
          </div>
          <div className="settings-actions">
            <button className="btn-primary" onClick={handleSaveDisplay}>
              {saved ? t('common.saved') : t('common.saveSettings')}
            </button>
          </div>
        </div>
      )}

      {/* ─── 언어 섹션 ─── */}
      {section === 'language' && (
        <div className="settings-grid">
          <div className="setting-row">
            <label>{t('common.language')}</label>
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as AppLocale)}
            >
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      )}

      {/* ─── 사운드 섹션 ─── */}
      {section === 'sound' && (
        <div className="settings-grid">
          <div className="setting-row">
            <label>{t('settings.soundEffects')}</label>
            <div className="toggle-switch">
              <input
                type="checkbox"
                id="sound-toggle"
                checked={soundEnabled}
                onChange={(e) => handleSoundToggle(e.target.checked)}
              />
              <label htmlFor="sound-toggle" className="toggle-label">
                {soundEnabled ? 'ON' : 'OFF'}
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ─── 데이터 관리 섹션 ─── */}
      {section === 'data' && (
        <div className="settings-grid">
          <div className="data-section">
            <h3>{t('data.exportAll')}</h3>
            <p className="text-secondary">{t('data.exportDesc')}</p>
            <button className="btn-primary" onClick={handleExport} disabled={exporting}>
              {exporting ? t('data.exporting') : t('data.exportJson')}
            </button>
          </div>
          {exportStatus && <p className="data-status">{exportStatus}</p>}
        </div>
      )}

      {/* ─── 앱 정보 섹션 ─── */}
      {section === 'about' && (
        <div className="settings-grid">
          <div className="about-section">
            <h3>{t('app.title')}</h3>
            <p className="text-secondary">{t('app.version')}</p>
            <p className="text-secondary">{t('settings.aboutDesc')}</p>
          </div>
        </div>
      )}
    </div>
  );
}
