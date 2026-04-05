/**
 * 웰컴 화면 — 프로 게이밍 소프트웨어 히어로 + 스펙 스트립 + CTA
 * 템플릿 카드 구조 탈피, 정보 밀도 높은 미니멀 레이아웃
 */
import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../../i18n';
import { ElementTransition } from '../transitions/ElementTransition';

interface WelcomeScreenProps {
  /** "시작하기" 클릭 → ProfileWizard로 이동 */
  onGetStarted: () => void;
}

/** 핵심 스펙 데이터 — 아이콘 + 수치/설명 */
const SPEC_ITEMS = [
  { iconType: 'target' as const, valueKey: 'welcome.specGP', descKey: 'welcome.aiOptTitle' },
  { iconType: 'dna' as const, valueKey: 'welcome.specDNA', descKey: 'welcome.dnaTitle' },
  { iconType: 'convert' as const, valueKey: 'welcome.specCross', descKey: 'welcome.crossGameTitle' },
] as const;

/** 인라인 SVG 아이콘 (20px, 프로 게이밍 UI용 단색) */
function SpecIcon({ type }: { type: 'target' | 'dna' | 'convert' }) {
  const icons: Record<string, React.ReactNode> = {
    /* 크로스헤어/타겟 */
    target: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" opacity="0.4" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    ),
    /* DNA 나선 */
    dna: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 4C7 4 7 8 12 10C17 12 17 16 17 16" />
        <path d="M17 4C17 4 17 8 12 10C7 12 7 16 7 16" />
        <path d="M7 20C7 20 7 17 10 15.5" />
        <path d="M17 20C17 20 17 17 14 15.5" />
      </svg>
    ),
    /* 변환 화살표 */
    convert: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3L21 7L17 11" />
        <path d="M3 7H21" />
        <path d="M7 21L3 17L7 13" />
        <path d="M21 17H3" />
      </svg>
    ),
  };
  return <span className="welcome-spec-icon">{icons[type]}</span>;
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="welcome-screen">
      {/* 배경 — 미묘한 그리드 + 글로우 */}
      <div className="welcome-bg-glow welcome-bg-glow--top" />
      <div className="welcome-bg-grid" />

      <div className="welcome-content">
        {/* 히어로 — 타이틀 + 서브 한 줄 */}
        <div className="welcome-hero">
          <ElementTransition index={0}>
            <h1 className="welcome-title">
              <span className="welcome-accent">AimForge</span>
            </h1>
          </ElementTransition>

          <ElementTransition index={1}>
            <p className="welcome-subtitle">
              Forge Your Perfect Aim
            </p>
          </ElementTransition>

          <ElementTransition index={2}>
            <p className="welcome-tagline">
              {t('welcome.subtitle')}
            </p>
          </ElementTransition>
        </div>

        {/* 스펙 스트립 — 카드 대신 수평 인라인 스펙 3개 */}
        <ElementTransition index={3}>
          <div className="welcome-specs">
            {SPEC_ITEMS.map((spec) => (
              <div key={spec.descKey} className="welcome-spec-item">
                <SpecIcon type={spec.iconType} />
                <div className="welcome-spec-text">
                  <span className="welcome-spec-value">{t(spec.valueKey)}</span>
                  <span className="welcome-spec-label">{t(spec.descKey)}</span>
                </div>
              </div>
            ))}
          </div>
        </ElementTransition>

        {/* CTA — 미니멀 버튼 + 보조 텍스트 */}
        <ElementTransition index={4}>
          <div className="welcome-cta-group">
            <motion.button
              className="btn-primary welcome-cta"
              onClick={onGetStarted}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
            >
              {t('onboarding.getStarted')}
            </motion.button>
            <span className="welcome-cta-hint">{t('welcome.ctaHint')}</span>
          </div>
        </ElementTransition>
      </div>
    </div>
  );
}
