package handlers

import (
	"logview-goversion/internal/models"
	"logview-goversion/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// LogHandler 日志处理器
type LogHandler struct {
	logService  *services.LogService
	fileService *services.FileService
}

// NewLogHandler 创建日志处理器
func NewLogHandler(logService *services.LogService, fileService *services.FileService) *LogHandler {
	return &LogHandler{
		logService:  logService,
		fileService: fileService,
	}
}

// GetLogs 获取所有日志列表
// GET /api/logs
func (h *LogHandler) GetLogs(c *gin.Context) {
	logs, err := h.logService.GetAllLogs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, logs)
}

// GetLog 获取特定日志信息
// GET /api/logs/:log_id
func (h *LogHandler) GetLog(c *gin.Context) {
	logID := c.Param("log_id")
	log, err := h.logService.GetLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	if log == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse(models.ErrLogNotFound, models.StatusNotFound))
		return
	}
	c.JSON(http.StatusOK, log)
}

// DownloadLog 下载日志
// POST /api/download
func (h *LogHandler) DownloadLog(c *gin.Context) {
	var req models.DownloadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(models.ErrInvalidRequest, models.StatusBadRequest))
		return
	}

	logID, err := h.logService.ValidateLogID(req.LogID)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(models.ErrInvalidLogID, models.StatusBadRequest))
		return
	}

	result, err := h.fileService.DownloadLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	if !result.Success {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(result.Error, models.StatusInternalServerError))
		return
	}

	// 保存到数据库
	err = h.logService.AddLog(logID, result.FilePath, result.ExtractPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"log_id": logID,
	}))
}

// GetLogFiles 获取日志文件结构
// GET /api/logs/:log_id/files
func (h *LogHandler) GetLogFiles(c *gin.Context) {
	logID := c.Param("log_id")

	// 检查日志是否存在
	log, err := h.logService.GetLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	if log == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse(models.ErrLogNotFound, models.StatusNotFound))
		return
	}

	// 获取文件结构
	fileStructure, err := h.fileService.GetFileStructure(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, fileStructure)
}

// GetLogFile 获取日志文件内容
// GET /api/logs/:log_id/file?path=文件路径
func (h *LogHandler) GetLogFile(c *gin.Context) {
	logID := c.Param("log_id")
	filePath := c.Query("path")

	if filePath == "" {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse("文件路径不能为空", models.StatusBadRequest))
		return
	}

	// 检查日志是否存在
	log, err := h.logService.GetLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	if log == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse(models.ErrLogNotFound, models.StatusNotFound))
		return
	}

	// 获取文件内容
	content, err := h.fileService.GetFileContent(logID, filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, content)
}

// DeleteLog 删除日志
// DELETE /api/logs/:log_id
func (h *LogHandler) DeleteLog(c *gin.Context) {
	logID := c.Param("log_id")

	// 从数据库删除
	success, err := h.logService.DeleteLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	if !success {
		c.JSON(http.StatusNotFound, models.NewErrorResponse(models.ErrLogNotFound, models.StatusNotFound))
		return
	}

	// 删除文件
	err = h.fileService.DeleteLogFiles(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(nil))
}

// UpdateLogTags 更新日志标签
// PUT /api/logs/:log_id/tags
func (h *LogHandler) UpdateLogTags(c *gin.Context) {
	logID := c.Param("log_id")

	var req models.UpdateTagsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(models.ErrInvalidRequest, models.StatusBadRequest))
		return
	}

	// 检查日志是否存在
	log, err := h.logService.GetLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	if log == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse(models.ErrLogNotFound, models.StatusNotFound))
		return
	}

	// 更新标签
	err = h.logService.UpdateTags(logID, req.Tags)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"tags": req.Tags,
	}))
}

// UpdateLogNotes 更新日志备注
// PUT /api/logs/:log_id/notes
func (h *LogHandler) UpdateLogNotes(c *gin.Context) {
	logID := c.Param("log_id")

	var req models.UpdateNotesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(models.ErrInvalidRequest, models.StatusBadRequest))
		return
	}

	// 检查日志是否存在
	log, err := h.logService.GetLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	if log == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse(models.ErrLogNotFound, models.StatusNotFound))
		return
	}

	// 更新备注
	err = h.logService.UpdateNotes(logID, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"notes": req.Notes,
	}))
}

// UpdateLogMetadata 同时更新标签和备注
// PUT /api/logs/:log_id/metadata
func (h *LogHandler) UpdateLogMetadata(c *gin.Context) {
	logID := c.Param("log_id")

	var req models.UpdateMetadataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(models.ErrInvalidRequest, models.StatusBadRequest))
		return
	}

	// 检查日志是否存在
	log, err := h.logService.GetLog(logID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	if log == nil {
		c.JSON(http.StatusNotFound, models.NewErrorResponse(models.ErrLogNotFound, models.StatusNotFound))
		return
	}

	// 更新标签和备注
	err = h.logService.UpdateMetadata(logID, req.Tags, req.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, models.NewSuccessResponse(gin.H{
		"tags":  req.Tags,
		"notes": req.Notes,
	}))
}