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
import { useTranslation } from '../i18n';
import { UI_COLORS } from '../config/theme';

interface Props {
  onBack: () => void;
}

/** 갭 원인 i18n 키 맵 */
const CAUSE_KEYS: Record<string, string> = {
  sens_mismatch: 'crossGame.sensMismatch',
  movement_unadapted: 'crossGame.movementUnadapted',
  style_mismatch: 'crossGame.styleMismatch',
  transition_narrowed: 'crossGame.transitionNarrowed',
  vertical_weakness_exposed: 'crossGame.verticalWeakness',
};

/** 심각도 → 뱃지 클래스 매핑 */
const SEVERITY_BADGE: Record<string, string> = {
  minor: 'badge',
  moderate: 'badge badge--warning',
  major: 'badge badge--danger',
  critical: 'badge badge--danger',
};

/** 듀얼 레이더 차트 — ref(파랑) + target(빨강) 오버레이 (D3 인라인 색상 유지) */
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
      g.append('circle').attr('r', r).attr('fill', 'none').attr('stroke', UI_COLORS.chartDomain).attr('stroke-width', 0.5);
    }

    // 축 라인 + 라벨
    refAxes.forEach((axis, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      g.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', maxR * Math.cos(angle))
        .attr('y2', maxR * Math.sin(angle))
        .attr('stroke', UI_COLORS.chartAxisLine).attr('stroke-width', 0.5);

      const labelR = maxR + 25;
      g.append('text')
        .attr('x', labelR * Math.cos(angle))
        .attr('y', labelR * Math.sin(angle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', UI_COLORS.chartLabel)
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

    drawPoly(refAxes, UI_COLORS.radarReference);   // Reference — 파랑
    drawPoly(targetAxes, UI_COLORS.accentGold); // Target — 오렌지(forge)

    // 범례
    const legendY = -maxR - 15;
    [{ color: UI_COLORS.radarReference, label: 'Reference' }, { color: UI_COLORS.accentGold, label: 'Target' }].forEach((item, i) => {
      const x = -40 + i * 100;
      g.append('rect').attr('x', x).attr('y', legendY).attr('width', 12).attr('height', 12).attr('fill', item.color).attr('rx', 2);
      g.append('text').attr('x', x + 16).attr('y', legendY + 10).attr('fill', UI_COLORS.chartLabel).attr('font-size', '11px').text(item.label);
    });
  }, [refAxes, targetAxes]);

  return <svg ref={svgRef} className="radar-chart dual-radar" />;
}

/** 프로파일 선택 + 비교 실행 UI */
function ComparisonSelector({ profiles, onCompare }: {
  profiles: GameProfile[];
  onCompare: (refId: number, targetId: number) => void;
}) {
  const { t } = useTranslation();
  const [refId, setRefId] = useState<number>(profiles[0]?.id ?? 0);
  const [targetId, setTargetId] = useState<number>(profiles[1]?.id ?? 0);

  return (
    <div className="cg-selector">
      <div className="form-group">
        <label className="form-label">Reference</label>
        <select className="select-field" value={refId} onChange={e => setRefId(Number(e.target.value))}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.gameName}</option>)}
        </select>
      </div>
      <span className="cg-selector__vs text-muted">vs</span>
      <div className="form-group">
        <label className="form-label">Target</label>
        <select className="select-field" value={targetId} onChange={e => setTargetId(Number(e.target.value))}>
          {profiles.map(p => <option key={p.id} value={p.id}>{p.gameName}</option>)}
        </select>
      </div>
      <button
        className="btn btn--primary cg-selector__btn"
        disabled={refId === targetId}
        onClick={() => onCompare(refId, targetId)}
      >
        {t('crossGame.runCompare')}
      </button>
    </div>
  );
}

