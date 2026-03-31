/**
 * 2D Perlin Noise — 순수 TypeScript 구현
 * Ken Perlin의 Improved Noise 알고리즘 기반
 * 외부 의존성 없음, StochasticTrackingScenario에서 사용
 */

/** 순열 테이블 (0~255 셔플) */
const PERMUTATION = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
  36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120,
  234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33,
  88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71,
  134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133,
  230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161,
  1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130,
  116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250,
  124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227,
  47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
  154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98,
  108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34,
  242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14,
  239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121,
  50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243,
  141, 128, 195, 78, 66, 215, 61, 156, 180,
];

export class PerlinNoise {
  private perm: number[];

  /** @param seed 시드값 (옵션, 기본=고정 순열) */
  constructor(seed?: number) {
    if (seed !== undefined) {
      // 시드 기반 Fisher-Yates 셔플
      const p = [...PERMUTATION];
      let s = seed;
      for (let i = p.length - 1; i > 0; i--) {
        s = (s * 16807 + 0) % 2147483647; // LCG
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
      }
      this.perm = [...p, ...p]; // 512 엔트리 (wrap-around 방지)
    } else {
      this.perm = [...PERMUTATION, ...PERMUTATION];
    }
  }

  /** 2D Perlin noise, 출력 범위 [-1, 1] */
  noise2D(x: number, y: number): number {
    // 격자 좌표
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;

    // 격자 내 상대 위치
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // 5차 보간 (quintic fade)
    const u = fade(xf);
    const v = fade(yf);

    // 해시 값
    const aa = this.perm[this.perm[xi] + yi];
    const ab = this.perm[this.perm[xi] + yi + 1];
    const ba = this.perm[this.perm[xi + 1] + yi];
    const bb = this.perm[this.perm[xi + 1] + yi + 1];

    // 그래디언트 보간
    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);

    return lerp(x1, x2, v);
  }
}

/** 5차 보간 곡선: 6t^5 - 15t^4 + 10t^3 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** 선형 보간 */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/** 그래디언트 함수 — 해시의 하위 비트로 방향 결정 */
function grad(hash: number, x: number, y: number): number {
  const h = hash & 3;
  switch (h) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    case 3:
      return -x - y;
    default:
      return 0;
  }
}
