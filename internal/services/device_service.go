package services

import (
	"bytes"
	"logview-goversion/internal/models"
	"os/exec"
	"time"
)

// DeviceService 设备服务
type DeviceService struct{}

// NewDeviceService 创建设备服务
func NewDeviceService() *DeviceService {
	return &DeviceService{}
}

// CheckDevice 检查设备在线状态
func (s *DeviceService) CheckDevice(deviceName string) (*models.DeviceCheckResponse, error) {
	if deviceName == "" {
		return &models.DeviceCheckResponse{
			Success: false,
			Error:   "设备名称不能为空",
		}, nil
	}

	// 构建完整的设备地址
	deviceAddress := deviceName + ".heiyu.space"

	// 执行dht命令
	cmd := exec.Command("./dht", deviceAddress)

	// 创建缓冲区捕获输出
	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// 启动命令
	err := cmd.Start()
	if err != nil {
		return &models.DeviceCheckResponse{
			Success: false,
			Error:   "启动检测命令失败: " + err.Error(),
		}, nil
	}

	// 等待命令完成
	done := make(chan error)
	go func() {
		done <- cmd.Wait()
	}()

	// 设置30秒超时
	select {
	case err := <-done:
		output := stdout.String()
		if stderr.Len() > 0 {
			output = stderr.String() + "\n" + output
		}

		if err != nil {
			return &models.DeviceCheckResponse{
				Success: false,
				Output:  output,
				Error:   "检测命令执行失败，设备可能离线",
			}, nil
		}

		return &models.DeviceCheckResponse{
			Success:       true,
			Output:        output,
			DeviceName:    deviceName,
			DeviceAddress: deviceAddress,
		}, nil

	case <-time.After(30 * time.Second):
		// 超时，终止命令
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
		return &models.DeviceCheckResponse{
			Success: false,
			Error:   "检测超时（30秒），设备可能离线或网络不可达",
			Output:  stdout.String(),
		}, nil
	}
}