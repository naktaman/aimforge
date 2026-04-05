/**
 * 공유 TypeScript 타입 정의
 * 도메인별 분리 파일에서 re-export — 기존 import 호환 유지
 *
 * @see ./types/core.ts — 코어 타입 (IPC, 입력, 엔진)
 * @see ./types/scenarios.ts — 시나리오 설정 + 메트릭
 * @see ./types/dna.ts — Aim DNA
 * @see ./types/training.ts — 훈련, Readiness, Stage
 * @see ./types/crossgame.ts — 크로스게임 비교
 * @see ./types/hardware.ts — 하드웨어, FOV, Movement
 * @see ./types/crosshair.ts — 크로스헤어 커스터마이징
 */
export * from './types/core';
export * from './types/scenarios';
export * from './types/dna';
export * from './types/training';
export * from './types/crossgame';
export * from './types/hardware';
export * from './types/crosshair';
