/**
 * 로딩 스피너 — CSS 전용, 라벨 옵션
 */
export function LoadingSpinner({ label = '로딩 중...' }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 40 }}>
      <div style={{
        width: 32, height: 32,
        border: '3px solid #2a2a3e',
        borderTop: '3px solid #e94560',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      {label && <span style={{ color: '#888', fontSize: 13 }}>{label}</span>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
