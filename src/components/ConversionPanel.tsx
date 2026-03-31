/**
 * 감도 변환 패널 — 6가지 변환 방식 동시 비교
 * MDM 0/56.25/75/100%, Viewspeed H/V 결과를 테이블로 표시
 * sens_step 스냅 결과 포함
 */
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../stores/settingsStore';
import type { GamePreset, AllMethodsConversion, ConversionMethod } from '../utils/types';

/** 변환 방식 표시 순서 및 라벨 */
const METHOD_LABELS: Array<{ key: ConversionMethod; label: string; description: string }> = [
  { key: 'MDM_0', label: 'MDM 0%', description: '순수 FOV 비율 (기본)' },
  { key: 'MDM_56.25', label: 'MDM 56.25%', description: '일반적 FPS 권장' },
  { key: 'MDM_75', label: 'MDM 75%', description: '높은 모니터 거리 매칭' },
  { key: 'MDM_100', label: 'MDM 100%', description: '동일 감도 유지' },
  { key: 'Viewspeed_H', label: 'Viewspeed H', description: '수평 화면 속도 매칭' },
  { key: 'Viewspeed_V', label: 'Viewspeed V', description: '수직 화면 속도 매칭' },
];

interface ConversionPanelProps {
  /** 사용 가능한 게임 목록 */
  games: GamePreset[];
}

export function ConversionPanel({ games }: ConversionPanelProps) {
  const { selectedGame, sensitivity, dpi } = useSettingsStore();
  const [targetGameId, setTargetGameId] = useState<string>('');
  const [result, setResult] = useState<AllMethodsConversion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 대상 게임 프리셋
  const targetGame = games.find((g) => g.id === targetGameId);

  /** 6가지 방식 변환 실행 */
  const handleConvert = async () => {
    if (!selectedGame || !targetGameId) return;

    setLoading(true);
    setError(null);
    try {
      const conversion = await invoke<AllMethodsConversion>('convert_all_methods', {
        fromGameId: selectedGame.id,
        toGameId: targetGameId,
        sens: sensitivity,
        dpi,
      });
      setResult(conversion);
    } catch (e) {
      setError(String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="settings-section conversion-panel">
      <h3>감도 변환기</h3>

      {/* 출발 게임 정보 */}
      {selectedGame && (
        <div className="conversion-source">
          <span className="source-label">출발:</span>
          <span className="source-value">
            {selectedGame.name} — sens {sensitivity} @ {dpi} DPI
          </span>
        </div>
      )}

      {/* 대상 게임 선택 + 변환 버튼 */}
      <div className="conversion-controls">
        <label>
          대상 게임
          <select
            value={targetGameId}
            onChange={(e) => {
              setTargetGameId(e.target.value);
              setResult(null);
            }}
          >
            <option value="">선택하세요</option>
            {games
              .filter((g) => g.id !== selectedGame?.id)
              .map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
          </select>
        </label>
        <button
          className="convert-button"
          onClick={handleConvert}
          disabled={!selectedGame || !targetGameId || loading}
        >
          {loading ? '변환 중...' : '변환'}
        </button>
      </div>

      {/* 에러 표시 */}
      {error && <div className="conversion-error">{error}</div>}

      {/* 결과 테이블 */}
      {result && (
        <div className="conversion-results">
          <div className="conversion-fov-info">
            FOV: {result.src_fov_h.toFixed(1)}° → {result.dst_fov_h.toFixed(1)}°
            {' | '}cm/360: {result.src_cm360.toFixed(2)}
          </div>
          <table className="conversion-table">
            <thead>
              <tr>
                <th>방식</th>
                <th>cm/360</th>
                <th>감도</th>
                <th>배율</th>
              </tr>
            </thead>
            <tbody>
              {METHOD_LABELS.map(({ key, label }) => {
                const r = result.results[key];
                if (!r) return null;

                // sens_step 스냅 표시
                const step = targetGame?.sens_step;
                let snappedSens = r.sens;
                if (step) {
                  const floor = Math.floor(r.sens / step) * step;
                  const ceil = Math.ceil(r.sens / step) * step;
                  // 더 가까운 쪽 선택
                  snappedSens = Math.abs(r.sens - floor) <= Math.abs(r.sens - ceil) ? floor : ceil;
                }

                return (
                  <tr key={key}>
                    <td title={METHOD_LABELS.find((m) => m.key === key)?.description}>
                      {label}
                    </td>
                    <td>{r.cm360.toFixed(2)}</td>
                    <td>
                      {step ? (
                        <span className="snapped-sens">
                          {snappedSens.toFixed(step < 1 ? Math.ceil(-Math.log10(step)) : 0)}
                          {snappedSens !== parseFloat(r.sens.toFixed(6)) && (
                            <span className="snap-indicator" title={`이상적: ${r.sens.toFixed(4)}`}> *</span>
                          )}
                        </span>
                      ) : (
                        r.sens.toFixed(4)
                      )}
                    </td>
                    <td>{r.multiplier.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="conversion-note">
            * 스냅: 게임 감도 단위({targetGame?.sens_step ?? 'N/A'})에 맞춤
          </div>
        </div>
      )}
    </section>
  );
}
