/**
 * 범용 빈 상태 컴포넌트
 * 데이터가 없거나 초기 상태일 때 표시하는 안내 UI
 */
import type { ReactNode } from 'react';

interface EmptyStateProps {
  /** 상단 아이콘 (SVG 또는 이모지 등) */
  icon?: ReactNode;
  /** 제목 텍스트 */
  title: string;
  /** 설명 텍스트 */
  description?: string;
  /** CTA 버튼 등 하단 액션 영역 */
  action?: ReactNode;
}

/** 빈 상태 안내 UI — 아이콘 + 제목 + 설명 + 액션 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state__icon">{icon}</div>}
      <h3 className="empty-state__title">{title}</h3>
      {description && <p className="empty-state__desc">{description}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
