/**
 * 감도 변환 선택기
 * 6가지 변환 방식 비교 + 추천 + 감도 스냅
 */
import { useCallback, useEffect, useState } from 'react';
import { safeInvoke } from '../utils/ipc';
import { useToastStore } from '../stores/toastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { BackButton } from './BackButton';
import { LoadingSpinner } from './LoadingSpinner';

/** 게임 프리셋 */
interface GamePreset {
  id: string;
  name: string;
  yaw: number;
  default_fov: number;
  fov_type: string;
  sens_step: number | null;
  movement_ratio: number;
}

/** 변환 결과 */
interface ConversionResult {
  cm360: number;
  sens: number;
  multiplier: number;
}

/** 6가지 변환 결과 */
interface AllMethodsConversion {
  src_game: string;
  dst_game: string;
  src_cm360: number;
  src_fov_h: number;
  dst_fov_h: number;
  results: Record<string, ConversionResult>;
}

/** 감도 스냅 결과 */
interface SnappedSensitivity {
  floor_sens: number;
  floor_cm360: number;
  ceil_sens: number;
  ceil_cm360: number;
  recommended_sens: number;
  recommended_cm360: number;
}

/** 6가지 변환 방식 표시 이름 + 설명 */
const METHODS: Record<string, { label: string; desc: string }> = {
  'MDM_0': { label: 'MDM 0%', desc: '순수 FOV 탄젠트 비율 (택티컬 FPS 추천)' },
  'MDM_56.25': { label: 'MDM 56.25%', desc: '중간 균형 (BR 추천)' },
  'MDM_75': { label: 'MDM 75%', desc: '경쟁전 표준' },
  'MDM_100': { label: 'MDM 100%', desc: 'FOV 무관 동일 감도' },
  'Viewspeed_H': { label: 'Viewspeed H', desc: '수평 FOV 비율 (아레나 추천)' },
  'Viewspeed_V': { label: 'Viewspeed V', desc: '수직 FOV 비율' },
};

/** 게임 카테고리별 추천 방식 결정 */
function getRecommended(srcId: string, dstId: string): string {
  const tactical = ['cs2', 'csgo', 'css', 'cs16', 'valorant', 'valorant_console', 'r6siege', 'spectre_divide', 'ready_or_not', 'insurgency', 'squad'];
  const br = ['fortnite', 'pubg', 'apex', 'apex_mobile', 'super_people', 'naraka', 'hyperscape'];
  const arena = ['quake', 'unreal_tournament', 'diabotical', 'splitgate', 'halo_infinite'];
  // 둘 다 택티컬이면 MDM_0, BR이면 MDM_56.25, 아레나면 Viewspeed_H, 그 외 MDM_75
  if (tactical.includes(srcId) && tactical.includes(dstId)) return 'MDM_0';
  if (br.includes(srcId) || br.includes(dstId)) return 'MDM_56.25';
  if (arena.includes(srcId) && arena.includes(dstId)) return 'Viewspeed_H';
  return 'MDM_75';
}

