/**
 * 커뮤니티 공유 — 크로스헤어/루틴 공유 브라우저
 * 서버 연결 시 /v1/share/* API 호출
 */
import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../utils/apiClient';
import { useAuthStore } from '../stores/authStore';
import { useSettingsStore } from '../stores/settingsStore';

/** 공유 콘텐츠 항목 */
interface SharedItem {
  id: string;
  contentType: 'crosshair' | 'routine';
  shareCode: string;
  data: Record<string, unknown>;
  likes: number;
  downloads: number;
  createdAt: string;
  authorName: string;
}

type ContentFilter = 'all' | 'crosshair' | 'routine';

interface CommunityShareProps {
  onBack: () => void;
}

export function CommunityShare({ onBack }: CommunityShareProps) {
  const { isOnline } = useAuthStore();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [filter, setFilter] = useState<ContentFilter>('all');
  const [loading, setLoading] = useState(false);
  const [importCode, setImportCode] = useState('');

  /** 인기 콘텐츠 로드 */
  const loadPopular = useCallback(async () => {
    if (!isOnline) return;
    setLoading(true);
    try {
      const result = await apiClient.get<{ items: SharedItem[] }>('/share/popular');
      if (result) {
        setItems(result.items);
      }
    } catch {
      // 오프라인 폴백
    } finally {
      setLoading(false);
    }
  }, [isOnline]);

  useEffect(() => { loadPopular(); }, [loadPopular]);

  /** 필터링된 아이템 */
  const filtered = filter === 'all' ? items : items.filter(i => i.contentType === filter);

  /** 크로스헤어 코드 가져오기 */
  const handleImport = useCallback(async () => {
    if (!importCode.trim()) return;

    // AIM- 프리픽스면 로컬 크로스헤어 코드
    if (importCode.startsWith('AIM-')) {
      const success = useSettingsStore.getState().importCrosshairCode(importCode);
      if (success) {
        setImportCode('');
        alert('크로스헤어를 적용했습니다!');
      } else {
        alert('유효하지 않은 코드입니다.');
      }
      return;
    }

    // 서버 공유 코드
    if (isOnline) {
      const result = await apiClient.get<SharedItem>(`/share/crosshair/${importCode}`);
      if (result) {
        // 크로스헤어 데이터 적용
        const config = result.data as Record<string, unknown>;
        useSettingsStore.getState().setCrosshair(config);
        setImportCode('');
        alert('크로스헤어를 적용했습니다!');
      } else {
        alert('코드를 찾을 수 없습니다.');
      }
    }
  }, [importCode, isOnline]);

  /** 내 크로스헤어 공유 */
  const handleShareMyCrosshair = useCallback(async () => {
    if (!isOnline) return;
    const crosshair = useSettingsStore.getState().crosshair;
    const result = await apiClient.post<{ shareCode: string }>('/share/crosshair', {
      data: crosshair,
    });
    if (result) {
      alert(`공유 코드: ${result.shareCode}`);
    }
  }, [isOnline]);

  return (
    <div className="community-share">
      <div className="section-header">
        <h2>커뮤니티</h2>
        <button className="btn-secondary" onClick={onBack}>돌아가기</button>
      </div>

      {!isOnline && (
        <p className="text-secondary">서버에 연결되지 않았습니다. 커뮤니티 기능은 온라인 모드에서만 사용 가능합니다.</p>
      )}

      {/* 코드 가져오기 */}
      <div className="share-import">
        <input
          type="text"
          value={importCode}
          onChange={(e) => setImportCode(e.target.value)}
          placeholder="공유 코드 또는 AIM- 크로스헤어 코드"
        />
        <button className="btn-primary btn-sm" onClick={handleImport}>가져오기</button>
        {isOnline && (
          <button className="btn-secondary btn-sm" onClick={handleShareMyCrosshair}>
            내 크로스헤어 공유
          </button>
        )}
      </div>

      {/* 필터 */}
      <div className="share-filter">
        <button className={`btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>전체</button>
        <button className={`btn-sm ${filter === 'crosshair' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('crosshair')}>크로스헤어</button>
        <button className={`btn-sm ${filter === 'routine' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('routine')}>루틴</button>
      </div>

      {loading && <p className="text-secondary">로딩 중...</p>}

      {/* 공유 아이템 그리드 */}
      <div className="share-grid">
        {filtered.map(item => (
          <div key={item.id} className="share-card">
            <div className="share-type-badge">{item.contentType === 'crosshair' ? '크로스헤어' : '루틴'}</div>
            <div className="share-code">{item.shareCode}</div>
            <div className="share-author">by {item.authorName}</div>
            <div className="share-stats">
              <span>♥ {item.likes}</span>
              <span>↓ {item.downloads}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
