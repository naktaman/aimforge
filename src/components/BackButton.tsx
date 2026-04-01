/**
 * 공통 뒤로가기 버튼
 */
export function BackButton({ onBack, label = '돌아가기' }: { onBack: () => void; label?: string }) {
  return (
    <button className="btn btn--ghost btn--sm" onClick={onBack}>
      {'←'} {label}
    </button>
  );
}
