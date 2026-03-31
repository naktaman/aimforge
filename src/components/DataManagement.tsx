/**
 * 데이터 관리 — DB 내보내기/가져오기
 * 전체 SQLite 데이터를 JSON으로 내보내기/가져오기
 */
import { useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface DataManagementProps {
  onBack: () => void;
}

export function DataManagement({ onBack }: DataManagementProps) {
  const [status, setStatus] = useState<string>('');
  const [exporting, setExporting] = useState(false);

  /** 데이터 내보내기 */
  const handleExport = useCallback(async () => {
    setExporting(true);
    setStatus('내보내기 진행 중...');
    try {
      const result = await invoke<string>('export_database');
      setStatus(`내보내기 완료: ${result}`);
    } catch (e) {
      setStatus(`내보내기 실패: ${e}`);
    } finally {
      setExporting(false);
    }
  }, []);

  return (
    <div className="data-management">
      <div className="section-header">
        <h2>데이터 관리</h2>
        <button className="btn-secondary" onClick={onBack}>돌아가기</button>
      </div>

      <div className="data-section">
        <h3>데이터 내보내기</h3>
        <p className="text-secondary">
          모든 훈련 데이터, 프로필, 루틴을 JSON 파일로 내보냅니다.
        </p>
        <button className="btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? '내보내기 중...' : 'JSON 내보내기'}
        </button>
      </div>

      {status && <p className="data-status">{status}</p>}
    </div>
  );
}
