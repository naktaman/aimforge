/**
 * 크로스헤어 커스터마이징 UI
 * CS2/Valorant 스타일 설정 + 실시간 미리보기 + share code
 */
import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { Crosshair } from './overlays/Crosshair';
import type { CrosshairShape } from '../utils/types';
import { CROSSHAIR_PRESETS } from '../utils/types';

export function CrosshairSettings() {
  const {
    crosshair, setCrosshair, setCrosshairPreset,
    exportCrosshairCode, importCrosshairCode,
  } = useSettingsStore();

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
      setImportError('유효하지 않은 코드입니다');
    }
  };

  const shapes: Array<{ value: CrosshairShape; label: string }> = [
    { value: 'cross', label: '+자형' },
    { value: 'cross_dot', label: '+도트' },
    { value: 't_shape', label: 'T자형' },
    { value: 'dot', label: '도트' },
    { value: 'circle', label: '원형' },
  ];

  return (
    <div className="crosshair-settings">
      <h3>크로스헤어 설정</h3>

      {/* 실시간 미리보기 */}
      <div className="crosshair-preview">
        <div className="crosshair-preview-box">
          <Crosshair config={crosshair} />
        </div>
      </div>

      {/* 프리셋 */}
      <div className="crosshair-presets">
        <label>프리셋</label>
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
        <label>형태</label>
        <div className="shape-selector">
          {shapes.map(({ value, label }) => (
            <button
              key={value}
              className={`shape-btn ${crosshair.shape === value ? 'active' : ''}`}
              onClick={() => setCrosshair({ shape: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 크기 설정 */}
      <div className="settings-grid crosshair-grid">
        <label>
          내부선 길이
          <input
            type="range" min={0} max={20} step={1}
            value={crosshair.innerLength}
            onChange={(e) => setCrosshair({ innerLength: Number(e.target.value) })}
          />
          <span className="value">{crosshair.innerLength}px</span>
        </label>
        <label>
          외부선 길이
          <input
            type="range" min={0} max={10} step={1}
            value={crosshair.outerLength}
            onChange={(e) => setCrosshair({ outerLength: Number(e.target.value) })}
          />
          <span className="value">{crosshair.outerLength}px</span>
        </label>
        <label>
          두께
          <input
            type="range" min={1} max={6} step={0.5}
            value={crosshair.thickness}
            onChange={(e) => setCrosshair({ thickness: Number(e.target.value) })}
          />
          <span className="value">{crosshair.thickness}px</span>
        </label>
        <label>
          센터 갭
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
          색상
          <input
            type="color"
            value={crosshair.color}
            onChange={(e) => setCrosshair({ color: e.target.value })}
          />
        </label>
        <label>
          투명도
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
          아웃라인
        </label>
        {crosshair.outlineEnabled && (
          <div className="settings-grid crosshair-grid inline">
            <label>
              두께
              <input
                type="range" min={0.5} max={3} step={0.5}
                value={crosshair.outlineThickness}
                onChange={(e) => setCrosshair({ outlineThickness: Number(e.target.value) })}
              />
              <span className="value">{crosshair.outlineThickness}px</span>
            </label>
            <label>
              색상
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
          센터 도트
        </label>
        {crosshair.dotEnabled && (
          <label>
            크기
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
          다이나믹 (발사 시 벌어짐)
        </label>
        {crosshair.dynamicEnabled && (
          <label>
            벌어짐
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
        <h4>크로스헤어 코드</h4>
        <div className="share-row">
          <input
            type="text"
            placeholder="AIM-xxxxx... 코드를 입력하세요"
            value={shareCode}
            onChange={(e) => { setShareCode(e.target.value); setImportError(''); }}
          />
          <button className="btn-secondary" onClick={handleImport}>가져오기</button>
          <button className="btn-primary" onClick={handleExport}>
            {showCopied ? '복사됨!' : '내보내기'}
          </button>
        </div>
        {importError && <p className="error-text">{importError}</p>}
      </div>
    </div>
  );
}
