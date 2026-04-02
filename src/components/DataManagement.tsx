/**
 * 데이터 관리 — DB 내보내기/가져오기
 * 전체 SQLite 데이터를 JSON으로 내보내기/가져오기
 */
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from '../i18n';

interface DataManagementProps {
  onBack: () => void;
}

export function DataManagement({ onBack }: DataManagementProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  /** 데이터 내보내기 */
  const handleExport = useCallback(async () => {
    setExporting(true);
    setStatus(t('data.exporting'));
    try {
      const result = await invoke<string>('export_database');
      setStatus(`${t('data.exportComplete')}: ${result}`);
    } catch (e) {
      setStatus(`${t('data.exportFailed')}: ${e}`);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="data-management">
      <div className="section-header">
        <h2>{t('data.title')}</h2>
        <button className="btn-secondary" onClick={onBack}>{t('common.back')}</button>
      </div>

      <div className="data-section">
        <h3>{t('data.exportAll')}</h3>
        <p className="text-secondary">
          {t('data.exportDesc')}
        </p>
        <button className="btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? t('data.exporting') : t('data.exportJson')}
        </button>
      </div>

      {status && <p className="data-status">{status}</p>}
    </div>
  );
}
