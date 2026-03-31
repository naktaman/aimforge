/**
 * 루틴 목록 — 저장된 루틴 보기/실행/삭제 + 새 루틴 생성
 */
import { useEffect, useState, useCallback } from 'react';
import { useRoutineStore } from '../stores/routineStore';

interface RoutineListProps {
  onBack: () => void;
  onEdit: (routineId: number, routineName: string) => void;
  onPlay: (routineId: number) => void;
}

export function RoutineList({ onBack, onEdit, onPlay }: RoutineListProps) {
  const { routines, loading, loadRoutines, createRoutine, deleteRoutine } = useRoutineStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  useEffect(() => { loadRoutines(); }, [loadRoutines]);

  /** 새 루틴 생성 */
  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    const id = await createRoutine(newName, newDesc);
    if (id !== null) {
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      onEdit(id, newName);
    }
  }, [newName, newDesc, createRoutine, onEdit]);

  /** 시간 포맷 (초 → 분:초) */
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0 ? `${m}분 ${s}초` : `${s}초`;
  };

  return (
    <div className="routine-list-page">
      <div className="section-header">
        <h2>커스텀 루틴</h2>
        <div>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ 새 루틴</button>
          <button className="btn-secondary btn-sm" onClick={onBack} style={{ marginLeft: 8 }}>돌아가기</button>
        </div>
      </div>

      {loading && <p className="text-secondary">로딩 중...</p>}

      {/* 루틴 카드 목록 */}
      <div className="routine-cards">
        {routines.map(r => (
          <div key={r.id} className="routine-card">
            <div className="routine-info">
              <h3>{r.name}</h3>
              {r.description && <p className="text-secondary">{r.description}</p>}
              <span className="routine-duration">{formatTime(r.totalDurationSec)}</span>
            </div>
            <div className="routine-actions">
              <button className="btn-primary btn-sm" onClick={() => onPlay(r.id)}>실행</button>
              <button className="btn-secondary btn-sm" onClick={() => onEdit(r.id, r.name)}>편집</button>
              <button className="btn-danger btn-sm" onClick={() => deleteRoutine(r.id)}>삭제</button>
            </div>
          </div>
        ))}
        {routines.length === 0 && !loading && (
          <p className="text-secondary">등록된 루틴이 없습니다.</p>
        )}
      </div>

      {/* 생성 폼 */}
      {showCreate && (
        <div className="routine-create-form">
          <h3>새 루틴</h3>
          <label>
            이름
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 워밍업 루틴" />
          </label>
          <label>
            설명 (선택)
            <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="간단한 설명" />
          </label>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleCreate}>생성</button>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>취소</button>
          </div>
        </div>
      )}
    </div>
  );
}
