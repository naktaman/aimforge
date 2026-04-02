/**
 * 공통 뒤로가기 버튼
 */
import { useTranslation } from '../i18n';

export function BackButton({ onBack, label }: { onBack: () => void; label?: string }) {
  const { t } = useTranslation();
  return (
    <button className="btn btn--ghost btn--sm" onClick={onBack}>
      {'←'} {label ?? t('common.back')}
    </button>
  );
}
