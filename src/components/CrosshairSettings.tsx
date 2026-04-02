/**
 * 크로스헤어 커스터마이징 UI
 * CS2/Valorant 스타일 설정 + 실시간 미리보기 + share code
 */
import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Crosshair } from './overlays/Crosshair';
import type { CrosshairShape } from '../utils/types';
import { CROSSHAIR_PRESETS } from '../utils/types';
import { useTranslation } from '../i18n';

export function CrosshairSettings() {
  const {
    crosshair, setCrosshair, setCrosshairPreset,
    exportCrosshairCode, importCrosshairCode,
  } = useSettingsStore();

  const { t } = useTranslation();
  const [shareCode, setShareCode] = useState('');
  const [importError, setImportError] = useState('');
  const [showCopied, setShowCopied] = useState(false);

  /** share code 내보내기 */
  const handleExport = () => {
    const code = exportCrosshairCode();
    setShareCode(code);
    navigator.clipboard?.writeText(code);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  /** share code 가져오기 */
  const handleImport = () => {
    if (!shareCode.trim()) return;
    const ok = importCrosshairCode(shareCode.trim());
    if (ok) {
      setImportError('');
      setShareCode('');
    } else {
      setImportError(t('crosshair.invalidCode'));
    }
  };

  const shapes: Array<{ value: CrosshairShape; labelKey: string }> = [
    { value: 'cross', labelKey: 'crosshair.cross' },
    { value: 'cross_dot', labelKey: 'crosshair.crossDot' },
    { value: 't_shape', labelKey: 'crosshair.tShape' },
    { value: 'dot', labelKey: 'crosshair.dotShape' },
    { value: 'circle', labelKey: 'crosshair.circle' },
  ];

  return (
    <div className="crosshair-settings">
      <h3>{t('crosshair.title')}</h3>

      {/* 실시간 미리보기 */}
      <div className="crosshair-preview">
        <div className="crosshair-preview-box">
          <Crosshair config={crosshair} />
        </div>
      </div>

      {/* 프리셋 */}
      <div className="crosshair-presets">
        <label>{t('crosshair.preset')}</label>
        <div className="preset-buttons">
          {CROSSHAIR_PRESETS.map((p) => (
            <button
              key={p.name}
              className="preset-btn"
              onClick={() => setCrosshairPreset(p.name)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* 형태 선택 */}
      <div className="settings-row">
        <label>{t('crosshair.shape')}</label>
        <div className="shape-selector">
          {shapes.map(({ value, labelKey }) => (
            <button
              key={value}
              className={`shape-btn ${crosshair.shape === value ? 'active' : ''}`}
              onClick={() => setCrosshair({ shape: value })}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* 크기 설정 */}
      <div className="settings-grid crosshair-grid">
        <label>
          {t('crosshair.innerLength')}
          <input
            type="range" min={0} max={20} step={1}
            value={crosshair.innerLength}
            onChange={(e) => setCrosshair({ innerLength: Number(e.target.value) })}
          />
          <span className="value">{crosshair.innerLength}px</span>
        </label>
        <label>
          {t('crosshair.outerLength')}
          <input
            type="range" min={0} max={10} step={1}
            value={crosshair.outerLength}
            onChange={(e) => setCrosshair({ outerLength: Number(e.target.value) })}
          />
          <span className="value">{crosshair.outerLength}px</span>
        </label>
        <label>
          {t('crosshair.thickness')}
          <input
            type="range" min={1} max={6} step={0.5}
            value={crosshair.thickness}
            onChange={(e) => setCrosshair({ thickness: Number(e.target.value) })}
          />
          <span className="value">{crosshair.thickness}px</span>
        </label>
        <label>
          {t('crosshair.centerGap')}
          <input
            type="range" min={0} max={15} step={1}
            value={crosshair.gap}
            onChange={(e) => setCrosshair({ gap: Number(e.target.value) })}
          />
          <span className="value">{crosshair.gap}px</span>
        </label>
      </div>

      {/* 색상 */}
      <div className="settings-grid crosshair-grid">
        <label>
          {t('crosshair.color')}
          <input
            type="color"
            value={crosshair.color}
            onChange={(e) => setCrosshair({ color: e.target.value })}
          />
        </label>
        <label>
          {t('crosshair.opacity')}
          <input
            type="range" min={0.1} max={1} step={0.05}
            value={crosshair.opacity}
            onChange={(e) => setCrosshair({ opacity: Number(e.target.value) })}
          />
          <span className="value">{Math.round(crosshair.opacity * 100)}%</span>
        </label>
      </div>

      {/* 아웃라인 */}
      <div className="settings-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={crosshair.outlineEnabled}
            onChange={(e) => setCrosshair({ outlineEnabled: e.target.checked })}
          />
          {t('crosshair.outline')}
        </label>
        {crosshair.outlineEnabled && (
          <div className="settings-grid crosshair-grid inline">
            <label>
              {t('crosshair.thickness')}
              <input
                type="range" min={0.5} max={3} step={0.5}
                value={crosshair.outlineThickness}
                onChange={(e) => setCrosshair({ outlineThickness: Number(e.target.value) })}
              />
              <span className="value">{crosshair.outlineThickness}px</span>
            </label>
            <label>
              {t('crosshair.color')}
              <input
                type="color"
                value={crosshair.outlineColor}
                onChange={(e) => setCrosshair({ outlineColor: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>

      {/* 센터 도트 */}
      <div className="settings-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={crosshair.dotEnabled}
            onChange={(e) => setCrosshair({ dotEnabled: e.target.checked })}
          />
          {t('crosshair.dot')}
        </label>
        {crosshair.dotEnabled && (
          <label>
            {t('crosshair.size')}
            <input
              type="range" min={1} max={6} step={0.5}
              value={crosshair.dotSize}
              onChange={(e) => setCrosshair({ dotSize: Number(e.target.value) })}
            />
            <span className="value">{crosshair.dotSize}px</span>
          </label>
        )}
      </div>

      {/* 다이나믹 */}
      <div className="settings-row">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={crosshair.dynamicEnabled}
            onChange={(e) => setCrosshair({ dynamicEnabled: e.target.checked })}
          />
          {t('crosshair.dynamicDesc')}
        </label>
        {crosshair.dynamicEnabled && (
          <label>
            {t('crosshair.spread')}
            <input
              type="range" min={1} max={10} step={1}
              value={crosshair.dynamicSpread}
              onChange={(e) => setCrosshair({ dynamicSpread: Number(e.target.value) })}
            />
            <span className="value">{crosshair.dynamicSpread}px</span>
          </label>
        )}
      </div>

      {/* Share Code */}
      <div className="crosshair-share">
        <h4>{t('crosshair.code')}</h4>
        <div className="share-row">
          <input
            type="text"
            placeholder={t('crosshair.codePlaceholder')}
            value={shareCode}
            onChange={(e) => { setShareCode(e.target.value); setImportError(''); }}
          />
          <button className="btn-secondary" onClick={handleImport}>{t('common.import')}</button>
          <button className="btn-primary" onClick={handleExport}>
            {showCopied ? t('common.copied') : t('common.export')}
          </button>
        </div>
        {importError && <p className="error-text">{importError}</p>}
      </div>
    </div>
  );
}
