/**
 * 메트릭 수집기
 * 매 프레임 궤적 기록 + 클릭 이벤트 수집
 * 시나리오 종료 시 JSON으로 직렬화하여 DB 저장
 */
import type {
  ClickType,
  MotorRegion,
  Direction,
  FlickTrialMetrics,
  TrackingTrialMetrics,
  TrajectoryType,
  ZoomCorrectionResult,
  ZoomReacquisitionResult,
} from '../../utils/types';

/** 프레임별 궤적 데이터 */
interface TrajectoryPoint {
  timestamp_us: number;
  camera_yaw: number;
  camera_pitch: number;
  dx_cm: number;
  dy_cm: number;
}

/** 클릭 이벤트 데이터 */
interface ClickEvent {
  timestamp_us: number;
  crosshair_velocity: number;
  crosshair_acceleration: number;
  is_decelerating: boolean;
  angular_error: number;
  hit: boolean;
  time_since_direction_change: number;
  click_type: ClickType;
}

/** Flick 단일 타겟 결과 */
export interface FlickTargetResult {
  ttt: number;           // Time To Target (ms)
  overshoot: number;     // 오버슛 각도 (라디안)
  correctionCount: number;
  settleTime: number;    // 안정화 시간 (ms)
  pathEfficiency: number; // 경로 효율 (0~1)
  hit: boolean;
  angleBucket: number;
  direction: Direction;
  motorRegion: MotorRegion;
  clickType: ClickType;
  angularError: number;
}

/** Tracking 프레임별 오차 */
interface TrackingFrame {
  timestamp: number;
  angularError: number;
  cameraVelocity: number;
  targetVelocity: number;
}

export class MetricsCollector {
  // 궤적 데이터
  private trajectory: TrajectoryPoint[] = [];
  // 클릭 이벤트
  private clicks: ClickEvent[] = [];
  // Flick 타겟별 결과
  private flickResults: FlickTargetResult[] = [];
  // Tracking 프레임별 데이터
  private trackingFrames: TrackingFrame[] = [];
  // Zoom 전환 결과 (Phase B/C)
  private zoomCorrectionResults: ZoomCorrectionResult[] = [];
  private zoomReacquisitionResults: ZoomReacquisitionResult[] = [];
  // MicroFlick 재획득 시간 (ms)
  private reacquireTimes: number[] = [];

  /** 매 프레임 궤적 기록 */
  recordFrame(data: TrajectoryPoint): void {
    this.trajectory.push(data);
  }

  /** 클릭 이벤트 기록 */
  recordClick(data: ClickEvent): void {
    this.clicks.push(data);
  }

  /** Flick 타겟 결과 추가 */
  addFlickResult(result: FlickTargetResult): void {
    this.flickResults.push(result);
  }

  /** Tracking 프레임 오차 기록 */
  recordTrackingFrame(data: TrackingFrame): void {
    this.trackingFrames.push(data);
  }

  /** Zoom 보정 결과 기록 (Phase B) */
  recordZoomCorrection(result: ZoomCorrectionResult): void {
    this.zoomCorrectionResults.push(result);
  }

  /** Zoom 재획득 결과 기록 (Phase C) */
  recordZoomReacquisition(result: ZoomReacquisitionResult): void {
    this.zoomReacquisitionResults.push(result);
  }

  /** MicroFlick 재획득 시간 기록 */
  recordReacquireTime(timeMs: number): void {
    this.reacquireTimes.push(timeMs);
  }

  /** Flick 시나리오 종합 메트릭 — 각도/방향/운동체계별 브레이크다운 */
  computeFlickMetrics(): {
    overall: FlickTrialMetrics;
    byAngle: Map<number, FlickTrialMetrics>;
    byDirection: Map<Direction, FlickTrialMetrics>;
    byMotor: Map<MotorRegion, FlickTrialMetrics>;
  } {
    const all = this.flickResults;

    const overall = this.aggregateFlick(all);

    // 각도 구간별 집계
    const byAngle = new Map<number, FlickTrialMetrics>();
    const angleGroups = this.groupBy(all, (r) => r.angleBucket);
    for (const [bucket, results] of angleGroups) {
      byAngle.set(bucket, this.aggregateFlick(results));
    }

    // 방향별 집계
    const byDirection = new Map<Direction, FlickTrialMetrics>();
    const dirGroups = this.groupBy(all, (r) => r.direction);
    for (const [dir, results] of dirGroups) {
      byDirection.set(dir, this.aggregateFlick(results));
    }

    // 운동체계별 집계
    const byMotor = new Map<MotorRegion, FlickTrialMetrics>();
    const motorGroups = this.groupBy(all, (r) => r.motorRegion);
    for (const [motor, results] of motorGroups) {
      byMotor.set(motor, this.aggregateFlick(results));
    }

    return { overall, byAngle, byDirection, byMotor };
  }

