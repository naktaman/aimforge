/**
 * 감도 최적화 대시보드 — 메인 컨테이너
 * 5층 구조: 헤더 → GP차트 → 수렴바 → 상태카드 → CTA
 * 데이터 없으면 empty state 표시
 */
import { motion } from 'motion/react';
import { useGPDashboardStore } from '../../stores/gpDashboardStore';
import { useEngineStore } from '../../stores/engineStore';
import { GPChart } from './GPChart';
import { ConvergenceBar } from './ConvergenceBar';
import { OptimalResult } from './OptimalResult';
import { CONVERGENCE_MODE_CONFIG } from '../../utils/gpTypes';
import { useTranslation } from '../../i18n';

/** 스테이지 표시 라벨 */
const STAGE_LABELS: Record<string, string> = {
  Screening: '스크리닝',
  Calibration: '캘리브레이션',
  Complete: '완료',
};

export function SensitivityDashboard() {
  const store = useGPDashboardStore();
  const setScreen = useEngineStore(s => s.setScreen);
  const { t } = useTranslation();

  /** 데이터 존재 여부 */
  const hasData = store.observations.length > 0 || store.finalResult !== null;

  /** 뒤로가기 */
  const handleBack = () => setScreen('settings');

  /** 최종 결과 화면 */
  if (store.view === 'result' && store.finalResult) {
    return (
      <motion.div
        className="sensitivity-dashboard"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <OptimalResult
          result={store.finalResult}
          conversions={store.sensConversions}
          onBack={() => useGPDashboardStore.getState().reset()}
        />
      </motion.div>
    );
  }

  const modeConfig = CONVERGENCE_MODE_CONFIG[store.convergenceMode];

  /** 다음 라운드 시작 — 캘리브레이션 진행 화면으로 이동 */
  const handleNextRound = () => {
    setScreen('calibration-progress');
  };

  /* 데이터 없을 때 empty state */
  if (!hasData) {
    return (
      <motion.div
        className="sensitivity-dashboard"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="sd-header">
          <button className="sd-back-btn" onClick={handleBack} title="뒤로" aria-label="뒤로">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="sd-header-text">
            <h1 className="sd-title">{t('sensitivity.title')}</h1>
          </div>
        </div>
        <div className="sd-empty-state">
          <p className="sd-empty-text">{t('empty.calibrationDashboard')}</p>
          <button className="btn-primary" onClick={() => setScreen('calibration-setup')}>
            {t('empty.calibrationAction')}
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="sensitivity-dashboard"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* 1층: 헤더 */}
      <div className="sd-header">
        <button className="sd-back-btn" onClick={handleBack} title="뒤로" aria-label="뒤로">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4L6 10L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="sd-header-text">
          <h1 className="sd-title">{t('sensitivity.title')}</h1>
          <div className="sd-subtitle">
            <span className="sd-mode-badge">{modeConfig.label}</span>
            <span className="sd-stage">{STAGE_LABELS[store.stage] ?? store.stage}</span>
          </div>
        </div>
      </div>

      {/* 2층: GP 메인 차트 */}
      <div className="sd-chart-section">
        <GPChart
          curve={store.gpCurve}
          observations={store.observations}
          bestCm360={store.bestCm360}
          eiRecommendation={store.eiRecommendation}
        />
      </div>

      {/* 3층: 수렴 진행률 바 */}
      <ConvergenceBar
        progress={store.convergenceProgress}
        mode={store.convergenceMode}
        iteration={store.iteration}
        maxIterations={store.maxIterations}
      />

      {/* 4층: 상태 카드 */}
      <div className="sd-status-cards">
        <div className="sd-card">
          <div className="sd-card-label">현재 최적 감도</div>
          <div className="sd-card-value">
            {store.bestCm360 !== null
              ? `${store.bestCm360.toFixed(1)} cm/360`
              : '—'
            }
          </div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">최고 점수</div>
          <div className="sd-card-value">
            {store.bestScore !== null
              ? `${(store.bestScore * 100).toFixed(0)}점`
              : '—'
            }
          </div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">신뢰도</div>
          <div className="sd-card-value">
            {store.convergenceProgress > 0.8
              ? '높음'
              : store.convergenceProgress > 0.4
              ? '보통'
              : '탐색 중'
            }
          </div>
        </div>
        <div className="sd-card">
          <div className="sd-card-label">남은 라운드</div>
          <div className="sd-card-value">
            ~{Math.max(0, store.maxIterations - store.iteration)}
          </div>
        </div>
      </div>

      {/* 5층: CTA — 다음 라운드 시작 핸들러 연결 */}
      <div className="sd-cta">
        <button className="btn-secondary sd-cta-back" onClick={handleBack}>
          나가기
        </button>
        <button
          className="btn-primary sd-cta-next"
          disabled={store.stage === 'Complete'}
          onClick={handleNextRound}
        >
          {store.stage === 'Complete' ? '수렴 완료' : '다음 라운드 시작'}
        </button>
      </div>
    </motion.div>
  );
}
