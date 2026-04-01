/**
 * 로딩 스피너 — CSS 클래스 기반
 */
export function LoadingSpinner({ label = '로딩 중...' }: { label?: string }) {
  return (
    <div className="spinner">
      <div className="spinner__ring" />
      {label && <span className="spinner__label">{label}</span>}
    </div>
  );
}
