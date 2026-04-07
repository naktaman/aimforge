/**
 * 무기 설정 UI 패널 (Phase 4)
 * - 무기 프리셋 드롭다운 선택
 * - 주요 파라미터 슬라이더 조절
 * - DisplaySettings 내 탭 또는 독립 패널로 사용
 */
import { useState, useCallback, type ReactElement } from 'react';
import { WEAPON_PRESETS, SCENARIO_WEAPON_PRESETS } from '../engine/WeaponPresets';
import type { WeaponConfig } from '../utils/types';

/** 패널에서 조절 가능한 파라미터 */
interface EditableParams {
  fireRateRpm: number;
  recoilResetMs: number;
  zoomMultiplier: number;
  zoomFov: number;
  zoomSensMultiplier: number;
  recoilRandomDeviation: number;
  baseSpread: number;
}

interface WeaponConfigPanelProps {
  /** 현재 선택된 프리셋 ID */
  selectedPresetId: string;
  /** 프리셋 변경 콜백 */
  onPresetChange: (presetId: string, config: WeaponConfig) => void;
  /** 파라미터 변경 콜백 (실시간 슬라이더) */
  onParamChange?: (params: Partial<WeaponConfig>) => void;
}

/** 슬라이더 설정 정의 */
interface SliderDef {
  key: keyof EditableParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: SliderDef[] = [
  { key: 'fireRateRpm', label: 'RPM (연사 속도)', min: 0, max: 1200, step: 10, unit: 'rpm' },
  { key: 'recoilResetMs', label: '반동 리셋', min: 100, max: 3000, step: 50, unit: 'ms' },
  { key: 'zoomMultiplier', label: '줌 배율', min: 1, max: 12, step: 0.5, unit: 'x' },
  { key: 'zoomFov', label: '줌 FOV', min: 8, max: 120, step: 1, unit: '°' },
  { key: 'zoomSensMultiplier', label: '줌 감도 배율', min: 0.1, max: 2, step: 0.05, unit: 'x' },
  { key: 'recoilRandomDeviation', label: '반동 랜덤성', min: 0, max: 1, step: 0.05, unit: '' },
  { key: 'baseSpread', label: '기본 산탄', min: 0, max: 5, step: 0.1, unit: '°' },
];

/** 시나리오 프리셋 드롭다운 항목 */
const PRESET_OPTIONS = SCENARIO_WEAPON_PRESETS.map((p) => ({
  id: p.id ?? 'unknown',
  name: p.name ?? p.id ?? 'Unknown',
  category: p.category ?? 'unknown',
}));

export function WeaponConfigPanel({
  selectedPresetId,
  onPresetChange,
  onParamChange,
}: WeaponConfigPanelProps): ReactElement {
  // 현재 편집 중인 파라미터 (프리셋 기반 초기화)
  const currentPreset = WEAPON_PRESETS[selectedPresetId] ?? WEAPON_PRESETS.default;
  const [params, setParams] = useState<EditableParams>({
    fireRateRpm: currentPreset.fireRateRpm,
    recoilResetMs: currentPreset.recoilResetMs,
    zoomMultiplier: currentPreset.zoomMultiplier,
    zoomFov: currentPreset.zoomFov,
    zoomSensMultiplier: currentPreset.zoomSensMultiplier,
    recoilRandomDeviation: currentPreset.recoilRandomDeviation ?? 0,
    baseSpread: currentPreset.baseSpread ?? 0,
  });

  /** 프리셋 선택 */
  const handlePresetSelect = useCallback((presetId: string) => {
    const preset = WEAPON_PRESETS[presetId];
    if (!preset) return;
    setParams({
      fireRateRpm: preset.fireRateRpm,
      recoilResetMs: preset.recoilResetMs,
      zoomMultiplier: preset.zoomMultiplier,
      zoomFov: preset.zoomFov,
      zoomSensMultiplier: preset.zoomSensMultiplier,
      recoilRandomDeviation: preset.recoilRandomDeviation ?? 0,
      baseSpread: preset.baseSpread ?? 0,
    });
    onPresetChange(presetId, preset);
  }, [onPresetChange]);

  /** 슬라이더 값 변경 */
  const handleSliderChange = useCallback((key: keyof EditableParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
    onParamChange?.({ [key]: value });
  }, [onParamChange]);

  /** 카테고리별 아이콘 */
  function categoryIcon(cat: string): string {
    switch (cat) {
      case 'pistol': return '🔫';
      case 'rifle': return '⊕';
      case 'smg': return '⚡';
      case 'sniper': return '◎';
      default: return '•';
    }
  }

  return (
    <div className="weapon-config-panel">
      {/* 프리셋 드롭다운 */}
      <div className="weapon-config-panel__section">
        <label className="form-label">무기 프리셋</label>
        <select
          className="weapon-config-panel__select"
          value={selectedPresetId}
          onChange={(e) => handlePresetSelect(e.target.value)}
        >
          <optgroup label="시나리오 무기">
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {categoryIcon(opt.category)} {opt.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="기본 프리셋">
            <option value="default">기본 (반동 없음)</option>
            <option value="ar_cs2">AR (CS2 AK-47)</option>
            <option value="smg">SMG (빠른 연사)</option>
            <option value="sniper_pubg">Sniper (PUBG AWM)</option>
          </optgroup>
        </select>
      </div>

      {/* 파라미터 슬라이더 */}
      <div className="weapon-config-panel__section">
        <label className="form-label">파라미터 조절</label>
        {SLIDERS.map((s) => (
          <div key={s.key} className="weapon-config-panel__slider-row">
            <div className="weapon-config-panel__slider-header">
              <span className="weapon-config-panel__slider-label">{s.label}</span>
              <span className="weapon-config-panel__slider-value">
                {params[s.key].toFixed(s.step < 1 ? 2 : 0)}{s.unit}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              step={s.step}
              value={params[s.key]}
              onChange={(e) => handleSliderChange(s.key, parseFloat(e.target.value))}
              className="weapon-config-panel__slider"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
