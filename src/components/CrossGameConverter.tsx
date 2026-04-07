/**
 * CrossGameConverter — 크로스게임 줌 감도 변환 UI (Cold Forge)
 * gameDatabase 59개 게임 활용, CSS 변수 기반 스타일링
 * 소스 게임/감도 입력 → cm/360 변환 → 타겟 게임 감도 출력
 */
import { useState, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ZoomProfileChart } from './ZoomProfileChart';
import { useSettingsStore } from '../stores/settingsStore';
import { useZoomCalibrationStore } from '../stores/zoomCalibrationStore';
import { DEFAULT_GAME_ZOOM_PROFILES } from '../utils/physics';
import { GAME_DATABASE } from '../data/gameDatabase';

/** 변환 결과 타입 (Rust CrossgameZoomResult 미러) */
interface CrossgameZoomResult {
  sourceCm360: number;
  sourceZoomCm360: number;
  targetSens: number;
  targetZoomCm360: number;
  kUsed: number;
  sourceMultiplier: number;
  targetMultiplier: number;
  multiplierDiff: number;
}

/** 줌 프리셋 옵션 */
const ZOOM_PRESETS = [
  { label: '1x (Red Dot)', ratio: 1 },
  { label: '2x (ACOG)', ratio: 2 },
  { label: '4x', ratio: 4 },
  { label: '6x', ratio: 6 },
  { label: '8x', ratio: 8 },
  { label: '10x', ratio: 10 },
  { label: '12x', ratio: 12 },
];

