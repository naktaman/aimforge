/**
 * 온보딩 위자드 (첫 실행 시 표시)
 * 5단계: 환영 → DPI → 게임 선택 → 감도 → 완료
 */
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import { useUiStore, type AppMode } from '../stores/uiStore';
import { useTranslation } from '../i18n';
import { gameSensToCm360 } from '../utils/physics';
import type { GamePreset } from '../utils/types';

const TOTAL_STEPS = 5;

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [dpi, setDpi] = useState(800);
  const [games, setGames] = useState<GamePreset[]>([]);
  const [selectedGame, setSelectedGame] = useState<GamePreset | null>(null);
  const [sensitivity, setSensitivity] = useState(1.0);
  const [mode, setMode] = useState<AppMode>('simple');

  const settingsStore = useSettingsStore();
  const uiStore = useUiStore();
  const { t } = useTranslation();

  /** 게임 목록 로드 */
  useEffect(() => {
    invoke<GamePreset[]>('get_available_games')
      .then(setGames)
      .catch((e) => console.error('게임 목록 로드 실패:', e));
  }, []);

  /** cm/360 실시간 계산 */
  const cm360 = selectedGame
    ? gameSensToCm360(sensitivity, dpi, selectedGame.yaw)
    : null;

  /** 완료 처리 — 설정 저장 후 메인 화면 전환 */
  const handleComplete = () => {
    settingsStore.setDpi(dpi);
    if (selectedGame) {
      settingsStore.selectGame(selectedGame);
      settingsStore.setSensitivity(sensitivity);
    }
    uiStore.setMode(mode);
    uiStore.completeOnboarding();
  };

  /** 다음 단계로 이동 (유효성 체크 포함) */
  const next = () => {
    // 게임 선택 단계에서 게임 미선택 시 차단
    if (step === 2 && !selectedGame) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="onboarding-overlay">
      <div className="onboarding-card">
        {/* 진행 도트 */}
        <div className="onboarding-dots">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`onboarding-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
            />
          ))}
        </div>

        {/* Step 0: 환영 */}
        {step === 0 && (
          <>
            <h2>{t('onboarding.welcome')}</h2>
            <p>{t('onboarding.welcomeDesc')}</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('onboarding.quickSetupHint')}
            </p>
            <div className="onboarding-actions">
              <button className="btn-primary" onClick={next}>{t('onboarding.getStarted')}</button>
            </div>
          </>
        )}

        {/* Step 1: DPI */}
        {step === 1 && (
          <>
            <h2>{t('onboarding.mouseSetup')}</h2>
            <p>{t('onboarding.mouseSetupDesc')}</p>
            <div className="onboarding-field">
              <label>DPI</label>
              <input
                type="number"
                min={100}
                max={32000}
                value={dpi}
                onChange={(e) => setDpi(Number(e.target.value) || 800)}
              />
            </div>
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
              <button className="btn-primary" onClick={next}>{t('common.next')}</button>
            </div>
          </>
        )}

        {/* Step 2: 게임 선택 */}
        {step === 2 && (
          <>
            <h2>{t('onboarding.gameSelect')}</h2>
            <p>{t('onboarding.gameSelectDesc')}</p>
            <div className="game-grid">
              {games.map((g) => (
                <div
                  key={g.name}
                  className={`game-card ${selectedGame?.name === g.name ? 'selected' : ''}`}
                  onClick={() => setSelectedGame(g)}
                >
                  {g.name}
                </div>
              ))}
            </div>
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
              <button className="btn-primary" onClick={next} disabled={!selectedGame}>{t('common.next')}</button>
            </div>
          </>
        )}

        {/* Step 3: 감도 */}
        {step === 3 && (
          <>
            <h2>{t('onboarding.sensSetup')}</h2>
            <p>{t('onboarding.sensSetupDesc').replace('{game}', selectedGame?.name ?? '')}</p>
            <div className="onboarding-field">
              <label>{t('onboarding.sensLabel')}</label>
              <input
                type="number"
                step="0.01"
                min={0.01}
                max={100}
                value={sensitivity}
                onChange={(e) => setSensitivity(Number(e.target.value) || 1.0)}
              />
              {cm360 !== null && (
                <div className="cm360-preview">
                  {cm360.toFixed(1)} cm/360
                </div>
              )}
            </div>
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
              <button className="btn-primary" onClick={next}>{t('common.next')}</button>
            </div>
          </>
        )}

        {/* Step 4: 완료 + 모드 선택 */}
        {step === 4 && (
          <>
            <h2>{t('onboarding.done')}</h2>
            <dl className="onboarding-summary">
              <dt>DPI</dt>
              <dd>{dpi}</dd>
              <dt>{t('settings.game')}</dt>
              <dd>{selectedGame?.name ?? t('onboarding.notSelected')}</dd>
              <dt>{t('settings.sensitivity')}</dt>
              <dd>{sensitivity} {cm360 ? `(${cm360.toFixed(1)} cm/360)` : ''}</dd>
            </dl>
            <div className="onboarding-field">
              <label>{t('onboarding.uiMode')}</label>
              <div className="mode-pill" style={{ justifyContent: 'center', marginTop: 8 }}>
                <button
                  className={mode === 'simple' ? 'active' : ''}
                  onClick={() => setMode('simple')}
                >
                  Simple
                </button>
                <button
                  className={mode === 'advanced' ? 'active' : ''}
                  onClick={() => setMode('advanced')}
                >
                  Advanced
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>
                {t('onboarding.simpleDesc')}
              </p>
            </div>
            <div className="onboarding-actions">
              <button className="btn-secondary" onClick={prev}>{t('common.prev')}</button>
              <button className="btn-primary" onClick={handleComplete}>{t('common.start')}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
