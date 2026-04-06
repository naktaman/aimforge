/**
 * 분석 탭 — 3열 대시보드
 * 좌: 종합 통계, 중앙: 세션 트렌드 + 분석 도구, 우: 최근 시나리오 점수
 */
import { useEngineStore } from '../../stores/engineStore';
import { CategoryIcons } from '../../config/scenarioConstants';

/** 분석 탭 Props */
interface AnalysisTabProps {
  onHistory?: () => void;
  mode: string;
  t: (key: string) => string;
  setMainTab: (tab: 'sensitivity' | 'training' | 'analysis') => void;
}

/** 분석 탭 컴포넌트 */
export function AnalysisTab({ onHistory, mode, t, setMainTab }: AnalysisTabProps) {
  return (
    <div className="dash-grid-3col">
      {/* 좌측 25% — 종합 통계 카드 */}
      <div className="dash-col-left">
        <div className="dash-section-label">{t('dash.globalMetrics')}</div>
        <div className="dash-stat-card dash-stat-hero">
          <span className="dash-stat-label">{t('dash.overallScore')}</span>
          <span className="dash-stat-value">{'\u2014'}</span>
          <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
        </div>
        <div className="dash-stat-card dash-stat-accent">
          <span className="dash-stat-label">{t('dash.overallAccuracy')}</span>
          <span className="dash-stat-value">{'\u2014'}</span>
          <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">{t('dash.reactionTime')}</span>
          <span className="dash-stat-value">{'\u2014'}</span>
          <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">{t('dash.criticalHitRatio')}</span>
          <span className="dash-stat-value">{'\u2014'}</span>
          <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
        </div>
      </div>

      {/* 중앙 45% — 세션 트렌드 + 분석 도구 */}
      <div className="dash-col-center">
        <div className="dash-section-label">{t('dash.sessionTrendline')}</div>
        <div className="dash-chart">
          <div className="dash-chart-header">
            <span className="dash-chart-title">{t('dash.last90days')}</span>
          </div>
          <div className="dash-empty-state">
            <svg className="dash-empty-icon" width="48" height="32" viewBox="0 0 48 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.2">
              <line x1="4" y1="28" x2="44" y2="28" />
              <polyline points="4,22 12,18 20,20 28,12 36,16 44,8" strokeDasharray="3 3" />
            </svg>
            <span className="dash-empty-text">{t('empty.sessionData')}</span>
          </div>
        </div>

        {/* 분석 도구 서브탭 카드 그리드 */}
        <div className="dash-section-label" style={{ marginTop: 'var(--space-4)' }}>{t('dash.analysisTools')}</div>
        <div className="dash-analysis-grid">
          <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('progress-dashboard')}>
            <span className="dash-analysis-icon">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 17 L3 8 L7 8 L7 17" /><path d="M8 17 L8 3 L12 3 L12 17" /><path d="M13 17 L13 10 L17 10 L17 17" /></svg>
            </span>
            <span className="dash-analysis-name">{t('tool.progressDashboard')}</span>
          </button>
          {onHistory && (
            <button className="dash-analysis-card" onClick={onHistory}>
              <span className="dash-analysis-icon">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8" /><path d="M10 5 L10 10 L14 12" /></svg>
              </span>
              <span className="dash-analysis-name">{t('tool.history')}</span>
            </button>
          )}
          {mode === 'advanced' && (
            <>
              <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('training-prescription')}>
                <span className="dash-analysis-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4 L16 4 L16 16 L4 16 Z" /><path d="M7 8 L13 8" /><path d="M7 12 L11 12" /></svg>
                </span>
                <span className="dash-analysis-name">{t('tool.prescription')}</span>
              </button>
              <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('trajectory-analysis')}>
                <span className="dash-analysis-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 18 Q6 6, 10 10 T18 2" /></svg>
                </span>
                <span className="dash-analysis-name">{t('tool.trajectory')}</span>
              </button>
              <button className="dash-analysis-card" onClick={() => useEngineStore.getState().setScreen('style-transition')}>
                <span className="dash-analysis-icon">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="10" r="4" /><circle cx="13" cy="10" r="4" /></svg>
                </span>
                <span className="dash-analysis-name">{t('tool.styleTransition')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 우측 30% — 최근 시나리오 점수 리스트 */}
      <div className="dash-col-right">
        <div className="dash-section-label">{t('dash.recentScenarios')}</div>
        <div className="dash-recent-list">
          <div className="dash-empty-state">
            <svg className="dash-empty-icon" width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25">
              <rect x="6" y="4" width="24" height="28" rx="3" />
              <line x1="11" y1="12" x2="25" y2="12" /><line x1="11" y1="18" x2="22" y2="18" /><line x1="11" y1="24" x2="19" y2="24" />
            </svg>
            <span className="dash-empty-text">{t('empty.sessionData')}</span>
          </div>
        </div>
      </div>

      {/* 하단: 분석 카테고리 카드 */}
      <div className="dash-bottom-cards">
        <button className="dash-cat-card" onClick={() => useEngineStore.getState().setScreen('progress-dashboard')}>
          <span className="dash-cat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 20 L3 10 L8 10 L8 20" /><path d="M9 20 L9 4 L14 4 L14 20" /><path d="M15 20 L15 12 L20 12 L20 20" />
            </svg>
          </span>
          <span className="dash-cat-label">{t('tool.progressDashboard')}</span>
        </button>
        {onHistory && (
          <button className="dash-cat-card" onClick={onHistory}>
            <span className="dash-cat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><path d="M12 6 L12 12 L16 14" />
              </svg>
            </span>
            <span className="dash-cat-label">{t('tool.history')}</span>
          </button>
        )}
        <button className="dash-cat-card" onClick={() => setMainTab('training')}>
          <span className="dash-cat-icon">
            {CategoryIcons.Flick}
          </span>
          <span className="dash-cat-label">{t('scenario.tabTraining')}</span>
        </button>
      </div>
    </div>
  );
}
