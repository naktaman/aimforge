/**
 * 웰컴 화면 — 프로 게이밍 소프트웨어 수준 히어로 + 기능 카드 + CTA
 * 화면 정중앙 레이아웃, CSS 파티클 배경, gradient 텍스트
 */
import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from '../../i18n';
import { ElementTransition } from '../transitions/ElementTransition';

interface WelcomeScreenProps {
  /** "시작하기" 클릭 → ProfileWizard로 이동 */
  onGetStarted: () => void;
}

/** 기능 카드 데이터 — SVG 아이콘 + i18n 키 */
const FEATURE_CARDS = [
  {
    iconType: 'target' as const,
    titleKey: 'welcome.aiOptTitle',
    descKey: 'welcome.aiOptDesc',
  },
  {
    iconType: 'dna' as const,
    titleKey: 'welcome.dnaTitle',
    descKey: 'welcome.dnaDesc',
  },
  {
    iconType: 'convert' as const,
    titleKey: 'welcome.crossGameTitle',
    descKey: 'welcome.crossGameDesc',
  },
] as const;

/** CSS�� 만든 아이콘 컴포넌트 (원 안에 SVG 심볼) */
function FeatureIcon({ type }: { type: 'target' | 'dna' | 'convert' }) {
  const paths: Record<string, React.ReactNode> = {
    /* 크로스헤어/타겟 아이콘 */
    target: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
        <line x1="12" y1="2" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="22" />
        <line x1="2" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="22" y2="12" />
      </svg>
    ),
    /* DNA 나선 아이콘 */
    dna: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M7 4C7 4 7 8 12 10C17 12 17 16 17 16" />
        <path d="M17 4C17 4 17 8 12 10C7 12 7 16 7 16" />
        <path d="M7 20C7 20 7 17 10 15.5" />
        <path d="M17 20C17 20 17 17 14 15.5" />
        <line x1="8" y1="6" x2="16" y2="6" opacity="0.5" />
        <line x1="8" y1="14" x2="16" y2="14" opacity="0.5" />
      </svg>
    ),
    /* 변환/화살표 순환 아이콘 */
    convert: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3L21 7L17 11" />
        <path d="M3 7H21" />
        <path d="M7 21L3 17L7 13" />
        <path d="M21 17H3" />
      </svg>
    ),
  };

  return (
    <div className="welcome-icon-circle">
      {paths[type]}
    </div>
  );
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="welcome-screen">
      {/* 배경 장식 요소 */}
      <div className="welcome-bg-glow welcome-bg-glow--top" />
      <div className="welcome-bg-glow welcome-bg-glow--bottom" />
      <div className="welcome-bg-grid" />

      <div className="welcome-content">
        {/* 히어로 섹션 */}
        <div className="welcome-hero">
          <ElementTransition index={0}>
            <h1 className="welcome-title">
              Welcome to <span className="welcome-accent">AimForge</span>
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

        {/* 기능 카드 3열 그리드 */}
        <div className="welcome-features-grid">
          {FEATURE_CARDS.map((card, i) => (
            <ElementTransition key={card.titleKey} index={i + 3} stagger={0.1}>
              <motion.div
                className="welcome-feature-card"
                whileHover={{ y: -4, scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <FeatureIcon type={card.iconType} />
                <h3 className="welcome-feature-title">{t(card.titleKey)}</h3>
                <p className="welcome-feature-desc">{t(card.descKey)}</p>
              </motion.div>
            </ElementTransition>
          ))}
        </div>

        {/* CTA 버튼 */}
        <ElementTransition index={6} stagger={0.1}>
          <motion.button
            className="btn-primary welcome-cta"
            onClick={onGetStarted}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
          >
            {t('onboarding.getStarted')}
          </motion.button>
        </ElementTransition>
      </div>
    </div>
  );
}
