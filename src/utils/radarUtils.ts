/**
 * Aim DNA 레이더 차트 유틸리티
 * AimDnaResult + CrossGameComparison에서 공용
 */
import type { AimDnaProfile, RadarAxis } from './types';

/** Aim DNA 프로파일 → 5축 레이더 데이터 (0~100 정규화) */
export function computeRadarAxes(dna: AimDnaProfile): RadarAxis[] {
  // Flick Power: peakVelocity(0~2000°/s) + effectiveRange(0~180°) 평균
  const velNorm = Math.min((dna.flickPeakVelocity ?? 0) / 2000 * 100, 100);
  const rangeNorm = Math.min((dna.effectiveRange ?? 0) / 180 * 100, 100);
  const flickPower = (velNorm + rangeNorm) / 2;

  // Tracking Precision: MAD 역수(0.3→0, 0→100) + velocityMatch(0~1→0~100)
  const madNorm = Math.max(0, 100 - (dna.trackingMad ?? 0.3) * 333);
  const vmNorm = (dna.velocityMatch ?? 0) * 100;
  const trackingPrecision = (madNorm + vmNorm) / 2;

  // Motor Control: 영역별 정확도 균형 + wristArmRatio 적절성
  const fAcc = (dna.fingerAccuracy ?? 0) * 100;
  const wAcc = (dna.wristAccuracy ?? 0) * 100;
  const aAcc = (dna.armAccuracy ?? 0) * 100;
  const avgAcc = (fAcc + wAcc + aAcc) / 3;
  const balanceBonus = (1 - Math.abs((dna.wristArmRatio ?? 0.5) - 0.5) * 2) * 20;
  const motorControl = Math.min(avgAcc + balanceBonus, 100);

  // Speed: fittsB 역수 (낮을수록 빠름, 50~300 범위 가정)
  const fittsB = dna.fittsB ?? 200;
  const speedNorm = Math.max(0, Math.min(100, (300 - fittsB) / 250 * 100));

  // Consistency: directionBias 역수 + vHRatio→1 근접도 + fatigue 역수
  const biasNorm = (1 - (dna.directionBias ?? 0)) * 100;
  const vhNorm = Math.max(0, 100 - Math.abs((dna.vHRatio ?? 1) - 1) * 100);
  const fatigueNorm = Math.max(0, 100 - Math.abs(dna.fatigueDecay ?? 0) * 200);
  const consistency = (biasNorm + vhNorm + fatigueNorm) / 3;

  return [
    { label: 'Flick Power', key: 'flickPower', value: flickPower },
    { label: 'Tracking', key: 'trackingPrecision', value: trackingPrecision },
    { label: 'Motor Control', key: 'motorControl', value: motorControl },
    { label: 'Speed', key: 'speed', value: speedNorm },
    { label: 'Consistency', key: 'consistency', value: consistency },
  ];
}
