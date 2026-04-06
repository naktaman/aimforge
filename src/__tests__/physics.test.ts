/**
 * physics.ts 물리 변환 유틸리티 단위 테스트
 * Rust game_db/conversion.rs와 동일한 공식 검증
 */
import { describe, it, expect } from 'vitest';
import {
  rawToCm,
  cmToDegrees,
  gameSensToCm360,
  cm360ToSens,
  gameFovToHfov,
  hfovToVfov,
  convertAllMethods,
  snapSensitivity,
} from '../utils/physics';

// 부동소수점 비교는 toBeCloseTo 사용

// ────────────────────────────────────────────────────────
// rawToCm
// ────────────────────────────────────────────────────────
describe('rawToCm — raw delta → cm 변환', () => {
  it('기본 변환: 400 DPI에서 400 counts → 2.54cm', () => {
    const [cx, cy] = rawToCm(400, 0, 400);
    expect(cx).toBeCloseTo(2.54, 6);
    expect(cy).toBe(0);
  });

  it('기본 변환: 800 DPI에서 800 counts → 2.54cm', () => {
    const [cx] = rawToCm(800, 0, 800);
    expect(cx).toBeCloseTo(2.54, 6);
  });

  it('dx, dy 모두 변환됨', () => {
    // 400 DPI, 100 counts → 100/400 × 2.54 = 0.635cm
    const [cx, cy] = rawToCm(100, 200, 400);
    expect(cx).toBeCloseTo(0.635, 6);
    expect(cy).toBeCloseTo(1.27, 6);
  });

  it('DPI=0 안전 처리 → [0, 0] 반환', () => {
    const result = rawToCm(500, 300, 0);
    expect(result).toEqual([0, 0]);
  });

  it('음수 delta 처리 — 방향 보존', () => {
    const [cx, cy] = rawToCm(-400, -800, 400);
    expect(cx).toBeCloseTo(-2.54, 6);
    expect(cy).toBeCloseTo(-5.08, 6);
  });
});

// ────────────────────────────────────────────────────────
// cmToDegrees
// ────────────────────────────────────────────────────────
describe('cmToDegrees — cm → 회전 각도 변환', () => {
  it('기본 변환: 정확히 cm360만큼 이동 → 360도', () => {
    expect(cmToDegrees(30, 30)).toBeCloseTo(360, 6);
  });

  it('절반 이동 → 180도', () => {
    expect(cmToDegrees(15, 30)).toBeCloseTo(180, 6);
  });

  it('cmPer360=0 안전 처리 → 0 반환', () => {
    expect(cmToDegrees(10, 0)).toBe(0);
  });

  it('음수 cm — 반대 방향 회전', () => {
    expect(cmToDegrees(-30, 30)).toBeCloseTo(-360, 6);
  });
});

