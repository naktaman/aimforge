/**
 * API 클라이언트 — 서버 연동용 fetch 래퍼
 * 오프라인 폴백, JWT 토큰 관리, 자동 재시도
 */

const DEFAULT_BASE_URL = 'http://localhost:8000';
const API_VERSION = '/v1';

/** API 클라이언트 싱글턴 */
class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = DEFAULT_BASE_URL;
  }

  /** 서버 URL 설정 */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /** JWT 토큰 설정 */
  setToken(token: string | null): void {
    this.token = token;
  }

  /** GET 요청 */
  async get<T>(path: string): Promise<T | null> {
    return this.request<T>('GET', path);
  }

  /** POST 요청 */
  async post<T>(path: string, body?: unknown): Promise<T | null> {
    return this.request<T>('POST', path, body);
  }

  /** 서버 연결 가능 여부 확인 */
  async isOnline(): Promise<boolean> {
    try {
      const resp = await fetch(`${this.baseUrl}/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return resp.ok;
    } catch {
      return false;
    }
  }

  /** 공통 요청 처리 — 오프라인 시 null 반환 */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T | null> {
    const url = `${this.baseUrl}${API_VERSION}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      });

      if (!resp.ok) {
        console.warn(`[API] ${method} ${path} → ${resp.status}`);
        return null;
      }

      return await resp.json() as T;
    } catch {
      // 오프라인이면 null 반환 (graceful 폴백)
      return null;
    }
  }
}

export const apiClient = new ApiClient();
