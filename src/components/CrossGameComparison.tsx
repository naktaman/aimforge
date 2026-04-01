/**
 * 크로스게임 DNA 비교 화면
 * 듀얼 레이더 + 델타 테이블 + 갭 원인 카드 + 개선 타임라인
 */
import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useCrossGameStore } from '../stores/crossGameStore';
import { useGameProfileStore, type GameProfile } from '../stores/gameProfileStore';
import { computeRadarAxes } from '../utils/radarUtils';
import type { AimDnaProfile, RadarAxis, CrossGameComparison as ComparisonType } from '../utils/types';
import { invoke } from '@tauri-apps/api/core';

interface Props {
  onBack: () => void;
}

/** 갭 원인 한국어 라벨 */
const CAUSE_LABELS: Record<string, string> = {
  sens_mismatch: '감도 불일치',
  movement_unadapted: '무빙 미적응',
  style_mismatch: '스타일 불일치',
  transition_narrowed: '전환점 축소',
  vertical_weakness_exposed: '수직 에이밍 약점',
};

/** 심각도 색상 */
const SEVERITY_COLORS: Record<string, string> = {
  minor: '#888',
  moderate: '#f5a623',
  major: '#e07020',
  critical: '#e94560',
};

/** 듀얼 레이더 차트 — ref(파랑) + target(빨강) 오버레이 */
function DualRadarChart({ refAxes, targetAxes }: { refAxes: RadarAxis[]; targetAxes: RadarAxis[] }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || refAxes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 400;
    const height = 400;
    const cx = width / 2;
    const cy = height / 2;
    const maxR = 150;
    const levels = 5;
    const n = refAxes.length;
    const angleSlice = (2 * Math.PI) / n;

    const g = svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${cx}, ${cy})`);

    // 동심원 그리드
    for (let level = 1; level <= levels; level++) {
      const r = (maxR / levels) * level;
      g.append('circle').attr('r', r).attr('fill', 'none').attr('stroke', '#333').attr('stroke-width', 0.5);
    }

    // 축 라인 + 라벨
    refAxes.forEach((axis, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', maxR * Math.cos(angle))
        .attr('y2', maxR * Math.sin(angle))
        .attr('stroke', '#444').attr('stroke-width', 0.5);

      const labelR = maxR + 25;
      g.append('text')
        .attr('x', labelR * Math.cos(angle))
        .attr('y', labelR * Math.sin(angle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#ccc')
        .attr('font-size', '11px')
        .text(axis.label);
    });

    const rScale = d3.scaleLinear().domain([0, 100]).range([0, maxR]);

    // 폴리곤 그리기 헬퍼
    const drawPoly = (axes: RadarAxis[], color: string) => {
      const points = axes.map((a, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const r = rScale(a.value);
        return [r * Math.cos(angle), r * Math.sin(angle)] as [number, number];
      });
      g.append('polygon')
        .attr('points', points.map(p => p.join(',')).join(' '))
        .attr('fill', color)
        .attr('fill-opacity', 0.15)
        .attr('stroke', color)
        .attr('stroke-width', 2);
      points.forEach(p => {
        g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 3).attr('fill', color);
      });
    };

    drawPoly(refAxes, '#4a9eff');   // Reference — 파랑
    drawPoly(targetAxes, '#e94560'); // Target — 빨강

    // 범례
    const legendY = -maxR - 15;
    [{ color: '#4a9eff', label: 'Reference' }, { color: '#e94560', label: 'Target' }].forEach((item, i) => {
      const x = -40 + i * 100;
      g.append('rect').attr('x', x).attr('y', legendY).attr('width', 12).attr('height', 12).attr('fill', item.color).attr('rx', 2);
      g.append('text').attr('x', x + 16).attr('y', legendY + 10).attr('fill', '#ccc').attr('font-size', '11px').text(item.label);
    });
  }, [refAxes, targetAxes]);

  return <svg ref={svgRef} className="radar-chart dual-radar" />;
}

/** 프로파일 선택 + 비교 실행 UI */
function ComparisonSelector({ profiles, onCompare }: {
  profiles: GameProfile[];
  onCompare: (refId: number, targetId: number) => void;
}) {
  const [refId, setRefId] = useState<number>(profiles[0]?.id ?? 0);
  const [targetId, setTargetId] = useState<number>(profiles[1]?.id ?? 0);

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24 }}>
      <div>
        <label style={{ color: '#ccc', fontSize: 13, display: 'block', marginBottom: 4 }}>Reference</label>
        <select value={refId} onChange={e => setRefId(Number(e.target.value))} style={{ padding: '6px 12px', borderRadius: 4, background: '#2a2a2a', color: '#fff', border: '1px solid #444' }}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.gameName}</option>)}
        </select>
      </div>
      <span style={{ color: '#666', fontSize: 20, marginTop: 20 }}>vs</span>
      <div>
        <label style={{ color: '#ccc', fontSize: 13, display: 'block', marginBottom: 4 }}>Target</label>
        <select value={targetId} onChange={e => setTargetId(Number(e.target.value))} style={{ padding: '6px 12px', borderRadius: 4, background: '#2a2a2a', color: '#fff', border: '1px solid #444' }}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.gameName}</option>)}
        </select>
      </div>
      <button
        className="btn-primary"
        style={{ marginTop: 20 }}
        disabled={refId === targetId}
        onClick={() => onCompare(refId, targetId)}
      >
        비교 실행
      </button>
    </div>
  );
}

/** 비교 결과 렌더링 */
function ComparisonResult({ comparison }: { comparison: ComparisonType }) {
  // DNA 프로파일 로드 (레이더용)
  const [refDna, setRefDna] = useState<AimDnaProfile | null>(null);
  const [targetDna, setTargetDna] = useState<AimDnaProfile | null>(null);

  useEffect(() => {
    (async () => {
      const ref = await invoke<AimDnaProfile | null>('get_aim_dna', { params: { profile_id: comparison.ref_profile_id } });
      const target = await invoke<AimDnaProfile | null>('get_aim_dna', { params: { profile_id: comparison.target_profile_id } });
      setRefDna(ref);
      setTargetDna(target);
    })();
  }, [comparison.ref_profile_id, comparison.target_profile_id]);

  const refAxes = refDna ? computeRadarAxes(refDna) : [];
  const targetAxes = targetDna ? computeRadarAxes(targetDna) : [];
  const sortedDeltas = [...comparison.deltas].sort((a, b) => Math.abs(b.delta_pct) - Math.abs(a.delta_pct));

  return (
    <div>
      {/* 전체 갭 요약 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, fontWeight: 'bold', color: '#e94560' }}>
          {comparison.overall_gap.toFixed(1)}%
        </div>
        <div style={{ color: '#888' }}>전체 갭 크기</div>
        <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>
          예상 적응 기간: <strong style={{ color: '#f5a623' }}>{comparison.predicted_days.toFixed(0)}일</strong>
        </div>
      </div>

      {/* 듀얼 레이더 */}
      {refAxes.length > 0 && targetAxes.length > 0 && (
        <DualRadarChart refAxes={refAxes} targetAxes={targetAxes} />
      )}

      {/* 델타 테이블 */}
      <h3 style={{ color: '#ddd', marginTop: 24 }}>피처별 델타</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #444', color: '#999' }}>
            <th style={{ textAlign: 'left', padding: 8 }}>피처</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Ref</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Target</th>
            <th style={{ textAlign: 'right', padding: 8 }}>Delta</th>
            <th style={{ textAlign: 'center', padding: 8 }}>심각도</th>
          </tr>
        </thead>
        <tbody>
          {sortedDeltas.map(d => (
            <tr key={d.feature} style={{ borderBottom: '1px solid #333' }}>
              <td style={{ padding: 8, color: '#ccc' }}>{d.feature}</td>
              <td style={{ padding: 8, textAlign: 'right', color: '#4a9eff' }}>{d.ref_value.toFixed(3)}</td>
              <td style={{ padding: 8, textAlign: 'right', color: '#e94560' }}>{d.target_value.toFixed(3)}</td>
              <td style={{ padding: 8, textAlign: 'right', color: d.delta_pct > 0 ? '#4caf50' : '#e94560' }}>
                {d.delta_pct > 0 ? '+' : ''}{d.delta_pct.toFixed(1)}%
              </td>
              <td style={{ padding: 8, textAlign: 'center' }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11,
                  background: SEVERITY_COLORS[d.severity] ?? '#888',
                  color: '#fff',
                }}>
                  {d.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 갭 원인 카드 */}
      {comparison.causes.length > 0 && (
        <>
          <h3 style={{ color: '#ddd' }}>갭 원인 분석</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {comparison.causes.map((cause, i) => (
              <div key={i} style={{
                background: '#1e1e1e', border: '1px solid #333', borderRadius: 8, padding: 16,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <strong style={{ color: '#f5a623' }}>
                    {CAUSE_LABELS[cause.cause_type] ?? cause.cause_type}
                  </strong>
                  <span style={{ fontSize: 12, color: '#888' }}>
                    심각도 {cause.severity.toFixed(0)}%
                  </span>
                </div>
                <p style={{ color: '#aaa', margin: '4px 0 8px', fontSize: 13 }}>{cause.description}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {cause.contributing_features.map(f => (
                    <span key={f} style={{
                      padding: '2px 8px', background: '#2a2a2a', borderRadius: 4,
                      fontSize: 11, color: '#ccc',
                    }}>{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 개선 타임라인 */}
      <h3 style={{ color: '#ddd' }}>개선 플랜</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, paddingLeft: 20, borderLeft: '2px solid #444' }}>
        {comparison.improvement_plan.phases.map(phase => (
          <div key={phase.phase} style={{ position: 'relative' }}>
            {/* Phase 마커 */}
            <div style={{
              position: 'absolute', left: -28, top: 4,
              width: 16, height: 16, borderRadius: '50%',
              background: '#e94560', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: '#fff', fontWeight: 'bold',
            }}>
              {phase.phase}
            </div>
            <div style={{ paddingLeft: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ color: '#ddd' }}>{phase.name}</strong>
                <span style={{
                  padding: '1px 6px', background: '#333', borderRadius: 4,
                  fontSize: 11, color: '#f5a623',
                }}>{phase.duration_weeks}</span>
              </div>
              <ul style={{ margin: '4px 0', paddingLeft: 20, color: '#aaa', fontSize: 13 }}>
                {phase.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
              {phase.scenarios.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {phase.scenarios.map(s => (
                    <span key={s} style={{
                      padding: '1px 6px', background: '#1a1a2e', border: '1px solid #444',
                      borderRadius: 4, fontSize: 10, color: '#aaa',
                    }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 타임라인 예측 상세 */}
      {comparison.timeline && comparison.timeline.per_feature.length > 0 && (
        <>
          <h3 style={{ color: '#ddd' }}>피처별 예상 기간</h3>
          <div style={{ marginBottom: 24 }}>
            {comparison.timeline.per_feature
              .sort((a, b) => b.estimated_days - a.estimated_days)
              .slice(0, 8)
              .map(ft => (
                <div key={ft.feature} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ width: 180, fontSize: 12, color: '#aaa' }}>{ft.feature}</span>
                  <div style={{ flex: 1, height: 8, background: '#222', borderRadius: 4, marginRight: 8 }}>
                    <div style={{
                      width: `${Math.min(ft.estimated_days / (comparison.timeline.total_days || 1) * 100, 100)}%`,
                      height: '100%', borderRadius: 4,
                      background: ft.feature === comparison.timeline.bottleneck_feature ? '#e94560' : '#4a9eff',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#888', minWidth: 40, textAlign: 'right' }}>
                    {ft.estimated_days.toFixed(0)}일
                  </span>
                </div>
              ))}
            <p style={{ fontSize: 12, color: '#666', marginTop: 8, fontStyle: 'italic' }}>
              {comparison.timeline.disclaimer}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export function CrossGameComparison({ onBack }: Props) {
  const { currentComparison, isComparing, compareGames } = useCrossGameStore();
  const { profiles, loadProfiles } = useGameProfileStore();

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleCompare = async (refId: number, targetId: number) => {
    await compareGames(refId, targetId);
  };

  return (
    <main className="app-main">
      <div className="aim-dna-result">
        <h2>크로스게임 DNA 비교</h2>

        {/* 프로파일 2개 미만 시 안내 */}
        {profiles.length < 2 ? (
          <div style={{ color: '#aaa', textAlign: 'center', padding: 40 }}>
            <p>크로스게임 비교를 위해 2개 이상의 게임 프로파일이 필요합니다.</p>
            <p style={{ fontSize: 13, color: '#666' }}>
              설정 &gt; 게임 프로파일에서 게임을 추가하고, 각각 배터리 테스트를 완료하세요.
            </p>
          </div>
        ) : (
          <>
            <ComparisonSelector profiles={profiles} onCompare={handleCompare} />

            {isComparing && (
              <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>
                비교 분석 중...
              </div>
            )}

            {currentComparison && !isComparing && (
              <ComparisonResult comparison={currentComparison} />
            )}
          </>
        )}

        <div className="result-actions">
          <button className="btn-secondary" onClick={onBack}>돌아가기</button>
        </div>
      </div>
    </main>
  );
}
