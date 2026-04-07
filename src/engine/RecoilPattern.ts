/**
 * 반동 패턴 시스템
 * - CS2 스타일: 고정 2D 패턴 배열, 발사마다 순차 적용
 * - Valorant 스타일: 첫 n발 고정 → 이후 랜덤 확산 (하이브리드)
 * - ViewPunch (시각적 흔들림) vs AimPunch (실제 조준점 이동) 분리
 * - 반동 보정 훈련용 분석 유틸리티
 */

/** 반동 패턴 유형 */
export type RecoilStyle = 'cs2' | 'valorant';

/**
 * 2D 반동 포인트 — [dx, dy] 도 단위
 * dx: 수평 (양수=우, 음수=좌), dy: 수직 (음수=위)
 */
export type RecoilPoint = [number, number];

/** ViewPunch + AimPunch 분리된 반동 결과 */
export interface RecoilOutput {
  /** AimPunch — 실제 조준점(카메라) 이동량 (도) */
  aimPunch: { dx: number; dy: number };
  /** ViewPunch — 시각적 흔들림 (도, 자동 복귀) */
  viewPunch: { dx: number; dy: number };
  /** 현재 발사 인덱스 */
  shotIndex: number;
}

/** 반동 보정 분석 결과 */
export interface RecoilCompensationResult {
  /** 이상적 보정 벡터 vs 실제 입력 차이 (도) */
  errorPerShot: Array<{ dx: number; dy: number }>;
  /** 평균 오차 (도) */
  meanError: number;
  /** 보정 정확도 (0~1, 1 = 완벽) */
  accuracy: number;
  /** 과보정 비율 (0~1) */
  overCompensationRate: number;
  /** 미보정 비율 (0~1) */
  underCompensationRate: number;
}

/**
 * 반동 패턴 설정 인터페이스
 */
export interface RecoilPatternConfig {
  /** 패턴 스타일 */
  style: RecoilStyle;
  /** 고정 패턴 포인트 배열 (CS2: 전체, Valorant: 초반 n발) */
  pattern: RecoilPoint[];
  /** ViewPunch 비율 (0~1, AimPunch 대비 시각 흔들림 비율) */
  viewPunchRatio: number;
  /** 랜덤 분산 계수 (0~1, 패턴에 더해지는 노이즈) */
  randomSpread: number;
  /** Valorant 전용: 고정 패턴 발수 (이후 랜덤 확산) */
  fixedShotCount?: number;
  /** Valorant 전용: 랜덤 확산 영역 크기 (도) */
  spreadRadius?: number;
  /** 반동 리셋 시간 (ms, 마지막 발사 후 초기화까지) */
  resetMs: number;
  /** 복귀 속도 (초당 비율, 0이면 복귀 없음) */
  recoveryRate: number;
}

/**
 * 반동 패턴 프로세서
 * 발사마다 호출하여 AimPunch + ViewPunch를 분리 반환
 */
export class RecoilPatternProcessor {
  private config: RecoilPatternConfig;
  private shotIndex = 0;
  private lastShotTimeMs = 0;
  /** 누적 AimPunch (보정 분석용) */
  private accumulatedAim = { dx: 0, dy: 0 };
  /** 현재 ViewPunch (프레임별 감쇠) */
  private currentViewPunch = { dx: 0, dy: 0 };
  /** 보정 훈련: 실제 사용자 보정 입력 기록 */
  private compensationInputs: Array<{ dx: number; dy: number }> = [];

  constructor(config: RecoilPatternConfig) {
    this.config = { ...config };
  }

  /** 설정 변경 */
  setConfig(config: RecoilPatternConfig): void {
    this.config = { ...config };
    this.reset();
  }

