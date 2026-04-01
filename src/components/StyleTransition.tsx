/**
 * 스타일 전환 모드 화면
 * 4단계 Phase 인디케이터 + 수렴 진행바 + 전환 시작 폼
 */
import { useState, useEffect } from 'react';
import { useTrainingStore } from '../stores/trainingStore';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** Phase 단계 정의 */
const PHASES = [
  { key: 'initial', label: '초기', icon: '1' },
  { key: 'adaptation', label: '적응', icon: '2' },
  { key: 'consolidation', label: '안정화', icon: '3' },
  { key: 'mastery', label: '숙달', icon: '4' },
] as const;

/** 스타일 타입 옵션 */
const STYLE_TYPES = [
  { value: 'wrist-flicker', label: '손목 플리커' },
  { value: 'arm-tracker', label: '팔 트래커' },
  { value: 'hybrid', label: '하이브리드' },
  { value: 'precision', label: '정밀 사수' },
] as const;

export default function StyleTransition({ onBack, profileId }: Props) {
  const {
    styleTransition, transitionProgress,
    loadStyleTransition, startStyleTransition, updateStyleTransition,
  } = useTrainingStore();

  const [fromType, setFromType] = useState('wrist-flicker');
  const [toType, setToType] = useState('arm-tracker');
  const [sensRange, setSensRange] = useState('25-35');

  useEffect(() => {
    loadStyleTransition(profileId);
  }, [profileId, loadStyleTransition]);

  const handleStart = () => {
    startStyleTransition(profileId, fromType, toType, sensRange);
  };

  const handleComplete = () => {
    updateStyleTransition(profileId, 'complete');
  };

  const currentPhaseIdx = transitionProgress
    ? PHASES.findIndex(p => p.key === transitionProgress.phase)
    : -1;

  return (
    <div style={{ padding: 32, maxWidth: 700, margin: '0 auto', color: '#e0e0e0' }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={btnStyle}>← 뒤로</button>
        <h2 style={{ margin: 0, fontSize: 22 }}>스타일 전환</h2>
      </div>

      {styleTransition && transitionProgress ? (
        <>
          {/* 전환 정보 */}
          <div style={{
            background: '#1e1e30', borderRadius: 12, padding: 20, marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#60a5fa' }}>
              {STYLE_TYPES.find(s => s.value === styleTransition.from_type)?.label || styleTransition.from_type}
            </span>
            <span style={{ fontSize: 20, color: '#888' }}>→</span>
            <span style={{ fontSize: 16, fontWeight: 600, color: '#4ade80' }}>
              {STYLE_TYPES.find(s => s.value === styleTransition.to_type)?.label || styleTransition.to_type}
            </span>
          </div>

          {/* Phase 인디케이터 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', marginBottom: 24,
            background: '#1e1e30', borderRadius: 12, padding: 20,
          }}>
            {PHASES.map((phase, i) => {
              const isActive = i === currentPhaseIdx;
              const isDone = i < currentPhaseIdx;
              const color = isDone ? '#4ade80' : isActive ? '#3b82f6' : '#444';
              return (
                <div key={phase.key} style={{ textAlign: 'center', flex: 1 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%', margin: '0 auto 8px',
                    background: isDone ? '#4ade8033' : isActive ? '#3b82f633' : '#2a2a3e',
                    border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color,
                  }}>
                    {isDone ? '✓' : phase.icon}
                  </div>
                  <div style={{ fontSize: 12, color: isActive ? '#fff' : '#888' }}>{phase.label}</div>
                </div>
              );
            })}
          </div>

          {/* 전체 수렴도 */}
          <div style={{ background: '#1e1e30', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 14 }}>전체 수렴도</span>
              <span style={{ fontWeight: 700, color: '#60a5fa' }}>{transitionProgress.convergence_pct.toFixed(1)}%</span>
            </div>
            <div style={{ background: '#2a2a3e', borderRadius: 4, height: 10, overflow: 'hidden' }}>
              <div style={{
                width: `${transitionProgress.convergence_pct}%`, height: '100%', borderRadius: 4,
                background: 'linear-gradient(90deg, #3b82f6, #4ade80)',
                transition: 'width 0.3s',
              }} />
            </div>

            {transitionProgress.estimated_days_remaining > 0 && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
                예상 잔여: ~{Math.ceil(transitionProgress.estimated_days_remaining)}일
              </div>
            )}
          </div>

          {/* 피처별 수렴 바 */}
          <div style={{ background: '#1e1e30', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, marginBottom: 12 }}>핵심 피처 수렴</h3>
            {transitionProgress.key_features_status.map(f => (
              <div key={f.feature_name} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span>{f.feature_name.replace(/_/g, ' ')}</span>
                  <span style={{ color: '#aaa' }}>
                    {f.convergence_pct.toFixed(0)}% ({f.target_direction === 'up' ? '↑' : '↓'})
                  </span>
                </div>
                <div style={{ background: '#2a2a3e', borderRadius: 3, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${f.convergence_pct}%`, height: '100%', borderRadius: 3,
                    background: f.convergence_pct > 80 ? '#4ade80' : f.convergence_pct > 50 ? '#f5a623' : '#e94560',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* 플래토 경고 */}
          {transitionProgress.plateau_detected && (
            <div style={{
              background: '#f5a62322', border: '1px solid #f5a623',
              borderRadius: 8, padding: 12, marginBottom: 20, fontSize: 13, color: '#f5a623',
            }}>
              플래토 감지: 수렴 속도가 정체되고 있습니다. 훈련 방법 변경을 고려하세요.
            </div>
          )}

          {/* 완료 버튼 */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={handleComplete} style={{ ...btnStyle, background: '#4ade8033', color: '#4ade80' }}>
              전환 완료
            </button>
          </div>
        </>
      ) : (
        /* 새 전환 시작 폼 */
        <div style={{ background: '#1e1e30', borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>새 스타일 전환 시작</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>현재 스타일 (From)</label>
              <select value={fromType} onChange={e => setFromType(e.target.value)} style={inputStyle}>
                {STYLE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>목표 스타일 (To)</label>
              <select value={toType} onChange={e => setToType(e.target.value)} style={inputStyle}>
                {STYLE_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>목표 감도 범위 (cm/360)</label>
              <input
                type="text"
                value={sensRange}
                onChange={e => setSensRange(e.target.value)}
                placeholder="예: 25-35"
                style={inputStyle}
              />
            </div>
            <button onClick={handleStart} style={{ ...btnStyle, background: '#3b82f6', padding: '10px 24px', fontWeight: 600 }}>
              전환 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#2a2a3e', color: '#e0e0e0', border: 'none',
  borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  background: '#2a2a3e', color: '#e0e0e0', border: '1px solid #444',
  borderRadius: 6, padding: '8px 12px', width: '100%', fontSize: 13,
};
