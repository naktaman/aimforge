/**
 * 게임 프로필 매니저 — 게임별 감도/DPI/FOV 프로필 CRUD
 */
import { useEffect, useState, useCallback } from 'react';
import { useGameProfileStore, type GameProfile } from '../stores/gameProfileStore';
import { useTranslation } from '../i18n';

interface GameProfileManagerProps {
  onBack: () => void;
}

/** 빈 폼 초기값 */
const EMPTY_FORM = { gameName: '', dpi: 800, sensitivity: 1.0, fov: 103, scopeMultiplier: 1.0 };

export function GameProfileManager({ onBack }: GameProfileManagerProps) {
  const { profiles, loading, loadProfiles, createProfile, updateProfile, deleteProfile, setActive } = useGameProfileStore();
  const { t } = useTranslation();
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  /** 새 프로필 생성 폼 열기 */
  const handleNew = useCallback(() => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }, []);

  /** 수정 폼 열기 */
  const handleEdit = useCallback((profile: GameProfile) => {
    setEditing(profile.id);
    setForm({
      gameName: profile.gameName,
      dpi: profile.dpi,
      sensitivity: profile.sensitivity,
      fov: profile.fov,
      scopeMultiplier: profile.scopeMultiplier,
    });
    setShowForm(true);
  }, []);

  /** 저장 (생성 또는 수정) */
  const handleSave = useCallback(async () => {
    if (!form.gameName.trim()) return;
    if (editing !== null) {
      await updateProfile(editing, form.gameName, form.dpi, form.sensitivity, form.fov, form.scopeMultiplier);
    } else {
      await createProfile(form.gameName, form.dpi, form.sensitivity, form.fov, form.scopeMultiplier);
    }
    setShowForm(false);
    setEditing(null);
  }, [editing, form, createProfile, updateProfile]);

  /** 삭제 확인 */
  const handleDelete = useCallback(async (id: number) => {
    await deleteProfile(id);
  }, [deleteProfile]);

  return (
    <div className="game-profiles">
      <div className="section-header">
        <h2>{t('profile.title')}</h2>
        <div>
          <button className="btn-primary btn-sm" onClick={handleNew}>+ {t('profile.addNew')}</button>
          <button className="btn-secondary btn-sm" onClick={onBack} style={{ marginLeft: 8 }}>{t('common.back')}</button>
        </div>
      </div>

      {loading && <p className="text-secondary">{t('common.loading')}</p>}

      {/* 프로필 목록 */}
      <div className="profile-list">
        {profiles.map(p => (
          <div key={p.id} className={`profile-card ${p.isActive ? 'active' : ''}`}>
            <div className="profile-info">
              <h3>{p.gameName} {p.isActive && <span className="badge-active">Active</span>}</h3>
              <div className="profile-stats">
                <span>DPI: {p.dpi}</span>
                <span>{t('settings.sensitivity')}: {p.sensitivity}</span>
                <span>FOV: {p.fov}</span>
                <span>Scope: {p.scopeMultiplier}x</span>
              </div>
            </div>
            <div className="profile-actions">
              {!p.isActive && (
                <button className="btn-sm btn-primary" onClick={() => setActive(p.id)}>{t('common.apply')}</button>
              )}
              <button className="btn-sm btn-secondary" onClick={() => handleEdit(p)}>{t('profile.editProfile')}</button>
              <button className="btn-sm btn-danger" onClick={() => handleDelete(p.id)}>{t('common.delete')}</button>
            </div>
          </div>
        ))}
        {profiles.length === 0 && !loading && (
          <p className="text-secondary">{t('profile.noProfiles')}</p>
        )}
      </div>

      {/* 생성/수정 폼 */}
      {showForm && (
        <div className="profile-form">
          <h3>{editing !== null ? t('profile.editProfile') : t('profile.addNew')}</h3>
          <div className="form-grid">
            <label>
              {t('settings.game')}
              <input
                type="text"
                value={form.gameName}
                onChange={(e) => setForm(f => ({ ...f, gameName: e.target.value }))}
                placeholder="예: Valorant, CS2, Overwatch 2"
              />
            </label>
            <label>
              DPI
              <input
                type="number"
                value={form.dpi}
                onChange={(e) => setForm(f => ({ ...f, dpi: parseInt(e.target.value, 10) || 800 }))}
              />
            </label>
            <label>
              {t('settings.sensitivity')}
              <input
                type="number"
                step="0.01"
                value={form.sensitivity}
                onChange={(e) => setForm(f => ({ ...f, sensitivity: parseFloat(e.target.value) || 1 }))}
              />
            </label>
            <label>
              FOV
              <input
                type="number"
                step="0.1"
                value={form.fov}
                onChange={(e) => setForm(f => ({ ...f, fov: parseFloat(e.target.value) || 103 }))}
              />
            </label>
            <label>
              Scope Multiplier
              <input
                type="number"
                step="0.01"
                value={form.scopeMultiplier}
                onChange={(e) => setForm(f => ({ ...f, scopeMultiplier: parseFloat(e.target.value) || 1 }))}
              />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleSave}>{t('common.save')}</button>
            <button className="btn-secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
