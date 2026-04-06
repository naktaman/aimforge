/**
 * settingsStore 단위 테스트
 * 하드웨어 설정, 감도 변환, FOV, 크로스헤어 액션 검증
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsStore } from '../stores/settingsStore';
import { gameSensToCm360, gameFovToHfov } from '../utils/physics';
import { CROSSHAIR_PRESETS } from '../utils/types';
import type { GamePreset } from '../utils/types';

/** 테스트용 CS2 게임 프리셋 */
const CS2_PRESET: GamePreset = {
  id: 'cs2',
  name: 'CS2',
  yaw: 0.022,
  defaultFov: 106.26,
  fovType: 'horizontal',
  defaultAspectRatio: 16 / 9,
  sensStep: 0.01,
  movementRatio: 0,
};

/** 테스트용 R6 (수직 FOV) 게임 프리셋 */
const R6_PRESET: GamePreset = {
  id: 'r6',
  name: 'Rainbow Six Siege',
  yaw: 0.00572957795,
  defaultFov: 60,
  fovType: 'vertical',
  defaultAspectRatio: 16 / 9,
  sensStep: 1,
  movementRatio: 0,
};

/** 초기 상태로 리셋하는 헬퍼 */
function resetStore() {
  useSettingsStore.setState({
    dpi: 800,
    pollingRate: 1000,
    selectedGame: null,
    sensitivity: 1.0,
    cmPer360: 46.18,
    fovSetting: 106.26,
    hfov: 106.26,
    currentZoom: 1,
    scopeMultiplier: 1,
    crosshair: { ...CROSSHAIR_PRESETS[0].config },
  });
}

describe('settingsStore — 초기 상태', () => {
  beforeEach(resetStore);

  it('기본 DPI는 800', () => {
    expect(useSettingsStore.getState().dpi).toBe(800);
  });

  it('기본 폴링레이트는 1000Hz', () => {
    expect(useSettingsStore.getState().pollingRate).toBe(1000);
  });

  it('기본 cm/360은 46.18', () => {
    expect(useSettingsStore.getState().cmPer360).toBe(46.18);
  });

  it('초기 selectedGame은 null', () => {
    expect(useSettingsStore.getState().selectedGame).toBeNull();
  });

  it('초기 감도는 1.0', () => {
    expect(useSettingsStore.getState().sensitivity).toBe(1.0);
  });
});

describe('settingsStore — setDpi', () => {
  beforeEach(resetStore);

  it('게임 미선택 시 DPI만 변경 — cm360 유지', () => {
    const beforeCm360 = useSettingsStore.getState().cmPer360;
    useSettingsStore.getState().setDpi(400);
    expect(useSettingsStore.getState().dpi).toBe(400);
    // 게임 미선택이므로 cm360 재계산 없이 기존 값 유지
    expect(useSettingsStore.getState().cmPer360).toBe(beforeCm360);
  });

  it('게임 선택 후 DPI 변경 시 cm360 재계산', () => {
    useSettingsStore.getState().selectGame(CS2_PRESET);
    useSettingsStore.getState().setDpi(400);
    const expected = gameSensToCm360(
      useSettingsStore.getState().sensitivity,
      400,
      CS2_PRESET.yaw,
    );
    expect(useSettingsStore.getState().cmPer360).toBeCloseTo(expected, 5);
  });
});

describe('settingsStore — setPollingRate', () => {
  beforeEach(resetStore);

  it('폴링레이트 500Hz로 설정', () => {
    useSettingsStore.getState().setPollingRate(500);
    expect(useSettingsStore.getState().pollingRate).toBe(500);
  });

  it('폴링레이트 8000Hz로 설정', () => {
    useSettingsStore.getState().setPollingRate(8000);
    expect(useSettingsStore.getState().pollingRate).toBe(8000);
  });
});

describe('settingsStore — setSensitivity', () => {
  beforeEach(resetStore);

  it('게임 미선택 시 감도만 변경 — cm360 유지', () => {
    const beforeCm360 = useSettingsStore.getState().cmPer360;
    useSettingsStore.getState().setSensitivity(2.0);
    expect(useSettingsStore.getState().sensitivity).toBe(2.0);
    expect(useSettingsStore.getState().cmPer360).toBe(beforeCm360);
  });

  it('게임 선택 후 감도 변경 시 cm360 재계산', () => {
    useSettingsStore.getState().selectGame(CS2_PRESET);
    useSettingsStore.getState().setSensitivity(2.5);
    const expected = gameSensToCm360(2.5, useSettingsStore.getState().dpi, CS2_PRESET.yaw);
    expect(useSettingsStore.getState().cmPer360).toBeCloseTo(expected, 5);
  });
});

describe('settingsStore — setFovSetting', () => {
  beforeEach(resetStore);

  it('게임 미선택 시 FOV = hfov (1:1)', () => {
    useSettingsStore.getState().setFovSetting(90);
    expect(useSettingsStore.getState().fovSetting).toBe(90);
    expect(useSettingsStore.getState().hfov).toBe(90);
  });

  it('수직 FOV 게임 선택 후 FOV 변경 시 hfov 재계산', () => {
    useSettingsStore.getState().selectGame(R6_PRESET);
    useSettingsStore.getState().setFovSetting(70);
    const expected = gameFovToHfov(70, 'vertical', R6_PRESET.defaultAspectRatio);
    expect(useSettingsStore.getState().hfov).toBeCloseTo(expected, 5);
  });

  it('수평 FOV 게임 선택 후 FOV 변경 시 hfov = fovSetting', () => {
    useSettingsStore.getState().selectGame(CS2_PRESET);
    useSettingsStore.getState().setFovSetting(90);
    expect(useSettingsStore.getState().hfov).toBeCloseTo(90, 5);
  });
});

