/**
 * 스플래시 화면 — Three.js 파티클 수렴 + 로고 애니메이션
 * 2초 시퀀스: 암전(0.3s) → 파티클 수렴(0.7s) → 텍스트 페이드인(0.5s) → 전환(0.5s)
 * prefers-reduced-motion 시 파티클 스킵, 즉시 로고 표시
 */
import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import * as THREE from 'three';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/* ── 상수 ── */
const PARTICLE_COUNT = 80;
const SPLASH_DURATION_MS = 2000;
/** 시퀀스 타이밍 (초) */
const PHASE = {
  DARK_END: 0.3,        // 암전 종료
  CONVERGE_END: 1.0,    // 파티클 수렴 완료
  TEXT_VISIBLE: 1.0,     // 텍스트 페이드인 시작
  TRANSITION_START: 1.5, // 다음 화면 전환 시작
} as const;

interface SplashScreenProps {
  /** 스플래시 완료 콜백 */
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const completeCalled = useRef(false);

  /** 완료 콜백 (중복 호출 방지) */
  const handleComplete = useCallback(() => {
    if (completeCalled.current) return;
    completeCalled.current = true;
    onComplete();
  }, [onComplete]);

  /** reduced motion: 즉시 완료 */
  useEffect(() => {
    if (reducedMotion) {
      const timer = setTimeout(handleComplete, 500);
      return () => clearTimeout(timer);
    }
  }, [reducedMotion, handleComplete]);

  /** Three.js 파티클 애니메이션 */
  useEffect(() => {
    if (reducedMotion) return;
    const container = canvasRef.current;
    if (!container) return;

    /* 렌더러 초기화 */
    const width = container.clientWidth;
    const height = container.clientHeight;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 5;

    /* 파티클 생성 — 랜덤 위치에서 중앙(0,0,0)으로 수렴 */
    const geometry = new THREE.BufferGeometry();
    const startPositions = new Float32Array(PARTICLE_COUNT * 3);
    const positions = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const i3 = i * 3;
      // 시작 위치: 반경 3~6 사이 구면 랜덤
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 3;
      startPositions[i3] = r * Math.sin(phi) * Math.cos(theta);
      startPositions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      startPositions[i3 + 2] = r * Math.cos(phi);
      // 현재 위치 = 시작 위치
      positions[i3] = startPositions[i3];
      positions[i3 + 1] = startPositions[i3 + 1];
      positions[i3 + 2] = startPositions[i3 + 2];
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0xe94560, // accent color
      size: 0.08,
      transparent: true,
      opacity: 0,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    /* 애니메이션 루프 */
    const startTime = performance.now();
    let animId: number;

    const animate = () => {
      const elapsed = (performance.now() - startTime) / 1000;

      if (elapsed < PHASE.DARK_END) {
        /* Phase 1: 암전 — 파티클 투명 */
        material.opacity = 0;
      } else if (elapsed < PHASE.CONVERGE_END) {
        /* Phase 2: 파티클 수렴 */
        const t = (elapsed - PHASE.DARK_END) / (PHASE.CONVERGE_END - PHASE.DARK_END);
        // easeOutCubic 보간
        const ease = 1 - Math.pow(1 - t, 3);
        material.opacity = Math.min(t * 1.5, 1);

        const posAttr = geometry.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3;
          // 중앙 근처 약간의 오프셋으로 수렴 (완전한 한 점이 아닌 로고 형태)
          const targetX = (Math.random() - 0.5) * 0.3;
          const targetY = (Math.random() - 0.5) * 0.15;
          posAttr.array[i3] = startPositions[i3] * (1 - ease) + targetX * ease;
          posAttr.array[i3 + 1] = startPositions[i3 + 1] * (1 - ease) + targetY * ease;
          posAttr.array[i3 + 2] = startPositions[i3 + 2] * (1 - ease);
        }
        posAttr.needsUpdate = true;
      } else {
        /* Phase 3+: 파티클 유지, 서서히 페이드아웃 */
        const fadeT = Math.min((elapsed - PHASE.CONVERGE_END) / 0.5, 1);
        material.opacity = 1 - fadeT * 0.5;
      }

      renderer.render(scene, camera);

      if (elapsed < SPLASH_DURATION_MS / 1000) {
        animId = requestAnimationFrame(animate);
      }
    };

    animId = requestAnimationFrame(animate);

    /* 완료 타이머 */
    const completeTimer = setTimeout(handleComplete, SPLASH_DURATION_MS);

    /* 클린업 */
    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(completeTimer);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [reducedMotion, handleComplete]);

  return (
    <div className="splash-screen">
      {/* Three.js 캔버스 컨테이너 */}
      <div ref={canvasRef} className="splash-particles" />

      {/* 로고 + 태그라인 오버레이 */}
      <div className="splash-content">
        <motion.h1
          className="splash-logo"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: reducedMotion ? 0 : PHASE.TEXT_VISIBLE,
            duration: reducedMotion ? 0 : 0.4,
            ease: 'easeOut',
          }}
        >
          AimForge
        </motion.h1>
        <motion.p
          className="splash-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: reducedMotion ? 0 : PHASE.TEXT_VISIBLE + 0.15,
            duration: reducedMotion ? 0 : 0.35,
            ease: 'easeOut',
          }}
        >
          Forge Your Perfect Aim
        </motion.p>
      </div>
    </div>
  );
}
