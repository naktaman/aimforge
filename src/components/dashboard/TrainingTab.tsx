/**
 * 훈련 탭 — 3열 대시보드
 * 좌: 훈련 요약 + 서브탭 전환, 중앙: 카탈로그/커스텀/배터리, 우: 최근 기록
 */
import type { ScenarioType, GamePreset, BatteryPreset } from '../../utils/types';
import type { ScenarioParamsState } from '../../types/scenarioSelect';
import type { BatteryParams, TrainingStartParams } from '../../types/scenarioSelect';
import { CategoryIcons, TRAINING_CATALOG, SCENARIO_TABS } from '../../config/scenarioConstants';

/** 훈련 서브탭 */
type TrainingSub = 'catalog' | 'custom' | 'battery';

/** 훈련 탭 Props */
interface TrainingTabProps {
  trainingSub: TrainingSub;
  setTrainingSub: (sub: TrainingSub) => void;
  subTabRef: React.RefObject<HTMLDivElement | null>;
  subTabKeyDown: (e: React.KeyboardEvent) => void;
  selectedGame: GamePreset | null;
  onBattery?: (params: BatteryParams) => void;
  onTrainingStart?: (params: TrainingStartParams) => void;
  scenarioType: ScenarioType;
  setScenarioType: (type: ScenarioType) => void;
  renderParams: () => React.ReactNode;
  handleStart: () => void;
  params: ScenarioParamsState;
  setParam: <K extends keyof ScenarioParamsState>(field: K, value: ScenarioParamsState[K]) => void;
  t: (key: string) => string;
  mode: string;
}

