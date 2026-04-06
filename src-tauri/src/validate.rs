//! IPC 입력값 범위 검증 헬퍼
//! 모든 프론트엔드 입력은 이 모듈을 통해 검증 후 사용

use crate::error::AppError;

/// DPI 범위 검증 (100~32000)
pub fn dpi(value: u32) -> Result<u32, AppError> {
    if !(100..=32000).contains(&value) {
        return Err(AppError::Validation(format!(
            "DPI는 100~32000 범위여야 합니다. (입력값: {})", value
        )));
    }
    Ok(value)
}

/// DPI 범위 검증 (i64 버전)
pub fn dpi_i64(value: i64) -> Result<i64, AppError> {
    if !(100..=32000).contains(&value) {
        return Err(AppError::Validation(format!(
            "DPI는 100~32000 범위여야 합니다. (입력값: {})", value
        )));
    }
    Ok(value)
}

/// 감도 검증 (0 초과)
pub fn sensitivity(value: f64) -> Result<f64, AppError> {
    if value <= 0.0 || !value.is_finite() {
        return Err(AppError::Validation(format!(
            "감도는 0보다 커야 합니다. (입력값: {})", value
        )));
    }
    Ok(value)
}

/// FOV 범위 검증 (1~179도)
pub fn fov(value: f64) -> Result<f64, AppError> {
    if !(1.0..=179.0).contains(&value) || !value.is_finite() {
        return Err(AppError::Validation(format!(
            "FOV는 1~179도 범위여야 합니다. (입력값: {})", value
        )));
    }
    Ok(value)
}

/// 비어있지 않은 문자열 검증
pub fn non_empty_str(value: &str, field_name: &str) -> Result<(), AppError> {
    if value.trim().is_empty() {
        return Err(AppError::Validation(format!(
            "{}은(는) 비어있을 수 없습니다.", field_name
        )));
    }
    Ok(())
}

/// ID 검증 (0 이상)
pub fn id(value: i64, field_name: &str) -> Result<i64, AppError> {
    if value < 0 {
        return Err(AppError::Validation(format!(
            "{}은(는) 0 이상이어야 합니다. (입력값: {})", field_name, value
        )));
    }
    Ok(value)
}

/// 점수 검증 (0.0~1.0 정규화)
pub fn score(value: f64) -> Result<f64, AppError> {
    if !(0.0..=1.0).contains(&value) || !value.is_finite() {
        return Err(AppError::Validation(format!(
            "점수는 0.0~1.0 범위여야 합니다. (입력값: {})", value
        )));
    }
    Ok(value)
}

/// cm/360 범위 검증 (양수, 일반적으로 5~200cm 범위)
pub fn cm360(value: f64) -> Result<f64, AppError> {
    if value <= 0.0 || !value.is_finite() {
        return Err(AppError::Validation(format!(
            "cm/360은 0보다 커야 합니다. (입력값: {})", value
        )));
    }
    Ok(value)
}

/// 양수 실수 검증
pub fn positive_f64(value: f64, field_name: &str) -> Result<f64, AppError> {
    if value <= 0.0 || !value.is_finite() {
        return Err(AppError::Validation(format!(
            "{}은(는) 0보다 커야 합니다. (입력값: {})", field_name, value
        )));
    }
    Ok(value)
}

/// 비음수 실수 검증 (0 이상)
pub fn non_negative_f64(value: f64, field_name: &str) -> Result<f64, AppError> {
    if value < 0.0 || !value.is_finite() {
        return Err(AppError::Validation(format!(
            "{}은(는) 0 이상이어야 합니다. (입력값: {})", field_name, value
        )));
    }
    Ok(value)
}

/// 줌 비율 검증 (1.0 이상)
pub fn zoom_ratio(value: f64) -> Result<f64, AppError> {
    if value < 1.0 || !value.is_finite() {
        return Err(AppError::Validation(format!(
            "줌 비율은 1.0 이상이어야 합니다. (입력값: {})", value
        )));
    }
    Ok(value)
}
