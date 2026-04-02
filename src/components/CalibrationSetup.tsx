/**
 * 캘리브레이션 설정 화면
 * 모드 선택 (Explore/Refine/Fixed) + 현재 감도 확인 + 시작
 */
import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../i18n';
import type { CalibrationMode, ConvergenceLevel } from '../stores/calibrationStore';

interface CalibrationSetupProps {
  onStart: (mode: CalibrationMode, convergence: ConvergenceLevel) => void;
  onBack: () => void;
}

/** 모드 설명 — descKey는 i18n 키 */
const MODE_INFO: Record<CalibrationMode, { label: string; descKey: string }> = {
  explore: { label: 'Explore', descKey: 'cal.exploreDesc' },
  refine: { label: 'Refine', descKey: 'cal.refineDesc' },
  fixed: { label: 'Fixed', descKey: 'cal.fixedDesc' },
};

/** 수렴 레벨 설명 — descKey는 i18n 키 */
const CONVERGENCE_INFO: Record<ConvergenceLevel, { label: string; descKey: string; iterKey: string }> = {
  quick: { label: 'Quick', descKey: 'cal.quickDesc', iterKey: 'cal.quickIter' },
  deep: { label: 'Deep', descKey: 'cal.deepDesc', iterKey: 'cal.deepIter' },
  obsessive: { label: 'Obsessive', descKey: 'cal.obsessiveDesc', iterKey: 'cal.obsessiveIter' },
};

export function CalibrationSetup({ onStart, onBack }: CalibrationSetupProps) {
  const [selectedMode, setSelectedMode] = useState<CalibrationMode>('explore');
  const [convergence, setConvergence] = useState<ConvergenceLevel>('quick');
  const { cmPer360, selectedGame, sensitivity, dpi } = useSettingsStore();
  const { t } = useTranslation();

  return (
    <div className="calibration-setup">
      <h2>{t('tool.quickCal')}</h2>
      <p className="setup-subtitle">
        {t('cal.subtitle')}
      </p>

      {/* 현재 설정 요약 */}
      <div className="setup-summary">
        <div className="summary-row">
          <span className="summary-label">{t('settings.game')}</span>
          <span className="summary-value">{selectedGame?.name ?? t('onboarding.notSelected')}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">{t('cal.currentSens')}</span>
          <span className="summary-value">{sensitivity.toFixed(2)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">cm/360</span>
          <span className="summary-value">{cmPer360.toFixed(1)}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">DPI</span>
          <span className="summary-value">{dpi}</span>
        </div>
      </div>

      {/* 모드 선택 */}
      <div className="mode-selector">
        <h3>{t('cal.modeTitle')}</h3>
        {(Object.keys(MODE_INFO) as CalibrationMode[]).map((mode) => (
          <button
            key={mode}
            className={`mode-btn ${selectedMode === mode ? 'active' : ''}`}
            onClick={() => setSelectedMode(mode)}
          >
            <span className="mode-label">{MODE_INFO[mode].label}</span>
            <span className="mode-desc">{t(MODE_INFO[mode].descKey)}</span>
          </button>
        ))}
      </div>

      {/* 수렴 모드 선택 */}
      <div className="mode-selector convergence-selector">
        <h3>{t('cal.convergenceTitle')}</h3>
        {(Object.keys(CONVERGENCE_INFO) as ConvergenceLevel[]).map((level) => (
          <button
            key={level}
            className={`mode-btn ${convergence === level ? 'active' : ''}`}
            onClick={() => setConvergence(level)}
          >
            <span className="mode-label">
              {CONVERGENCE_INFO[level].label}
              <span className="iteration-badge">{t(CONVERGENCE_INFO[level].iterKey)}</span>
            </span>
            <span className="mode-desc">{t(CONVERGENCE_INFO[level].descKey)}</span>
          </button>
        ))}
      </div>

      {/* 안내 */}
      <div className="setup-info">
        <p>{t('cal.step1Info')}</p>
        <p>{t('cal.step2Info')}</p>
      </div>

      {/* 버튼 */}
      <div className="setup-actions">
        <button className="btn-secondary" onClick={onBack}>
          {t('common.back')}
        </button>
        <button
          className="btn-primary"
          onClick={() => onStart(selectedMode, convergence)}
          disabled={!selectedGame}
        >
          {t('common.start')}
        </button>
      </div>
    </div>
  );
}
