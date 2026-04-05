/// 보안 에러 처리 — 내부 에러 차단, 프론트엔드에는 안전한 메시지만 전달
///
/// AppError: 내부 에러 (DB, Lock, IO 등) — 로깅 전용
/// PublicError: 프론트엔드 전달용 — 시스템 경로, SQL 쿼리, 스택트레이스 차단

use serde::Serialize;

/// 내부 에러 타입 — log::error!로만 기록, 프론트엔드에 직접 노출 금지
#[derive(Debug)]
pub enum AppError {
    /// 입력값 범위/형식 검증 실패 — 사용자에게 구체적 메시지 전달 가능
    Validation(String),
    /// DB 쿼리 실패 — 내부 로깅만
    Database(String),
    /// Mutex lock 실패
    Lock(String),
    /// 리소스를 찾을 수 없음 (세션, 프로필 등)
    NotFound(String),
    /// 기타 내부 에러
    Internal(String),
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Validation(msg) => write!(f, "Validation: {}", msg),
            AppError::Database(msg) => write!(f, "Database: {}", msg),
            AppError::Lock(msg) => write!(f, "Lock: {}", msg),
            AppError::NotFound(msg) => write!(f, "NotFound: {}", msg),
            AppError::Internal(msg) => write!(f, "Internal: {}", msg),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Database(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Internal(format!("JSON 직렬화/역직렬화 실패: {}", e))
    }
}

/// 프론트엔드 전달용 안전한 에러 — 내부 상세 정보 차단
#[derive(Debug, Clone, Serialize)]
pub struct PublicError {
    /// 사용자에게 표시할 메시지 (시스템 경로, SQL 쿼리 등 제거됨)
    pub message: String,
    /// 에러 분류 코드 (프론트에서 분기용)
    pub code: &'static str,
}

impl std::fmt::Display for PublicError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

/// AppError → PublicError 변환 — 내부 상세 정보를 로깅 후 안전한 메시지로 치환
impl From<AppError> for PublicError {
    fn from(err: AppError) -> Self {
        match err {
            // Validation 에러는 사용자 입력 문제이므로 메시지 그대로 전달
            AppError::Validation(msg) => {
                log::warn!("입력 검증 실패: {}", msg);
                PublicError {
                    message: msg,
                    code: "VALIDATION_ERROR",
                }
            }
            // DB 에러 — SQL 쿼리, 경로 등 내부 정보 차단
            AppError::Database(detail) => {
                log::error!("DB 에러: {}", detail);
                PublicError {
                    message: "데이터 처리 중 오류가 발생했습니다.".to_string(),
                    code: "DATABASE_ERROR",
                }
            }
            // Lock 에러 — 동시성 문제, 사용자에게는 일반 메시지
            AppError::Lock(detail) => {
                log::error!("Lock 에러: {}", detail);
                PublicError {
                    message: "내부 동기화 오류가 발생했습니다. 다시 시도해주세요.".to_string(),
                    code: "LOCK_ERROR",
                }
            }
            // NotFound — 사용자 메시지 그대로 전달 (리소스 이름은 안전)
            AppError::NotFound(msg) => {
                log::warn!("리소스 없음: {}", msg);
                PublicError {
                    message: msg,
                    code: "NOT_FOUND",
                }
            }
            // Internal — 내부 상세 차단
            AppError::Internal(detail) => {
                log::error!("내부 에러: {}", detail);
                PublicError {
                    message: "내부 오류가 발생했습니다.".to_string(),
                    code: "INTERNAL_ERROR",
                }
            }
        }
    }
}

/// Mutex lock 헬퍼 — PoisonError를 AppError::Lock으로 변환
pub fn lock_state<T>(mutex: &std::sync::Mutex<T>) -> Result<std::sync::MutexGuard<'_, T>, AppError> {
    mutex.lock().map_err(|e| AppError::Lock(e.to_string()))
}
