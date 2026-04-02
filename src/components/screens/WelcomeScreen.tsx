/**
 * 웰컴 화면 — 첫 실행 사용자용 온보딩 진입점
 * 환영 메시지 + 가치 제안 → "Get Started" → ProfileWizard 연결
 */
import { motion } from 'motion/react';
import { ElementTransition } from '../transitions/ElementTransition';

interface WelcomeScreenProps {
  /** "시작하기" 클릭 → ProfileWizard로 이동 */
  onGetStarted: () => void;
}

/** 가치 제안 항목 */
const VALUE_PROPS = [
  {
    icon: '🎯',
    title: 'AI 감도 최적화',
    desc: 'Bayesian Optimization으로 당신만의 완벽한 감도를 찾아드립니다',
  },
  {
    icon: '🧬',
    title: 'Aim DNA 분석',
    desc: '8가지 에임 요소를 측정하여 강점과 약점을 정밀 분석합니다',
  },
  {
    icon: '🎮',
    title: '크로스게임 변환',
    desc: '50+ 게임 간 감도를 정확하게 변환합니다',
  },
] as const;

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
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
            과학적 에임 교정 & 훈련 도구
          </p>
        </ElementTransition>

        {/* 가치 제안 카드 */}
        <div className="welcome-features">
          {VALUE_PROPS.map((prop, i) => (
            <ElementTransition key={prop.title} index={i + 2} stagger={0.08}>
              <div className="welcome-feature-card">
                <span className="welcome-feature-icon">{prop.icon}</span>
                <div>
                  <h3 className="welcome-feature-title">{prop.title}</h3>
                  <p className="welcome-feature-desc">{prop.desc}</p>
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
            시작하기
          </motion.button>
        </ElementTransition>
      </div>
    </div>
  );
}