  /** Tracking 시나리오 종합 메트릭 */
  computeTrackingMetrics(
    trajectoryType: TrajectoryType,
  ): TrackingTrialMetrics {
    const frames = this.trackingFrames;
    if (frames.length === 0) {
      return {
        mad: 0,
        deviationVariance: 0,
        phaseLag: 0,
        velocityMatchRatio: 0,
        trajectoryType,
      };
    }

    // MAD (Mean Angular Deviation)
    const errors = frames.map((f) => f.angularError);
    const mad = errors.reduce((a, b) => a + b, 0) / errors.length;

    // deviation_variance
    const meanErr = mad;
    const deviationVariance =
      errors.reduce((sum, e) => sum + (e - meanErr) ** 2, 0) / errors.length;

    // velocity_match_ratio
    let velocityMatchSum = 0;
    let velocityCount = 0;
    for (const f of frames) {
      if (f.targetVelocity > 0) {
        const ratio =
          Math.min(f.cameraVelocity, f.targetVelocity) /
          Math.max(f.cameraVelocity, f.targetVelocity);
        velocityMatchSum += ratio;
        velocityCount++;
      }
    }
    const velocityMatchRatio =
      velocityCount > 0 ? velocityMatchSum / velocityCount : 0;

    // phase_lag (간이 계산: 카메라 속도 vs 타겟 속도 상관 시차)
    const phaseLag = this.estimatePhaseLag(frames);

    return {
      mad,
      deviationVariance,
      phaseLag,
      velocityMatchRatio,
      trajectoryType,
    };
  }

  /** Zoom 보정 메트릭 계산 (Phase B 집계) */
  computeZoomCorrectionMetrics(): {
    avgCorrectionTime: number;
    overCorrectionRatio: number;
    underCorrectionRatio: number;
    hitRate: number;
    avgSettledError: number;
  } {
    const results = this.zoomCorrectionResults;
    if (results.length === 0) {
      return {
        avgCorrectionTime: 0,
        overCorrectionRatio: 0,
        underCorrectionRatio: 0,
        hitRate: 0,
        avgSettledError: 0,
      };
    }
    const n = results.length;
    return {
      avgCorrectionTime: results.reduce((s, r) => s + r.correctionTime, 0) / n,
      overCorrectionRatio: results.filter((r) => r.overCorrected).length / n,
      underCorrectionRatio: results.filter((r) => r.underCorrected).length / n,
      hitRate: results.filter((r) => r.hit).length / n,
      avgSettledError: results.reduce((s, r) => s + r.settledError, 0) / n,
    };
  }

  /** Zoom 재획득 메트릭 계산 (Phase C 집계) */
  computeZoomReacquisitionMetrics(): {
    avgReacquisitionTime: number;
    reacquisitionRate: number;
  } {
    const results = this.zoomReacquisitionResults;
    if (results.length === 0) {
      return { avgReacquisitionTime: 0, reacquisitionRate: 0 };
    }
    const n = results.length;
    return {
      avgReacquisitionTime:
        results.reduce((s, r) => s + r.reacquisitionTime, 0) / n,
      reacquisitionRate: results.filter((r) => r.reacquired).length / n,
    };
  }

