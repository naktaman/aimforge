/**
 * 반동 패턴 편집기
 * SVG 기반 패턴 시각화 + 편집 + 스프레이 미리보기
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { WEAPON_PRESETS } from '../engine/WeaponSystem';
import { useTranslation } from '../i18n';
import { safeInvoke } from '../utils/ipc';
import { useToastStore } from '../stores/toastStore';
import { BackButton } from './BackButton';
import { LoadingSpinner } from './LoadingSpinner';

/** DB에서 로드된 커스텀 패턴 */
interface RecoilPatternRow {
  id: number;
  gameId: number;
  weaponName: string;
  patternPoints: string;
  randomness: number;
  vertical: number;
  horizontal: number;
  rpm: number;
  isCustom: boolean;
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
  const { t } = useTranslation();
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
    const dbRows = await safeInvoke<RecoilPatternRow[]>('get_recoil_patterns', { params: { gameId: null } });
    const customs: PatternItem[] = (dbRows ?? []).map((r) => ({
      id: `db-${r.id}`,
      name: r.weaponName,
      points: JSON.parse(r.patternPoints) as Array<[number, number]>,
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
        id: selected.dbId, weaponName: editName, patternPoints: pointsJson,
        randomness: editRandomness, vertical: editVertical, horizontal: editHorizontal, rpm: editRpm,
      }});
    } else {
      // 새로 저장
      await safeInvoke('save_recoil_pattern', { params: {
        gameId: 1, weaponName: editName, patternPoints: pointsJson,
        randomness: editRandomness, vertical: editVertical, horizontal: editHorizontal, rpm: editRpm,
      }});
    }
    useToastStore.getState().addToast(t('recoil.patternSaved'), 'success');
    loadPatterns();
  };

  /** 삭제 (커스텀만) */
  const handleDelete = async () => {
    if (!selected?.dbId) return;
    await safeInvoke('delete_recoil_pattern', { params: { id: selected.dbId } });
    useToastStore.getState().addToast(t('recoil.patternDeleted'), 'info');
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

  /** 스프레이 미리보기 중지 */
  const stopSpray = () => {
    if (sprayTimerRef.current) {
      clearInterval(sprayTimerRef.current);
      sprayTimerRef.current = null;
    }
    setSprayDots([]);
  };

  // 정리
  useEffect(() => () => stopSpray(), []);

  if (loading) return <LoadingSpinner label={t('recoil.patternLoading')} />;

  return (
    <div className="page page--wide">
      <div className="page-header">
        <BackButton onBack={onBack} />
        <h2>{t('recoil.title')}</h2>
      </div>

      <div className="recoil-layout">
        {/* 좌측: 패턴 목록 */}
        <div className="recoil-sidebar">
          <button className="btn btn--primary btn--full btn--sm" onClick={createNew}>{t('recoil.newPattern')}</button>
          <div className="recoil-sidebar__list">
            {patterns.map((p) => (
              <button
                key={p.id}
                onClick={() => selectPattern(p)}
                className={`recoil-pattern-btn ${selected?.id === p.id ? 'recoil-pattern-btn--active' : ''}`}
              >
                <div>{p.name}</div>
                <div className="recoil-pattern-btn__meta">
                  {p.points.length}pts | {p.rpm} RPM {p.isCustom ? t('recoil.custom') : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 중앙: SVG 패턴 캔버스 */}
        <div className="recoil-canvas">
          {selected || editPoints.length > 0 ? (
            <>
              <svg
                width={SVG_W} height={SVG_H}
                className="recoil-svg"
                onClick={handleSvgClick}
                onMouseMove={handleSvgMove}
                onMouseUp={handleSvgUp}
                onMouseLeave={handleSvgUp}
              >
                {/* 그리드 */}
                <line x1={SVG_W / 2} y1={0} x2={SVG_W / 2} y2={SVG_H} stroke="#1a1a2e" />
                <line x1={0} y1={20} x2={SVG_W} y2={20} stroke="#1a1a2e" />
                {/* 원점 표시 */}
                <circle cx={SVG_W / 2} cy={20} r={4} fill="#FFB81C" opacity={0.5} />

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

              <div className="recoil-spray-actions">
                <button className="btn btn--primary btn--sm" onClick={startSpray}>{t('recoil.sprayPreview')}</button>
                <button className="btn btn--secondary btn--sm" onClick={stopSpray}>{t('recoil.resetView')}</button>
              </div>
            </>
          ) : (
            <div className="recoil-empty">
              {t('recoil.selectOrCreate')}
            </div>
          )}
        </div>

        {/* 우측: 컨트롤 패널 */}
        {(selected || editPoints.length > 0) && (
          <div className="recoil-controls">
            <div className="form-group">
              <label className="form-label">{t('common.name')}</label>
              <input
                className="input-field"
                value={editName} onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">RPM: {editRpm}</label>
              <input type="range" min={60} max={1200} value={editRpm}
                onChange={(e) => setEditRpm(+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('recoil.randomSpread')}: {editRandomness.toFixed(2)}</label>
              <input type="range" min={0} max={1} step={0.05} value={editRandomness}
                onChange={(e) => setEditRandomness(+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('recoil.verticalScale')}: {editVertical.toFixed(2)}</label>
              <input type="range" min={0} max={2} step={0.1} value={editVertical}
                onChange={(e) => setEditVertical(+e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('recoil.horizontalScale')}: {editHorizontal.toFixed(2)}</label>
              <input type="range" min={0} max={2} step={0.1} value={editHorizontal}
                onChange={(e) => setEditHorizontal(+e.target.value)} />
            </div>
            <p className="form-hint">
              {t('recoil.points')}: {editPoints.length}<br />
              {t('recoil.clickDragHint')}
            </p>

            <div className="recoil-controls__actions">
              <button className="btn btn--success btn--sm" onClick={handleSave}>{t('common.save')}</button>
              {selected?.isCustom && selected?.dbId && (
                <button className="btn btn--danger btn--sm" onClick={handleDelete}>{t('common.delete')}</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
