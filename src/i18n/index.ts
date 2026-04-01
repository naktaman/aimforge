/**
 * 경량 i18n 시스템
 * useTranslation() 훅으로 현재 로케일에 맞는 번역 문자열 조회
 */
import { useUiStore, type AppLocale } from '../stores/uiStore';
import ko from './ko.json';
import en from './en.json';

/** 로케일별 번역 맵 */
const translations: Record<AppLocale, Record<string, string>> = { ko, en };

/**
 * 번역 훅 — t(key)로 현재 로케일의 문자열 반환
 * fallback: 현재 로케일 → ko → key 자체
 */
export function useTranslation() {
  const locale = useUiStore((s) => s.locale);

  const t = (key: string): string => {
    return translations[locale]?.[key]
      ?? translations.ko[key]
      ?? key;
  };

  return { t, locale };
}