  /**
   * 발사 시 호출 — AimPunch + ViewPunch 반환
   * @param timeMs 현재 시각 (ms)
   */
  fire(timeMs: number): RecoilOutput {
    // 리셋 타이머 확인
    if (this.shotIndex > 0 && timeMs - this.lastShotTimeMs > this.config.resetMs) {
      this.reset();
    }
    this.lastShotTimeMs = timeMs;

    // 패턴 포인트 계산
    const raw = this.getRawRecoil();

    // 랜덤 분산 추가
    const spread = this.config.randomSpread;
    const dx = raw[0] * (1 + (Math.random() - 0.5) * spread);
    const dy = raw[1] * (1 + (Math.random() - 0.5) * spread);

    // ViewPunch / AimPunch 분리
    const vpRatio = this.config.viewPunchRatio;
    const aimPunch = {
      dx: dx * (1 - vpRatio),
      dy: dy * (1 - vpRatio),
    };
    const viewPunch = {
      dx: dx * vpRatio,
      dy: dy * vpRatio,
    };

    // 누적
    this.accumulatedAim.dx += aimPunch.dx;
    this.accumulatedAim.dy += aimPunch.dy;
    this.currentViewPunch.dx += viewPunch.dx;
    this.currentViewPunch.dy += viewPunch.dy;

    const result: RecoilOutput = {
      aimPunch,
      viewPunch,
      shotIndex: this.shotIndex,
    };

    this.shotIndex++;
    return result;
  }

  /**
   * 매 프레임 ViewPunch 감쇠 업데이트
   * @returns 이번 프레임에 적용할 ViewPunch 복귀량 (도)
   */
  updateViewPunch(deltaTime: number): { dx: number; dy: number } {
    // ViewPunch는 빠르게 자동 복귀 (AimPunch보다 8배 빠른 감쇠)
    const decayRate = 8.0;
    const factor = 1 - Math.min(decayRate * deltaTime, 1);

    const recoveryDx = this.currentViewPunch.dx * (1 - factor);
    const recoveryDy = this.currentViewPunch.dy * (1 - factor);

    this.currentViewPunch.dx *= factor;
    this.currentViewPunch.dy *= factor;

    return { dx: recoveryDx, dy: recoveryDy };
  }

  /**
   * 매 프레임 AimPunch 자연 복귀
   * @returns 이번 프레임에 복귀할 양 (도)
   */
  updateAimRecovery(deltaTime: number): { dx: number; dy: number } {
    if (this.config.recoveryRate <= 0) return { dx: 0, dy: 0 };
    // 마지막 발사 후 복귀 시작
    const magnitude = Math.sqrt(
      this.accumulatedAim.dx ** 2 + this.accumulatedAim.dy ** 2,
    );
    if (magnitude < 0.001) return { dx: 0, dy: 0 };

    const recoveryAmount = magnitude * this.config.recoveryRate * deltaTime;
    const ratio = Math.min(recoveryAmount / magnitude, 1);

    const dx = this.accumulatedAim.dx * ratio;
    const dy = this.accumulatedAim.dy * ratio;

    this.accumulatedAim.dx -= dx;
    this.accumulatedAim.dy -= dy;

    return { dx, dy };
  }

  /** 상태 초기화 */
  reset(): void {
    this.shotIndex = 0;
    this.accumulatedAim = { dx: 0, dy: 0 };
    this.currentViewPunch = { dx: 0, dy: 0 };
    this.compensationInputs = [];
  }

  /** 현재 발사 인덱스 */
  getShotIndex(): number {
    return this.shotIndex;
  }

  /** 누적 AimPunch (현재까지의 총 이동량) */
  getAccumulatedAim(): { dx: number; dy: number } {
    return { ...this.accumulatedAim };
  }

  /** 현재 ViewPunch 값 */
  getCurrentViewPunch(): { dx: number; dy: number } {
    return { ...this.currentViewPunch };
  }

  // === 반동 보정 훈련 API ===

