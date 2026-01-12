package handlers

import (
	"logview-goversion/internal/models"
	"logview-goversion/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// RemoteHandler 远程日志处理器
type RemoteHandler struct {
	remoteService *services.RemoteService
}

// NewRemoteHandler 创建远程日志处理器
func NewRemoteHandler(remoteService *services.RemoteService) *RemoteHandler {
	return &RemoteHandler{
		remoteService: remoteService,
	}
}

// GetRemoteLogs 获取远程日志列表
// GET /api/remote-logs
func (h *RemoteHandler) GetRemoteLogs(c *gin.Context) {
	logs, err := h.remoteService.GetRemoteLogs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}
	c.JSON(http.StatusOK, logs)
}