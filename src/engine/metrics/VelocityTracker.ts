/**
 * 크로스헤어 속도/가속도 추적기
 * 매 프레임 카메라 각도를 기록하여 속도·가속도 계산
 * 클릭 타이밍 분류의 핵심 입력
 */
import { RAD2DEG } from '../../utils/physics';

interface RotationSample {
  time: number;  // ms
  yaw: number;   // 라디안
  pitch: number; // 라디안
}

/** 속도 계산에 사용할 최근 프레임 수 */
const HISTORY_SIZE = 5;

export class VelocityTracker {
  private history: RotationSample[] = [];
  private lastDirectionChangeTime = 0;
  private lastMoveSign = 0; // -1, 0, 1

  /** 매 프레임 카메라 회전 기록 */
  record(timeMs: number, yaw: number, pitch: number): void {
    this.history.push({ time: timeMs, yaw, pitch });
    if (this.history.length > HISTORY_SIZE) {
      this.history.shift();
    }

    // 방향 전환 감지 (수평 기준)
    if (this.history.length >= 2) {
      const prev = this.history[this.history.length - 2];
      const curr = this.history[this.history.length - 1];
      const delta = curr.yaw - prev.yaw;
      const sign = Math.sign(delta);
      if (sign !== 0 && sign !== this.lastMoveSign) {
        this.lastDirectionChangeTime = timeMs;
        this.lastMoveSign = sign;
      }
    }
  }

  /** 현재 속도 (°/s) — 최근 N 프레임의 이동 평균 */
  getVelocity(): number {
    if (this.history.length < 2) return 0;
    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const dt = (last.time - first.time) / 1000; // 초 변환
    if (dt <= 0) return 0;

    const dYaw = (last.yaw - first.yaw) * RAD2DEG;
    const dPitch = (last.pitch - first.pitch) * RAD2DEG;
    const totalDeg = Math.sqrt(dYaw * dYaw + dPitch * dPitch);
    return totalDeg / dt;
  }

  /** 현재 가속도 (°/s²) */
  getAcceleration(): number {
    if (this.history.length < 3) return 0;
    const mid = Math.floor(this.history.length / 2);
    const first = this.history[0];
    const middle = this.history[mid];
    const last = this.history[this.history.length - 1];

    const dt1 = (middle.time - first.time) / 1000;
    const dt2 = (last.time - middle.time) / 1000;
    if (dt1 <= 0 || dt2 <= 0) return 0;

    const v1 = this.calcSpeed(first, middle, dt1);
    const v2 = this.calcSpeed(middle, last, dt2);
    const totalDt = (last.time - first.time) / 1000;
    return (v2 - v1) / totalDt;
  }

  /** 감속 중인지 여부 */
  isDecelerating(): boolean {
    return this.getAcceleration() < -10; // 충분한 음의 가속도
  }

  /** 마지막 방향 전환 이후 경과 시간 (ms) */
  timeSinceDirectionChange(currentTimeMs: number): number {
    return currentTimeMs - this.lastDirectionChangeTime;
  }

  /** 초기화 */
  reset(): void {
    this.history = [];
    this.lastDirectionChangeTime = 0;
    this.lastMoveSign = 0;
  }

  private calcSpeed(a: RotationSample, b: RotationSample, dt: number): number {
    const dYaw = (b.yaw - a.yaw) * RAD2DEG;
    const dPitch = (b.pitch - a.pitch) * RAD2DEG;
    return Math.sqrt(dYaw * dYaw + dPitch * dPitch) / dt;
  }
}