  /**
   * 사용자의 마우스 보정 입력을 기록 (반동 보정 훈련용)
   * @param dx 수평 보정 입력 (도)
   * @param dy 수직 보정 입력 (도)
   */
  recordCompensation(dx: number, dy: number): void {
    this.compensationInputs.push({ dx, dy });
  }

  /**
   * 반동 보정 분석 — 이상적 보정 vs 실제 입력 비교
   * 이상적 보정 = 패턴의 반대 방향 (-dx, -dy)
   */
  analyzeCompensation(): RecoilCompensationResult {
    const pattern = this.config.pattern;
    const inputs = this.compensationInputs;
    const count = Math.min(pattern.length, inputs.length);

    if (count === 0) {
      return {
        errorPerShot: [],
        meanError: 0,
        accuracy: 0,
        overCompensationRate: 0,
        underCompensationRate: 0,
      };
    }

    const errors: Array<{ dx: number; dy: number }> = [];
    let totalError = 0;
    let overCount = 0;
    let underCount = 0;

    for (let i = 0; i < count; i++) {
      // 이상적 보정 = 패턴의 반대 방향
      const idealDx = -pattern[i][0];
      const idealDy = -pattern[i][1];
      const actualDx = inputs[i].dx;
      const actualDy = inputs[i].dy;

      const errDx = actualDx - idealDx;
      const errDy = actualDy - idealDy;
      errors.push({ dx: errDx, dy: errDy });

      const errMag = Math.sqrt(errDx ** 2 + errDy ** 2);
      totalError += errMag;

      // 보정량 비교 (수직 기준)
      const idealMag = Math.sqrt(idealDx ** 2 + idealDy ** 2);
      const actualMag = Math.sqrt(actualDx ** 2 + actualDy ** 2);
      if (idealMag > 0.01) {
        if (actualMag > idealMag * 1.1) overCount++;
        else if (actualMag < idealMag * 0.9) underCount++;
      }
    }

    const meanError = totalError / count;
    // 패턴 평균 크기 기준 정확도 계산
    const avgPatternMag = pattern.slice(0, count).reduce(
      (sum, p) => sum + Math.sqrt(p[0] ** 2 + p[1] ** 2), 0,
    ) / count;
    const accuracy = avgPatternMag > 0.01
      ? Math.max(0, 1 - meanError / avgPatternMag)
      : 0;

    return {
      errorPerShot: errors,
      meanError,
      accuracy,
      overCompensationRate: overCount / count,
      underCompensationRate: underCount / count,
    };
  }

  /**
   * 현재 발사 인덱스에 대한 이상적 보정 벡터 반환
   * 반동 보정 연습 가이드용
   */
  getIdealCompensation(shotIndex: number): { dx: number; dy: number } {
    const pattern = this.config.pattern;
    if (pattern.length === 0) return { dx: 0, dy: 0 };
    const idx = shotIndex % pattern.length;
    return { dx: -pattern[idx][0], dy: -pattern[idx][1] };
  }

  // === 내부 패턴 계산 ===

  /**
   * 현재 shotIndex에 해당하는 원시 반동 포인트
   * CS2: 패턴 순환, Valorant: 첫 n발 고정 → 이후 랜덤
   */
  private getRawRecoil(): RecoilPoint {
    const { style, pattern, fixedShotCount, spreadRadius } = this.config;

    if (pattern.length === 0) return [0, 0];

    if (style === 'valorant') {
      return this.getValorantRecoil(pattern, fixedShotCount, spreadRadius);
    }

    // CS2 스타일: 고정 패턴 순환
    const idx = this.shotIndex % pattern.length;
    return pattern[idx];
  }

