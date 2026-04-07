/**
 * 인사이트 패널 — ResultScreen 하단에 표시
 * 이전 세션 대비 성과 변화, 트렌드, 훈련 추천을 Cold Forge 카드로 렌더링
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { generateSessionInsights, type Insight, type InsightType } from '../../utils/insightGenerator';
import { useProgressStore } from '../../stores/progressStore';
import type { GameMetrics } from '../../hooks/useGameMetrics';

/** 인사이트 타입별 아이콘 SVG */
function InsightIcon({ icon }: { icon: Insight['icon'] }) {
  const size = 18;
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

  switch (icon) {
    case 'trending-up':
      return <svg {...common}><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>;
    case 'trending-down':
      return <svg {...common}><polyline points="23 18 13.5 8.5 8.5 13.5 1 6" /><polyline points="17 18 23 18 23 12" /></svg>;
    case 'lightbulb':
      return <svg {...common}><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" /></svg>;
    case 'target':
      return <svg {...common}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'zap':
      return <svg {...common}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>;
  }
}

/** 인사이트 타입별 스타일 매핑 */
function getInsightStyle(type: InsightType): { className: string; label: string } {
  switch (type) {
    case 'improvement':
      return { className: 'insight-card--improvement', label: '향상' };
    case 'decline':
      return { className: 'insight-card--decline', label: '주의' };
    case 'recommendation':
      return { className: 'insight-card--recommendation', label: '추천' };
  }
}

interface InsightPanelProps {
  metrics: GameMetrics;
  scenarioType: string | null;
  /** 프로필 ID (이전 세션 로드용, 없으면 1) */
  profileId?: number;
}

export function InsightPanel({ metrics, scenarioType, profileId = 1 }: InsightPanelProps) {
  const { dailyStats, loadDailyStats } = useProgressStore();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 이전 세션 통계 로드 후 인사이트 생성
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      try {
        await loadDailyStats(profileId, 30);
      } catch {
        // 이전 데이터 없어도 추천 인사이트는 생성 가능
        console.error('[InsightPanel] 이전 통계 로드 실패');
      }
      if (!cancelled) setLoaded(true);
    }

    load();
    return () => { cancelled = true; };
  }, [profileId, loadDailyStats]);

  // dailyStats 로드 완료 시 인사이트 생성
  useEffect(() => {
    if (!loaded) return;
    const result = generateSessionInsights(metrics, dailyStats, scenarioType);
    setInsights(result);
  }, [loaded, dailyStats, metrics, scenarioType]);

  // 인사이트 없으면 렌더링 안 함
  if (insights.length === 0 && loaded) return <></>;

  return (
    <motion.div
      className="insight-panel"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 3.0, duration: 0.5 }}
    >
      <div className="insight-panel__header">
        <span className="insight-panel__title">세션 인사이트</span>
      </div>
      <div className="insight-panel__cards">
        <AnimatePresence>
          {insights.map((insight, i) => {
            const style = getInsightStyle(insight.type);
            return (
              <motion.div
                key={`${insight.metric}-${i}`}
                className={`insight-card ${style.className}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 3.2 + i * 0.15, duration: 0.3 }}
              >
                <div className="insight-card__icon">
                  <InsightIcon icon={insight.icon} />
                </div>
                <div className="insight-card__content">
                  <span className="insight-card__badge">{style.label}</span>
                  <p className="insight-card__message">{insight.message}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
