/**
 * 반동 패턴 편집기
 * SVG 기반 패턴 시각화 + 편집 + 스프레이 미리보기
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { WEAPON_PRESETS } from '../engine/WeaponSystem';
import { safeInvoke } from '../utils/ipc';
import { useToastStore } from '../stores/toastStore';
import { BackButton } from './BackButton';
import { LoadingSpinner } from './LoadingSpinner';

/** DB에서 로드된 커스텀 패턴 */
interface RecoilPatternRow {
  id: number;
  game_id: number;
  weapon_name: string;
  pattern_points: string;
  randomness: number;
  vertical: number;
  horizontal: number;
  rpm: number;
  is_custom: boolean;
}

/** 패턴 아이템 (빌트인 + 커스텀 통합) */
interface PatternItem {
  id: string;
  name: string;
  points: Array<[number, number]>;
  rpm: number;
  randomness: number;
  vertical: number;
  horizontal: number;
  isCustom: boolean;
  dbId?: number;
}

/** 빌트인 프리셋을 PatternItem으로 변환 */
function builtinToItems(): PatternItem[] {
  return Object.entries(WEAPON_PRESETS)
    .filter(([, cfg]) => cfg.recoilPattern.length > 0)
    .map(([key, cfg]) => ({
      id: `builtin-${key}`,
      name: key.replace(/_/g, ' ').toUpperCase(),
      points: cfg.recoilPattern,
      rpm: cfg.fireRateRpm,
      randomness: 0.2,
      vertical: 1.0,
      horizontal: 1.0,
      isCustom: false,
    }));
}

/** SVG 좌표 변환 — 패턴 포인트(도) → SVG 픽셀 */
const SVG_W = 400;
const SVG_H = 500;
const SCALE = 80; // 1도 = 80px

function toSvg(dx: number, dy: number): [number, number] {
  return [SVG_W / 2 + dx * SCALE, 20 - dy * SCALE];
}

