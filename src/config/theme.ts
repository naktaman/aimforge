/**
 * 디자인 토큰 — 하드코딩 색상을 중앙 관리
 * THREE.js (0x 숫자)와 CSS (# 문자열) 용도 구분
 */

// ===== 환경 색상 (THREE.js hex) =====

export const ENV_COLORS = {
  /** 바닥 그리드 주 색상 */
  gridPrimary: 0x2a2a3e,
  /** 바닥 그리드 보조 색상 */
  gridSecondary: 0x1a1a2e,
  /** 벽 색상 */
  wall: 0x2a2a3e,
  /** 씬 배경 */
  background: 0x0a0a1a,
  /** 조명 색상 (흰색) */
  light: 0xffffff,
} as const;

// ===== 타겟 색상 (THREE.js hex) =====

export const TARGET_COLORS = {
  /** 기본 타겟 (빨강-핑크, Flick/Correction 등) */
  flickRed: 0xe94560,
  /** 트래킹 타겟 (초록) */
  trackingGreen: 0x4ade80,
  /** 경고/고우선 타겟 (밝은 빨강) */
  alertRed: 0xff6b6b,
  /** 대안 트래킹 색상 (청록) */
  trackingTeal: 0x4ecdc4,
  /** 몸통 (파랑) */
  bodyBlue: 0x3b82f6,
} as const;

// ===== 히트 플래시 색상 (THREE.js hex) =====

export const HIT_FLASH_COLORS = {
  /** 헤드샷 플래시 */
  headshot: 0xff0000,
  /** 상체 히트 플래시 */
  upperBody: 0xffffff,
  /** 하체 히트 플래시 */
  lowerBody: 0xff8800,
  /** 기본 히트 플래시 (초록) */
  default: 0x4ade80,
} as const;

// ===== 스테이지 색상 (THREE.js hex) =====

export const STAGE_COLORS = {
  flickMedium: 0xffa500,
  flickMacro: 0xe74c3c,
  aerialTracking: 0x00b894,
  scopedLongRange: 0x6c5ce7,
  strafeTracking: 0xfdcb6e,
  switchingWide: 0xe17055,
  trackingMid: 0x0984e3,
  longRange: 0x54a0ff,
  customDrill: 0xff9f43,
} as const;

// ===== UI 색상 (CSS hex 문자열) =====

export const UI_COLORS = {
  // ── 텍스트 ──
  /** 주 텍스트 (밝은 회색) */
  textPrimary: '#e2e8f0',
  /** 보조 텍스트 (중간 회색) */
  textSecondary: '#94a3b8',
  /** 흰색 텍스트 */
  textWhite: '#fff',
  /** 비활성/플레이스홀더 텍스트 */
  textMuted: '#888',

  // ── 시맨틱 색상 ──
  /** 정보 강조 (청색) */
  infoHighlight: '#38bdf8',
  /** 정보 파랑 (60a5fa) */
  infoBlue: '#60a5fa',
  /** 성공/트래킹 초록 */
  successGreen: '#4ade80',
  /** 위험/미스 빨강 */
  dangerRed: '#f87171',
  /** 골드 액센트 */
  accentGold: '#FFB81C',
  /** 참조 블루 (연한) */
  referenceBlue: '#74b9ff',
  /** 메탈 크롬 (강조 회색) */
  metalChrome: '#8A9AB5',

  // ── 차트/D3 공통 ──
  /** 차트 축 텍스트 */
  chartAxisText: '#888',
  /** 차트 축 라인/틱 */
  chartAxisLine: '#444',
  /** 차트 그리드 (점선) */
  chartGrid: '#555',
  /** 차트 축 레이블 */
  chartLabel: '#aaa',
  /** 차트 도메인 라인 */
  chartDomain: '#333',
  /** 차트 틱 텍스트 (어두운 회색) */
  chartTickText: '#666',

  // ── 표면/배경 ──
  /** 가장 깊은 배경 */
  bgDeep: '#0a0a1a',
  /** 패널 배경 */
  bgPanel: '#1a1a2e',
  /** 카드/서피스 배경 */
  bgSurface: '#1e293b',
  /** 미묘한 테두리 */
  borderSubtle: '#2a2a2a',

  // ── 레이더/스코프 ──
  /** 레이더 차트 참조 색상 (파랑) */
  radarReference: '#4a9eff',
  /** 레이더 차트 타겟 색상 (골드) */
  radarTarget: '#FFB81C',
  /** 스코프 빨간 점 */
  scopeRedDot: '#ff3333',
} as const;

// ===== 등급 색상 (CSS hex 문자열) =====

export const GRADE_COLORS = {
  S: '#FFD700',
  A: '#10B981',
  B: '#D4960A',
  C: '#F59E0B',
  D: '#6B7280',
} as const;

// ===== 크로스헤어 프리셋 색상 (CSS hex 문자열) =====

export const CROSSHAIR_COLORS = {
  cs2Default: '#4ade80',
  valorantDefault: '#00ff00',
  dotOnly: '#ff4444',
  circle: '#ffffff',
  tShape: '#00ffff',
  overwatchDefault: '#00ff00',
  minimal: '#ffffff',
  outline: '#000000',
} as const;

// ===== 무기 뷰모델 색상 (THREE.js hex) =====

export const WEAPON_COLORS = {
  gunMetal: 0x2a2a2e,
  gunDark: 0x1a1a1e,
  gunHighlight: 0x3a3a40,
  gunShadow: 0x222226,
} as const;
