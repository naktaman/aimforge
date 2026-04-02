/**
 * 웰컴 화면 — 첫 실행 사용자용 온보딩 진입점
 * 환영 메시지 + 가치 제안 → "Get Started" → ProfileWizard 연결
 */
import { motion } from 'motion/react';
import { useTranslation } from '../../i18n';
import { ElementTransition } from '../transitions/ElementTransition';

interface WelcomeScreenProps {
  /** "시작하기" 클릭 → ProfileWizard로 이동 */
  onGetStarted: () => void;
}

/** 가치 제안 항목 — i18n 키 사용 */
const VALUE_PROPS = [
  { icon: '🎯', titleKey: 'welcome.aiOptTitle', descKey: 'welcome.aiOptDesc' },
  { icon: '🧬', titleKey: 'welcome.dnaTitle', descKey: 'welcome.dnaDesc' },
  { icon: '🎮', titleKey: 'welcome.crossGameTitle', descKey: 'welcome.crossGameDesc' },
] as const;

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="welcome-screen">
      <div className="welcome-card">
        {/* 헤더 */}
        <ElementTransition index={0}>
          <h1 className="welcome-title">
            Welcome to <span className="welcome-accent">AimForge</span>
          </h1>
        </ElementTransition>

        <ElementTransition index={1}>
          <p className="welcome-subtitle">
            {t('welcome.subtitle')}
          </p>
        </ElementTransition>

        {/* 가치 제안 카드 */}
        <div className="welcome-features">
          {VALUE_PROPS.map((prop, i) => (
            <ElementTransition key={prop.titleKey} index={i + 2} stagger={0.08}>
              <div className="welcome-feature-card">
                <span className="welcome-feature-icon">{prop.icon}</span>
                <div>
                  <h3 className="welcome-feature-title">{t(prop.titleKey)}</h3>
                  <p className="welcome-feature-desc">{t(prop.descKey)}</p>
                </div>
              </div>
            </ElementTransition>
          ))}
        </div>

        {/* CTA 버튼 */}
        <ElementTransition index={5} stagger={0.08}>
          <motion.button
            className="btn-primary welcome-cta"
            onClick={onGetStarted}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            {t('onboarding.getStarted')}
          </motion.button>
        </ElementTransition>
      </div>
    </div>
  );
}
