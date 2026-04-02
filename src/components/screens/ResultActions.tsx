/**
 * 결과화면 CTA 버튼 (Action Zone)
 * 다시하기 (Space), 메인메뉴 (Esc) — 키보드 단축키 포함
 */
import { useEffect } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../../i18n';

interface ResultActionsProps {
  onRetry: () => void;
  onMainMenu: () => void;
}

export function ResultActions({ onRetry, onMainMenu }: ResultActionsProps) {
  const { t } = useTranslation();
  /** 키보드 단축키: Space=다시하기, Esc=메인메뉴 */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        onRetry();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        onMainMenu();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onRetry, onMainMenu]);

  return (
    <motion.div
      className="result-actions"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 3.0, ease: 'easeOut' }}
    >
      <button className="result-actions__retry" onClick={onRetry}>
        {t('result.retry')}
        <span className="result-actions__hint">Space</span>
      </button>
      <button className="result-actions__menu" onClick={onMainMenu}>
        {t('result.mainMenu')}
        <span className="result-actions__hint">Esc</span>
      </button>
    </motion.div>
  );
}
