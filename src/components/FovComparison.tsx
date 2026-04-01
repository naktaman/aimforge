/**
 * FOV 비교 화면
 * FOV별 테스트 결과 테이블 + peripheral/center 점수 비교 + 추천
 */
import { useState, useEffect } from 'react';
import { useFovStore } from '../stores/fovStore';

interface Props {
  onBack: () => void;
  profileId: number;
}

/** FOV 값에 대응하는 CSS 클래스 접미사 */
const FOV_CLASS_SUFFIX: Record<number, string> = {
  90: '90',
  100: '100',
  110: '110',
  120: '120',
};

export default function FovComparison({ onBack, profileId }: Props) {
  const { results, recommendation, isLoading, loadResults, compare } = useFovStore();
  const [hasCompared, setHasCompared] = useState(false);

  /** 프로필 변경 시 결과 로드 */
  useEffect(() => {
    loadResults(profileId);
  }, [profileId, loadResults]);

  /** FOV 비교 분석 실행 */
  const handleCompare = async () => {
    await compare(profileId);
    setHasCompared(true);
  };

  /** FOV 값에 맞는 텍스트 색상 클래스 반환 */
  const fovColorClass = (fov: number) => {
    const suffix = FOV_CLASS_SUFFIX[fov];
    return suffix ? `fov-color--${suffix}` : '';
  };

  /** FOV 값에 맞는 배경 색상 클래스 반환 */
  const fovBgClass = (fov: number) => {
    const suffix = FOV_CLASS_SUFFIX[fov];
    return suffix ? `fov-bg--${suffix}` : '';
  };

  return (
    <div className="page page--narrow">
      {/* 페이지 헤더: 제목 + 뒤로가기 */}
      <div className="page-header">
        <h2>FOV 비교 분석</h2>
        <button className="btn btn--ghost btn--sm" onClick={onBack}>← 돌아가기</button>
      </div>

      {/* 테스트 결과 테이블 섹션 */}
      <div className="glass-card page-section">
        <h3 className="page-section__title">테스트 결과 ({results.length}건)</h3>
        {results.length === 0 ? (
          <p className="fov-comparison__empty">
            FOV 테스트 결과가 없습니다. 동일 감도로 FOV 90/100/110/120을 각각 테스트하세요.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>FOV</th>
                <th>시나리오</th>
                <th>Peripheral</th>
                <th>Center</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.id}>
                  <td className={fovColorClass(r.fov_tested)}>
                    {r.fov_tested}°
                  </td>
                  <td>{r.scenario_type}</td>
                  <td>
                    {r.peripheral_score != null ? r.peripheral_score.toFixed(1) : '-'}
                  </td>
                  <td>
                    {r.center_score != null ? r.center_score.toFixed(1) : '-'}
                  </td>
                  <td>{r.score.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* 결과가 있을 때만 비교 버튼 노출 */}
        {results.length > 0 && (
          <button
            className="btn btn--primary"
            onClick={handleCompare}
            disabled={isLoading}
          >
            {isLoading ? '분석 중...' : 'FOV 비교 분석'}
          </button>
        )}
      </div>

      {/* 비교 결과: 추천 FOV + FOV별 바 차트 */}
      {hasCompared && recommendation && (
        <div className="glass-card--glow glass-card page-section">
          <h3 className="page-section__title">추천 결과</h3>

          {/* 추천 FOV 카드 */}
          <div className="fov-recommendation">
            <div className="fov-recommendation__value">
              추천 FOV: {recommendation.recommended_fov}°
            </div>
            <div className="fov-recommendation__reason">
              {recommendation.reason}
            </div>
          </div>

          {/* FOV별 비교 바 */}
          <h4>FOV별 비교</h4>
          {recommendation.comparisons.map((comp) => {
            const isRecommended = Math.abs(comp.fov - recommendation.recommended_fov) < 0.1;
            return (
              <div
                key={comp.fov}
                className={`fov-bar ${isRecommended ? 'fov-bar--recommended' : ''}`}
              >
                {/* FOV 라벨 (색상 구분) */}
                <span className={`fov-bar__label ${fovColorClass(comp.fov)}`}>
                  {comp.fov}°
                </span>

                <div className="fov-bar__details">
                  {/* Peripheral / Center 점수 표시 */}
                  <div className="fov-bar__scores">
                    <span>
                      Peripheral: {comp.avg_peripheral.toFixed(1)}
                      {comp.peripheral_delta_pct !== 0 && (
                        <span className={comp.peripheral_delta_pct > 0 ? 'delta--positive' : 'delta--negative'}>
                          {' '}({comp.peripheral_delta_pct > 0 ? '+' : ''}{comp.peripheral_delta_pct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                    <span>
                      Center: {comp.avg_center.toFixed(1)}
                      {comp.center_delta_pct !== 0 && (
                        <span className={comp.center_delta_pct > -5 ? 'delta--positive' : 'delta--negative'}>
                          {' '}({comp.center_delta_pct > 0 ? '+' : ''}{comp.center_delta_pct.toFixed(1)}%)
                        </span>
                      )}
                    </span>
                  </div>
                  {/* 종합 점수 프로그레스 바 */}
                  <div className="fov-bar__track">
                    <div
                      className={`fov-bar__fill ${fovBgClass(comp.fov)}`}
                      style={{ width: `${Math.min(100, comp.composite)}%` }}
                    />
                  </div>
                </div>

                {/* 종합 점수 수치 */}
                <span className="fov-bar__composite">
                  {comp.composite.toFixed(1)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* 데이터 부족 안내 */}
      {hasCompared && !recommendation && (
        <div className="glass-card empty-state">
          분석할 FOV 데이터가 부족합니다.
        </div>
      )}
    </div>
  );
}
