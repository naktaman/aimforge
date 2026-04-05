/**
 * 결과 등급 표시 + 애니메이션
 * S/A/B/C/D 등급을 정확도 기반으로 결정하고, scale+glow 애니메이션 표현
 */
import { motion } from 'motion/react';

/** 등급 정의 — 정확도 기준 */
interface GradeInfo {
  letter: string;
  color: string;
  minAccuracy: number;
}

const GRADES: GradeInfo[] = [
  { letter: 'S', color: '#FFD700', minAccuracy: 0.9 },
  { letter: 'A', color: '#10B981', minAccuracy: 0.75 },
  { letter: 'B', color: '#D4960A', minAccuracy: 0.6 },
  { letter: 'C', color: '#F59E0B', minAccuracy: 0.45 },
  { letter: 'D', color: '#6B7280', minAccuracy: 0 },
];

/** 정확도(0-1)에서 등급 정보 계산 */
export function getGrade(accuracy: number): GradeInfo {
  return GRADES.find(g => accuracy >= g.minAccuracy) ?? GRADES[GRADES.length - 1];
}

interface ResultGradeProps {
  accuracy: number;
}

export function ResultGrade({ accuracy }: ResultGradeProps) {
  const grade = getGrade(accuracy);

  return (
    <motion.div
      className="result-grade"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: [0, 1.2, 1], opacity: 1 }}
      transition={{ duration: 0.6, times: [0, 0.6, 1], ease: 'easeOut', delay: 0.5 }}
    >
      {/* 등급 글로우 배경 */}
      <motion.div
        className="result-grade__glow"
        style={{ background: `radial-gradient(circle, ${grade.color}33 0%, transparent 70%)` }}
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* 등급 글자 */}
      <motion.span
        className="result-grade__letter"
        style={{ color: grade.color, textShadow: `0 0 40px ${grade.color}, 0 0 80px ${grade.color}55` }}
      >
        {grade.letter}
      </motion.span>
    </motion.div>
  );
}
