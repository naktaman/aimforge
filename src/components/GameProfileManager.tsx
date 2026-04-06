/**
 * 게임 프로필 매니저 — gameDatabase 59개 게임 연동 + 동적 감도 필드 폼
 * 게임별 sensitivityFields 배열로 폼 동적 생성, cm/360 실시간 계산
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { GAME_DATABASE, type GameEntry, type GameSensField } from '../data/gameDatabase';
import { gameSensToCm360 } from '../utils/physics';
import { useGameProfileStore, type GameProfile } from '../stores/gameProfileStore';
import { useTranslation } from '../i18n';
import { GameSelector, getGameInitials, getCategoryColor } from './GameSelector';

interface GameProfileManagerProps {
  onBack: () => void;
}

/** 폼 상태 — 감도 필드는 string으로 관리 (타이핑 도중 빈 값 허용) */
interface FormState {
  dpi: number;
  fov: number;
  /** 감도 필드 key → string 값 매핑 */
  sensFields: Record<string, string>;
}

/** 뷰 모드 */
type ViewMode = 'list' | 'create' | 'edit';

/** sensFieldsJson 파싱 — 에러 시 빈 객체 반환 */
function parseSensFields(json: string): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, number>;
    }
  } catch (e) {
    console.error('sensFieldsJson 파싱 실패:', e);
  }
  return {};
}