  /**
   * Valorant 하이브리드: 첫 fixedShotCount발은 고정 패턴,
   * 이후는 마지막 패턴 포인트 기반 랜덤 확산
   */
  private getValorantRecoil(
    pattern: RecoilPoint[],
    fixedCount?: number,
    radius?: number,
  ): RecoilPoint {
    const fixed = fixedCount ?? Math.min(pattern.length, 7);
    const spread = radius ?? 1.5;

    if (this.shotIndex < fixed && this.shotIndex < pattern.length) {
      // 고정 패턴 구간
      return pattern[this.shotIndex];
    }

    // 랜덤 확산 구간 — 마지막 고정 패턴 방향 기반
    const lastIdx = Math.min(fixed - 1, pattern.length - 1);
    const baseDx = pattern[lastIdx][0];
    const baseDy = pattern[lastIdx][1];

    // 원형 랜덤 분포
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    const dx = baseDx * 0.3 + Math.cos(angle) * r;
    const dy = baseDy * 0.5 + Math.sin(angle) * r * 0.6; // 수직 약화

    return [dx, dy];
  }
}

// === 프리셋 패턴 정의 ===

/** CS2 AK-47 스타일 30발 고정 반동 패턴 */
export const CS2_AK47_PATTERN: RecoilPoint[] = [
  [0, -0.8], [0.1, -1.0], [-0.1, -1.2], [0.2, -1.0], [-0.2, -0.8],
  [0.3, -0.6], [-0.3, -0.9], [0.1, -1.1], [-0.1, -0.7], [0.2, -0.5],
  [-0.2, -0.8], [0.3, -1.0], [-0.3, -0.6], [0.1, -0.4], [-0.1, -0.7],
  [0.4, -0.5], [-0.4, -0.3], [0.5, -0.4], [-0.5, -0.6], [0.3, -0.3],
  [-0.3, -0.5], [0.2, -0.4], [-0.2, -0.3], [0.1, -0.5], [0, -0.4],
  [-0.1, -0.6], [0.2, -0.3], [-0.1, -0.5], [0.1, -0.4], [0, -0.3],
];

/** Valorant Vandal 스타일 — 첫 7발 고정, 이후 확산 */
export const VALORANT_VANDAL_PATTERN: RecoilPoint[] = [
  [0, -0.6], [0.05, -0.9], [-0.05, -1.1], [0.1, -0.8],
  [-0.1, -0.7], [0.15, -0.6], [-0.15, -0.5],
];

/** SMG 경량 패턴 (10발 순환) */
export const SMG_PATTERN: RecoilPoint[] = [
  [0, -0.3], [0.08, -0.4], [-0.08, -0.3], [0.05, -0.35], [-0.05, -0.3],
  [0.1, -0.25], [-0.1, -0.3], [0.05, -0.35], [-0.05, -0.25], [0, -0.3],
];

/** 프리셋 패턴 설정 */
export const RECOIL_PATTERN_PRESETS: Record<string, RecoilPatternConfig> = {
  /** CS2 AK-47 — 고정 30발 패턴, 느린 복귀 */
  cs2_ak47: {
    style: 'cs2',
    pattern: CS2_AK47_PATTERN,
    viewPunchRatio: 0.3,
    randomSpread: 0.15,
    resetMs: 400,
    recoveryRate: 0.5,
  },
  /** Valorant Vandal — 7발 고정 후 확산, 빠른 복귀 */
  valorant_vandal: {
    style: 'valorant',
    pattern: VALORANT_VANDAL_PATTERN,
    viewPunchRatio: 0.4,
    randomSpread: 0.2,
    fixedShotCount: 7,
    spreadRadius: 1.5,
    resetMs: 350,
    recoveryRate: 0.8,
  },
  /** SMG — 작은 고정 패턴, 빠른 복귀 */
  smg_light: {
    style: 'cs2',
    pattern: SMG_PATTERN,
    viewPunchRatio: 0.2,
    randomSpread: 0.25,
    resetMs: 250,
    recoveryRate: 1.0,
  },
  /** 없음 — 반동 비활성화 */
  none: {
    style: 'cs2',
    pattern: [],
    viewPunchRatio: 0,
    randomSpread: 0,
    resetMs: 500,
    recoveryRate: 0,
  },
};
