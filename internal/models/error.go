package models

import "net/http"

// ErrorResponse 错误响应
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    int    `json:"code,omitempty"`
}

// SuccessResponse 成功响应
type SuccessResponse struct {
	Status  string      `json:"status"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
}

// NewErrorResponse 创建错误响应
func NewErrorResponse(err string, code int) ErrorResponse {
	return ErrorResponse{
		Error: err,
		Code:  code,
	}
}

// NewSuccessResponse 创建成功响应
func NewSuccessResponse(data interface{}) SuccessResponse {
	return SuccessResponse{
		Status: "success",
		Data:   data,
	}
}

// HTTP状态码常量
const (
	StatusOK                  = http.StatusOK
	StatusBadRequest          = http.StatusBadRequest
	StatusNotFound            = http.StatusNotFound
	StatusInternalServerError = http.StatusInternalServerError
)

// 常用错误消息
const (
	ErrInvalidRequest    = "请求参数错误"
	ErrLogNotFound       = "日志不存在"
	ErrFileNotFound      = "文件不存在"
	ErrDownloadFailed    = "下载失败"
	ErrExtractFailed     = "解压失败"
	ErrInvalidLogID      = "无效的日志ID"
	ErrDeviceCheckFailed = "设备检测失败"
	ErrDeviceTimeout     = "设备检测超时"
)