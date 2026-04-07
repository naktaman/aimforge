/**
 * 환경 프리셋 — Cold Forge 테마 재질 + 맵 4종 + 조명 설정
 * 훈련 목적별 최적화된 맵 구성 (기획서 §3 기반)
 */
import * as THREE from 'three';
import { FORGE_COLORS } from '../config/theme';

// ═══════════════════════════════════════════════════════
// 타입 정의
// ═══════════════════════════════════════════════════════

/** PBR 재질 프리셋 */
export interface MaterialPreset {
  color: number;
  metalness: number;
  roughness: number;
  emissive?: number;
  emissiveIntensity?: number;
}

/** 조명 설정 */
export interface LightingConfig {
  ambient: { color: number; intensity: number };
  hemisphere: { skyColor: number; groundColor: number; intensity: number };
  directional: {
    color: number;
    intensity: number;
    position: [number, number, number];
    castShadow: boolean;
    shadowMapSize: number;
  };
  points: Array<{
    color: number;
    intensity: number;
    distance: number;
    position: [number, number, number];
  }>;
}

/** 안개 설정 */
export interface FogConfig {
  type: 'linear' | 'exponential';
  color: number;
  near?: number;
  far?: number;
  density?: number;
}

/** 장애물 설정 */
export interface ObstacleConfig {
  type: 'wall' | 'pillar' | 'crate';
  position: [number, number, number];
  size: [number, number, number];
  rotation?: number;
  material: keyof typeof COLD_FORGE_MATERIALS;
}

/** 먼지 파티클 설정 */
export interface DustConfig {
  count: number;
  area: { width: number; height: number; depth: number };
  size: number;
  opacity: number;
  speed: number;
  color: number;
}

/** 맵 프리셋 전체 설정 */
export interface MapPreset {
  id: string;
  name: string;
  category: 'flick' | 'tracking' | 'cqb' | 'longrange';
  dimensions: { width: number; depth: number; height: number };
  obstacles: ObstacleConfig[];
  lighting: LightingConfig;
  fog: FogConfig;
  dust: DustConfig;
  /** 네온 그리드 간격 (m). 0이면 그리드 비활성 */
  gridSpacing: number;
}

// ═══════════════════════════════════════════════════════
// Cold Forge 재질 팩토리
// ═══════════════════════════════════════════════════════

/** Cold Forge PBR 재질 정의 */
export const COLD_FORGE_MATERIALS: Record<string, MaterialPreset> = {
  floor: {
    color: FORGE_COLORS.floorDark,
    metalness: 0.1,
    roughness: 0.85,
  },
  wallMetal: {
    color: FORGE_COLORS.wallMetal,
    metalness: 0.7,
    roughness: 0.4,
  },
  wallConcrete: {
    color: FORGE_COLORS.wallConcrete,
    metalness: 0.0,
    roughness: 0.9,
  },
  ceiling: {
    color: FORGE_COLORS.ceiling,
    metalness: 0.5,
    roughness: 0.6,
  },
  neonCyan: {
    color: FORGE_COLORS.neonCyan,
    metalness: 0.0,
    roughness: 0.0,
    emissive: FORGE_COLORS.neonCyan,
    emissiveIntensity: 2.5,
  },
  neonMagenta: {
    color: FORGE_COLORS.neonMagenta,
    metalness: 0.0,
    roughness: 0.0,
    emissive: FORGE_COLORS.neonMagenta,
    emissiveIntensity: 1.8,
  },
};

/** MaterialPreset → THREE.MeshStandardMaterial 변환 */
export function createMaterial(preset: MaterialPreset): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: preset.color,
    metalness: preset.metalness,
    roughness: preset.roughness,
  });
  if (preset.emissive !== undefined) {
    mat.emissive = new THREE.Color(preset.emissive);
    mat.emissiveIntensity = preset.emissiveIntensity ?? 1.0;
    mat.toneMapped = false;
  }
  return mat;
}

// ═══════════════════════════════════════════════════════
// 기본 먼지 파티클 설정
// ═══════════════════════════════════════════════════════