/** 감도 필드 값을 숫자로 변환 (빈 값이면 기본값 사용) */
function sensFieldToNumber(value: string, defaultValue: number): number {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/** 게임 감도 필드 요약 텍스트 생성 (프로필 카드용) */
function summarizeSensFields(
  sensJson: string,
  gameEntry: GameEntry | undefined,
  maxShow: number = 3,
): string {
  const fields = parseSensFields(sensJson);
  const defs = gameEntry?.sensitivityFields ?? [];
  const entries = defs
    .filter(d => fields[d.key] !== undefined)
    .map(d => `${d.label}: ${fields[d.key]}`);

  if (entries.length <= maxShow) return entries.join(' · ');
  return entries.slice(0, maxShow).join(' · ') + ` +${entries.length - maxShow}개 더`;
}

export function GameProfileManager({ onBack }: GameProfileManagerProps): React.JSX.Element {
  const {
    profiles, isLoading: loading,
    loadProfiles, createProfile, updateProfile, deleteProfile, setActive,
  } = useGameProfileStore();
  const { t } = useTranslation();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedGame, setSelectedGame] = useState<GameEntry | null>(null);

  /** 폼 상태 */
  const [form, setForm] = useState<FormState>({ dpi: 800, fov: 103, sensFields: {} });

  useEffect(() => { loadProfiles(); }, [loadProfiles]);

  /** 선택된 게임의 sensitivityFields 정의 */
  const sensFieldDefs: GameSensField[] = useMemo(
    () => selectedGame?.sensitivityFields ?? [],
    [selectedGame],
  );

  /** cm/360 실시간 계산 — 첫 번째 감도 필드 기준 */
  const cm360Preview = useMemo((): number | null => {
    if (!selectedGame || sensFieldDefs.length === 0) return null;
    const firstField = sensFieldDefs[0];
    const sensValue = sensFieldToNumber(
      form.sensFields[firstField.key] ?? '',
      firstField.defaultValue,
    );
    if (sensValue <= 0 || form.dpi <= 0) return null;
    return gameSensToCm360(sensValue, form.dpi, selectedGame.yaw);
  }, [selectedGame, sensFieldDefs, form.sensFields, form.dpi]);

  /** 게임 선택 시 — FOV + 감도 기본값 세팅 */
  const handleGameSelect = useCallback((game: GameEntry): void => {
    setSelectedGame(game);
    const defaultSens: Record<string, string> = {};
    for (const field of game.sensitivityFields) {
      defaultSens[field.key] = String(field.defaultValue);
    }
    setForm(f => ({
      ...f,
      fov: game.defaultFov,
      sensFields: defaultSens,
    }));
  }, []);

  /** 새 프로필 생성 모드 진입 */
  const handleNew = useCallback((): void => {
    setEditingId(null);
    setSelectedGame(null);
    setForm({ dpi: 800, fov: 103, sensFields: {} });
    setViewMode('create');
  }, []);

  /** 수정 모드 진입 — sensFieldsJson에서 값 복원 */
  const handleEdit = useCallback((profile: GameProfile): void => {
    setEditingId(profile.id);
    const gameEntry = GAME_DATABASE.find(g => g.id === profile.gameId);
    setSelectedGame(gameEntry ?? null);

    // sensFieldsJson에서 감도 값 복원
    const savedFields = parseSensFields(profile.sensFieldsJson);
    const sensFields: Record<string, string> = {};
    const defs = gameEntry?.sensitivityFields ?? [];
    for (const def of defs) {
      sensFields[def.key] = String(savedFields[def.key] ?? def.defaultValue);
    }

    setForm({
      dpi: profile.customDpi,
      fov: profile.customFov,
      sensFields,
    });
    setViewMode('edit');
  }, []);

  /** 저장 (생성 또는 수정) */
  const handleSave = useCallback(async (): Promise<void> => {
    if (!selectedGame) return;

    // 감도 필드 값을 숫자로 변환
    const sensValues: Record<string, number> = {};
    for (const def of sensFieldDefs) {
      sensValues[def.key] = sensFieldToNumber(
        form.sensFields[def.key] ?? '',
        def.defaultValue,
      );
    }

    // 첫 번째 감도 필드 = customSens
    const mainSens = sensFieldDefs.length > 0
      ? sensValues[sensFieldDefs[0].key]
      : 1.0;

    const cm360 = gameSensToCm360(mainSens, form.dpi, selectedGame.yaw);
    const sensFieldsJson = JSON.stringify(sensValues);

    if (editingId !== null) {
      await updateProfile({
        id: editingId,
        customSens: mainSens,
        customDpi: form.dpi,
        customFov: form.fov,
        customCm360: cm360,
        sensFieldsJson,
      });
    } else {
      await createProfile({
        profileId: 1, // 단일 사용자 — user profiles.id
        gameId: selectedGame.id,
        gameName: selectedGame.name,
        customSens: mainSens,
        customDpi: form.dpi,
        customFov: form.fov,
        customCm360: cm360,
        sensFieldsJson,
      });
    }

    setViewMode('list');
    setEditingId(null);
  }, [selectedGame, sensFieldDefs, form, editingId, createProfile, updateProfile]);

  /** 삭제 */
  const handleDelete = useCallback(async (id: number): Promise<void> => {
    await deleteProfile(id);
  }, [deleteProfile]);

  /** 뒤로 (폼 → 목록, 목록 → onBack) */
  const handleBack = useCallback((): void => {
    if (viewMode !== 'list') {
      setViewMode('list');
      setEditingId(null);
    } else {
      onBack();
    }
  }, [viewMode, onBack]);

  /** 감도 필드 값 변경 핸들러 */
  const handleSensChange = useCallback((key: string, value: string): void => {
    setForm(f => ({
      ...f,
      sensFields: { ...f.sensFields, [key]: value },
    }));
  }, []);

  // ─── 렌더링 ───

  /** 프로필 카드 렌더링 */
  const renderProfileCard = (p: GameProfile): React.JSX.Element => {
    const gameEntry = GAME_DATABASE.find(g => g.id === p.gameId);
    const avatarColor = gameEntry
      ? getCategoryColor(gameEntry.category)
      : 'var(--color-cat-arena)';
    const sensSummary = summarizeSensFields(p.sensFieldsJson, gameEntry);

    return (
      <div key={p.id} className={`profile-card ${p.isActive ? 'active' : ''}`}>
        <div className="profile-info">
          <div className="profile-header-row">
            <div className="game-avatar game-avatar--sm" style={{ background: avatarColor }}>
              {getGameInitials(p.gameName)}
            </div>
            <div>
              <h3>
                {p.gameName}
                {p.isActive && <span className="badge-active">Active</span>}
              </h3>
              {gameEntry && (
                <span className="profile-category-tag" style={{ color: avatarColor }}>
                  {gameEntry.category.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* 감도 필드 요약 */}
          <div className="profile-stats">
            <span>DPI: {p.customDpi}</span>
            <span>FOV: {p.customFov} ({gameEntry?.fovType ?? '-'})</span>
            <span>{p.customCm360.toFixed(1)} cm/360</span>
          </div>
          {sensSummary && (
            <div className="profile-sens-summary">{sensSummary}</div>
          )}
        </div>
        <div className="profile-actions">
          {!p.isActive && (
            <button className="btn-sm btn-primary" onClick={() => setActive(p.id)}>
              {t('common.apply')}
            </button>
          )}
          <button className="btn-sm btn-secondary" onClick={() => handleEdit(p)}>
            {t('profile.editProfile')}
          </button>
          <button className="btn-sm btn-danger" onClick={() => handleDelete(p.id)}>
            {t('common.delete')}
          </button>
        </div>
      </div>
    );
  };

  /** 감도 필드 폼 렌더링 — 게임별 동적 생성 */
  const renderSensFields = (): React.JSX.Element | null => {
    if (sensFieldDefs.length === 0) return null;

    return (
      <div className="sens-fields-section">
        <h4 className="sens-fields-title">
          감도 설정
          <span className="text-tertiary"> — {selectedGame?.name}</span>
        </h4>
        <div className="sens-fields-grid">
          {sensFieldDefs.map((field) => (
            <label key={field.key} className="sens-field-item">
              <span className="sens-field-label">{field.label}</span>
              <input
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={form.sensFields[field.key] ?? ''}
                onChange={(e) => handleSensChange(field.key, e.target.value)}
                placeholder={String(field.defaultValue)}
              />
              <span className="sens-field-range">
                {field.min} ~ {field.max}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="game-profiles">
      <div className="section-header">
        <h2>{t('profile.title')}</h2>
        <div>
          {viewMode === 'list' && (
            <button className="btn-primary btn-sm" onClick={handleNew}>
              + {t('profile.addNew')}
            </button>
          )}
          <button className="btn-secondary btn-sm" onClick={handleBack} style={{ marginLeft: 8 }}>
            {viewMode !== 'list' ? t('common.cancel') : t('common.back')}
          </button>
        </div>
      </div>

      {loading && <p className="text-secondary">{t('common.loading')}</p>}

      {/* ─── 프로필 목록 ─── */}
      {viewMode === 'list' && (
        <div className="profile-list">
          {profiles.map(renderProfileCard)}
          {profiles.length === 0 && !loading && (
            <p className="text-secondary">{t('profile.noProfiles')}</p>
          )}
        </div>
      )}

      {/* ─── 생성/수정 폼 ─── */}
      {(viewMode === 'create' || viewMode === 'edit') && (
        <div className="profile-form">
          <h3>{viewMode === 'edit' ? t('profile.editProfile') : t('profile.addNew')}</h3>

          {/* 게임 선택 (생성 모드에서만) */}
          {viewMode === 'create' && (
            <GameSelector
              onSelect={handleGameSelect}
              selectedGameId={selectedGame?.id ?? null}
            />
          )}

          {/* 수정 모드: 게임 이름 표시 (변경 불가) */}
          {viewMode === 'edit' && selectedGame && (
            <div className="edit-game-info">
              <div className="game-avatar" style={{ background: getCategoryColor(selectedGame.category) }}>
                {getGameInitials(selectedGame.name)}
              </div>
              <div>
                <strong>{selectedGame.name}</strong>
                <span className="text-tertiary"> ({selectedGame.nameKo})</span>
              </div>
            </div>
          )}

          {/* DPI + FOV 기본 설정 */}
          {selectedGame && (
            <>
              <div className="form-grid">
                <label>
                  DPI
                  <input
                    type="number"
                    min={100}
                    max={32000}
                    value={form.dpi}
                    onChange={(e) => setForm(f => ({ ...f, dpi: parseInt(e.target.value, 10) || 800 }))}
                  />
                </label>
                <label>
                  FOV ({selectedGame.fovType})
                  <input
                    type="number"
                    step="0.1"
                    value={form.fov}
                    onChange={(e) => setForm(f => ({ ...f, fov: parseFloat(e.target.value) || selectedGame.defaultFov }))}
                  />
                </label>
              </div>

              {/* 게임별 동적 감도 필드 */}
              {renderSensFields()}

              {/* cm/360 실시간 미리보기 */}
              {cm360Preview !== null && (
                <div className="cm360-preview">
                  {cm360Preview.toFixed(1)} cm/360
                </div>
              )}

              <div className="form-actions">
                <button className="btn-primary" onClick={handleSave}>{t('common.save')}</button>
                <button className="btn-secondary" onClick={handleBack}>{t('common.cancel')}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
