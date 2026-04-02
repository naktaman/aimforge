/**
 * Aim DNA 히스토리 + 전후 비교 컴포넌트
 * - 5축 시계열 라인 차트 + 변경점 마커
 * - 스냅샷 비교 모드 (두 스냅샷 선택 → 레이더 오버레이)
 * - 정체기 감지 배너 + 개선 방향 인사이트
 */
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAimDnaStore } from '../stores/aimDnaStore';
import type { DnaSnapshot, DnaChangeEvent, SnapshotComparison } from '../utils/types';

// 5축 색상 팔레트
const AXIS_COLORS: Record<string, string> = {
  flick_power:        '#e94560',
  tracking_precision: '#4ecdc4',
  motor_control:      '#ffe66d',
  speed:              '#a29bfe',
  consistency:        '#fd79a8',
};

const AXIS_LABELS: Record<string, string> = {
  flick_power:        'Flick Power',
  tracking_precision: 'Tracking',
  motor_control:      'Motor Control',
  speed:              'Speed',
  consistency:        'Consistency',
};

/** DnaSnapshot에서 수치 축에 해당하는 키 */
type AxisKey = 'flick_power' | 'tracking_precision' | 'motor_control' | 'speed' | 'consistency';

const AXIS_KEYS: AxisKey[] = [
  'flick_power', 'tracking_precision', 'motor_control', 'speed', 'consistency',
];

const CHANGE_TYPE_LABELS: Record<string, string> = {
  gear:        '🎮 기어',
  sensitivity: '🎯 감도',
  grip:        '✋ 그립',
  posture:     '🪑 자세',
};

// ── 타임라인 차트 ──────────────────────────────────────────────────────────────

interface TimelineChartProps {
  snapshots: DnaSnapshot[];
  changeEvents: DnaChangeEvent[];
  selectedIds: [number | null, number | null];
  onSelectSnapshot: (id: number) => void;
}

function TimelineChart({ snapshots, changeEvents, selectedIds, onSelectSnapshot }: TimelineChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || snapshots.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = 680;
    const H = 260;
    const margin = { top: 20, right: 24, bottom: 48, left: 44 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;

    const g = svg
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('style', 'width:100%;height:auto;')
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X 스케일: 측정 시각
    const dates = snapshots.map(s => new Date(s.measured_at));
    const xScale = d3.scaleTime()
      .domain(d3.extent(dates) as [Date, Date])
      .range([0, innerW]);

    // Y 스케일: 0~100
    const yScale = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    // 그리드
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW))
      .call(ax => ax.selectAll('line').attr('stroke', '#2a2a2a').attr('stroke-dasharray', '2,3'))
      .call(ax => ax.selectAll('text').attr('fill', '#666').attr('font-size', '11px'))
      .call(ax => ax.select('.domain').remove());

    // X축
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => {
        const date = d as Date;
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
      }))
      .call(ax => ax.selectAll('text').attr('fill', '#666').attr('font-size', '10px'))
      .call(ax => ax.select('.domain').attr('stroke', '#333'));

    // 5축 라인 그리기
    AXIS_KEYS.forEach(key => {
      const lineGen = d3.line<DnaSnapshot>()
        .x(s => xScale(new Date(s.measured_at)))
        .y(s => yScale(s[key] as number))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(snapshots)
        .attr('fill', 'none')
        .attr('stroke', AXIS_COLORS[key])
        .attr('stroke-width', 1.8)
        .attr('d', lineGen);

      // 데이터 포인트
      g.selectAll<SVGCircleElement, DnaSnapshot>(`.dot-${key}`)
        .data(snapshots)
        .join('circle')
        .attr('cx', s => xScale(new Date(s.measured_at)))
        .attr('cy', s => yScale(s[key] as number))
        .attr('r', s => selectedIds.includes(s.id) ? 7 : 4)
        .attr('fill', s => selectedIds.includes(s.id) ? '#fff' : AXIS_COLORS[key])
        .attr('stroke', AXIS_COLORS[key])
        .attr('stroke-width', s => selectedIds.includes(s.id) ? 2.5 : 0)
        .attr('cursor', 'pointer')
        .on('click', (_, s) => onSelectSnapshot(s.id));
    });

    // 변경점 이벤트 수직 마커
    changeEvents.forEach(ev => {
      const evDate = new Date(ev.occurred_at);
      const x = xScale(evDate);
      if (x < 0 || x > innerW) return;

      g.append('line')
        .attr('x1', x).attr('x2', x)
        .attr('y1', 0).attr('y2', innerH)
        .attr('stroke', '#f5a623')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3')
        .attr('opacity', 0.8);

      g.append('text')
        .attr('x', x + 3)
        .attr('y', 12)
        .attr('fill', '#f5a623')
        .attr('font-size', '10px')
        .text(CHANGE_TYPE_LABELS[ev.change_type] ?? ev.change_type);
    });
  }, [snapshots, changeEvents, selectedIds]);

  return <svg ref={svgRef} />;
}

