/**
 * 루틴 목록 — 저장된 루틴 보기/실행/삭제 + 새 루틴 생성
 */
import { useEffect, useState, useCallback } from 'react';
import { useRoutineStore } from '../stores/routineStore';
import { useTranslation } from '../i18n';

interface RoutineListProps {
  onBack: () => void;
  onEdit: (routineId: number, routineName: string) => void;
  onPlay: (routineId: number) => void;
}

export function RoutineList({ onBack, onEdit, onPlay }: RoutineListProps) {
  const { routines, loading, loadRoutines, createRoutine, deleteRoutine } = useRoutineStore();
  const { t } = useTranslation();
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
        <h2>{t('routine.customRoutine')}</h2>
        <div>
          <button className="btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ {t('routine.newRoutine')}</button>
          <button className="btn-secondary btn-sm" onClick={onBack} style={{ marginLeft: 8 }}>{t('common.back')}</button>
        </div>
      </div>

      {loading && <p className="text-secondary">{t('common.loading')}</p>}

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
              <button className="btn-primary btn-sm" onClick={() => onPlay(r.id)}>{t('common.run')}</button>
              <button className="btn-secondary btn-sm" onClick={() => onEdit(r.id, r.name)}>{t('common.edit')}</button>
              <button className="btn-danger btn-sm" onClick={() => deleteRoutine(r.id)}>{t('common.delete')}</button>
            </div>
          </div>
        ))}
        {routines.length === 0 && !loading && (
          <p className="text-secondary">{t('routine.noRoutines')}</p>
        )}
      </div>

      {/* 생성 폼 */}
      {showCreate && (
        <div className="routine-create-form">
          <h3>{t('routine.newRoutine')}</h3>
          <label>
            {t('common.name')}
            <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('routine.namePlaceholder')} />
          </label>
          <label>
            {t('routine.descOptional')}
            <input type="text" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder={t('routine.descPlaceholder')} />
          </label>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleCreate}>{t('common.create')}</button>
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
