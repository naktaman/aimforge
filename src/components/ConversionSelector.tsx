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

/** 게임 카테고리별 추천 방식 */
function getRecommended(srcId: string, dstId: string): string {
  const tactical = ['cs2', 'valorant', 'r6_siege'];
  const br = ['fortnite', 'pubg', 'apex'];
  // 둘 다 택티컬이면 MDM_0, BR이면 MDM_56.25, 그 외 MDM_75
  if (tactical.includes(srcId) && tactical.includes(dstId)) return 'MDM_0';
  if (br.includes(srcId) || br.includes(dstId)) return 'MDM_56.25';
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

  // 게임 목록 로드
  useEffect(() => {
    safeInvoke<GamePreset[]>('get_available_games', {}).then((g) => {
      if (g) setGames(g);
    });
  }, []);

  /** 변환 실행 */
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

  /** 소스/대상 스왑 */
  const swap = () => {
    setSrcGame(dstGame);
    setDstGame(srcGame);
    setResult(null);
    setSnap(null);
  };

  /** 클립보드 복사 */
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    useToastStore.getState().addToast('복사 완료', 'success', 1500);
  };

  const recommended = result ? getRecommended(srcGame, dstGame) : '';

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto', color: '#e0e0e0', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BackButton onBack={onBack} />
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>감도 변환기</h2>
      </div>

      {/* 입력 영역 */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
        <label style={labelStyle}>
          소스 게임
          <select value={srcGame} onChange={(e) => { setSrcGame(e.target.value); setResult(null); }} style={selectStyle}>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        <button onClick={swap} style={{
          background: 'none', border: '1px solid #2a2a3e', color: '#888',
          borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 16,
          alignSelf: 'flex-end', marginBottom: 2,
        }}>
          {'⇄'}
        </button>

        <label style={labelStyle}>
          대상 게임
          <select value={dstGame} onChange={(e) => { setDstGame(e.target.value); setResult(null); }} style={selectStyle}>
            {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        <label style={labelStyle}>
          소스 감도
          <input
            value={sens} onChange={(e) => setSens(e.target.value)}
            type="number" step="0.01" min="0.01"
            style={{ ...selectStyle, width: 100 }}
          />
        </label>

        <button onClick={convert} disabled={loading} style={{
          background: '#e94560', color: '#fff', border: 'none', borderRadius: 6,
          padding: '10px 20px', cursor: 'pointer', fontSize: 14, fontWeight: 600,
          alignSelf: 'flex-end', marginBottom: 2, opacity: loading ? 0.6 : 1,
        }}>
          {loading ? '계산 중...' : '변환'}
        </button>
      </div>

      {loading && <LoadingSpinner label="변환 계산 중..." />}

      {/* 결과 테이블 */}
      {result && !loading && (
        <>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
            {result.src_game} → {result.dst_game} | 소스 cm/360: {result.src_cm360.toFixed(2)} | FOV: {result.src_fov_h.toFixed(1)}° → {result.dst_fov_h.toFixed(1)}°
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a3e' }}>
                <th style={thStyle}>방식</th>
                <th style={thStyle}>cm/360</th>
                <th style={thStyle}>감도</th>
                <th style={thStyle}>배율</th>
                <th style={thStyle}>설명</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(METHODS).map(([key, meta]) => {
                const r = result.results[key];
                if (!r) return null;
                const isRec = key === recommended;
                return (
                  <tr key={key} style={{
                    borderBottom: '1px solid #1a1a2e',
                    background: isRec ? 'rgba(233,69,96,0.1)' : 'transparent',
                  }}>
                    <td style={tdStyle}>
                      {meta.label}
                      {isRec && <span style={{ color: '#e94560', fontSize: 10, marginLeft: 6 }}>추천</span>}
                    </td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{r.cm360.toFixed(2)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600 }}>{r.sens.toFixed(4)}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>×{r.multiplier.toFixed(4)}</td>
                    <td style={{ ...tdStyle, fontSize: 11, color: '#888' }}>{meta.desc}</td>
                    <td style={tdStyle}>
                      <button onClick={() => copyToClipboard(r.sens.toFixed(4))} style={{
                        background: 'none', border: '1px solid #2a2a3e', color: '#888',
                        borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11,
                      }}>
                        복사
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* 감도 스냅 결과 */}
          {snap && (
            <div style={{
              marginTop: 16, padding: 16, background: '#1a1a2e',
              borderRadius: 8, border: '1px solid #2a2a3e',
            }}>
              <h3 style={{ fontSize: 14, marginBottom: 8 }}>감도 스냅 (추천 방식 기준)</h3>
              <div style={{ display: 'flex', gap: 24, fontSize: 13 }}>
                <div>
                  <div style={{ color: '#888', fontSize: 11 }}>추천 감도</div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: '#4ade80' }}>
                    {snap.recommended_sens.toFixed(4)}
                  </div>
                  <div style={{ fontSize: 11, color: '#888' }}>{snap.recommended_cm360.toFixed(2)} cm/360</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: 11 }}>Floor</div>
                  <div style={{ fontFamily: 'monospace' }}>{snap.floor_sens.toFixed(4)}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{snap.floor_cm360.toFixed(2)} cm/360</div>
                </div>
                <div>
                  <div style={{ color: '#888', fontSize: 11 }}>Ceil</div>
                  <div style={{ fontFamily: 'monospace' }}>{snap.ceil_sens.toFixed(4)}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{snap.ceil_cm360.toFixed(2)} cm/360</div>
                </div>
              </div>
              <button onClick={() => copyToClipboard(snap.recommended_sens.toFixed(4))} style={{
                marginTop: 10, background: '#4ade80', color: '#000', border: 'none',
                borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
                추천 감도 복사
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 4,
};

const selectStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 4,
  color: '#e0e0e0', padding: '8px 10px', fontSize: 13,
};

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '8px 10px', color: '#888', fontSize: 11, fontWeight: 600,
};

const tdStyle: React.CSSProperties = {
  padding: '10px 10px',
};
