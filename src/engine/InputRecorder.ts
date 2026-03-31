/**
 * InputRecorder — 마우스 입력 타임시리즈 로깅
 * 프레임별 마우스 좌표, velocity, acceleration, click timing, target offset 기록
 * DNA 분석 및 리플레이를 위한 구조화된 데이터 수집
 */

/** 단일 프레임 입력 기록 */
export interface InputFrame {
  /** 타임스탬프 (ms, 세션 시작 기준) */
  t: number;
  /** 마우스 delta X (raw counts) */
  dx: number;
  /** 마우스 delta Y (raw counts) */
  dy: number;
  /** 누적 yaw (라디안) */
  yaw: number;
  /** 누적 pitch (라디안) */
  pitch: number;
  /** 각속도 X (도/초) */
  velX: number;
  /** 각속도 Y (도/초) */
  velY: number;
  /** 각가속도 크기 (도/초²) */
  accel: number;
  /** 타겟까지 각도 오차 (도, 없으면 null) */
  targetOffsetDeg: number | null;
  /** 클릭 이벤트 ('left' | 'right' | null) */
  click: 'left' | 'right' | null;
}

/** 클릭 이벤트 기록 */
export interface ClickEvent {
  /** 타임스탬프 (ms) */
  t: number;
  /** 클릭 시점 타겟 오프셋 (도) */
  targetOffsetDeg: number;
  /** 히트 여부 */
  hit: boolean;
  /** 클릭 시점 velocity (도/초) */
  velocity: number;
  /** 타겟 출현 후 경과 시간 (ms) */
  reactionMs: number;
}

/** 세션 통계 요약 */
export interface InputSessionStats {
  /** 총 프레임 수 */
  totalFrames: number;
  /** 평균 속도 (도/초) */
  avgVelocity: number;
  /** 최대 속도 (도/초) */
  maxVelocity: number;
  /** 속도 표준편차 (도/초) */
  velocityStdDev: number;
  /** 평균 가속도 (도/초²) */
  avgAcceleration: number;
  /** 총 클릭 수 */
  totalClicks: number;
  /** 히트 클릭 수 */
  hitClicks: number;
  /** 평균 클릭 속도 (발사 시 마우스가 얼마나 빠르게 움직이는가) */
  avgClickVelocity: number;
  /** 기록 시간 (ms) */
  durationMs: number;
}

export class InputRecorder {
  private frames: InputFrame[] = [];
  private clicks: ClickEvent[] = [];
  private startTime = 0;
  private isRecording = false;

  // 이전 프레임 데이터 (velocity/acceleration 계산용)
  private prevVelX = 0;
  private prevVelY = 0;
  private prevTime = 0;
  // 누적 yaw/pitch — getFrames에서 접근 가능
  cumulativeYaw = 0;
  cumulativePitch = 0;

  // 타겟 출현 시각 (reaction time 계산용)
  private targetAppearTime = 0;

  /** 기록 시작 */
  start(): void {
    this.frames = [];
    this.clicks = [];
    this.startTime = performance.now();
    this.prevTime = this.startTime;
    this.prevVelX = 0;
    this.prevVelY = 0;
    this.cumulativeYaw = 0;
    this.cumulativePitch = 0;
    this.targetAppearTime = this.startTime;
    this.isRecording = true;
  }

  /** 기록 종료 */
  stop(): void {
    this.isRecording = false;
  }

  /** 타겟 출현 시각 기록 (reaction time 계산용) */
  markTargetAppear(): void {
    this.targetAppearTime = performance.now();
  }

  /** 프레임 기록 — 매 프레임 GameEngine에서 호출 */
  recordFrame(
    dx: number,
    dy: number,
    yaw: number,
    pitch: number,
    targetOffsetDeg: number | null,
    click: 'left' | 'right' | null,
  ): void {
    if (!this.isRecording) return;

    const now = performance.now();
    const t = now - this.startTime;
    const dt = (now - this.prevTime) / 1000; // 초 단위

    this.cumulativeYaw = yaw;
    this.cumulativePitch = pitch;

    // 각속도 계산 (도/초)
    const velX = dt > 0 ? (dx / dt) : 0;
    const velY = dt > 0 ? (dy / dt) : 0;

    // 각가속도 계산 (도/초²)
    const accelX = dt > 0 ? (velX - this.prevVelX) / dt : 0;
    const accelY = dt > 0 ? (velY - this.prevVelY) / dt : 0;
    const accel = Math.sqrt(accelX * accelX + accelY * accelY);

    this.frames.push({
      t, dx, dy, yaw, pitch,
      velX, velY, accel,
      targetOffsetDeg,
      click,
    });

    // 클릭 이벤트 상세 기록
    if (click === 'left') {
      this.clicks.push({
        t,
        targetOffsetDeg: targetOffsetDeg ?? 999,
        hit: targetOffsetDeg !== null && targetOffsetDeg < 5, // 5도 이내 = 히트 근사
        velocity: Math.sqrt(velX * velX + velY * velY),
        reactionMs: now - this.targetAppearTime,
      });
    }

    this.prevVelX = velX;
    this.prevVelY = velY;
    this.prevTime = now;
  }

  /** 프레임 데이터 반환 */
  getFrames(): InputFrame[] {
    return this.frames;
  }

  /** 클릭 이벤트 반환 */
  getClicks(): ClickEvent[] {
    return this.clicks;
  }

  /** 세션 통계 계산 */
  getStats(): InputSessionStats {
    if (this.frames.length === 0) {
      return {
        totalFrames: 0, avgVelocity: 0, maxVelocity: 0,
        velocityStdDev: 0, avgAcceleration: 0,
        totalClicks: 0, hitClicks: 0, avgClickVelocity: 0, durationMs: 0,
      };
    }

    const velocities = this.frames.map((f) => Math.sqrt(f.velX ** 2 + f.velY ** 2));
    const avgVel = velocities.reduce((s, v) => s + v, 0) / velocities.length;
    const maxVel = Math.max(...velocities);
    const velVariance = velocities.reduce((s, v) => s + (v - avgVel) ** 2, 0) / velocities.length;

    const avgAccel = this.frames.reduce((s, f) => s + f.accel, 0) / this.frames.length;

    const hitClicks = this.clicks.filter((c) => c.hit).length;
    const avgClickVel = this.clicks.length > 0
      ? this.clicks.reduce((s, c) => s + c.velocity, 0) / this.clicks.length
      : 0;

    return {
      totalFrames: this.frames.length,
      avgVelocity: avgVel,
      maxVelocity: maxVel,
      velocityStdDev: Math.sqrt(velVariance),
      avgAcceleration: avgAccel,
      totalClicks: this.clicks.length,
      hitClicks,
      avgClickVelocity: avgClickVel,
      durationMs: this.frames[this.frames.length - 1].t,
    };
  }

  /** JSON 직렬화 (DB 저장용) */
  toJSON(): string {
    return JSON.stringify({
      frames: this.frames,
      clicks: this.clicks,
      stats: this.getStats(),
    });
  }

  /** 기록 상태 확인 */
  getIsRecording(): boolean {
    return this.isRecording;
  }
}
