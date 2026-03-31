/**
 * 캘리브레이션 설정 화면
 * 모드 선택 (Explore/Refine/Fixed) + 현재 감도 확인 + 시작
 */
import { useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import type { CalibrationMode, ConvergenceLevel } from '../stores/calibrationStore';

interface CalibrationSetupProps {
  onStart: (mode: CalibrationMode, convergence: ConvergenceLevel) => void;
  onBack: () => void;
}

/** 모드 설명 */
const MODE_INFO: Record<CalibrationMode, { label: string; desc: string }> = {
  explore: {
    label: 'Explore',
    desc: '넓은 범위에서 최적 감도를 탐색합니다. 현재 감도 ±15 cm/360 범위.',
  },
  refine: {
    label: 'Refine',
    desc: '현재 감도 근처 미세 조정. ±5~10% 범위. 머슬메모리를 보존합니다.',
  },
  fixed: {
    label: 'Fixed',
    desc: '감도를 변경하지 않고 Aim DNA만 수집합니다.',
  },
};

/** 수렴 레벨 설명 */
const CONVERGENCE_INFO: Record<ConvergenceLevel, { label: string; desc: string; iterations: string }> = {
  quick: {
    label: 'Quick',
    desc: '빠른 수렴. 기본값.',
    iterations: '~15회',
  },
  deep: {
    label: 'Deep',
    desc: '더 정밀한 탐색. 미세한 차이도 감지.',
    iterations: '~25회',
  },
  obsessive: {
    label: 'Obsessive',
    desc: '극도로 정밀한 탐색. 최대 반복.',
    iterations: '~40회',
  },
};

export function CalibrationSetup({ onStart, onBack }: CalibrationSetupProps) {
  const [selectedMode, setSelectedMode] = useState<CalibrationMode>('explore');
  const [convergence, setConvergence] = useState<ConvergenceLevel>('quick');
  const { cmPer360, selectedGame, sensitivity, dpi } = useSettingsStore();

  return (
    <div className="calibration-setup">
      <h2>Quick Calibration</h2>
      <p className="setup-subtitle">
        GP Bayesian Optimization으로 최적 감도를 찾습니다
      </p>

      {/* 현재 설정 요약 */}
      <div className="setup-summary">
        <div className="summary-row">
          <span className="summary-label">게임</span>
          <span className="summary-value">{selectedGame?.name ?? '미선택'}</span>
        </div>
        <div className="summary-row">
          <span className="summary-label">현재 감도</span>
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
        <h3>캘리브레이션 모드</h3>
        {(Object.keys(MODE_INFO) as CalibrationMode[]).map((mode) => (
          <button
            key={mode}
            className={`mode-btn ${selectedMode === mode ? 'active' : ''}`}
            onClick={() => setSelectedMode(mode)}
          >
            <span className="mode-label">{MODE_INFO[mode].label}</span>
            <span className="mode-desc">{MODE_INFO[mode].desc}</span>
          </button>
        ))}
      </div>

      {/* 수렴 모드 선택 */}
      <div className="mode-selector convergence-selector">
        <h3>수렴 모드</h3>
        {(Object.keys(CONVERGENCE_INFO) as ConvergenceLevel[]).map((level) => (
          <button
            key={level}
            className={`mode-btn ${convergence === level ? 'active' : ''}`}
            onClick={() => setConvergence(level)}
          >
            <span className="mode-label">
              {CONVERGENCE_INFO[level].label}
              <span className="iteration-badge">{CONVERGENCE_INFO[level].iterations}</span>
            </span>
            <span className="mode-desc">{CONVERGENCE_INFO[level].desc}</span>
          </button>
        ))}
      </div>

      {/* 안내 */}
      <div className="setup-info">
        <p>
          1단계: DNA 스크리닝 (~20회, ~3분) — 현재 감도로 워밍업 겸 기본 프로파일 수집
        </p>
        <p>
          2단계: 캘리브레이션 — AI가 다양한 감도를 제안하며 최적점 탐색
        </p>
      </div>

      {/* 버튼 */}
      <div className="setup-actions">
        <button className="btn-secondary" onClick={onBack}>
          뒤로
        </button>
        <button
          className="btn-primary"
          onClick={() => onStart(selectedMode, convergence)}
          disabled={!selectedGame}
        >
          시작
        </button>
      </div>
    </div>
  );
}
