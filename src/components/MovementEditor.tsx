/**
 * 무브먼트 에디터 화면 (Day 22~23 고도화)
 * 10개 게임 프리셋 선택 + 5 슬라이더 커스텀 편집 + 라이브 프리뷰
 * + JSON 내보내기/가져오기 + 벽 도달 캘리브레이션 + 가중 추천
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useMovementStore } from '../stores/movementStore';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** 가속 타입 한국어 라벨 */
const ACCEL_LABELS: Record<string, string> = {
  instant: '즉시 정지',
  linear: '선형 감속',
  velocity_based: '속도 비례',
};

export default function MovementEditor({ onBack }: Props) {
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
        setImportMsg(`"${preset.name}" 가져오기 성공`);
      } else {
        setImportMsg('가져오기 실패: 잘못된 파일 형식');
      }
    } catch {
      setImportMsg('파일 읽기 실패');
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
      setCalResult(`계산된 max_speed: ${result.calculatedMaxSpeed} u/s (거리: ${result.distanceUsed})`);
    } else {
      setCalResult('캘리브레이션 실패');
    }
    setTimeout(() => setCalResult(null), 5000);
  };

  return (
    <div className="page">
      {/* 페이지 헤더 */}
      <div className="page-header">
        <h2>무브먼트 에디터</h2>
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← 돌아가기</button>
      </div>

      {/* 게임 프리셋 선택 + Export/Import */}
      <div className="movement-editor__toolbar">
        <div className="form-group">
          <label className="form-label font-semibold">게임 프리셋: </label>
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
            JSON 내보내기
          </button>
          <button className="btn btn--secondary btn--sm" onClick={() => fileInputRef.current?.click()}>
            JSON 가져오기
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
          저장 완료: {exportPath}
        </div>
      )}
      {importMsg && (
        <div className={`movement-editor__status-msg ${importMsg.includes('실패') ? 'movement-editor__status-msg--error' : 'movement-editor__status-msg--success'}`}>
          {importMsg}
        </div>
      )}

      {/* 5 슬라이더 + 라이브 프리뷰 */}
      <div className="movement-editor__columns page-section">
        {/* 슬라이더 영역 */}
        <div className="glass-card movement-editor__sliders">
          <h3>이동 물리 파라미터</h3>

          <SliderRow label="최대 속도" value={maxSpeed} min={100} max={600} step={10}
            unit="u/s" onChange={setMaxSpeed} />
          <SliderRow label="정지 시간" value={stopTime} min={0.01} max={0.3} step={0.01}
            unit="초" onChange={setStopTime} />

          <div className="slider-row">
            <label className="form-label">가속 타입: </label>
            <select className="select-field" value={accelType} onChange={(e) => setAccelType(e.target.value)}>
              {Object.entries(ACCEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <SliderRow label="공중 제어" value={airControl} min={0} max={1} step={0.05}
            unit="" onChange={setAirControl} />
          <SliderRow label="카운터스트레이프 보너스" value={csBonus} min={0.5} max={1.2} step={0.05}
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
        <h3>실측 캘리브레이션 가이드</h3>
        <div className="movement-editor__guide-steps text-muted">
          <p>1. 게임에서 벽 근처의 알려진 거리 위치에 서세요</p>
          <p>2. 이동키를 눌러 벽까지 도달하는 시간을 측정하세요</p>
          <p>3. 아래에 거리와 시간을 입력하면 자동으로 계산됩니다</p>
        </div>
        <div className="movement-editor__cal-row">
          <label className="form-label">
            거리 (game units):
            <input className="input-field" type="number" min={1} value={calDistance}
              onChange={(e) => setCalDistance(Number(e.target.value))} />
          </label>
          <label className="form-label">
            측정 시간 (초):
            <input className="input-field" type="number" min={0.01} step={0.01} value={calTime}
              onChange={(e) => setCalTime(Number(e.target.value))} />
          </label>
          <button className="btn btn--primary btn--sm" onClick={handleCalibrate}>
            자동 계산
          </button>
        </div>
        {calResult && (
          <div className={`movement-editor__status-msg ${calResult.includes('실패') ? 'movement-editor__status-msg--error' : 'movement-editor__status-msg--success'}`}>
            {calResult}
          </div>
        )}
      </div>

      {/* 가중 추천 계산 */}
      <div className="glass-card movement-editor__section">
        <h3>가중 감도 추천</h3>
        <div className="movement-editor__rec-row">
          <label className="form-label">
            정적 최적 cm/360:
            <input className="input-field" type="number" value={staticOpt}
              onChange={(e) => setStaticOpt(Number(e.target.value))} />
          </label>
          <label className="form-label">
            무빙 최적 cm/360:
            <input className="input-field" type="number" value={movingOpt}
              onChange={(e) => setMovingOpt(Number(e.target.value))} />
          </label>
          <button className="btn btn--primary btn--sm" onClick={handleCalcRecommendation}>계산</button>
        </div>

        {recommendation && (
          <div className="movement-editor__rec-result">
            <div className="movement-editor__rec-value">
              {recommendation.finalCm360.toFixed(1)} cm/360
            </div>
            <div className="movement-editor__rec-detail text-muted">
              정적 {recommendation.staticOptimal.toFixed(1)} × 무빙 {recommendation.movingOptimal.toFixed(1)}
              {' '}(비율 {(recommendation.movementRatio * 100).toFixed(0)}%)
            </div>
            <div className="movement-editor__rec-direction">
              {recommendation.direction}
            </div>
          </div>
        )}
      </div>

      {/* 프리셋 비교 테이블 */}
      <div className="glass-card">
        <h3>게임별 프리셋 비교</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>게임</th>
              <th>속도</th>
              <th>정지</th>
              <th>가속</th>
              <th>공중</th>
              <th>CS보너스</th>
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
                <td>{ACCEL_LABELS[p.accelType] ?? p.accelType}</td>
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
      ctx.fillStyle = '#0d1117';
      ctx.fillRect(0, 0, W, H);

      // 바닥 라인
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(10, H - 30);
      ctx.lineTo(W - 10, H - 30);
      ctx.stroke();

      // 이동 점 — 가속/감속/정지 색상 분기
      const dotColor = phase === 0 ? '#4ade80' : phase === 1 ? '#fbbf24' : '#e94560';
      ctx.fillStyle = dotColor;
      ctx.beginPath();
      ctx.arc(dotX, H - 30, 8, 0, Math.PI * 2);
      ctx.fill();

      // 속도 바
      ctx.fillStyle = '#333';
      ctx.fillRect(10, 10, W - 20, 8);
      const speedPct = (maxSpeed - 100) / 500;
      const gradient = ctx.createLinearGradient(10, 0, 10 + (W - 20) * speedPct, 0);
      gradient.addColorStop(0, '#38bdf8');
      gradient.addColorStop(1, '#e94560');
      ctx.fillStyle = gradient;
      ctx.fillRect(10, 10, (W - 20) * speedPct, 8);

      // 레이블
      ctx.fillStyle = '#aaa';
      ctx.font = '10px monospace';
      ctx.fillText(`속도: ${maxSpeed} u/s`, 10, 34);
      ctx.fillText(`정지: ${stopTime}s`, 10, 46);
      ctx.fillText(`${ACCEL_LABELS[accelType] ?? accelType}`, 10, 58);

      // 공중 제어 바
      const airY = 70;
      ctx.fillStyle = '#333';
      ctx.fillRect(10, airY, 80, 6);
      ctx.fillStyle = '#c084fc';
      ctx.fillRect(10, airY, 80 * airControl, 6);
      ctx.fillStyle = '#aaa';
      ctx.fillText(`공중: ${(airControl * 100).toFixed(0)}%`, 95, airY + 6);

      // CS 보너스 뱃지
      const badgeColor = csBonus < 0.9 ? '#4ade80' : csBonus > 1.0 ? '#e94560' : '#666';
      ctx.fillStyle = badgeColor;
      ctx.fillText(`CS보너스: ${csBonus}x`, 10, airY + 20);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [maxSpeed, stopTime, accelType, airControl, csBonus]);

  return (
    <div className="movement-preview">
      <div className="movement-preview__label">라이브 프리뷰</div>
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