// ── 비교 레이더 오버레이 ────────────────────────────────────────────────────────

interface CompareRadarProps {
  comparison: SnapshotComparison;
}

function CompareRadar({ comparison }: CompareRadarProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const W = 320;
    const H = 320;
    const cx = W / 2;
    const cy = H / 2;
    const maxR = 120;
    const levels = 5;
    const axes = AXIS_KEYS;
    const n = axes.length;
    const slice = (2 * Math.PI) / n;

    const g = svg.attr('viewBox', `0 0 ${W} ${H}`)
      .attr('style', 'width:100%;max-width:320px;height:auto;')
      .append('g')
      .attr('transform', `translate(${cx},${cy})`);

    // 동심원 그리드
    for (let lv = 1; lv <= levels; lv++) {
      g.append('circle').attr('r', maxR / levels * lv)
        .attr('fill', 'none').attr('stroke', '#2a2a2a').attr('stroke-width', 0.5);
    }

    // 축 라인 + 라벨
    axes.forEach((key, i) => {
      const angle = slice * i - Math.PI / 2;
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', maxR * Math.cos(angle)).attr('y2', maxR * Math.sin(angle))
        .attr('stroke', '#333').attr('stroke-width', 0.5);

      const labelR = maxR + 22;
      g.append('text')
        .attr('x', labelR * Math.cos(angle))
        .attr('y', labelR * Math.sin(angle))
        .attr('text-anchor', 'middle').attr('dominant-baseline', 'middle')
        .attr('fill', '#999').attr('font-size', '11px')
        .text(AXIS_LABELS[key]);
    });

    const rScale = d3.scaleLinear().domain([0, 100]).range([0, maxR]);

    // before 폴리곤 (파란색)
    const beforeVals = [
      comparison.before.flick_power,
      comparison.before.tracking_precision,
      comparison.before.motor_control,
      comparison.before.speed,
      comparison.before.consistency,
    ];
    const beforePts = beforeVals.map((v, i) => {
      const angle = slice * i - Math.PI / 2;
      const r = rScale(v);
      return [r * Math.cos(angle), r * Math.sin(angle)];
    });
    g.append('polygon')
      .attr('points', beforePts.map(p => p.join(',')).join(' '))
      .attr('fill', '#74b9ff').attr('fill-opacity', 0.15)
      .attr('stroke', '#74b9ff').attr('stroke-width', 1.8);

    // after 폴리곤 (빨간색)
    const afterVals = [
      comparison.after.flick_power,
      comparison.after.tracking_precision,
      comparison.after.motor_control,
      comparison.after.speed,
      comparison.after.consistency,
    ];
    const afterPts = afterVals.map((v, i) => {
      const angle = slice * i - Math.PI / 2;
      const r = rScale(v);
      return [r * Math.cos(angle), r * Math.sin(angle)];
    });
    g.append('polygon')
      .attr('points', afterPts.map(p => p.join(',')).join(' '))
      .attr('fill', '#e94560').attr('fill-opacity', 0.2)
      .attr('stroke', '#e94560').attr('stroke-width', 2);
  }, [comparison]);

  return <svg ref={svgRef} />;
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