  /** MicroFlick 하이브리드 메트릭 계산 */
  computeHybridMetrics(
    trajectoryType: TrajectoryType,
  ): {
    tracking: TrackingTrialMetrics;
    flick: { hitRate: number; avgTtt: number; avgOvershoot: number; preFireRatio: number };
    avgReacquireTimeMs: number;
  } {
    const tracking = this.computeTrackingMetrics(trajectoryType);

    const flickResults = this.flickResults;
    const hitRate =
      flickResults.length > 0
        ? flickResults.filter((r) => r.hit).length / flickResults.length
        : 0;
    const avgTtt =
      flickResults.length > 0
        ? flickResults.reduce((s, r) => s + r.ttt, 0) / flickResults.length
        : 0;
    const avgOvershoot =
      flickResults.length > 0
        ? flickResults.reduce((s, r) => s + r.overshoot, 0) / flickResults.length
        : 0;
    const preFireRatio =
      flickResults.length > 0
        ? flickResults.filter((r) => r.clickType === 'PreFire').length / flickResults.length
        : 0;

    const avgReacquireTimeMs =
      this.reacquireTimes.length > 0
        ? this.reacquireTimes.reduce((s, t) => s + t, 0) / this.reacquireTimes.length
        : 0;

    return {
      tracking,
      flick: { hitRate, avgTtt, avgOvershoot, preFireRatio },
      avgReacquireTimeMs,
    };
  }

  /** JSON 직렬화 (DB 저장용) */
  toTrialJson(): {
    trajectory: TrajectoryPoint[];
    clicks: ClickEvent[];
    flickResults: FlickTargetResult[];
    trackingFrames: TrackingFrame[];
  } {
    return {
      trajectory: this.trajectory,
      clicks: this.clicks,
      flickResults: this.flickResults,
      trackingFrames: this.trackingFrames,
    };
  }

  /** 초기화 */
  reset(): void {
    this.trajectory = [];
    this.clicks = [];
    this.flickResults = [];
    this.trackingFrames = [];
    this.zoomCorrectionResults = [];
    this.zoomReacquisitionResults = [];
    this.reacquireTimes = [];
  }

  // === 내부 유틸 ===

  private aggregateFlick(results: FlickTargetResult[]): FlickTrialMetrics {
    if (results.length === 0) {
      return {
        ttt: 0, overshoot: 0, correctionCount: 0, settleTime: 0,
        pathEfficiency: 0, hit: false, angleBucket: 0,
        direction: 'right', motorRegion: 'wrist', clickType: 'Flick',
      };
    }

    const hitCount = results.filter((r) => r.hit).length;
    return {
      ttt: results.reduce((s, r) => s + r.ttt, 0) / results.length,
      overshoot: results.reduce((s, r) => s + r.overshoot, 0) / results.length,
      correctionCount: results.reduce((s, r) => s + r.correctionCount, 0) / results.length,
      settleTime: results.reduce((s, r) => s + r.settleTime, 0) / results.length,
      pathEfficiency: results.reduce((s, r) => s + r.pathEfficiency, 0) / results.length,
      hit: hitCount / results.length > 0.5,
      angleBucket: results[0].angleBucket,
      direction: results[0].direction,
      motorRegion: results[0].motorRegion,
      clickType: results[0].clickType,
    };
  }

  /** phase lag 간이 추정 — 시간 차이 기반 */
  private estimatePhaseLag(frames: TrackingFrame[]): number {
    // 간이: 카메라 속도 피크와 타겟 속도 피크 사이의 평균 시간 차이
    if (frames.length < 10) return 0;

    let lagSum = 0;
    let lagCount = 0;
    const window = 5;

    for (let i = window; i < frames.length - window; i++) {
      // 타겟 속도 피크 감지
      if (
        frames[i].targetVelocity > frames[i - 1].targetVelocity &&
        frames[i].targetVelocity > frames[i + 1].targetVelocity
      ) {
        // 근처에서 카메라 속도 피크 찾기
        let bestJ = i;
        let bestVel = 0;
        for (let j = i; j < Math.min(i + window * 2, frames.length); j++) {
          if (frames[j].cameraVelocity > bestVel) {
            bestVel = frames[j].cameraVelocity;
            bestJ = j;
          }
        }
        lagSum += frames[bestJ].timestamp - frames[i].timestamp;
        lagCount++;
      }
    }

    return lagCount > 0 ? lagSum / lagCount : 0;
  }

  private groupBy<T, K>(arr: T[], key: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of arr) {
      const k = key(item);
      const group = map.get(k);
      if (group) {
        group.push(item);
      } else {
        map.set(k, [item]);
      }
    }
    return map;
  }
}
