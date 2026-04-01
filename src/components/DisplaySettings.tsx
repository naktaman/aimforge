/**
 * 디스플레이 설정 — 해상도, 리프레시 레이트, 전체화면 모드, VSync 설정
 * Rust 백엔드의 user_settings 테이블에 저장
 */
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToastStore } from '../stores/toastStore';

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

interface DisplaySettingsProps {
  onBack: () => void;
}

export function DisplaySettings({ onBack }: DisplaySettingsProps) {
  const [settings, setSettings] = useState<DisplaySettingsState>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

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
      } catch (e) {
        console.warn('[DisplaySettings] 설정 로드 실패:', e);
        useToastStore.getState().addToast('디스플레이 설정 로드 실패', 'warning');
      }
    })();
  }, []);

  /** 개별 설정 저장 */
  const saveSetting = useCallback(async (key: string, value: string) => {
    try {
      await invoke('save_user_setting', { key, value });
    } catch (e) {
      console.warn('[DisplaySettings] 설정 저장 실패:', key, e);
      useToastStore.getState().addToast('설정 저장 실패', 'warning');
    }
  }, []);

  /** 전체 설정 저장 */
  const handleSave = useCallback(async () => {
    await Promise.all([
      saveSetting('display_mode', settings.displayMode),
      saveSetting('target_refresh_rate', String(settings.targetRefreshRate)),
      saveSetting('vsync_enabled', String(settings.vsyncEnabled)),
      saveSetting('render_scale', String(settings.renderScale)),
    ]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [settings, saveSetting]);

  return (
    <div className="display-settings">
      <div className="section-header">
        <h2>디스플레이 설정</h2>
        <button className="btn-secondary" onClick={onBack}>돌아가기</button>
      </div>

      <div className="settings-grid">
        {/* 디스플레이 모드 */}
        <div className="setting-row">
          <label>디스플레이 모드</label>
          <select
            value={settings.displayMode}
            onChange={(e) => setSettings(s => ({ ...s, displayMode: e.target.value as DisplayMode }))}
          >
            <option value="windowed">창 모드</option>
            <option value="borderless">전체 창 (보더리스)</option>
            <option value="fullscreen">전체 화면</option>
          </select>
        </div>

        {/* 타겟 리프레시 레이트 */}
        <div className="setting-row">
          <label>프레임 제한</label>
          <select
            value={settings.targetRefreshRate}
            onChange={(e) => setSettings(s => ({ ...s, targetRefreshRate: parseInt(e.target.value, 10) }))}
          >
            {REFRESH_RATES.map(rate => (
              <option key={rate} value={rate}>
                {rate === 0 ? '무제한' : `${rate} FPS`}
              </option>
            ))}
          </select>
        </div>

        {/* VSync */}
        <div className="setting-row">
          <label>수직 동기화 (VSync)</label>
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
          <span className="setting-hint">
            에임 훈련 시 OFF 권장 (입력 지연 최소화)
          </span>
        </div>

        {/* 렌더 스케일 */}
        <div className="setting-row">
          <label>렌더 스케일: {settings.renderScale}%</label>
          <input
            type="range"
            min={50}
            max={200}
            step={10}
            value={settings.renderScale}
            onChange={(e) => setSettings(s => ({ ...s, renderScale: parseInt(e.target.value, 10) }))}
          />
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary" onClick={handleSave}>
          {saved ? '저장됨!' : '설정 저장'}
        </button>
      </div>
    </div>
  );
}