interface Props {
  profileId: number;
}

export function AimDnaHistory({ profileId }: Props) {
  const {
    snapshots, changeEvents, comparison, stagnation,
    loadSnapshots, loadChangeEvents, compareSnapshots, detectStagnation,
  } = useAimDnaStore();

  /** 비교 선택된 두 스냅샷 ID */
  const [selectedIds, setSelectedIds] = useState<[number | null, number | null]>([null, null]);
  /** 비교 모드 활성 여부 */
  const [compareMode, setCompareMode] = useState(false);

  // 마운트 시 데이터 로드
  useEffect(() => {
    loadSnapshots(profileId, 30);
    loadChangeEvents(profileId, 50);
    detectStagnation(profileId);
  }, [profileId]);

  // 스냅샷 클릭 핸들러 — 최대 2개 선택
  function handleSelectSnapshot(id: number) {
    setSelectedIds(prev => {
      if (prev[0] === id || prev[1] === id) {
        // 이미 선택된 경우 해제
        return [prev[0] === id ? null : prev[0], prev[1] === id ? null : prev[1]];
      }
      if (prev[0] === null) return [id, prev[1]];
      if (prev[1] === null) return [prev[0], id];
      // 두 개 다 선택된 경우 첫 번째 교체
      return [id, prev[1]];
    });
  }

  // 비교 실행
  async function handleCompare() {
    if (selectedIds[0] !== null && selectedIds[1] !== null) {
      // 오래된 것을 before, 최근 것을 after로 자동 정렬
      const a = snapshots.find(s => s.id === selectedIds[0]);
      const b = snapshots.find(s => s.id === selectedIds[1]);
      if (!a || !b) return;
      const [beforeId, afterId] = new Date(a.measured_at) < new Date(b.measured_at)
        ? [a.id, b.id] : [b.id, a.id];
      await compareSnapshots(profileId, beforeId, afterId);
      setCompareMode(true);
    }
  }

  const canCompare = selectedIds[0] !== null && selectedIds[1] !== null;

  return (
    <div className="aim-dna-history">
      {/* 정체기 감지 배너 */}
      {stagnation?.is_stagnant && (
        <div className="stagnation-banner" style={{
          background: '#3d2a1a', border: '1px solid #f5a623',
          borderRadius: 8, padding: '12px 16px', marginBottom: 16,
        }}>
          <strong style={{ color: '#f5a623' }}>
            정체기 감지 — {stagnation.stagnant_axes.join(', ')} 축이 5회 연속 변화 미미
          </strong>
          <ul style={{ margin: '8px 0 0', paddingLeft: 20, fontSize: 13, color: '#ccc' }}>
            {stagnation.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}

      {/* 타임라인 차트 */}
      <div className="history-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#ccc' }}>5축 성장 타임라인</h3>
          <div style={{ fontSize: 12, color: '#666' }}>
            차트 점 클릭으로 비교할 스냅샷 선택 (2개)
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#555' }}>
            아직 DNA 측정 데이터가 없습니다.<br />배터리를 완료하면 히스토리가 쌓입니다.
          </div>
        ) : (
          <TimelineChart
            snapshots={snapshots}
            changeEvents={changeEvents}
            selectedIds={selectedIds}
            onSelectSnapshot={handleSelectSnapshot}
          />
        )}

        {/* 범례 */}
        {snapshots.length > 0 && (
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {AXIS_KEYS.map(key => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                <div style={{ width: 16, height: 3, background: AXIS_COLORS[key], borderRadius: 2 }} />
                <span style={{ color: '#999' }}>{AXIS_LABELS[key]}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              <div style={{ width: 16, height: 3, background: '#f5a623', borderRadius: 2, borderTop: '2px dashed #f5a623' }} />
              <span style={{ color: '#f5a623' }}>변경점</span>
            </div>
          </div>
        )}
      </div>

      {/* 비교 액션 */}
      {snapshots.length >= 2 && (
        <div style={{ margin: '16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn-primary"
            disabled={!canCompare}
            onClick={handleCompare}
            style={{ opacity: canCompare ? 1 : 0.4 }}
          >
            선택한 두 스냅샷 비교
          </button>
          {canCompare && (
            <span style={{ fontSize: 13, color: '#888' }}>
              스냅샷 #{selectedIds[0]} vs #{selectedIds[1]}
            </span>
          )}
          {compareMode && (
            <button className="btn-secondary" style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={() => { setCompareMode(false); setSelectedIds([null, null]); }}>
              비교 초기화
            </button>
          )}
        </div>
      )}

      {/* 비교 결과 */}
      {compareMode && comparison && (
        <div className="comparison-panel" style={{
          background: '#141414', border: '1px solid #2a2a2a',
          borderRadius: 10, padding: 20, marginTop: 8,
        }}>
          <h3 style={{ marginTop: 0, fontSize: 15, color: '#ccc' }}>전후 비교 결과</h3>

          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* 레이더 오버레이 */}
            <div style={{ flex: '0 0 auto' }}>
              <CompareRadar comparison={comparison} />
              <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, background: '#74b9ff', borderRadius: 2, opacity: 0.6 }} />
                  <span style={{ color: '#74b9ff' }}>이전</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 12, height: 12, background: '#e94560', borderRadius: 2, opacity: 0.6 }} />
                  <span style={{ color: '#e94560' }}>이후</span>
                </div>
              </div>
            </div>

            {/* 축별 수치 변화 테이블 */}
            <div style={{ flex: 1, minWidth: 240 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>
                    {['축', '이전', '이후', '변화 (%)'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#666', fontWeight: 'normal', borderBottom: '1px solid #222' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.deltas.map(d => {
                    const color = d.direction === 'improved' ? '#00b894'
                      : d.direction === 'degraded' ? '#e94560' : '#888';
                    return (
                      <tr key={d.axis}>
                        <td style={{ padding: '6px 8px', color: '#ccc' }}>{d.axis}</td>
                        <td style={{ padding: '6px 8px', color: '#888' }}>{d.before_val.toFixed(1)}</td>
                        <td style={{ padding: '6px 8px', color: '#ccc' }}>{d.after_val.toFixed(1)}</td>
                        <td style={{ padding: '6px 8px', color }}>
                          {d.delta_pct > 0 ? '+' : ''}{d.delta_pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 자동 인사이트 */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 6 }}>자동 분석</div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#ccc' }}>
              {comparison.insights.map((msg, i) => <li key={i}>{msg}</li>)}
            </ul>
          </div>
        </div>
      )}

      {/* 변경점 이벤트 목록 */}
      {changeEvents.length > 0 && (
        <div className="change-events-section" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, color: '#ccc', marginBottom: 8 }}>변경점 이벤트 기록</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {changeEvents.slice(0, 10).map(ev => (
              <div key={ev.id} style={{
                background: '#1a1a1a', border: '1px solid #2a2a2a',
                borderRadius: 6, padding: '10px 14px', fontSize: 13,
                display: 'flex', gap: 12, alignItems: 'flex-start',
              }}>
                <span style={{ color: '#f5a623', whiteSpace: 'nowrap' }}>
                  {CHANGE_TYPE_LABELS[ev.change_type] ?? ev.change_type}
                </span>
                <span style={{ color: '#888', whiteSpace: 'nowrap' }}>
                  {new Date(ev.occurred_at).toLocaleDateString('ko-KR')}
                </span>
                <span style={{ color: '#ccc', flex: 1 }}>{ev.description}</span>
                {ev.before_value && (
                  <span style={{ color: '#555', fontSize: 11 }}>
                    {ev.before_value} → {ev.after_value}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