/** 훈련 탭 컴포넌트 */
export function TrainingTab({
  trainingSub, setTrainingSub, subTabRef, subTabKeyDown,
  selectedGame, onBattery, onTrainingStart,
  scenarioType, setScenarioType,
  renderParams, handleStart,
  params, setParam, t,
}: TrainingTabProps) {
  return (
    <div className="dash-grid-3col">
      {/* 좌측 25% — 훈련 요약 */}
      <div className="dash-col-left">
        <div className="dash-section-label">{t('dash.trainingStats')}</div>
        {/* 오늘 훈련 통계 — 실데이터 없으면 "데이터 없음" 서브라벨 */}
        <div className="dash-stat-card">
          <span className="dash-stat-label">{t('dash.todaySessions')}</span>
          <span className="dash-stat-value">{'\u2014'}</span>
          <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
        </div>
        <div className="dash-stat-card">
          <span className="dash-stat-label">{t('dash.avgScore')}</span>
          <span className="dash-stat-value">{'\u2014'}</span>
          <span className="dash-stat-sub">{t('dash.noDataYet')}</span>
        </div>

        {/* 배터리 테스트 진입 */}
        {onBattery && (
          <button
            className="btn-secondary"
            style={{ width: '100%', marginTop: 'var(--space-2)' }}
            onClick={() => onBattery({ preset: 'TACTICAL' })}
            disabled={!selectedGame}
          >
            {t('scenario.batteryTest')}
          </button>
        )}

        {/* 서브탭: 카탈로그/커스텀/배터리 전환 */}
        <div className="dash-section-label" style={{ marginTop: 'var(--space-3)' }}>{t('dash.mode')}</div>
        <div className="dash-sub-tabs" role="tablist" ref={subTabRef} onKeyDown={subTabKeyDown}>
          {([
            { key: 'catalog' as TrainingSub, label: t('scenario.catalog') },
            { key: 'custom' as TrainingSub, label: t('scenario.customPlay') },
            { key: 'battery' as TrainingSub, label: t('scenario.batteryTest') },
          ]).map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={trainingSub === key}
              tabIndex={trainingSub === key ? 0 : -1}
              className={`dash-sub-tab ${trainingSub === key ? 'active' : ''}`}
              onClick={() => setTrainingSub(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 중앙 45% — 카탈로그/커스텀/배터리 콘텐츠 */}
      <div className="dash-col-center">
        <div className="dash-section-label">
          {trainingSub === 'catalog' ? t('scenario.catalog') : trainingSub === 'custom' ? t('scenario.customScenario') : t('scenario.battery')}
        </div>

        {/* 카탈로그 — 카테고리 헤더 + 아이콘 + 2열 그리드 */}
        {trainingSub === 'catalog' && (
          <div>
            {TRAINING_CATALOG.map(({ category, items }) => (
              <div key={category}>
                <div className="dash-catalog-category">
                  <span className="dash-catalog-category-icon">{CategoryIcons[category]}</span>
                  <span className="dash-catalog-category-name">{category}</span>
                </div>
                <div className="dash-catalog-grid">
                  {items.map((item) => (
                    <button
                      key={item.type}
                      className="dash-catalog-card"
                      disabled={!selectedGame}
                      onClick={() => onTrainingStart?.({ stageType: item.type })}
                    >
                      <div className="dash-catalog-color" style={{ background: item.color }} />
                      <span className="dash-catalog-name">
                        {item.name}
                        {'star' in item && item.star && <span className="star-badge">CORE</span>}
                      </span>
                      <span className="dash-catalog-desc">{t(item.descKey)}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 커스텀 플레이 */}
        {trainingSub === 'custom' && (
          <div className="dash-custom-play">
            <div className="scenario-tabs">
              {SCENARIO_TABS.map(({ type, label }) => (
                <button key={type} className={scenarioType === type ? 'active' : ''} onClick={() => setScenarioType(type)}>
                  {label}
                </button>
              ))}
            </div>
            {renderParams()}
            <button className="btn-primary btn-lg" onClick={handleStart} disabled={!selectedGame} style={{ marginTop: 'var(--space-4)', width: '100%' }}>
              {t('scenario.startScenario')}
            </button>
          </div>
        )}

        {/* 배터리 테스트 */}
        {trainingSub === 'battery' && (
          <div className="dash-battery">
            <p className="dash-battery-desc">{t('scenario.batteryDesc')}</p>
            <div className="dash-battery-presets">
              {(['TACTICAL', 'MOVEMENT', 'BR', 'CUSTOM'] as BatteryPreset[]).map((preset) => (
                <label key={preset} className="dash-battery-radio">
                  <input type="radio" name="battery" value={preset} checked={params.batteryPreset === preset} onChange={() => setParam('batteryPreset', preset)} />
                  {preset}
                </label>
              ))}
            </div>
            {onBattery && (
              <button className="btn-primary btn-lg" onClick={() => onBattery({ preset: params.batteryPreset })} disabled={!selectedGame} style={{ width: '100%' }}>
                {t('scenario.startBattery')} ({params.batteryPreset})
              </button>
            )}
          </div>
        )}
      </div>

      {/* 우측 30% — 최근 기록 */}
      <div className="dash-col-right">
        <div className="dash-section-label">{t('dash.recentPlays')}</div>
        <div className="dash-recent-list">
          <div className="dash-empty-state">
            <svg className="dash-empty-icon" width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25">
              <rect x="6" y="4" width="24" height="28" rx="3" />
              <line x1="11" y1="12" x2="25" y2="12" /><line x1="11" y1="18" x2="22" y2="18" /><line x1="11" y1="24" x2="19" y2="24" />
            </svg>
            <span className="dash-empty-text">{t('empty.sessionData')}</span>
          </div>
        </div>

        {/* 점수 트렌드 — 데이터 없으면 empty state */}
        <div className="dash-chart">
          <div className="dash-chart-header">
            <span className="dash-chart-title">{t('dash.scoreTrend')}</span>
          </div>
          <div className="dash-empty-state">
            <svg className="dash-empty-icon" width="36" height="36" viewBox="0 0 36 36" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.25">
              <line x1="6" y1="30" x2="6" y2="6" /><line x1="6" y1="30" x2="30" y2="30" />
              <polyline points="10,24 16,18 20,22 26,12" />
            </svg>
            <span className="dash-empty-text">{t('empty.sessionData')}</span>
          </div>
        </div>
      </div>

      {/* 하단: 카테고리 카드 */}
      <div className="dash-bottom-cards">
        {(['Flick', 'Tracking', 'Switching'] as const).map((cat) => (
          <button key={cat} className="dash-cat-card" onClick={() => { setTrainingSub('catalog'); }}>
            <span className="dash-cat-icon" style={{ color: 'var(--accent-primary)' }}>
              {CategoryIcons[cat]}
            </span>
            <span className="dash-cat-label">{cat}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
