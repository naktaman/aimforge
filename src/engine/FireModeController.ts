/**
 * 발사 모드 컨트롤러
 * - 단발 (Semi-Auto): 클릭당 1발
 * - 연발 (Full-Auto): 마우스 홀드 시 RPM 기반 연속 발사
 * - 점사 (Burst): 클릭당 3발 연속
 */

/** 발사 모드 타입 */
export type FireMode = 'semi' | 'auto' | 'burst';

/** 발사 모드 순서 (cycleMode에서 사용) */
const MODE_ORDER: FireMode[] = ['semi', 'auto', 'burst'];

export class FireModeController {
  private mode: FireMode = 'semi';
  private rpm = 600;
  private lastFireTimeMs = 0;
  private mouseDown = false;
  private burstRemaining = 0;
  private burstCount = 3; // 점사 시 연속 발사 수

  /** 발사 간격 (ms) = 60000 / RPM */
  get intervalMs(): number {
    return 60000 / this.rpm;
  }

  /** 현재 발사 모드 */
  getMode(): FireMode {
    return this.mode;
  }

  /** 현재 RPM */
  getRpm(): number {
    return this.rpm;
  }

  /** 발사 모드 설정 */
  setMode(mode: FireMode): void {
    this.mode = mode;
    this.burstRemaining = 0;
    this.mouseDown = false;
  }

  /** RPM 설정 (최소 60, 최대 1200) */
  setRpm(rpm: number): void {
    this.rpm = Math.max(60, Math.min(1200, rpm));
  }

  /** 발사 모드 순환 (semi → auto → burst → semi) */
  cycleMode(): FireMode {
    const idx = MODE_ORDER.indexOf(this.mode);
    this.mode = MODE_ORDER[(idx + 1) % MODE_ORDER.length];
    this.burstRemaining = 0;
    this.mouseDown = false;
    return this.mode;
  }

  /**
   * 마우스 다운 이벤트 처리
   * @returns 즉시 발사해야 하면 true
   */
  onMouseDown(timeMs: number): boolean {
    // 쿨다운 확인
    if (!this.canFire(timeMs)) {
      // auto 모드면 mouseDown 상태만 기록 (다음 프레임에서 발사)
      if (this.mode === 'auto') {
        this.mouseDown = true;
      }
      return false;
    }

    this.lastFireTimeMs = timeMs;

    switch (this.mode) {
      case 'semi':
        // 단발: 1발만 발사
        return true;

      case 'auto':
        // 연발: 첫 발 발사 + mouseDown 상태 기록
        this.mouseDown = true;
        return true;

      case 'burst':
        // 점사: 첫 발 발사 + 나머지 burst 예약
        this.burstRemaining = this.burstCount - 1;
        return true;
    }
  }

  /** 마우스 업 이벤트 — auto 모드 연사 중단 */
  onMouseUp(): void {
    this.mouseDown = false;
  }

  /**
   * 매 프레임 호출 — auto/burst 추가 발사 판정
   * @returns 이번 프레임에 발사할 횟수 (0 이상)
   */
  update(timeMs: number): number {
    let fireCount = 0;

    switch (this.mode) {
      case 'semi':
        // 단발 모드는 update에서 발사하지 않음
        break;

      case 'auto':
        // 연발: mouseDown 상태이면 RPM 간격으로 계속 발사
        if (this.mouseDown) {
          while (this.canFire(timeMs)) {
            this.lastFireTimeMs += this.intervalMs;
            fireCount++;
            // 한 프레임에 최대 3발로 제한 (너무 많은 발사 방지)
            if (fireCount >= 3) break;
          }
        }
        break;

      case 'burst':
        // 점사: 남은 burst 발 수만큼 RPM 간격으로 발사
        while (this.burstRemaining > 0 && this.canFire(timeMs)) {
          this.lastFireTimeMs += this.intervalMs;
          this.burstRemaining--;
          fireCount++;
        }
        break;
    }

    return fireCount;
  }

  /** RPM 쿨다운 확인 */
  private canFire(timeMs: number): boolean {
    return timeMs - this.lastFireTimeMs >= this.intervalMs;
  }

  /** 상태 리셋 (시나리오 전환 등) */
  reset(): void {
    this.lastFireTimeMs = 0;
    this.mouseDown = false;
    this.burstRemaining = 0;
  }
}