/** 기본 먼지 설정 (맵 크기에 따라 area 덮어씀) */
function makeDust(width: number, height: number, depth: number, count = 400): DustConfig {
  return {
    count,
    area: { width, height, depth },
    size: 0.04,
    opacity: 0.3,
    speed: 0.02,
    color: FORGE_COLORS.dustParticle,
  };
}

// ═══════════════════════════════════════════════════════
// 맵 프리셋 4종
// ═══════════════════════════════════════════════════════

/** Flick 전용 — 넓은 개방 공간 */
const OPEN_FORGE: MapPreset = {
  id: 'open-forge',
  name: 'Open Forge',
  category: 'flick',
  dimensions: { width: 30, depth: 30, height: 6 },
  obstacles: [
    { type: 'pillar', position: [-8, 0, -8], size: [1, 6, 1], material: 'wallMetal' },
    { type: 'pillar', position: [8, 0, -8], size: [1, 6, 1], material: 'wallMetal' },
    { type: 'pillar', position: [-8, 0, 8], size: [1, 6, 1], material: 'wallMetal' },
    { type: 'pillar', position: [8, 0, 8], size: [1, 6, 1], material: 'wallMetal' },
  ],
  lighting: {
    ambient: { color: 0x1a1a3e, intensity: 0.5 },
    hemisphere: { skyColor: 0x2a2a5e, groundColor: 0x1a1a0a, intensity: 0.5 },
    directional: {
      color: 0xffffff, intensity: 0.8,
      position: [0, 20, 0], castShadow: true, shadowMapSize: 1024,
    },
    points: [
      { color: FORGE_COLORS.neonCyan, intensity: 0.6, distance: 20, position: [0, 5, 0] },
    ],
  },
  fog: { type: 'linear', color: FORGE_COLORS.baseDark, near: 30, far: 80 },
  dust: makeDust(30, 6, 30, 500),
  gridSpacing: 4,
};

/** Tracking 전용 — 시야 차단 구간 포함 */
const CIRCUIT_FORGE: MapPreset = {
  id: 'circuit-forge',
  name: 'Circuit Forge',
  category: 'tracking',
  dimensions: { width: 24, depth: 24, height: 5 },
  obstacles: [
    { type: 'pillar', position: [0, 0, 0], size: [3, 5, 3], material: 'wallMetal' },
    { type: 'wall', position: [-6, 0, -4], size: [4, 3, 0.5], rotation: 0.3, material: 'wallConcrete' },
    { type: 'wall', position: [6, 0, 4], size: [4, 3, 0.5], rotation: -0.3, material: 'wallConcrete' },
    { type: 'crate', position: [-4, 0, 6], size: [2, 1.5, 2], material: 'wallMetal' },
    { type: 'crate', position: [4, 0, -6], size: [2, 1.5, 2], material: 'wallMetal' },
  ],
  lighting: {
    ambient: { color: 0x12122a, intensity: 0.35 },
    hemisphere: { skyColor: FORGE_COLORS.hemiSky, groundColor: FORGE_COLORS.hemiGround, intensity: 0.4 },
    directional: {
      color: 0xeeeeff, intensity: 0.7,
      position: [5, 15, 5], castShadow: true, shadowMapSize: 1024,
    },
    points: [
      { color: FORGE_COLORS.neonCyan, intensity: 1.0, distance: 12, position: [-8, 4, -8] },
      { color: FORGE_COLORS.neonCyan, intensity: 1.0, distance: 12, position: [8, 4, 8] },
    ],
  },
  fog: { type: 'linear', color: FORGE_COLORS.baseDark, near: 20, far: 50 },
  dust: makeDust(24, 5, 24, 400),
  gridSpacing: 3,
};

