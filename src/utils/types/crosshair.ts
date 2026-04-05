/**
 * 크로스헤어 커스터마이징 타입 + 프리셋
 */
import { CROSSHAIR_COLORS } from '../../config/theme';

/** 크로스헤어 형태 */
export type CrosshairShape = 'cross' | 'dot' | 'circle' | 't_shape' | 'cross_dot';

/** 크로스헤어 설정 */
export interface CrosshairConfig {
  shape: CrosshairShape;
  innerLength: number;
  outerLength: number;
  thickness: number;
  gap: number;
  color: string;
  opacity: number;
  outlineEnabled: boolean;
  outlineThickness: number;
  outlineColor: string;
  dotEnabled: boolean;
  dotSize: number;
  dynamicEnabled: boolean;
  dynamicSpread: number;
}

/** 크로스헤어 프리셋 */
export interface CrosshairPreset {
  name: string;
  config: CrosshairConfig;
}

/** 기본 크로스헤어 프리셋 목록 */
export const CROSSHAIR_PRESETS: CrosshairPreset[] = [
  {
    name: 'CS2 Default',
    config: {
      shape: 'cross', innerLength: 5, outerLength: 0, thickness: 1, gap: 3,
      color: CROSSHAIR_COLORS.cs2Default, opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: CROSSHAIR_COLORS.outline, dotEnabled: false, dotSize: 2,
      dynamicEnabled: false, dynamicSpread: 3,
    },
  },
  {
    name: 'Valorant Default',
    config: {
      shape: 'cross', innerLength: 4, outerLength: 2, thickness: 2, gap: 3,
      color: CROSSHAIR_COLORS.valorantDefault, opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: CROSSHAIR_COLORS.outline, dotEnabled: true, dotSize: 2,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'Dot Only',
    config: {
      shape: 'dot', innerLength: 0, outerLength: 0, thickness: 0, gap: 0,
      color: CROSSHAIR_COLORS.dotOnly, opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: CROSSHAIR_COLORS.outline, dotEnabled: true, dotSize: 4,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'Circle',
    config: {
      shape: 'circle', innerLength: 0, outerLength: 0, thickness: 2, gap: 10,
      color: CROSSHAIR_COLORS.circle, opacity: 0.8, outlineEnabled: false, outlineThickness: 0,
      outlineColor: CROSSHAIR_COLORS.outline, dotEnabled: true, dotSize: 2,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'T-Shape',
    config: {
      shape: 't_shape', innerLength: 6, outerLength: 0, thickness: 2, gap: 2,
      color: CROSSHAIR_COLORS.tShape, opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: CROSSHAIR_COLORS.outline, dotEnabled: false, dotSize: 0,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
  {
    name: 'Overwatch Default',
    config: {
      shape: 'cross_dot', innerLength: 5, outerLength: 0, thickness: 2, gap: 4,
      color: CROSSHAIR_COLORS.overwatchDefault, opacity: 1, outlineEnabled: false, outlineThickness: 0,
      outlineColor: CROSSHAIR_COLORS.outline, dotEnabled: true, dotSize: 3,
      dynamicEnabled: true, dynamicSpread: 5,
    },
  },
  {
    name: 'Minimal',
    config: {
      shape: 'cross', innerLength: 3, outerLength: 0, thickness: 1, gap: 2,
      color: CROSSHAIR_COLORS.minimal, opacity: 0.7, outlineEnabled: false, outlineThickness: 0,
      outlineColor: CROSSHAIR_COLORS.outline, dotEnabled: false, dotSize: 0,
      dynamicEnabled: false, dynamicSpread: 0,
    },
  },
];
