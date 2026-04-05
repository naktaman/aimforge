/**
 * Steam 로그인 컴포넌트 — 서버 연결 시 Steam OpenID 인증
 * 오프라인 시 비활성, 로그인 상태 표시
 */
import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from '../i18n';

export function SteamLogin() {
  const { isLoggedIn, isOnline, user, loading, checkOnline, logout } = useAuthStore();
  const { t } = useTranslation();

  /** 앱 시작 시 서버 연결 확인 */
  useEffect(() => { checkOnline(); }, [checkOnline]);

  /** Steam 로그인 시작 (Steam OpenID 팝업) */
  const handleLogin = useCallback(() => {
    // Steam OpenID URL로 리다이렉트 — 서버 콜백에서 JWT 수신
    // 실제 구현은 Tauri shell open + 로컬 콜백 서버 필요
    /* Steam OpenID 로그인 — Tauri shell open + 로컬 콜백 서버 필요 (미구현) */
  }, []);

  if (!isOnline) {
    return (
      <div className="steam-login offline">
        <span className="status-dot offline" />
        <span>{t('steam.offline')}</span>
      </div>
    );
  }

  if (isLoggedIn && user) {
    return (
      <div className="steam-login logged-in">
        <span className="status-dot online" />
        {user.avatarUrl && <img src={user.avatarUrl} alt="" className="avatar" />}
        <span>{user.displayName}</span>
        <button className="btn-sm btn-secondary" onClick={logout}>{t('steam.logout')}</button>
      </div>
    );
  }

  return (
    <div className="steam-login">
      <span className="status-dot online" />
      <button className="btn-sm btn-primary" onClick={handleLogin} disabled={loading}>
        {loading ? t('steam.loggingIn') : t('steam.login')}
      </button>
    </div>
  );
}
