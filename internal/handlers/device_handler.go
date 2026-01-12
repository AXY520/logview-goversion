package handlers

import (
	"logview-goversion/internal/models"
	"logview-goversion/internal/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// DeviceHandler 设备处理器
type DeviceHandler struct {
	deviceService *services.DeviceService
}

// NewDeviceHandler 创建设备处理器
func NewDeviceHandler(deviceService *services.DeviceService) *DeviceHandler {
	return &DeviceHandler{
		deviceService: deviceService,
	}
}

// CheckDevice 检查设备在线状态
// POST /api/device-check
func (h *DeviceHandler) CheckDevice(c *gin.Context) {
	var req models.DeviceCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.NewErrorResponse(models.ErrInvalidRequest, models.StatusBadRequest))
		return
	}

	result, err := h.deviceService.CheckDevice(req.DeviceName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.NewErrorResponse(err.Error(), models.StatusInternalServerError))
		return
	}

	c.JSON(http.StatusOK, result)
}