/**
 * 설정 화면 — 디스플레이 / 언어 / 사운드 / 데이터 관리 / 앱 정보
 * 섹션별로 분리된 통합 설정 UI
 */
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToastStore } from '../stores/toastStore';
import { useUiStore, type AppLocale } from '../stores/uiStore';
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

/** 현재 활성 설정 섹션 */
type SettingsSection = 'display' | 'language' | 'sound' | 'data' | 'about';

interface DisplaySettingsProps {
  onBack: () => void;
}

export function DisplaySettings({ onBack }: DisplaySettingsProps) {
  const [settings, setSettings] = useState<DisplaySettingsState>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState<SettingsSection>('display');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [exportStatus, setExportStatus] = useState('');
  const [exporting, setExporting] = useState(false);
  const { locale, setLocale } = useUiStore();
  const { t } = useTranslation();

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

  /** 섹션 탭 목록 */
  const SECTIONS: Array<{ key: SettingsSection; label: string }> = [
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