export default function RecoilEditor({ onBack }: { onBack: () => void }) {
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  const [selected, setSelected] = useState<PatternItem | null>(null);
  const [loading, setLoading] = useState(true);

  // 편집 상태
  const [editName, setEditName] = useState('');
  const [editRpm, setEditRpm] = useState(600);
  const [editRandomness, setEditRandomness] = useState(0.2);
  const [editVertical, setEditVertical] = useState(1.0);
  const [editHorizontal, setEditHorizontal] = useState(1.0);
  const [editPoints, setEditPoints] = useState<Array<[number, number]>>([]);
  const [dragging, setDragging] = useState<number | null>(null);

  // 스프레이 미리보기 상태
  const [sprayDots, setSprayDots] = useState<Array<[number, number]>>([]);
  const sprayTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** DB 패턴 로드 */
  const loadPatterns = useCallback(async () => {
    setLoading(true);
    const builtins = builtinToItems();
    const dbRows = await safeInvoke<RecoilPatternRow[]>('get_recoil_patterns', { params: { game_id: null } });
    const customs: PatternItem[] = (dbRows ?? []).map((r) => ({
      id: `db-${r.id}`,
      name: r.weapon_name,
      points: JSON.parse(r.pattern_points) as Array<[number, number]>,
      rpm: r.rpm,
      randomness: r.randomness,
      vertical: r.vertical,
      horizontal: r.horizontal,
      isCustom: true,
      dbId: r.id,
    }));
    setPatterns([...builtins, ...customs]);
    setLoading(false);
  }, []);

  useEffect(() => { loadPatterns(); }, [loadPatterns]);

  /** 패턴 선택 시 편집 상태 동기화 */
  const selectPattern = (p: PatternItem) => {
    setSelected(p);
    setEditName(p.name);
    setEditRpm(p.rpm);
    setEditRandomness(p.randomness);
    setEditVertical(p.vertical);
    setEditHorizontal(p.horizontal);
    setEditPoints([...p.points]);
    stopSpray();
  };

  /** 새 패턴 생성 */
  const createNew = () => {
    const newP: PatternItem = {
      id: 'new', name: 'New Pattern', points: [[0, -0.5], [0, -1.0]],
      rpm: 600, randomness: 0.2, vertical: 1.0, horizontal: 1.0, isCustom: true,
    };
    selectPattern(newP);
  };

  /** SVG 클릭 — 포인트 추가 */
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging !== null) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = (x - SVG_W / 2) / SCALE;
    const dy = -(y - 20) / SCALE;
    setEditPoints((pts) => [...pts, [parseFloat(dx.toFixed(2)), parseFloat(dy.toFixed(2))]]);
  };

  /** 포인트 드래그 시작 */
  const handlePointDown = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDragging(idx);
  };

  /** 드래그 이동 */
  const handleSvgMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (dragging === null) return;
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const dx = parseFloat(((x - SVG_W / 2) / SCALE).toFixed(2));
    const dy = parseFloat((-(y - 20) / SCALE).toFixed(2));
    setEditPoints((pts) => pts.map((p, i) => (i === dragging ? [dx, dy] : p)));
  };

  /** 드래그 종료 */
  const handleSvgUp = () => setDragging(null);

  /** 포인트 삭제 (우클릭) */
  const handlePointContext = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditPoints((pts) => pts.filter((_, i) => i !== idx));
  };

  /** 저장 (커스텀만) */
  const handleSave = async () => {
    const pointsJson = JSON.stringify(editPoints);
    if (selected?.dbId) {
      // 업데이트
      await safeInvoke('update_recoil_pattern', { params: {
        id: selected.dbId, weapon_name: editName, pattern_points: pointsJson,
        randomness: editRandomness, vertical: editVertical, horizontal: editHorizontal, rpm: editRpm,
      }});
    } else {
      // 새로 저장
      await safeInvoke('save_recoil_pattern', { params: {
        game_id: 1, weapon_name: editName, pattern_points: pointsJson,
        randomness: editRandomness, vertical: editVertical, horizontal: editHorizontal, rpm: editRpm,
      }});
    }
    useToastStore.getState().addToast('패턴 저장 완료', 'success');
    loadPatterns();
  };

  /** 삭제 (커스텀만) */
  const handleDelete = async () => {
    if (!selected?.dbId) return;
    await safeInvoke('delete_recoil_pattern', { params: { id: selected.dbId } });
    useToastStore.getState().addToast('패턴 삭제 완료', 'info');
    setSelected(null);
    loadPatterns();
  };

  /** 스프레이 미리보기 시작 */
  const startSpray = () => {
    stopSpray();
    if (editPoints.length === 0 || editRpm <= 0) return;
    const intervalMs = 60000 / editRpm;
    let shotIdx = 0;
    const dots: Array<[number, number]> = [];
    let accX = 0;
    let accY = 0;

    sprayTimerRef.current = setInterval(() => {
      const pt = editPoints[shotIdx % editPoints.length];
      // ±randomness 스프레드
      const spread = editRandomness;
      const dx = pt[0] * editHorizontal + (Math.random() * 2 - 1) * spread * 0.5;
      const dy = pt[1] * editVertical + (Math.random() * 2 - 1) * spread * 0.5;
      accX += dx;
      accY += dy;
      dots.push([accX, accY]);
      setSprayDots([...dots]);
      shotIdx++;
      if (shotIdx >= editPoints.length * 2) stopSpray();
    }, intervalMs);
  };

  const stopSpray = () => {
    if (sprayTimerRef.current) {
      clearInterval(sprayTimerRef.current);
      sprayTimerRef.current = null;
    }
    setSprayDots([]);
  };

  // 정리
  useEffect(() => () => stopSpray(), []);

  if (loading) return <LoadingSpinner label="패턴 로딩 중..." />;

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto', color: '#e0e0e0', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <BackButton onBack={onBack} />
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>반동 패턴 편집기</h2>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>
        {/* 좌측: 패턴 목록 */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <button onClick={createNew} style={btnStyle('#3b82f6')}>+ 새 패턴</button>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {patterns.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPattern(p)}
                style={{
                  ...btnStyle(selected?.id === p.id ? '#e94560' : '#2a2a3e'),
                  textAlign: 'left',
                  fontSize: 12,
                  padding: '6px 10px',
                }}
              >
                <div>{p.name}</div>
                <div style={{ fontSize: 10, color: '#888' }}>
                  {p.points.length}pts | {p.rpm} RPM {p.isCustom ? '(커스텀)' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 중앙: SVG 패턴 캔버스 */}
        <div style={{ flex: 1 }}>
          {selected || editPoints.length > 0 ? (
            <>
              <svg
                width={SVG_W} height={SVG_H}
                style={{ background: '#12121a', borderRadius: 8, border: '1px solid #2a2a3e', cursor: 'crosshair' }}
                onClick={handleSvgClick}
                onMouseMove={handleSvgMove}
                onMouseUp={handleSvgUp}
                onMouseLeave={handleSvgUp}
              >
                {/* 그리드 */}
                <line x1={SVG_W / 2} y1={0} x2={SVG_W / 2} y2={SVG_H} stroke="#1a1a2e" />
                <line x1={0} y1={20} x2={SVG_W} y2={20} stroke="#1a1a2e" />
                {/* 원점 표시 */}
                <circle cx={SVG_W / 2} cy={20} r={4} fill="#e94560" opacity={0.5} />

                {/* 패턴 연결선 */}
                {editPoints.length > 1 && (
                  <polyline
                    points={editPoints.map(([dx, dy]) => toSvg(dx, dy).join(',')).join(' ')}
                    fill="none" stroke="#4ade80" strokeWidth={1.5} opacity={0.6}
                  />
                )}

                {/* 패턴 포인트 */}
                {editPoints.map(([dx, dy], i) => {
                  const [sx, sy] = toSvg(dx, dy);
                  return (
                    <g key={i}>
                      <circle
                        cx={sx} cy={sy} r={6}
                        fill={dragging === i ? '#fbbf24' : '#4ade80'}
                        stroke="#fff" strokeWidth={1}
                        style={{ cursor: 'grab' }}
                        onMouseDown={(e) => handlePointDown(i, e)}
                        onContextMenu={(e) => handlePointContext(i, e)}
                      />
                      <text x={sx + 8} y={sy + 4} fill="#888" fontSize={9}>
                        {i + 1}
                      </text>
                    </g>
                  );
                })}

                {/* 스프레이 미리보기 점 */}
                {sprayDots.map(([dx, dy], i) => {
                  const [sx, sy] = toSvg(dx, dy);
                  return <circle key={`s${i}`} cx={sx} cy={sy} r={2.5} fill="#f87171" opacity={0.8} />;
                })}
              </svg>

              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <button onClick={startSpray} style={btnStyle('#6366f1')}>스프레이 미리보기</button>
                <button onClick={stopSpray} style={btnStyle('#2a2a3e')}>초기화</button>
              </div>
            </>
          ) : (
            <div style={{ color: '#666', padding: 40, textAlign: 'center' }}>
              좌측에서 패턴을 선택하거나 새 패턴을 만드세요
            </div>
          )}
        </div>

        {/* 우측: 컨트롤 패널 */}
        {(selected || editPoints.length > 0) && (
          <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={labelStyle}>
              이름
              <input
                value={editName} onChange={(e) => setEditName(e.target.value)}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              RPM: {editRpm}
              <input type="range" min={60} max={1200} value={editRpm}
                onChange={(e) => setEditRpm(+e.target.value)} style={{ width: '100%' }} />
            </label>
            <label style={labelStyle}>
              랜덤 스프레드: {editRandomness.toFixed(2)}
              <input type="range" min={0} max={1} step={0.05} value={editRandomness}
                onChange={(e) => setEditRandomness(+e.target.value)} style={{ width: '100%' }} />
            </label>
            <label style={labelStyle}>
              수직 스케일: {editVertical.toFixed(2)}
              <input type="range" min={0} max={2} step={0.1} value={editVertical}
                onChange={(e) => setEditVertical(+e.target.value)} style={{ width: '100%' }} />
            </label>
            <label style={labelStyle}>
              수평 스케일: {editHorizontal.toFixed(2)}
              <input type="range" min={0} max={2} step={0.1} value={editHorizontal}
                onChange={(e) => setEditHorizontal(+e.target.value)} style={{ width: '100%' }} />
            </label>
            <div style={{ fontSize: 11, color: '#888' }}>
              포인트: {editPoints.length}개<br />
              클릭=추가, 드래그=이동, 우클릭=삭제
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button onClick={handleSave} style={btnStyle('#4ade80', '#000')}>저장</button>
              {selected?.isCustom && selected?.dbId && (
                <button onClick={handleDelete} style={btnStyle('#ef4444')}>삭제</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const btnStyle = (bg: string, color = '#fff'): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 6,
  padding: '8px 14px', cursor: 'pointer', fontSize: 13, width: '100%',
});

const labelStyle: React.CSSProperties = {
  fontSize: 12, color: '#aaa', display: 'flex', flexDirection: 'column', gap: 4,
};

const inputStyle: React.CSSProperties = {
  background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 4,
  color: '#e0e0e0', padding: '6px 8px', fontSize: 13,
};
