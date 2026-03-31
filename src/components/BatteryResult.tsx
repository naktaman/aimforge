/**
 * 배터리 결과 화면
 * 가중 종합 점수 + 시나리오별 점수 바 차트 + Aim DNA 분석 트리거
 */
import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useBatteryStore } from '../stores/batteryStore';
import { useAimDnaStore } from '../stores/aimDnaStore';
import type { AimDnaProfile, ScenarioType } from '../utils/types';

/** 시나리오 한글 라벨 */
const LABELS: Record<string, string> = {
  flick: 'Flick',
  tracking: 'Tracking',
  circular_tracking: 'Circular Tracking',
  stochastic_tracking: 'Stochastic Tracking',
  counter_strafe_flick: 'Counter-Strafe',
  micro_flick: 'Micro-Flick',
  zoom_composite: 'Zoom Composite',
};

interface Props {
  onBack: () => void;
  onViewDna: () => void;
}

export function BatteryResult({ onBack, onViewDna }: Props) {
  const { batteryResult, scenarioRawMetrics, sessionId } = useBatteryStore();
  const { setCurrentDna } = useAimDnaStore();
  const [computing, setComputing] = useState(false);

  /** Aim DNA 산출 → 결과 화면 이동 */
  const handleComputeDna = useCallback(async () => {
    if (!batteryResult || !sessionId) return;
    setComputing(true);

    try {
      // 시나리오별 raw 메트릭을 JSON 문자열로 변환
      const toJson = (key: ScenarioType) => {
        const data = scenarioRawMetrics[key];
        return data ? JSON.stringify(data) : null;
      };

      const dna = await invoke<AimDnaProfile>('compute_aim_dna_cmd', {
        params: {
          input: {
            profile_id: 1,
            session_id: sessionId,
            flick_metrics: toJson('flick'),
            tracking_metrics: toJson('tracking'),
            circular_metrics: toJson('circular_tracking'),
            stochastic_metrics: toJson('stochastic_tracking'),
            counter_strafe_metrics: toJson('counter_strafe_flick'),
            micro_flick_metrics: toJson('micro_flick'),
            zoom_metrics: toJson('zoom_composite'),
            scenario_scores: {
              flick: batteryResult.scores.flick ?? null,
              tracking: batteryResult.scores.tracking ?? null,
              circular_tracking: batteryResult.scores.circular_tracking ?? null,
              stochastic_tracking: batteryResult.scores.stochastic_tracking ?? null,
              counter_strafe_flick: batteryResult.scores.counter_strafe_flick ?? null,
              micro_flick: batteryResult.scores.micro_flick ?? null,
              zoom_composite: batteryResult.scores.zoom_composite ?? null,
            },
          },
        },
      });

      setCurrentDna(dna);
      onViewDna();
    } catch (e) {
      console.error('Aim DNA 산출 실패:', e);
    } finally {
      setComputing(false);
    }
  }, [batteryResult, scenarioRawMetrics, sessionId, setCurrentDna, onViewDna]);

  if (!batteryResult) return null;

  const maxScore = Math.max(
    ...Object.values(batteryResult.scores).filter((s): s is number => s !== undefined),
    1,
  );

  return (
    <main className="app-main">
      <div className="battery-result">
        <h2>Battery 결과</h2>

        {/* 종합 점수 */}
        <div className="composite-score">
          <span className="score-value">{batteryResult.weightedComposite.toFixed(1)}</span>
          <span className="score-label">종합 점수 ({batteryResult.preset})</span>
        </div>

        {/* 시나리오별 점수 바 */}
        <div className="score-bars">
          {Object.entries(batteryResult.scores).map(([type, score]) => {
            if (score === undefined) return null;
            const weight = batteryResult.weights[type as keyof typeof batteryResult.weights] ?? 0;
            return (
              <div key={type} className="score-bar-row">
                <span className="bar-label">{LABELS[type] ?? type}</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${(score / maxScore) * 100}%` }}
                  />
                </div>
                <span className="bar-score">{score.toFixed(1)}</span>
                <span className="bar-weight">×{weight.toFixed(2)}</span>
              </div>
            );
          })}
        </div>

        {/* 액션 버튼 */}
        <div className="result-actions">
          <button className="btn-secondary" onClick={onBack}>
            돌아가기
          </button>
          <button
            className="btn-primary"
            onClick={handleComputeDna}
            disabled={computing}
          >
            {computing ? '분석 중...' : 'Aim DNA 분석'}
          </button>
        </div>
      </div>
    </main>
  );
}