describe('settingsStore — selectGame', () => {
  beforeEach(resetStore);

  it('게임 선택 시 selectedGame 업데이트', () => {
    useSettingsStore.getState().selectGame(CS2_PRESET);
    expect(useSettingsStore.getState().selectedGame?.id).toBe('cs2');
  });

  it('게임 선택 시 yaw 기반 cm360 자동 계산', () => {
    useSettingsStore.getState().selectGame(CS2_PRESET);
    const expected = gameSensToCm360(
      useSettingsStore.getState().sensitivity,
      useSettingsStore.getState().dpi,
      CS2_PRESET.yaw,
    );
    expect(useSettingsStore.getState().cmPer360).toBeCloseTo(expected, 5);
  });

  it('게임 선택 시 hfov 자동 계산 — 수직 FOV 변환', () => {
    useSettingsStore.getState().selectGame(R6_PRESET);
    const expected = gameFovToHfov(
      R6_PRESET.defaultFov,
      R6_PRESET.fovType,
      R6_PRESET.defaultAspectRatio,
    );
    expect(useSettingsStore.getState().hfov).toBeCloseTo(expected, 5);
  });

  it('게임 선택 시 fovSetting이 게임 기본값으로 설정', () => {
    useSettingsStore.getState().selectGame(CS2_PRESET);
    expect(useSettingsStore.getState().fovSetting).toBe(CS2_PRESET.defaultFov);
  });
});

describe('settingsStore — setCrosshair', () => {
  beforeEach(resetStore);

  it('부분 업데이트 — gap만 변경', () => {
    const before = useSettingsStore.getState().crosshair;
    useSettingsStore.getState().setCrosshair({ gap: 5 });
    expect(useSettingsStore.getState().crosshair.gap).toBe(5);
    // 나머지 필드 유지 확인
    expect(useSettingsStore.getState().crosshair.shape).toBe(before.shape);
    expect(useSettingsStore.getState().crosshair.thickness).toBe(before.thickness);
  });

  it('color + opacity 동시 업데이트', () => {
    useSettingsStore.getState().setCrosshair({ color: '#ff0000', opacity: 0.5 });
    const ch = useSettingsStore.getState().crosshair;
    expect(ch.color).toBe('#ff0000');
    expect(ch.opacity).toBe(0.5);
  });
});

describe('settingsStore — setCrosshairPreset', () => {
  beforeEach(resetStore);

  it('존재하는 프리셋 적용 — Valorant Default', () => {
    useSettingsStore.getState().setCrosshairPreset('Valorant Default');
    const ch = useSettingsStore.getState().crosshair;
    expect(ch.shape).toBe('cross');
    expect(ch.dotEnabled).toBe(true);
  });

  it('존재하지 않는 프리셋 이름 — 상태 변경 없음', () => {
    const before = { ...useSettingsStore.getState().crosshair };
    useSettingsStore.getState().setCrosshairPreset('없는프리셋');
    expect(useSettingsStore.getState().crosshair).toEqual(before);
  });

  it('Dot Only 프리셋 적용 시 shape = dot', () => {
    useSettingsStore.getState().setCrosshairPreset('Dot Only');
    expect(useSettingsStore.getState().crosshair.shape).toBe('dot');
  });
});

describe('settingsStore — exportCrosshairCode / importCrosshairCode 라운드트립', () => {
  beforeEach(resetStore);

  it('내보내기 코드가 AIM- 프리픽스로 시작', () => {
    const code = useSettingsStore.getState().exportCrosshairCode();
    expect(code.startsWith('AIM-')).toBe(true);
  });

  it('내보내기 → 가져오기 라운드트립 — 설정 복원', () => {
    useSettingsStore.getState().setCrosshair({ gap: 7, thickness: 3 });
    const code = useSettingsStore.getState().exportCrosshairCode();

    // 상태를 다른 프리셋으로 덮어쓰고 import
    useSettingsStore.getState().setCrosshairPreset('Dot Only');
    const result = useSettingsStore.getState().importCrosshairCode(code);
    expect(result).toBe(true);
    expect(useSettingsStore.getState().crosshair.gap).toBe(7);
    expect(useSettingsStore.getState().crosshair.thickness).toBe(3);
  });

  it('잘못된 프리픽스 — import 실패', () => {
    const result = useSettingsStore.getState().importCrosshairCode('WRONG-abc123');
    expect(result).toBe(false);
  });

  it('손상된 base64 — import 실패', () => {
    const result = useSettingsStore.getState().importCrosshairCode('AIM-!!!invalid!!!');
    expect(result).toBe(false);
  });

  it('잘못된 shape 값 포함 코드 — import 실패', () => {
    const badConfig = {
      shape: 'unknown_shape',
      innerLength: 5, outerLength: 0, thickness: 1, gap: 3,
      color: '#fff', opacity: 1, outlineEnabled: true, outlineThickness: 1,
      outlineColor: '#000', dotEnabled: false, dotSize: 2,
      dynamicEnabled: false, dynamicSpread: 0,
    };
    const code = `AIM-${btoa(JSON.stringify(badConfig))}`;
    const result = useSettingsStore.getState().importCrosshairCode(code);
    expect(result).toBe(false);
  });
});