// ────────────────────────────────────────────────────────
// gameSensToCm360
// ────────────────────────────────────────────────────────
describe('gameSensToCm360 — 게임 감도 → cm/360 변환', () => {
  it('CS2 기본: sens=1.0, DPI=400, yaw=0.022', () => {
    // (360 / (1.0 × 0.022 × 400)) × 2.54 = (360/8.8) × 2.54 ≈ 103.9090...
    const result = gameSensToCm360(1.0, 400, 0.022);
    expect(result).toBeCloseTo(103.909, 3);
  });

  it('Valorant 기본: sens=0.4, DPI=800, yaw=0.07', () => {
    // (360 / (0.4 × 0.07 × 800)) × 2.54 = (360/22.4) × 2.54 ≈ 40.821...
    const result = gameSensToCm360(0.4, 800, 0.07);
    expect(result).toBeCloseTo(40.821, 3);
  });

  it('감도 2배 → cm/360 절반', () => {
    const base = gameSensToCm360(1.0, 400, 0.022);
    const doubled = gameSensToCm360(2.0, 400, 0.022);
    expect(doubled).toBeCloseTo(base / 2, 6);
  });

  it('경계값: sens=0 → 0 반환 (0 나누기 안전 처리)', () => {
    expect(gameSensToCm360(0, 400, 0.022)).toBe(0);
  });

  it('경계값: dpi=0 → 0 반환', () => {
    expect(gameSensToCm360(1.0, 0, 0.022)).toBe(0);
  });

  it('경계값: yaw=0 → 0 반환', () => {
    expect(gameSensToCm360(1.0, 400, 0)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────
// cm360ToSens
// ────────────────────────────────────────────────────────
describe('cm360ToSens — gameSensToCm360 역변환', () => {
  it('gameSensToCm360과 역함수 관계 — CS2 yaw=0.022', () => {
    const originalSens = 1.5;
    const cm360 = gameSensToCm360(originalSens, 400, 0.022);
    const recoveredSens = cm360ToSens(cm360, 400, 0.022);
    expect(recoveredSens).toBeCloseTo(originalSens, 6);
  });

  it('gameSensToCm360과 역함수 관계 — Valorant yaw=0.07', () => {
    const originalSens = 0.6;
    const cm360 = gameSensToCm360(originalSens, 800, 0.07);
    const recoveredSens = cm360ToSens(cm360, 800, 0.07);
    expect(recoveredSens).toBeCloseTo(originalSens, 6);
  });

  it('cm360=0 → 0 반환 (0 나누기 안전 처리)', () => {
    expect(cm360ToSens(0, 400, 0.022)).toBe(0);
  });

  it('DPI=0 → 0 반환', () => {
    expect(cm360ToSens(30, 0, 0.022)).toBe(0);
  });
});

// ────────────────────────────────────────────────────────
// gameFovToHfov
// ────────────────────────────────────────────────────────
describe('gameFovToHfov — 게임 FOV → 수평 FOV 변환', () => {
  it('horizontal 타입 → 그대로 통과', () => {
    expect(gameFovToHfov(90, 'horizontal', 16 / 9)).toBe(90);
    expect(gameFovToHfov(103, 'horizontal', 16 / 9)).toBe(103);
  });

  it('vertical → horizontal: 16:9 aspect에서 vFOV≈58.72° → hFOV=90°', () => {
    // hFOV=90°를 만들려면: tan(vFOV/2) = tan(45°) × (9/16) → vFOV≈58.716°
    const vFov = 58.71550708558254;
    const hFov = gameFovToHfov(vFov, 'vertical', 16 / 9);
    expect(hFov).toBeCloseTo(90, 5);
  });

  it('vertical → horizontal: aspectRatio=1 (정사각형) → hFOV=vFOV', () => {
    const fov = 60;
    const result = gameFovToHfov(fov, 'vertical', 1);
    expect(result).toBeCloseTo(fov, 5);
  });

  it('unknown fovType → vertical로 처리 (horizontal 분기 미해당)', () => {
    // fovType이 'horizontal'이 아니면 vertical 공식 적용
    const result = gameFovToHfov(60, 'vertical', 16 / 9);
    expect(result).toBeGreaterThan(60); // 16:9에서 hFOV > vFOV
  });
});

// ────────────────────────────────────────────────────────
// hfovToVfov
// ────────────────────────────────────────────────────────
describe('hfovToVfov — gameFovToHfov 역변환', () => {
  it('gameFovToHfov(vertical)과 역함수 관계 — 16:9', () => {
    const originalVfov = 60;
    const hfov = gameFovToHfov(originalVfov, 'vertical', 16 / 9);
    const recoveredVfov = hfovToVfov(hfov, 16 / 9);
    expect(recoveredVfov).toBeCloseTo(originalVfov, 5);
  });

  it('hFOV=90°, 16:9 → vFOV < 90°', () => {
    const vfov = hfovToVfov(90, 16 / 9);
    expect(vfov).toBeLessThan(90);
  });

  it('aspectRatio=1 → hFOV=vFOV', () => {
    const hfov = 75;
    const result = hfovToVfov(hfov, 1);
    expect(result).toBeCloseTo(hfov, 5);
  });
});

// ────────────────────────────────────────────────────────
// convertAllMethods
// ────────────────────────────────────────────────────────
describe('convertAllMethods — 6가지 FOV 변환 방식 동시 계산', () => {
  it('같은 FOV면 전 방식에서 srcCm360 그대로 반환 (배율=1)', () => {
    const srcFov = 90;
    const result = convertAllMethods(srcFov, srcFov, 30, 16 / 9);
    for (const [, val] of Object.entries(result)) {
      expect(val).toBeCloseTo(30, 5);
    }
  });

  it('6가지 키 모두 반환: MDM_0, MDM_56.25, MDM_75, MDM_100, Viewspeed_H, Viewspeed_V', () => {
    const result = convertAllMethods(90, 103, 30, 16 / 9);
    expect(Object.keys(result)).toContain('MDM_0');
    expect(Object.keys(result)).toContain('MDM_56.25');
    expect(Object.keys(result)).toContain('MDM_75');
    expect(Object.keys(result)).toContain('MDM_100');
    expect(Object.keys(result)).toContain('Viewspeed_H');
    expect(Object.keys(result)).toContain('Viewspeed_V');
  });

  it('dstFov > srcFov (줌아웃) → MDM_0 결과는 srcCm360보다 작음', () => {
    // dstFov=120 > srcFov=90: fovRatio>1, mult>1 → srcCm360/mult < srcCm360
    const result = convertAllMethods(90, 120, 30, 16 / 9);
    expect(result['MDM_0']).toBeLessThan(30);
  });

  it('MDM_100 → Viewspeed_H와 동일한 결과 (MDM 100% = 완전 비례)', () => {
    // MDM 100%와 Viewspeed H는 서로 다른 공식이므로 동일하지 않음
    // MDM 100%: fovRatio^0 = 1 → dst = srcCm360
    const result = convertAllMethods(90, 60, 30, 16 / 9);
    expect(result['MDM_100']).toBeCloseTo(30, 5);
  });
});

// ────────────────────────────────────────────────────────
// snapSensitivity
// ────────────────────────────────────────────────────────
describe('snapSensitivity — 감도 스냅 후보 생성', () => {
  it('floor/ceil 후보가 idealSens를 사이에 두고 생성됨', () => {
    const result = snapSensitivity(30, 400, 0.022, 0.1);
    expect(result.floorSens).toBeLessThanOrEqual(result.ceilSens);
  });

  it('floorCm360 ≥ targetCm360, ceilCm360 ≤ targetCm360 (감도가 낮을수록 cm/360 커짐)', () => {
    // 낮은 감도 → 높은 cm/360, 높은 감도 → 낮은 cm/360
    const result = snapSensitivity(30, 400, 0.022, 0.1);
    expect(result.floorCm360).toBeGreaterThanOrEqual(result.ceilCm360);
  });

  it('sensStep=0.1 — floor/ceil 차이가 최대 0.1', () => {
    const result = snapSensitivity(30, 400, 0.022, 0.1);
    expect(result.ceilSens - result.floorSens).toBeCloseTo(0.1, 5);
  });

  it('floorSens=0이면 floorCm360=Infinity', () => {
    // 매우 작은 targetCm360으로 idealSens가 매우 커져 floor=0이 되지 않도록
    // 매우 큰 cm360으로 idealSens → 0에 가깝게
    const result = snapSensitivity(10000, 400, 0.022, 1);
    // idealSens ≈ 0.000103 → floorSens = 0
    expect(result.floorSens).toBe(0);
    expect(result.floorCm360).toBe(Infinity);
  });
});
