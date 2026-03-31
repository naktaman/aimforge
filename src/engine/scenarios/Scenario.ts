/**
 * 시나리오 추상 기본 클래스
 * 모든 시나리오(Flick, Tracking 등)는 이 클래스를 상속
 */
import type { GameEngine } from '../GameEngine';
import type { TargetManager } from '../TargetManager';

export abstract class Scenario {
  protected engine: GameEngine;
  protected targetManager: TargetManager;

  constructor(engine: GameEngine, targetManager: TargetManager) {
    this.engine = engine;
    this.targetManager = targetManager;
  }

  /** 시나리오 시작 */
  abstract start(): void;

  /** 매 프레임 업데이트 */
  abstract update(deltaTime: number): void;

  /** 마우스 클릭 시 호출 */
  abstract onClick(): void;

  /** 시나리오 완료 여부 */
  abstract isComplete(): boolean;

  /** 결과 반환 */
  abstract getResults(): unknown;

  /** 리소스 정리 */
  dispose(): void {
    this.targetManager.clear();
  }
}