/** 비교 결과 렌더링 */
function ComparisonResult({ comparison }: { comparison: ComparisonType }) {
  const { t } = useTranslation();
  // DNA 프로파일 로드 (레이더용)
  const [refDna, setRefDna] = useState<AimDnaProfile | null>(null);
  const [targetDna, setTargetDna] = useState<AimDnaProfile | null>(null);

  useEffect(() => {
    (async () => {
      const ref = await invoke<AimDnaProfile | null>('get_aim_dna', { params: { profileId: comparison.refProfileId } });
      const target = await invoke<AimDnaProfile | null>('get_aim_dna', { params: { profileId: comparison.targetProfileId } });
      setRefDna(ref);
      setTargetDna(target);
    })();
  }, [comparison.refProfileId, comparison.targetProfileId]);

  const refAxes = refDna ? computeRadarAxes(refDna) : [];
  const targetAxes = targetDna ? computeRadarAxes(targetDna) : [];
  const sortedDeltas = [...comparison.deltas].sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct));

  return (
    <div>
      {/* 전체 갭 요약 */}
      <div className="cg-gap-summary page-section">
        <div className="stat-value stat-value--accent stat-value--big">
          {comparison.overallGap.toFixed(1)}%
        </div>
        <div className="stat-label">{t('crossGame.overallGap')}</div>
        <p className="text-sm text-muted cg-gap-summary__adapt">
          {t('crossGame.estimatedAdapt')}: <strong className="text-accent">{comparison.predictedDays.toFixed(0)} {t('style.days')}</strong>
        </p>
      </div>

      {/* 듀얼 레이더 */}
      {refAxes.length > 0 && targetAxes.length > 0 && (
        <DualRadarChart refAxes={refAxes} targetAxes={targetAxes} />
      )}

      {/* 델타 테이블 */}
      <h3 className="page-section__title">{t('crossGame.featureDelta')}</h3>
      <table className="data-table cg-delta-table">
        <thead>
          <tr>
            <th>{t('hardware.feature')}</th>
            <th className="text-right">Ref</th>
            <th className="text-right">Target</th>
            <th className="text-right">Delta</th>
            <th className="text-center">{t('crossGame.severity')}</th>
          </tr>
        </thead>
        <tbody>
          {sortedDeltas.map(d => (
            <tr key={d.feature}>
              <td>{d.feature}</td>
              <td className="text-right cg-ref-value">{d.refValue.toFixed(3)}</td>
              <td className="text-right cg-target-value">{d.targetValue.toFixed(3)}</td>
              <td className={`text-right ${d.deltaPct > 0 ? 'cg-delta-pos' : 'cg-delta-neg'}`}>
                {d.deltaPct > 0 ? '+' : ''}{d.deltaPct.toFixed(1)}%
              </td>
              <td className="text-center">
                <span className={SEVERITY_BADGE[d.severity] ?? 'badge'}>
                  {d.severity}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 갭 원인 카드 */}
      {comparison.causes.length > 0 && (
        <div className="page-section">
          <h3 className="page-section__title">{t('crossGame.gapAnalysis')}</h3>
          <div className="cg-cause-list">
            {comparison.causes.map((cause, i) => (
              <div key={i} className="glass-card glass-card--compact">
                <div className="cg-cause-header">
                  <strong className="text-accent">
                    {CAUSE_KEYS[cause.causeType] ? t(CAUSE_KEYS[cause.causeType]) : cause.causeType}
                  </strong>
                  <span className="text-sm text-muted">
                    {t('crossGame.severity')} {cause.severity.toFixed(0)}%
                  </span>
                </div>
                <p className="text-sm text-muted cg-cause-desc">{cause.description}</p>
                <div className="cg-tag-list">
                  {cause.contributingFeatures.map(f => (
                    <span key={f} className="badge">{f}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 개선 타임라인 */}
      <div className="page-section">
        <h3 className="page-section__title">{t('crossGame.improvementPlan')}</h3>
        <div className="cg-timeline">
          {comparison.improvementPlan.phases.map(phase => (
            <div key={phase.phase} className="cg-timeline__phase">
              {/* Phase 마커 */}
              <div className="cg-timeline__marker">{phase.phase}</div>
              <div className="cg-timeline__content">
                <div className="cg-timeline__phase-header">
                  <strong>{phase.name}</strong>
                  <span className="badge badge--warning">{phase.durationWeeks}</span>
                </div>
                <ul className="cg-timeline__actions text-sm text-muted">
                  {phase.actions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
                {phase.scenarios.length > 0 && (
                  <div className="cg-tag-list">
                    {phase.scenarios.map(s => (
                      <span key={s} className="badge badge--info">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 타임라인 예측 상세 */}
      {comparison.timeline && comparison.timeline.perFeature.length > 0 && (
        <div className="page-section">
          <h3 className="page-section__title">{t('crossGame.featureEstimate')}</h3>
          <div className="cg-feature-bars">
            {comparison.timeline.perFeature
              .sort((a, b) => b.estimatedDays - a.estimatedDays)
              .slice(0, 8)
              .map(ft => (
                <div key={ft.feature} className="cg-feature-bar">
                  <span className="cg-feature-bar__label text-sm text-muted">{ft.feature}</span>
                  <div className="cg-feature-bar__track">
                    <div
                      className={`cg-feature-bar__fill ${ft.feature === comparison.timeline!.bottleneckFeature ? 'cg-feature-bar__fill--bottleneck' : ''}`}
                      style={{ width: `${Math.min(ft.estimatedDays / (comparison.timeline!.totalDays || 1) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="cg-feature-bar__days text-sm text-muted">
                    {ft.estimatedDays.toFixed(0)} {t('style.days')}
                  </span>
                </div>
              ))}
          </div>
          <p className="text-sm text-muted cg-disclaimer">
            {comparison.timeline.disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}

/** 크로스게임 DNA 비교 메인 컴포넌트 */
export function CrossGameComparison({ onBack }: Props) {
  const { t } = useTranslation();
  const { currentComparison, isComparing, compareGames } = useCrossGameStore();
  const { profiles, loadProfiles } = useGameProfileStore();

  useEffect(() => {
    loadProfiles();
  }, []);

  /** 두 프로파일 비교 실행 */
  const handleCompare = async (refId: number, targetId: number) => {
    await compareGames(refId, targetId);
  };

  return (
    <main className="app-main">
      <div className="page">
        <div className="page-header">
          <h2>{t('crossGame.title')}</h2>
        </div>

        {/* 프로파일 2개 미만 시 안내 */}
        {profiles.length < 2 ? (
          <div className="cg-empty-state">
            <p>{t('crossGame.needProfiles')}</p>
            <p className="text-sm text-muted">
              {t('crossGame.addProfiles')}
            </p>
          </div>
        ) : (
          <>
            <ComparisonSelector profiles={profiles} onCompare={handleCompare} />

            {isComparing && (
              <div className="spinner">
                {t('crossGame.comparing')}
              </div>
            )}

            {currentComparison && !isComparing && (
              <ComparisonResult comparison={currentComparison} />
            )}
          </>
        )}

        <div className="result-actions">
          <button className="btn btn--secondary" onClick={onBack}>{t('common.back')}</button>
        </div>
      </div>
    </main>
  );
}