export function CrossGameConverter() {
  const { selectedGame } = useSettingsStore();
  const { kFitResult } = useZoomCalibrationStore();

  const [sourceGame, setSourceGame] = useState(selectedGame?.id || 'cs2');
  const [targetGame, setTargetGame] = useState('apex');
  const [sourceSens, setSourceSens] = useState('2.0');
  const [zoomRatio, setZoomRatio] = useState(4);
  const [result, setResult] = useState<CrossgameZoomResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 검증된 게임만 필터 (yaw 값 있는 게임)
  const availableGames = useMemo(
    () => GAME_DATABASE.filter(g => g.yaw > 0).sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  // 현재 선택된 소스/타겟 게임 정보
  const sourceGameInfo = useMemo(
    () => GAME_DATABASE.find(g => g.id === sourceGame),
    [sourceGame],
  );
  const targetGameInfo = useMemo(
    () => GAME_DATABASE.find(g => g.id === targetGame),
    [targetGame],
  );

  // 변환 실행
  const convert = useCallback(async (): Promise<void> => {
    setError('');
    setLoading(true);
    try {
      const zoomProfile = DEFAULT_GAME_ZOOM_PROFILES.find(
        p => p.id.startsWith(targetGame),
      );

      const res = await invoke<CrossgameZoomResult>('convert_crossgame_zoom_sensitivity', {
        params: {
          sourceGame,
          targetGame,
          sourceSens: parseFloat(sourceSens),
          optic: `${zoomRatio}x`,
          zoomRatio,
          kValue: kFitResult?.kValue ?? null,
          piecewiseK: kFitResult?.piecewiseK ?? null,
          aimTypeK: null,
          gameZoomProfile: zoomProfile ?? null,
        },
      });
      setResult(res);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [sourceGame, targetGame, sourceSens, zoomRatio, kFitResult]);

  // ZoomProfileChart 데이터 구성
  const chartPoints = kFitResult?.dataPoints?.map((dp: { zoomRatio: number; score: number }) => ({
    zoomRatio: dp.zoomRatio,
    kValue: kFitResult.kValue,
    isMeasured: true,
    label: `${dp.zoomRatio}x`,
  })) ?? [];

  return (
    <div className="cgc">
      <h2 className="cgc__title heading">크로스게임 줌 감도 변환</h2>
      <p className="cgc__subtitle">
        {availableGames.length}개 게임 지원 · cm/360 기반 정밀 변환
      </p>

      {/* ── 입력 폼 ── */}
      <div className="cgc__form">
        {/* 소스 게임 */}
        <div className="cgc__field">
          <label className="cgc__label">소스 게임</label>
          <select
            className="cgc__select"
            value={sourceGame}
            onChange={e => setSourceGame(e.target.value)}
          >
            {availableGames.map(g => (
              <option key={g.id} value={g.id}>
                {g.name} {g.confidence === 'verified' ? '✓' : ''}
              </option>
            ))}
          </select>
          {sourceGameInfo && (
            <span className="cgc__hint">
              yaw: {sourceGameInfo.yaw} · {sourceGameInfo.engine}
            </span>
          )}
        </div>

        {/* 타겟 게임 */}
        <div className="cgc__field">
          <label className="cgc__label">타겟 게임</label>
          <select
            className="cgc__select"
            value={targetGame}
            onChange={e => setTargetGame(e.target.value)}
          >
            {availableGames.map(g => (
              <option key={g.id} value={g.id}>
                {g.name} {g.confidence === 'verified' ? '✓' : ''}
              </option>
            ))}
          </select>
          {targetGameInfo && (
            <span className="cgc__hint">
              yaw: {targetGameInfo.yaw} · {targetGameInfo.engine}
            </span>
          )}
        </div>

        {/* 소스 감도 */}
        <div className="cgc__field">
          <label className="cgc__label">소스 감도</label>
          <input
            className="cgc__input"
            type="number"
            step="0.01"
            value={sourceSens}
            onChange={e => setSourceSens(e.target.value)}
          />
        </div>

        {/* 줌 배율 선택 */}
        <div className="cgc__field">
          <label className="cgc__label">줌 배율</label>
          <select
            className="cgc__select"
            value={zoomRatio}
            onChange={e => setZoomRatio(Number(e.target.value))}
          >
            {ZOOM_PRESETS.map(p => (
              <option key={p.ratio} value={p.ratio}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── 개인 k 정보 카드 ── */}
      {kFitResult && (
        <div className="cgc__k-card">
          <span className="cgc__k-label">개인 k</span>
          <span className="cgc__k-value data-value">{kFitResult.kValue.toFixed(3)}</span>
          <span className="cgc__k-quality">{kFitResult.quality}</span>
          {kFitResult.piecewiseK && (
            <span className="cgc__k-piecewise">Piecewise: {kFitResult.piecewiseK.length}구간</span>
          )}
        </div>
      )}

      {/* ── 변환 버튼 ── */}
      <button
        className="cgc__convert-btn btn-primary"
        onClick={convert}
        disabled={loading}
      >
        {loading ? '변환 중...' : '변환'}
      </button>

      {/* ── 에러 ── */}
      {error && <div className="cgc__error">{error}</div>}

      {/* ── 결과 카드 ── */}
      {result && (
        <div className="cgc__result-card">
          <h3 className="cgc__result-title heading">변환 결과</h3>
          <div className="cgc__result-grid">
            <ResultItem label="소스 cm/360 (힙파이어)" value={`${result.sourceCm360.toFixed(2)} cm`} />
            <ResultItem label="소스 줌 cm/360" value={`${result.sourceZoomCm360.toFixed(2)} cm`} />
            <ResultItem label="타겟 감도" value={result.targetSens.toFixed(4)} highlight />
            <ResultItem label="타겟 줌 cm/360" value={`${result.targetZoomCm360.toFixed(2)} cm`} />
            <ResultItem label="사용된 k" value={result.kUsed.toFixed(3)} />
            <ResultItem label="소스 배율" value={result.sourceMultiplier.toFixed(3)} />
            <ResultItem label="타겟 배율" value={result.targetMultiplier.toFixed(3)} />
            <ResultItem label="배율 차이" value={result.multiplierDiff.toFixed(3)} />
          </div>
        </div>
      )}

      {/* ── k 프로파일 차트 ── */}
      {chartPoints.length > 0 && (
        <div className="cgc__chart-section">
          <h3 className="cgc__chart-title heading">줌 프로파일 (배율 vs k)</h3>
          <ZoomProfileChart
            points={chartPoints}
            globalK={kFitResult?.kValue}
            piecewise={kFitResult?.piecewiseK?.map((p: { ratioStart: number; ratioEnd: number; k: number }) => ({
              ratioStart: p.ratioStart,
              ratioEnd: p.ratioEnd,
              k: p.k,
            }))}
          />
        </div>
      )}
    </div>
  );
}

/** 결과 항목 — Cold Forge 카드 내 개별 행 */
function ResultItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`cgc__result-item ${highlight ? 'cgc__result-item--highlight' : ''}`}>
      <span className="cgc__result-label">{label}</span>
      <span className={`cgc__result-value data-value ${highlight ? 'cgc__result-value--highlight' : ''}`}>
        {value}
      </span>
    </div>
  );
}