/** CQB 전용 — 좁은 공간, 코너, 엄폐물 */
const PRESSURE_FORGE: MapPreset = {
  id: 'pressure-forge',
  name: 'Pressure Forge',
  category: 'cqb',
  dimensions: { width: 12, depth: 12, height: 3.5 },
  obstacles: [
    { type: 'wall', position: [-2, 0, -2], size: [6, 3.5, 0.4], rotation: 0, material: 'wallConcrete' },
    { type: 'wall', position: [3, 0, 2], size: [0.4, 3.5, 5], rotation: 0, material: 'wallMetal' },
    { type: 'crate', position: [0, 0, 4], size: [1.5, 1.2, 1.5], material: 'wallMetal' },
    { type: 'crate', position: [-4, 0, 0], size: [1.5, 1.2, 1.5], material: 'wallMetal' },
  ],
  lighting: {
    ambient: { color: 0x0a0a15, intensity: 0.25 },
    hemisphere: { skyColor: 0x101030, groundColor: 0x150a05, intensity: 0.3 },
    directional: {
      color: 0xccccee, intensity: 0.5,
      position: [2, 8, 2], castShadow: true, shadowMapSize: 1024,
    },
    points: [
      { color: FORGE_COLORS.neonCyan, intensity: 1.5, distance: 8, position: [-3, 3, -3] },
      { color: FORGE_COLORS.neonMagenta, intensity: 0.8, distance: 6, position: [4, 3, 3] },
    ],
  },
  fog: { type: 'linear', color: 0x050510, near: 8, far: 20 },
  dust: makeDust(12, 3.5, 12, 250),
  gridSpacing: 2,
};

/** Long Range 전용 — 긴 복도형 */
const CORRIDOR_FORGE: MapPreset = {
  id: 'corridor-forge',
  name: 'Corridor Forge',
  category: 'longrange',
  dimensions: { width: 8, depth: 60, height: 5 },
  obstacles: [
    { type: 'pillar', position: [-3, 0, -20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [3, 0, -20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [-3, 0, 0], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [3, 0, 0], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [-3, 0, 20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'pillar', position: [3, 0, 20], size: [0.8, 5, 0.8], material: 'wallMetal' },
    { type: 'crate', position: [-2, 0, -10], size: [2, 2, 1], material: 'wallConcrete' },
    { type: 'crate', position: [2, 0, 10], size: [2, 2, 1], material: 'wallConcrete' },
  ],
  lighting: {
    ambient: { color: FORGE_COLORS.baseDark, intensity: 0.3 },
    hemisphere: { skyColor: FORGE_COLORS.hemiSky, groundColor: FORGE_COLORS.hemiGround, intensity: 0.35 },
    directional: {
      color: 0xffffff, intensity: 0.6,
      position: [0, 15, -20], castShadow: true, shadowMapSize: 2048,
    },
    points: [
      { color: FORGE_COLORS.neonCyan, intensity: 0.8, distance: 15, position: [0, 4, -20] },
      { color: FORGE_COLORS.neonCyan, intensity: 0.8, distance: 15, position: [0, 4, 0] },
      { color: FORGE_COLORS.neonCyan, intensity: 0.8, distance: 15, position: [0, 4, 20] },
    ],
  },
  fog: { type: 'exponential', color: FORGE_COLORS.baseDark, density: 0.015 },
  dust: makeDust(8, 5, 60, 350),
  gridSpacing: 4,
};

// ═══════════════════════════════════════════════════════
// 프리셋 레지스트리
// ═══════════════════════════════════════════════════════

/** 전체 맵 프리셋 (ID → MapPreset) */
export const MAP_PRESETS: Record<string, MapPreset> = {
  'open-forge': OPEN_FORGE,
  'circuit-forge': CIRCUIT_FORGE,
  'pressure-forge': PRESSURE_FORGE,
  'corridor-forge': CORRIDOR_FORGE,
};

/** 기본 프리셋 ID */
export const DEFAULT_MAP_PRESET_ID = 'open-forge';

/** 프리셋 목록 (UI 드롭다운용) */
export const MAP_PRESET_LIST: Array<{ id: string; name: string; category: string }> =
  Object.values(MAP_PRESETS).map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
  }));
