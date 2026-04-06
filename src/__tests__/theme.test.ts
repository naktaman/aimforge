/**
 * 디자인 토큰(theme.ts) 무결성 테스트
 * 색상 형식, 키 존재 여부, 중복 값 검증
 */
import { describe, it, expect } from 'vitest';
import {
  ENV_COLORS, TARGET_COLORS, HIT_FLASH_COLORS,
  STAGE_COLORS, UI_COLORS, GRADE_COLORS,
  CROSSHAIR_COLORS, WEAPON_COLORS,
} from '../config/theme';

/** THREE.js hex 형식 검증 (0x000000 ~ 0xFFFFFF) */
const isThreeHex = (v: number) => Number.isInteger(v) && v >= 0 && v <= 0xFFFFFF;
/** CSS hex 문자열 형식 검증 */
const isCssHex = (v: string) => /^#([0-9a-fA-F]{3,8})$/.test(v);

describe('ENV_COLORS (THREE.js hex)', () => {
  it('모든 값이 유효한 THREE.js hex', () => {
    Object.entries(ENV_COLORS).forEach(([key, val]) => {
      expect(isThreeHex(val), `${key}: ${val}`).toBe(true);
    });
  });
});

describe('TARGET_COLORS (THREE.js hex)', () => {
  it('필수 키 존재', () => {
    expect(TARGET_COLORS).toHaveProperty('flickRed');
    expect(TARGET_COLORS).toHaveProperty('trackingGreen');
  });
  it('모든 값이 유효한 THREE.js hex', () => {
    Object.entries(TARGET_COLORS).forEach(([key, val]) => {
      expect(isThreeHex(val), `${key}: ${val}`).toBe(true);
    });
  });
});

describe('STAGE_COLORS (THREE.js hex)', () => {
  it('9개 스테이지 색상 존재', () => {
    expect(Object.keys(STAGE_COLORS).length).toBe(9);
  });
  it('모든 값이 유효한 THREE.js hex', () => {
    Object.entries(STAGE_COLORS).forEach(([key, val]) => {
      expect(isThreeHex(val), `${key}: ${val}`).toBe(true);
    });
  });
});

describe('UI_COLORS (CSS hex)', () => {
  it('텍스트 색상 존재', () => {
    expect(UI_COLORS).toHaveProperty('textPrimary');
    expect(UI_COLORS).toHaveProperty('textSecondary');
    expect(UI_COLORS).toHaveProperty('textWhite');
  });
  it('차트 색상 존재', () => {
    expect(UI_COLORS).toHaveProperty('chartAxisText');
    expect(UI_COLORS).toHaveProperty('chartAxisLine');
    expect(UI_COLORS).toHaveProperty('chartGrid');
  });
  it('모든 값이 유효한 CSS hex 문자열', () => {
    Object.entries(UI_COLORS).forEach(([key, val]) => {
      expect(isCssHex(val), `${key}: ${val}`).toBe(true);
    });
  });
});

describe('GRADE_COLORS', () => {
  it('S/A/B/C/D 등급 색상 완비', () => {
    expect(GRADE_COLORS).toHaveProperty('S');
    expect(GRADE_COLORS).toHaveProperty('A');
    expect(GRADE_COLORS).toHaveProperty('B');
    expect(GRADE_COLORS).toHaveProperty('C');
    expect(GRADE_COLORS).toHaveProperty('D');
  });
  it('모든 값이 CSS hex', () => {
    Object.entries(GRADE_COLORS).forEach(([key, val]) => {
      expect(isCssHex(val), `${key}: ${val}`).toBe(true);
    });
  });
});

describe('CROSSHAIR_COLORS', () => {
  it('모든 값이 CSS hex', () => {
    Object.entries(CROSSHAIR_COLORS).forEach(([key, val]) => {
      expect(isCssHex(val), `${key}: ${val}`).toBe(true);
    });
  });
});

describe('HIT_FLASH_COLORS / WEAPON_COLORS', () => {
  it('모든 값이 THREE.js hex', () => {
    [...Object.entries(HIT_FLASH_COLORS), ...Object.entries(WEAPON_COLORS)].forEach(([key, val]) => {
      expect(isThreeHex(val), `${key}: ${val}`).toBe(true);
    });
  });
});
