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

  // 프리셋 선택 시 슬라이더 동기화
  const selectPreset = (idx: number) => {
    setSelectedIdx(idx);
    const p = presets[idx];
    if (p) {
      setMaxSpeed(p.max_speed);
      setStopTime(p.stop_time);
      setAccelType(p.accel_type);
      setAirControl(p.air_control);
      setCsBonus(p.cs_bonus);
    }
  };

  // 첫 로드 시 프리셋 동기화
  useEffect(() => {
    if (presets.length > 0) selectPreset(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presets]);

  // 가중 추천 계산
  const handleCalcRecommendation = () => {
    const preset = presets[selectedIdx];
    if (!preset) return;
    const movementRatios: Record<string, number> = {
      cs2: 0.34, valorant: 0.30, overwatch2: 0.30, apex: 0.35,
      r6siege: 0.25, fortnite: 0.40, cod_mw: 0.30, battlefield: 0.30,
      pubg: 0.30, quake: 0.30,
    };
    const ratio = movementRatios[preset.game_id] ?? 0.3;
    calculateRecommendation(staticOpt, movingOpt, ratio);
  };

  // JSON 내보내기
  const handleExport = async () => {
    const preset = presets[selectedIdx];
    if (!preset) return;
    const path = await exportProfile({
      game_id: preset.game_id,
      name: preset.name,
      max_speed: maxSpeed,
      stop_time: stopTime,
      accel_type: accelType,
      air_control: airControl,
      cs_bonus: csBonus,
    });
    setExportPath(path);
    setTimeout(() => setExportPath(null), 5000);
  };

  // JSON 가져오기
  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const preset = await importProfile(text);
      if (preset) {
        setMaxSpeed(preset.max_speed);
        setStopTime(preset.stop_time);
        setAccelType(preset.accel_type);
        setAirControl(preset.air_control);
        setCsBonus(preset.cs_bonus);
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

  // 캘리브레이션 실행
  const handleCalibrate = async () => {
    const preset = presets[selectedIdx];
    if (!preset) return;
    const result = await calibrateMaxSpeed(preset.game_id, calDistance, calTime);
    if (result) {
      setMaxSpeed(result.calculated_max_speed);
      setCalResult(`계산된 max_speed: ${result.calculated_max_speed} u/s (거리: ${result.distance_used})`);
    } else {
      setCalResult('캘리브레이션 실패');
    }
    setTimeout(() => setCalResult(null), 5000);
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>무브먼트 에디터</h2>
        <button onClick={onBack}>← 돌아가기</button>
      </div>

      {/* 게임 프리셋 선택 + Export/Import */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <label style={{ fontWeight: 'bold' }}>게임 프리셋: </label>
          <select
            value={selectedIdx}
            onChange={(e) => selectPreset(Number(e.target.value))}
            style={{ padding: '4px 8px', fontSize: 14 }}
          >
            {presets.map((p, i) => (
              <option key={p.game_id} value={i}>{p.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExport} style={{ fontSize: 12, padding: '4px 10px' }}>
            JSON 내보내기
          </button>
          <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12, padding: '4px 10px' }}>
            JSON 가져오기
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Export/Import 알림 */}
      {exportPath && (
        <div style={{ background: '#0f3460', padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, color: '#4ade80' }}>
          저장 완료: {exportPath}
        </div>
      )}
      {importMsg && (
        <div style={{ background: '#0f3460', padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, color: importMsg.includes('실패') ? '#e94560' : '#4ade80' }}>
          {importMsg}
        </div>
      )}

      {/* 5 슬라이더 + 라이브 프리뷰 */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        {/* 슬라이더 영역 */}
        <div style={{ background: '#1a1a2e', padding: 20, borderRadius: 8, flex: 1 }}>
          <h3 style={{ marginTop: 0 }}>이동 물리 파라미터</h3>

          <SliderRow label="최대 속도" value={maxSpeed} min={100} max={600} step={10}
            unit="u/s" onChange={setMaxSpeed} />
          <SliderRow label="정지 시간" value={stopTime} min={0.01} max={0.3} step={0.01}
            unit="초" onChange={setStopTime} />

          <div style={{ marginBottom: 12 }}>
            <label>가속 타입: </label>
            <select value={accelType} onChange={(e) => setAccelType(e.target.value)}
              style={{ padding: '2px 6px' }}>
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
      <div style={{ background: '#16213e', padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>실측 캘리브레이션 가이드</h3>
        <div style={{ fontSize: 13, opacity: 0.8, marginBottom: 12 }}>
          <p style={{ margin: '0 0 4px' }}>1. 게임에서 벽 근처의 알려진 거리 위치에 서세요</p>
          <p style={{ margin: '0 0 4px' }}>2. 이동키를 눌러 벽까지 도달하는 시간을 측정하세요</p>
          <p style={{ margin: '0 0 4px' }}>3. 아래에 거리와 시간을 입력하면 자동으로 계산됩니다</p>
        </div>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 13 }}>
            거리 (game units):
            <input type="number" min={1} value={calDistance}
              onChange={(e) => setCalDistance(Number(e.target.value))}
              style={{ width: 80, marginLeft: 8 }} />
          </label>
          <label style={{ fontSize: 13 }}>
            측정 시간 (초):
            <input type="number" min={0.01} step={0.01} value={calTime}
              onChange={(e) => setCalTime(Number(e.target.value))}
              style={{ width: 80, marginLeft: 8 }} />
          </label>
          <button onClick={handleCalibrate} style={{ fontSize: 13, padding: '4px 12px' }}>
            자동 계산
          </button>
        </div>
        {calResult && (
          <div style={{ marginTop: 8, fontSize: 13, color: calResult.includes('실패') ? '#e94560' : '#4ade80' }}>
            {calResult}
          </div>
        )}
      </div>

      {/* 가중 추천 계산 */}
      <div style={{ background: '#16213e', padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h3 style={{ marginTop: 0 }}>가중 감도 추천</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <label>
            정적 최적 cm/360:
            <input type="number" value={staticOpt} onChange={(e) => setStaticOpt(Number(e.target.value))}
              style={{ width: 80, marginLeft: 8 }} />
          </label>
          <label>
            무빙 최적 cm/360:
            <input type="number" value={movingOpt} onChange={(e) => setMovingOpt(Number(e.target.value))}
              style={{ width: 80, marginLeft: 8 }} />
          </label>
          <button onClick={handleCalcRecommendation}>계산</button>
        </div>

        {recommendation && (
          <div style={{ background: '#0f3460', padding: 16, borderRadius: 6 }}>
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#e94560' }}>
              {recommendation.final_cm360.toFixed(1)} cm/360
            </div>
            <div style={{ marginTop: 8, opacity: 0.8 }}>
              정적 {recommendation.static_optimal.toFixed(1)} × 무빙 {recommendation.moving_optimal.toFixed(1)}
              {' '}(비율 {(recommendation.movement_ratio * 100).toFixed(0)}%)
            </div>
            <div style={{ marginTop: 4, color: '#4ade80' }}>
              {recommendation.direction}
            </div>
          </div>
        )}
      </div>

      {/* 프리셋 비교 테이블 */}
      <div style={{ background: '#1a1a2e', padding: 20, borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>게임별 프리셋 비교</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #333' }}>
              <th style={{ textAlign: 'left', padding: 6 }}>게임</th>
              <th>속도</th>
              <th>정지</th>
              <th>가속</th>
              <th>공중</th>
              <th>CS보너스</th>
            </tr>
          </thead>
          <tbody>
            {presets.map((p, i) => (
              <tr key={p.game_id}
                style={{
                  background: i === selectedIdx ? '#0f3460' : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => selectPreset(i)}
              >
                <td style={{ padding: 6 }}>{p.name}</td>
                <td style={{ textAlign: 'center' }}>{p.max_speed}</td>
                <td style={{ textAlign: 'center' }}>{p.stop_time}s</td>
                <td style={{ textAlign: 'center' }}>{ACCEL_LABELS[p.accel_type] ?? p.accel_type}</td>
                <td style={{ textAlign: 'center' }}>{p.air_control}</td>
                <td style={{ textAlign: 'center' }}>{p.cs_bonus}x</td>
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

      // 이동 점
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
    <div style={{ background: '#0d1117', borderRadius: 8, padding: 8, width: 260 }}>
      <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>라이브 프리뷰</div>
      <canvas ref={canvasRef} width={244} height={120} style={{ borderRadius: 4 }} />
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <label>{label}</label>
        <span>{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%' }}
      />
    </div>
  );
}
