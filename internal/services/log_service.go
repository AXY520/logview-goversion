package services

import (
	"fmt"
	"logview-goversion/internal/models"
	"logview-goversion/internal/repository"
)

// LogService 日志服务
type LogService struct {
	logRepo *repository.LogRepository
}

// NewLogService 创建日志服务
func NewLogService(logRepo *repository.LogRepository) *LogService {
	return &LogService{
		logRepo: logRepo,
	}
}

// GetAllLogs 获取所有日志
func (s *LogService) GetAllLogs() ([]models.Log, error) {
	return s.logRepo.GetAll()
}

// GetLog 获取指定日志
func (s *LogService) GetLog(logID string) (*models.Log, error) {
	return s.logRepo.GetByID(logID)
}

// AddLog 添加日志
func (s *LogService) AddLog(logID, filePath, extractPath string) error {
	return s.logRepo.Create(logID, filePath, extractPath)
}

// DeleteLog 删除日志
func (s *LogService) DeleteLog(logID string) (bool, error) {
	return s.logRepo.Delete(logID)
}

// UpdateTags 更新标签
func (s *LogService) UpdateTags(logID, tags string) error {
	return s.logRepo.UpdateTags(logID, tags)
}

// UpdateNotes 更新备注
func (s *LogService) UpdateNotes(logID, notes string) error {
	return s.logRepo.UpdateNotes(logID, notes)
}

// UpdateMetadata 更新元数据
func (s *LogService) UpdateMetadata(logID, tags, notes string) error {
	return s.logRepo.UpdateTagsAndNotes(logID, tags, notes)
}

// ValidateLogID 验证日志ID
func (s *LogService) ValidateLogID(logID interface{}) (string, error) {
	if logID == nil {
		return "", fmt.Errorf(models.ErrInvalidLogID)
	}

	switch v := logID.(type) {
	case string:
		if v == "" {
			return "", fmt.Errorf(models.ErrInvalidLogID)
		}
		return v, nil
	case float64:
		return fmt.Sprintf("%.0f", v), nil
	case int:
		return fmt.Sprintf("%d", v), nil
	case int64:
		return fmt.Sprintf("%d", v), nil
	default:
		return "", fmt.Errorf(models.ErrInvalidLogID)
	}
}