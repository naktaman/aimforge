/**
 * 무브먼트 에디터 화면 (Day 22~23 고도화)
 * 10개 게임 프리셋 선택 + 5 슬라이더 커스텀 편집 + 라이브 프리뷰
 * + JSON 내보내기/가져오기 + 벽 도달 캘리브레이션 + 가중 추천
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../i18n';
import { useMovementStore } from '../stores/movementStore';
import { UI_COLORS } from '../config/theme';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** 가속 타입 i18n 키 매핑 */
const ACCEL_LABEL_KEYS: Record<string, string> = {
  instant: 'movement.accelInstant',
  linear: 'movement.accelLinear',
  velocity_based: 'movement.accelVelocity',
};

export default function MovementEditor({ onBack }: Props) {
  const { t } = useTranslation();
  const {
    presets, recommendation, loadPresets, calculateRecommendation,
    exportProfile, importProfile, calibrateMaxSpeed,
  } = useMovementStore();

  // 선택된 프리셋 인덱스
  const [selectedIdx, setSelectedIdx] = useState(0);
  // 슬라이더 값 (편집 중)
  const [maxSpeed, setMaxSpeed] = useState(250);
  const [stopTime, setStopTime] = useState(0.05);
  const [accelType, setAccelType] = useState('instant');
  const [airControl, setAirControl] = useState(0.0);
  const [csBonus, setCsBonus] = useState(1.0);
  // 가중 추천 입력
  const [staticOpt, setStaticOpt] = useState(35);
  const [movingOpt, setMovingOpt] = useState(30);
  // Export/Import 상태
  const [exportPath, setExportPath] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  // 캘리브레이션 상태
  const [calDistance, setCalDistance] = useState(128);
  const [calTime, setCalTime] = useState(0.5);
  const [calResult, setCalResult] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  /** 프리셋 선택 시 슬라이더 동기화 */
  const selectPreset = (idx: number) => {
    setSelectedIdx(idx);
    const p = presets[idx];
    if (p) {
      setMaxSpeed(p.maxSpeed);
      setStopTime(p.stopTime);
      setAccelType(p.accelType);
      setAirControl(p.airControl);
      setCsBonus(p.csBonus);
    }
  };

  // 첫 로드 시 프리셋 동기화
  useEffect(() => {
    if (presets.length > 0) selectPreset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  /** 가중 추천 계산 */
  const handleCalcRecommendation = () => {
    const preset = presets[selectedIdx];
    if (!preset) return;
    const movementRatios: Record<string, number> = {
      cs2: 0.34, valorant: 0.30, overwatch2: 0.30, apex: 0.35,
      r6siege: 0.25, fortnite: 0.40, cod_mw: 0.30, battlefield: 0.30,
      pubg: 0.30, quake: 0.30,
    };
    const ratio = movementRatios[preset.gameId] ?? 0.3;
    calculateRecommendation(staticOpt, movingOpt, ratio);
  };

  /** JSON 내보내기 */
  const handleExport = async () => {
    const preset = presets[selectedIdx];
    if (!preset) return;
    const path = await exportProfile({
      gameId: preset.gameId,
      name: preset.name,
      maxSpeed: maxSpeed,
      stopTime: stopTime,
      accelType: accelType,
      airControl: airControl,
      csBonus: csBonus,
    });
    setExportPath(path);
    setTimeout(() => setExportPath(null), 5000);
  };

  /** JSON 가져오기 */
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const preset = await importProfile(text);
      if (preset) {
        setMaxSpeed(preset.maxSpeed);
        setStopTime(preset.stopTime);
        setAccelType(preset.accelType);
        setAirControl(preset.airControl);
        setCsBonus(preset.csBonus);
        setImportMsg(`"${preset.name}" ${t('movement.importSuccess')}`);
      } else {
        setImportMsg(t('movement.importFailed'));
      }
    } catch {
      setImportMsg(t('movement.fileFailed'));
    }
    setTimeout(() => setImportMsg(null), 4000);
    // 같은 파일 다시 선택 가능하도록 리셋
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [importProfile]);

  /** 캘리브레이션 실행 */
  const handleCalibrate = async () => {
    const preset = presets[selectedIdx];
    if (!preset) return;
    const result = await calibrateMaxSpeed(preset.gameId, calDistance, calTime);
    if (result) {
      setMaxSpeed(result.calculatedMaxSpeed);
      setCalResult(`max_speed: ${result.calculatedMaxSpeed} u/s (${t('movement.calDistance')} ${result.distanceUsed})`);
    } else {
      setCalResult(t('movement.calFailed'));
    }
    setTimeout(() => setCalResult(null), 5000);
  };

  return (
    <div className="page">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h2>{t('movement.title')}</h2>
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← {t('common.back')}</button>
      </div>

      {/* 게임 프리셋 선택 + Export/Import */}
      <div className="movement-editor__toolbar">
        <div className="form-group">
          <label className="form-label font-semibold">{t('movement.gamePreset')}: </label>
          <select
            className="select-field"
            value={selectedIdx}
            onChange={(e) => selectPreset(Number(e.target.value))}
          >
            {presets.map((p, i) => (
              <option key={p.gameId} value={i}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="movement-editor__actions">
          <button className="btn btn--secondary btn--sm" onClick={handleExport}>
            {t('movement.jsonExport')}
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => fileInputRef.current?.click()}>
            {t('movement.jsonImport')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            hidden
          />
        </div>
      </div>

      {/* Export/Import 알림 */}
      {exportPath && (
        <div className="movement-editor__status-msg movement-editor__status-msg--success">
          {t('movement.savedComplete')}: {exportPath}
        </div>
      )}
      {importMsg && (
        <div className={`movement-editor__status-msg ${(importMsg === t('movement.importFailed') || importMsg === t('movement.fileFailed')) ? 'movement-editor__status-msg--error' : 'movement-editor__status-msg--success'}`}>
          {importMsg}
        </div>
      )}

      {/* 5 슬라이더 + 라이브 프리뷰 */}
      <div className="movement-editor__columns page-section">
        {/* 슬라이더 영역 */}
        <div className="glass-card movement-editor__sliders">
          <h3>{t('movement.physicsParams')}</h3>

          <SliderRow label={t('movement.maxSpeed')} value={maxSpeed} min={100} max={600} step={10}
            unit="u/s" onChange={setMaxSpeed} />
          <SliderRow label={t('movement.stopTime')} value={stopTime} min={0.01} max={0.3} step={0.01}
            unit="s" onChange={setStopTime} />

          <div className="slider-row">
            <label className="form-label">{t('movement.accelType')}: </label>
            <select className="select-field" value={accelType} onChange={(e) => setAccelType(e.target.value)}>
              {Object.entries(ACCEL_LABEL_KEYS).map(([k, key]) => (
                <option key={k} value={k}>{t(key)}</option>
              ))}
            </select>
          </div>

          <SliderRow label={t('movement.airControl')} value={airControl} min={0} max={1} step={0.05}
            unit="" onChange={setAirControl} />
          <SliderRow label={t('movement.csBonus')} value={csBonus} min={0.5} max={1.2} step={0.05}
            unit="x" onChange={setCsBonus} />
        </div>

        {/* 라이브 프리뷰 패널 */}
        <MovementPreviewPanel
          maxSpeed={maxSpeed}
          stopTime={stopTime}
          accelType={accelType}
          airControl={airControl}
          csBonus={csBonus}
        />
      </div>

      {/* 캘리브레이션 가이드 */}
      <div className="glass-card movement-editor__section">
        <h3>{t('movement.calGuide')}</h3>
        <div className="movement-editor__guide-steps text-muted">
          <p>{t('movement.calStep1')}</p>
          <p>{t('movement.calStep2')}</p>
          <p>{t('movement.calStep3')}</p>
        </div>
        <div className="movement-editor__cal-row">
          <label className="form-label">
            {t('movement.calDistance')}
            <input className="input-field" type="number" min={1} value={calDistance}
              onChange={(e) => setCalDistance(Number(e.target.value))} />
          </label>
          <label className="form-label">
            {t('movement.calTime')}
            <input className="input-field" type="number" min={0.01} step={0.01} value={calTime}
              onChange={(e) => setCalTime(Number(e.target.value))} />
          </label>
          <button className="btn btn--primary btn--sm" onClick={handleCalibrate}>
            {t('movement.autoCalc')}
          </button>
        </div>
        {calResult && (
          <div className={`movement-editor__status-msg ${calResult === t('movement.calFailed') ? 'movement-editor__status-msg--error' : 'movement-editor__status-msg--success'}`}>
            {calResult}
          </div>
        )}
      </div>

      {/* 가중 추천 계산 */}
      <div className="glass-card movement-editor__section">
        <h3>{t('movement.weightedSensRec')}</h3>
        <div className="movement-editor__rec-row">
          <label className="form-label">
            {t('movement.staticOptCm')}
            <input className="input-field" type="number" value={staticOpt}
              onChange={(e) => setStaticOpt(Number(e.target.value))} />
          </label>
          <label className="form-label">
            {t('movement.movingOptCm')}
            <input className="input-field" type="number" value={movingOpt}
              onChange={(e) => setMovingOpt(Number(e.target.value))} />
          </label>
          <button className="btn btn--primary btn--sm" onClick={handleCalcRecommendation}>{t('common.calculate')}</button>
        </div>

        {recommendation && (
          <div className="movement-editor__rec-result">
            <div className="movement-editor__rec-value">
              {recommendation.finalCm360.toFixed(1)} cm/360
            </div>
            <div className="movement-editor__rec-detail text-muted">
              {t('landscape.static')} {recommendation.staticOptimal.toFixed(1)} × {t('landscape.moving')} {recommendation.movingOptimal.toFixed(1)}
              {' '}({(recommendation.movementRatio * 100).toFixed(0)}%)
            </div>
            <div className="movement-editor__rec-direction">
              {recommendation.direction}
            </div>
          </div>
        )}
      </div>

      {/* 프리셋 비교 테이블 */}
      <div className="glass-card">
        <h3>{t('movement.presetCompare')}</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('settings.game')}</th>
              <th>{t('movement.speed')}</th>
              <th>{t('movement.stop')}</th>
              <th>{t('movement.accel')}</th>
              <th>{t('movement.air')}</th>
              <th>{t('movement.csBonus')}</th>
            </tr>
          </thead>
          <tbody>
            {presets.map((p, i) => (
              <tr
                key={p.gameId}
                className={i === selectedIdx ? 'row-selected' : ''}
                onClick={() => selectPreset(i)}
                style={{ cursor: 'pointer' }}
              >
                <td>{p.name}</td>
                <td>{p.maxSpeed}</td>
                <td>{p.stopTime}s</td>
                <td>{ACCEL_LABEL_KEYS[p.accelType] ? t(ACCEL_LABEL_KEYS[p.accelType]) : p.accelType}</td>
                <td>{p.airControl}</td>
                <td>{p.csBonus}x</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** 라이브 프리뷰 패널 — 이동 물리 시뮬레이션 애니메이션 */
function MovementPreviewPanel({ maxSpeed, stopTime, accelType, airControl, csBonus }: {
  maxSpeed: number;
  stopTime: number;
  accelType: string;
  airControl: number;
  csBonus: number;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    // 시뮬레이션 상태
    let dotX = 20;
    let velocity = 0;
    let moving = true;
    let phase = 0; // 0=가속, 1=등속, 2=감속
    let elapsed = 0;
    const dt = 1 / 60;
    // 3초 주기로 리셋
    const cycleSec = 3;

    /** 프레임 드로우 함수 — 이동 물리 시뮬레이션 + 캔버스 렌더링 */
    const draw = () => {
      elapsed += dt;
      if (elapsed > cycleSec) {
        elapsed = 0;
        dotX = 20;
        velocity = 0;
        moving = true;
        phase = 0;
      }

      // 이동 구간: 0~1.5초 가속/등속, 1.5초~ 감속
      const moveEnd = cycleSec * 0.5;
      if (elapsed < moveEnd) {
        // 가속/등속 구간
        const speedNorm = maxSpeed / 600; // 0~1 정규화
        velocity = speedNorm * (W - 40);
        phase = 0;
        moving = true;
      } else if (moving) {
        // 감속 구간
        phase = 1;
        const decayProgress = (elapsed - moveEnd) / Math.max(stopTime * 5, 0.05);
        if (accelType === 'instant') {
          velocity = decayProgress < 0.2 ? velocity * (1 - decayProgress * 5) : 0;
        } else if (accelType === 'linear') {
          velocity = Math.max(0, velocity * (1 - decayProgress));
        } else {
          velocity = velocity * Math.exp(-decayProgress * 3);
        }
        if (velocity < 0.5) {
          velocity = 0;
          moving = false;
          phase = 2;
        }
      }

      dotX += velocity * dt;
      if (dotX > W - 20) dotX = W - 20;

      // 배경
      ctx.fillStyle = UI_COLORS.canvasBg;
      ctx.fillRect(0, 0, W, H);

      // 바닥 라인
      ctx.strokeStyle = UI_COLORS.chartDomain;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, H - 30);
      ctx.lineTo(W - 10, H - 30);
      ctx.stroke();

      // 이동 점 — 가속/감속/정지 색상 분기
      const dotColor = phase === 0 ? UI_COLORS.successGreen : phase === 1 ? UI_COLORS.warningYellow : UI_COLORS.dangerRed;
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(dotX, H - 30, 8, 0, Math.PI * 2);
      ctx.fill();

      // 속도 바
      ctx.fillStyle = UI_COLORS.chartDomain;
      ctx.fillRect(10, 10, W - 20, 8);
      const speedPct = (maxSpeed - 100) / 500;
      const gradient = ctx.createLinearGradient(10, 0, 10 + (W - 20) * speedPct, 0);
      gradient.addColorStop(0, UI_COLORS.chartCurveSky);
      gradient.addColorStop(1, UI_COLORS.dangerRed);
      ctx.fillStyle = gradient;
      ctx.fillRect(10, 10, (W - 20) * speedPct, 8);

      // 레이블
      ctx.fillStyle = UI_COLORS.chartLabel;
      ctx.font = '10px monospace';
      ctx.fillText(`${t('movement.speed')}: ${maxSpeed} u/s`, 10, 34);
      ctx.fillText(`${t('movement.stop')}: ${stopTime}s`, 10, 46);
      const accelKey = ACCEL_LABEL_KEYS[accelType];
      ctx.fillText(`${accelKey ? t(accelKey) : accelType}`, 10, 58);

      // 공중 제어 바
      const airY = 70;
      ctx.fillStyle = UI_COLORS.chartDomain;
      ctx.fillRect(10, airY, 80, 6);
      ctx.fillStyle = UI_COLORS.chartCurvePurple;
      ctx.fillRect(10, airY, 80 * airControl, 6);
      ctx.fillStyle = UI_COLORS.chartLabel;
      ctx.fillText(`${t('movement.air')}: ${(airControl * 100).toFixed(0)}%`, 95, airY + 6);

      // CS 보너스 뱃지
      const badgeColor = csBonus < 0.9 ? UI_COLORS.successGreen : csBonus > 1.0 ? UI_COLORS.dangerRed : UI_COLORS.chartTickText;
      ctx.fillStyle = badgeColor;
      ctx.fillText(`${t('movement.csBonus')}: ${csBonus}x`, 10, airY + 20);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [maxSpeed, stopTime, accelType, airControl, csBonus, t]);

  return (
    <div className="movement-preview">
      <div className="movement-preview__label">{t('movement.livePreview')}</div>
      <canvas ref={canvasRef} width={244} height={120} />
    </div>
  );
}

/** 슬라이더 행 공통 컴포넌트 */
function SliderRow({ label, value, min, max, step, unit, onChange }: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="slider-row">
      <div className="slider-row__header">
        <label className="form-label">{label}</label>
        <span className="text-sm text-accent">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}
