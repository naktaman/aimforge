/**
 * CrossGameConverter — 크로스게임 줌 감도 변환 UI
 * 소스 게임/감도 입력 → 타겟 게임/옵틱 선택 → 개인 k로 변환 결과 표��
 */
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ZoomProfileChart } from './ZoomProfileChart';
import { useSettingsStore } from '../stores/settingsStore';
import { useZoomCalibrationStore } from '../stores/zoomCalibrationStore';
import { DEFAULT_GAME_ZOOM_PROFILES } from '../utils/physics';
import { UI_COLORS } from '../config/theme';

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

  // 변환 실행
  const convert = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      // 게임 줌 프로파일 매칭
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
    <div style={{ padding: 20, maxWidth: 800, color: UI_COLORS.textPrimary }}>
      <h2 style={{ marginBottom: 16 }}>크로스게임 줌 감도 변환</h2>

      {/* 입력 폼 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        {/* 소스 게임 */}
        <div>
          <label style={{ fontSize: 12, color: UI_COLORS.textSecondary }}>소스 게임</label>
          <select
            value={sourceGame}
            onChange={e => setSourceGame(e.target.value)}
            style={selectStyle}
          >
            <option value="cs2">CS2</option>
            <option value="valorant">Valorant</option>
            <option value="apex">Apex Legends</option>
            <option value="overwatch2">Overwatch 2</option>
            <option value="pubg">PUBG</option>
            <option value="r6siege">Rainbow Six Siege</option>
            <option value="cod_mw">CoD: Warzone</option>
          </select>
        </div>

        {/* 타겟 게임 */}
        <div>
          <label style={{ fontSize: 12, color: UI_COLORS.textSecondary }}>��겟 게임</label>
          <select
            value={targetGame}
            onChange={e => setTargetGame(e.target.value)}
            style={selectStyle}
          >
            <option value="cs2">CS2</option>
            <option value="valorant">Valorant</option>
            <option value="apex">Apex Legends</option>
            <option value="overwatch2">Overwatch 2</option>
            <option value="pubg">PUBG</option>
            <option value="r6siege">Rainbow Six Siege</option>
            <option value="cod_mw">CoD: Warzone</option>
          </select>
        </div>

        {/* 소스 감도 */}
        <div>
          <label style={{ fontSize: 12, color: UI_COLORS.textSecondary }}>소스 감도</label>
          <input
            type="number"
            step="0.01"
            value={sourceSens}
            onChange={e => setSourceSens(e.target.value)}
            style={inputStyle}
          />
        </div>

        {/* 줌 배율 선택 */}
        <div>
          <label style={{ fontSize: 12, color: UI_COLORS.textSecondary }}>줌 배율</label>
          <select
            value={zoomRatio}
            onChange={e => setZoomRatio(Number(e.target.value))}
            style={selectStyle}
          >
            {ZOOM_PRESETS.map(p => (
              <option key={p.ratio} value={p.ratio}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 개인 k 정보 */}
      {kFitResult && (
        <div style={{ padding: '8px 12px', background: UI_COLORS.bgSurface, borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          개인 k: <strong style={{ color: UI_COLORS.infoHighlight }}>{kFitResult.kValue.toFixed(3)}</strong>
          {' '}({kFitResult.quality})
          {kFitResult.piecewiseK && ` | Piecewise: ${kFitResult.piecewiseK.length}구간`}
        </div>
      )}

      {/* 변환 버튼 */}
      <button
        onClick={convert}
        disabled={loading}
        style={{
          padding: '10px 24px',
          background: loading ? '#475569' : '#2563eb',
          color: UI_COLORS.textWhite,
          border: 'none',
          borderRadius: 6,
          cursor: loading ? 'wait' : 'pointer',
          fontSize: 14,
          fontWeight: 600,
          marginBottom: 16,
        }}
      >
        {loading ? '변환 중...' : '변환'}
      </button>

      {/* 에러 */}
      {error && (
        <div style={{ padding: 8, background: '#7f1d1d', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* 결과 */}
      {result && (
        <div style={{ background: UI_COLORS.bgSurface, borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h3 style={{ marginBottom: 12, fontSize: 16 }}>변환 결과</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              <ResultRow label="소스 cm/360 (힙파이어)" value={`${result.sourceCm360.toFixed(2)} cm`} />
              <ResultRow label="소스 줌 cm/360" value={`${result.sourceZoomCm360.toFixed(2)} cm`} />
              <ResultRow label="타겟 감도" value={result.targetSens.toFixed(4)} highlight />
              <ResultRow label="타겟 줌 cm/360" value={`${result.targetZoomCm360.toFixed(2)} cm`} />
              <ResultRow label="사용된 k" value={result.kUsed.toFixed(3)} />
              <ResultRow label="소스 배율" value={result.sourceMultiplier.toFixed(3)} />
              <ResultRow label="타겟 배율" value={result.targetMultiplier.toFixed(3)} />
              <ResultRow label="배율 차이" value={result.multiplierDiff.toFixed(3)} />
            </tbody>
          </table>
        </div>
      )}

      {/* k 프로파일 차트 */}
      {chartPoints.length > 0 && (
        <div>
          <h3 style={{ marginBottom: 8, fontSize: 14 }}>줌 프로파일 (배율 vs k)</h3>
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

/** 결과 테이블 행 */
function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <tr style={{ borderBottom: '1px solid #334155' }}>
      <td style={{ padding: '6px 8px', color: UI_COLORS.textSecondary }}>{label}</td>
      <td style={{
        padding: '6px 8px',
        textAlign: 'right',
        fontWeight: highlight ? 700 : 400,
        color: highlight ? UI_COLORS.successGreen : UI_COLORS.textPrimary,
        fontSize: highlight ? 15 : 13,
      }}>{value}</td>
    </tr>
  );
}

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: UI_COLORS.bgSurface,
  color: UI_COLORS.textPrimary,
  border: '1px solid #334155',
  borderRadius: 6,
  fontSize: 13,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: UI_COLORS.bgSurface,
  color: UI_COLORS.textPrimary,
  border: '1px solid #334155',
  borderRadius: 6,
  fontSize: 13,
  boxSizing: 'border-box',
};