export default function ConversionSelector({ onBack }: { onBack: () => void }) {
  const { dpi } = useSettingsStore();
  const [games, setGames] = useState<GamePreset[]>([]);
  const [srcGame, setSrcGame] = useState('cs2');
  const [dstGame, setDstGame] = useState('valorant');
  const [sens, setSens] = useState('2.0');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AllMethodsConversion | null>(null);
  const [snap, setSnap] = useState<SnappedSensitivity | null>(null);
  const [srcSearch, setSrcSearch] = useState('');
  const [dstSearch, setDstSearch] = useState('');

  // 게임 목록 로드
  useEffect(() => {
    safeInvoke<GamePreset[]>('get_available_games', {}).then((g) => {
      if (g) setGames(g);
    });
  }, []);

  /** 검색 필터링 */
  const filterGames = (query: string) => {
    if (!query.trim()) return games;
    const q = query.toLowerCase();
    return games.filter(g => g.name.toLowerCase().includes(q) || g.id.includes(q));
  };

  /** 변환 실행: 6가지 방식으로 변환 후, 추천 방식 기준 스냅 계산 */
  const convert = useCallback(async () => {
    const sensNum = parseFloat(sens);
    if (isNaN(sensNum) || sensNum <= 0) return;
    setLoading(true);
    const res = await safeInvoke<AllMethodsConversion>('convert_all_methods', {
      from_game_id: srcGame, to_game_id: dstGame, sens: sensNum, dpi, aspect_ratio: null,
    });
    setResult(res);

    // 추천 방식의 cm360으로 스냅
    if (res) {
      const rec = getRecommended(srcGame, dstGame);
      const recResult = res.results[rec];
      if (recResult) {
        const snapRes = await safeInvoke<SnappedSensitivity>('snap_sensitivity', {
          game_id: dstGame, target_cm360: recResult.cm360, dpi,
        });
        setSnap(snapRes);
      }
    }
    setLoading(false);
  }, [srcGame, dstGame, sens, dpi]);

  /** 소스/대상 게임 스왑 */
  const swap = () => {
    setSrcGame(dstGame);
    setDstGame(srcGame);
    setResult(null);
    setSnap(null);
  };

  /** 클립보드에 감도 값 복사 */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    useToastStore.getState().addToast('복사 완료', 'success', 1500);
  };

  const recommended = result ? getRecommended(srcGame, dstGame) : '';

  return (
    <div className="page page--narrow">
      {/* 헤더: 뒤로가기 + 제목 */}
      <div className="page-header">
        <BackButton onBack={onBack} />
        <h2>감도 변환기</h2>
      </div>

      {/* 입력 영역: 소스/대상 게임 선택 + 감도 입력 + 변환 버튼 */}
      <div className="conversion-controls">
        <label className="form-label">
          소스 게임
          <input
            type="text"
            className="input-field"
            placeholder="검색..."
            value={srcSearch}
            onChange={e => setSrcSearch(e.target.value)}
            style={{ marginBottom: 4, fontSize: 12 }}
          />
          <select
            className="select-field"
            value={srcGame}
            onChange={(e) => { setSrcGame(e.target.value); setResult(null); setSrcSearch(''); }}
          >
            {filterGames(srcSearch).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        <button className="btn btn--ghost btn--icon" onClick={swap} title="소스/대상 스왑">
          ⇄
        </button>

        <label className="form-label">
          대상 게임
          <input
            type="text"
            className="input-field"
            placeholder="검색..."
            value={dstSearch}
            onChange={e => setDstSearch(e.target.value)}
            style={{ marginBottom: 4, fontSize: 12 }}
          />
          <select
            className="select-field"
            value={dstGame}
            onChange={(e) => { setDstGame(e.target.value); setResult(null); setDstSearch(''); }}
          >
            {filterGames(dstSearch).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        <label className="form-label">
          소스 감도
          <input
            className="input-field"
            value={sens}
            onChange={(e) => setSens(e.target.value)}
            type="number"
            step="0.01"
            min="0.01"
            style={{ width: 100 }}
          />
        </label>

        <button
          className="btn btn--primary convert-button"
          onClick={convert}
          disabled={loading}
        >
          {loading ? '계산 중...' : '변환'}
        </button>
      </div>

      {loading && <LoadingSpinner label="변환 계산 중..." />}

      {/* 결과 테이블: 6가지 방식의 변환 결과 표시 */}
      {result && !loading && (
        <>
          <div className="conversion-fov-info">
            {result.src_game} → {result.dst_game} | 소스 cm/360: {result.src_cm360.toFixed(2)} | FOV: {result.src_fov_h.toFixed(1)}° → {result.dst_fov_h.toFixed(1)}°
          </div>

          <table className="conversion-table">
            <thead>
              <tr>
                <th>방식</th>
                <th>cm/360</th>
                <th>감도</th>
                <th>배율</th>
                <th>설명</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(METHODS).map(([key, meta]) => {
                const r = result.results[key];
                if (!r) return null;
                const isRec = key === recommended;
                return (
                  <tr
                    key={key}
                    className={isRec ? 'data-table highlight' : ''}
                    style={isRec ? { background: 'rgba(233,69,96,0.1)' } : undefined}
                  >
                    <td>
                      {meta.label}
                      {isRec && <span className="badge badge--accent" style={{ marginLeft: 6 }}>추천</span>}
                    </td>
                    <td>{r.cm360.toFixed(2)}</td>
                    <td className="font-semibold">{r.sens.toFixed(4)}</td>
                    <td>×{r.multiplier.toFixed(4)}</td>
                    <td className="text-sm text-muted">{meta.desc}</td>
                    <td>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => copyToClipboard(r.sens.toFixed(4))}
                      >
                        복사
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 감도 스냅 결과: 추천 방식 기준 floor/ceil/추천 감도 */}
          {snap && (
            <div className="conversion-results" style={{ marginTop: 16 }}>
              <h3 className="page-section__title">감도 스냅 (추천 방식 기준)</h3>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <div className="stat-label">추천 감도</div>
                  <div className="stat-value stat-value--success">{snap.recommended_sens.toFixed(4)}</div>
                  <div className="snap-indicator">{snap.recommended_cm360.toFixed(2)} cm/360</div>
                </div>
                <div>
                  <div className="stat-label">Floor</div>
                  <div className="stat-value">{snap.floor_sens.toFixed(4)}</div>
                  <div className="snap-indicator">{snap.floor_cm360.toFixed(2)} cm/360</div>
                </div>
                <div>
                  <div className="stat-label">Ceil</div>
                  <div className="stat-value">{snap.ceil_sens.toFixed(4)}</div>
                  <div className="snap-indicator">{snap.ceil_cm360.toFixed(2)} cm/360</div>
                </div>
              </div>
              <button
                className="btn btn--success"
                onClick={() => copyToClipboard(snap.recommended_sens.toFixed(4))}
                style={{ marginTop: 10 }}
              >
                추천 감도 복사
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
