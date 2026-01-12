package models

import "time"

// Log 日志模型
type Log struct {
	ID           int       `json:"id"`
	LogID        string    `json:"log_id"`
	FilePath     string    `json:"file_path"`
	ExtractPath  string    `json:"extract_path"`
	DownloadTime time.Time `json:"download_time"`
	Tags         string    `json:"tags"`
	Notes        string    `json:"notes"`
}

// RemoteLog 远程日志模型
type RemoteLog struct {
	ID          string `json:"id"`
	BoxName     string `json:"boxname"`
	CreateAt    string `json:"createat"`
	Description string `json:"description"`
}

// FileNode 文件节点模型
type FileNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	Type     string      `json:"type"` // "file" or "directory"
	Size     int64       `json:"size,omitempty"`
	Children []*FileNode `json:"children,omitempty"`
}

// FileContent 文件内容模型
type FileContent struct {
	Content string `json:"content"`
	Type    string `json:"type"` // json, xml, yaml, html, text, error
	Size    int    `json:"size"`
}

// DownloadRequest 下载请求
type DownloadRequest struct {
	LogID interface{} `json:"log_id"`
}

// UpdateTagsRequest 更新标签请求
type UpdateTagsRequest struct {
	Tags string `json:"tags"`
}

// UpdateNotesRequest 更新备注请求
type UpdateNotesRequest struct {
	Notes string `json:"notes"`
}

// UpdateMetadataRequest 更新元数据请求
type UpdateMetadataRequest struct {
	Tags  string `json:"tags"`
	Notes string `json:"notes"`
}

// DeviceCheckRequest 设备检测请求
type DeviceCheckRequest struct {
	DeviceName string `json:"device_name"`
}

// DeviceCheckResponse 设备检测响应
type DeviceCheckResponse struct {
	Success       bool   `json:"success"`
	Output        string `json:"output,omitempty"`
	Error         string `json:"error,omitempty"`
	DeviceName    string `json:"device_name,omitempty"`
	DeviceAddress string `json:"device_address,omitempty"`
}

// DownloadResult 下载结果
type DownloadResult struct {
	Success     bool   `json:"success"`
	FilePath    string `json:"file_path"`
	ExtractPath string `json:"extract_path"`
	Error       string `json:"error,omitempty"`
}