package services

import (
	"encoding/json"
	"fmt"
	"logview-goversion/internal/config"
	"logview-goversion/internal/models"
	"net/http"
	"time"
)

// RemoteService 远程服务
type RemoteService struct {
	cfg *config.Config
}

// NewRemoteService 创建远程服务
func NewRemoteService(cfg *config.Config) *RemoteService {
	return &RemoteService{
		cfg: cfg,
	}
}

// GetRemoteLogs 获取远程日志列表
func (s *RemoteService) GetRemoteLogs() ([]models.RemoteLog, error) {
	url := fmt.Sprintf("%s/search?queryType=1&keyword=", s.cfg.RemoteAPI.BaseURL)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.SetBasicAuth(s.cfg.RemoteAPI.Username, s.cfg.RemoteAPI.Password)

	client := &http.Client{
		Timeout: time.Duration(s.cfg.RemoteAPI.Timeout) * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP错误: %d", resp.StatusCode)
	}

	var remoteLogs []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&remoteLogs); err != nil {
		return nil, fmt.Errorf("解析响应失败: %w", err)
	}

	return s.formatRemoteLogs(remoteLogs), nil
}

// formatRemoteLogs 格式化远程日志
func (s *RemoteService) formatRemoteLogs(logs []map[string]interface{}) []models.RemoteLog {
	var formattedLogs []models.RemoteLog
	for _, log := range logs {
		formattedLog := models.RemoteLog{
			ID:          s.convertToString(log["id"]),
			BoxName:     s.getString(log, "x-boxname"),
			CreateAt:    s.getString(log, "createat"),
			Description: s.getString(log, "description"),
		}
		formattedLogs = append(formattedLogs, formattedLog)
	}
	return formattedLogs
}

// getString 从map中获取字符串值
func (s *RemoteService) getString(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

// convertToString 将interface{}值转换为字符串
func (s *RemoteService) convertToString(val interface{}) string {
	if val == nil {
		return ""
	}

	switch v := val.(type) {
	case string:
		return v
	case float64:
		return fmt.Sprintf("%.0f", v)
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}