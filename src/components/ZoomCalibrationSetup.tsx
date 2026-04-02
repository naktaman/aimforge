/**
 * 줌 캘리브레이션 설정 화면
 * 스코프 선택, AI 추천 비율, 수렴 모드 설정
 */
import { useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useZoomCalibrationStore, type ZoomProfile } from '../stores/zoomCalibrationStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../i18n';

interface ZoomCalibrationSetupProps {
  onStart: () => void;
  onBack: () => void;
}

export function ZoomCalibrationSetup({ onStart, onBack }: ZoomCalibrationSetupProps) {
  const {
    availableProfiles,
    recommendedIndices,
    selectedProfileIds,
    convergenceMode,
    setAvailableProfiles,
    setRecommendedIndices,
    setSelectedProfileIds,
    setConvergenceMode,
  } = useZoomCalibrationStore();

  const { selectedGame } = useSettingsStore();
  const { t } = useTranslation();

  // 게임 변경 시 줌 프로파일 로드
  useEffect(() => {
    if (!selectedGame) return;
    (async () => {
      try {
        const profiles = await invoke<ZoomProfile[]>('get_zoom_profiles', {
          // NOTE: game_id는 DB games 테이블 PK — 현재 줌 프로파일은 DB 시드 기반
          // 게임 프리셋(String ID)과 DB games(integer ID) 매핑은 시드 인프라 구축 후 연동 예정
          gameId: 1,
        });
        setAvailableProfiles(profiles);

        // AI 추천: 균등 분포 3개 선택
        if (profiles.length > 3) {
          const step = (profiles.length - 1) / 2;
          const indices = [0, Math.round(step), profiles.length - 1];
          setRecommendedIndices(indices);
          setSelectedProfileIds(indices.map((i) => profiles[i].id));
        } else {
          const indices = profiles.map((_, i) => i);
          setRecommendedIndices(indices);
          setSelectedProfileIds(profiles.map((p) => p.id));
        }
      } catch (e) {
        console.error('줌 프로파일 로드 실패:', e);
      }
    })();
  }, [selectedGame, setAvailableProfiles, setRecommendedIndices, setSelectedProfileIds]);

  /** 프로파일 선택 토글 */
  const toggleProfile = useCallback(
    (id: number) => {
      setSelectedProfileIds(
        selectedProfileIds.includes(id)
          ? selectedProfileIds.filter((pid) => pid !== id)
          : [...selectedProfileIds, id]
      );
    },
    [selectedProfileIds, setSelectedProfileIds],
  );

  const canStart = selectedProfileIds.length >= 2;

  return (
    <div className="zoom-calibration-setup">
      <h2>{t('zoom.title')}</h2>
      <p className="subtitle">{t('zoom.subtitle')}</p>

      {/* 스코프 선택 */}
      <section className="scope-selection">
        <h3>{t('zoom.scopeSelect')}</h3>
        {availableProfiles.length === 0 ? (
          <p className="no-data">{t('zoom.noProfile')}</p>
        ) : (
          <div className="scope-list">
            {availableProfiles.map((p, i) => (
              <label
                key={p.id}
                className={`scope-item ${selectedProfileIds.includes(p.id) ? 'selected' : ''} ${recommendedIndices.includes(i) ? 'recommended' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedProfileIds.includes(p.id)}
                  onChange={() => toggleProfile(p.id)}
                />
                <span className="scope-name">{p.scopeName}</span>
                <span className="scope-ratio">{p.zoomRatio}x</span>
                {recommendedIndices.includes(i) && (
                  <span className="ai-badge">AI</span>
                )}
              </label>
            ))}
          </div>
        )}
      </section>

      {/* 수렴 모드 */}
      <section className="convergence-mode">
        <h3>{t('zoom.searchDepth')}</h3>
        <div className="mode-options">
          {(['quick', 'deep', 'obsessive'] as const).map((mode) => (
            <label
              key={mode}
              className={`mode-option ${convergenceMode === mode ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="convergenceMode"
                value={mode}
                checked={convergenceMode === mode}
                onChange={() => setConvergenceMode(mode)}
              />
              <div className="mode-info">
                <strong>
                  {mode === 'quick' ? 'Quick' : mode === 'deep' ? 'Deep' : 'Obsessive'}
                </strong>
                <span className="mode-desc">
                  {mode === 'quick' && t('zoom.quickSearch')}
                  {mode === 'deep' && t('zoom.deepSearch')}
                  {mode === 'obsessive' && t('zoom.obsessiveSearch')}
                </span>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* 버튼 */}
      <div className="setup-actions">
        <button className="btn-secondary" onClick={onBack}>
          {t('common.back')}
        </button>
        <button
          className="btn-primary"
          onClick={onStart}
          disabled={!canStart}
        >
          {t('zoom.startCal')} ({selectedProfileIds.length})
        </button>
      </div>
    </div>
  );
}
