/**
 * 공통 뒤로가기 버튼
 */
export function BackButton({ onBack, label = '돌아가기' }: { onBack: () => void; label?: string }) {
  return (
    <button
      onClick={onBack}
      style={{
        background: 'none',
        border: '1px solid #2a2a3e',
        color: '#888',
        borderRadius: 6,
        padding: '6px 14px',
        cursor: 'pointer',
        fontSize: 13,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {'←'} {label}
    </button>
  );
}
