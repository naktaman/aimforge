/**
 * 순수 구현 2D Simplex Noise
 * 외부 라이브러리 없이 타겟 움직임용 부드러운 노이즈 생성
 * 참조: Stefan Gustavson의 Simplex Noise 알고리즘 (2005)
 */

/** Grad 벡터 (2D 단순화) */
const GRAD2: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
];

/** 순열 테이블 크기 */
const TABLE_SIZE = 256;

/**
 * 2D Simplex Noise 생성기
 * 시드 기반 결정론적 노이즈 — 동일 입력 → 동일 출력
 */
export class SimplexNoise2D {
  private perm: Uint8Array;

  constructor(seed?: number) {
    this.perm = new Uint8Array(TABLE_SIZE * 2);
    this.initPermutation(seed ?? Math.random() * 65536);
  }

  /** 시드 기반 순열 테이블 초기화 (Fisher-Yates 셔플) */
  private initPermutation(seed: number): void {
    const p = new Uint8Array(TABLE_SIZE);
    for (let i = 0; i < TABLE_SIZE; i++) p[i] = i;

    // xorshift32 기반 의사 난수
    let s = seed | 0;
    for (let i = TABLE_SIZE - 1; i > 0; i--) {
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      const j = ((s >>> 0) % (i + 1));
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }

    // 2배 확장 (모듈러 연산 제거용)
    for (let i = 0; i < TABLE_SIZE * 2; i++) {
      this.perm[i] = p[i & (TABLE_SIZE - 1)];
    }
  }

  /**
   * 2D Simplex Noise 값 계산
   * @returns -1.0 ~ 1.0 범위의 노이즈 값
   */
  noise2D(x: number, y: number): number {
    // Skewing/unskewing 상수 (2D simplex)
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;

    // Skew → 정수 격자 좌표
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);

    // Unskew → 셀 내 좌표
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);

    // 삼각형 꼭짓점 결정 (어느 simplex에 속하는지)
    let i1: number, j1: number;
    if (x0 > y0) {
      i1 = 1; j1 = 0;
    } else {
      i1 = 0; j1 = 1;
    }

    // 세 꼭짓점 상대 좌표
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;

    // 해시 인덱스
    const ii = i & (TABLE_SIZE - 1);
    const jj = j & (TABLE_SIZE - 1);
    const gi0 = this.perm[ii + this.perm[jj]] & 7;
    const gi1 = this.perm[ii + i1 + this.perm[jj + j1]] & 7;
    const gi2 = this.perm[ii + 1 + this.perm[jj + 1]] & 7;

    // 각 꼭짓점 기여도
    let n0 = 0, n1 = 0, n2 = 0;

    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * this.dot2(GRAD2[gi0], x0, y0);
    }

    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * this.dot2(GRAD2[gi1], x1, y1);
    }

    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * this.dot2(GRAD2[gi2], x2, y2);
    }

    // 스케일링: 결과를 [-1, 1] 범위로 정규화
    return 70.0 * (n0 + n1 + n2);
  }

  /** 2D 내적 (grad · [x, y]) */
  private dot2(g: readonly [number, number], x: number, y: number): number {
    return g[0] * x + g[1] * y;
  }
}
