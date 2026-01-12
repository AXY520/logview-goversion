package httpclient

import (
	"fmt"
	"io"
	"logview-goversion/internal/config"
	"net/http"
	"os"
	"sync"
	"time"
)

// Client HTTP客户端
type Client struct {
	cfg *config.Config
}

// 全局共享HTTP客户端（连接复用）
var (
	defaultClient *http.Client
	clientInit    sync.Once
)

// init 初始化共享客户端
func initSharedClient(timeout time.Duration) {
	clientInit.Do(func() {
		defaultClient = &http.Client{
			Timeout: timeout,
			Transport: &http.Transport{
				MaxIdleConns:        100,
				MaxIdleConnsPerHost:  10,
				IdleConnTimeout:      90 * time.Second,
				TLSHandshakeTimeout:  10 * time.Second,
				ResponseHeaderTimeout: 30 * time.Second,
			},
		}
	})
}

// NewClient 创建HTTP客户端
func NewClient(cfg *config.Config) *Client {
	return &Client{
		cfg: cfg,
	}
}

// DownloadWithAuth 使用认证下载文件（连接复用）
func (c *Client) DownloadWithAuth(url, savePath string) error {
	// 初始化共享客户端（只执行一次）
	initSharedClient(time.Duration(c.cfg.RemoteAPI.Timeout) * time.Second)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return fmt.Errorf("创建请求失败: %w", err)
	}

	req.SetBasicAuth(c.cfg.RemoteAPI.Username, c.cfg.RemoteAPI.Password)
	req.Header.Set("User-Agent", "LogView/1.0")

	resp, err := defaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("发送请求失败: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return fmt.Errorf("日志不存在或已过期")
	}

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("HTTP错误: %d", resp.StatusCode)
	}

	// 保存文件
	file, err := os.Create(savePath)
	if err != nil {
		return fmt.Errorf("创建文件失败: %w", err)
	}
	defer file.Close()

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		return fmt.Errorf("保存文件失败: %w", err)
	}

	return nil
}

// GetWithAuth 使用认证发送GET请求（连接复用）
func (c *Client) GetWithAuth(url string) (*http.Response, error) {
	// 初始化共享客户端（只执行一次）
	initSharedClient(time.Duration(c.cfg.RemoteAPI.Timeout) * time.Second)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	req.SetBasicAuth(c.cfg.RemoteAPI.Username, c.cfg.RemoteAPI.Password)
	req.Header.Set("User-Agent", "LogView/1.0")

	return defaultClient.Do(req)
}