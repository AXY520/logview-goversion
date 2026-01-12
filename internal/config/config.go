package config

import (
	"os"
	"strconv"
)

// Config 应用配置
type Config struct {
	// 服务器配置
	Server ServerConfig
	// 数据库配置
	Database DatabaseConfig
	// 存储配置
	Storage StorageConfig
	// 远程API配置
	RemoteAPI RemoteAPIConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Port    string
	Mode    string // debug, release, test
	Timeout int    // 超时时间（秒）
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Path string
}

// StorageConfig 存储配置
type StorageConfig struct {
	BaseDir    string
	ZipDir     string
	ExtractDir string
	MaxFileSize int64 // 最大文件大小（字节）
	MaxPreview  int64 // 预览大小（字节）
}

// RemoteAPIConfig 远程API配置
type RemoteAPIConfig struct {
	BaseURL string
	Username string
	Password string
	Timeout int // 超时时间（秒）
}

// Load 加载配置
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:    getEnv("PORT", "5001"),
			Mode:    getEnv("GIN_MODE", "release"),
			Timeout: getEnvAsInt("SERVER_TIMEOUT", 30),
		},
		Database: DatabaseConfig{
			Path: getEnv("DB_PATH", "logs.db"),
		},
		Storage: StorageConfig{
			BaseDir:     getEnv("STORAGE_BASE_DIR", "."),
			ZipDir:      getEnv("STORAGE_ZIP_DIR", "storage/zips"),
			ExtractDir:  getEnv("STORAGE_EXTRACT_DIR", "storage/extracted"),
			MaxFileSize: getEnvAsInt64("MAX_FILE_SIZE", 50*1024*1024), // 50MB
			MaxPreview:  getEnvAsInt64("MAX_PREVIEW_SIZE", 10*1024*1024),  // 10MB
		},
		RemoteAPI: RemoteAPIConfig{
			BaseURL: getEnv("REMOTE_API_URL", "https://hlogs.lazycat.cloud/api/v1"),
			Username: getEnv("REMOTE_API_USERNAME", "lnks"),
			Password: getEnv("REMOTE_API_PASSWORD", "N5JKpyiw97zhrY0U"),
			Timeout: getEnvAsInt("REMOTE_API_TIMEOUT", 300),
		},
	}
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvAsInt 获取环境变量并转换为int
func getEnvAsInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return defaultValue
}

// getEnvAsInt64 获取环境变量并转换为int64
func getEnvAsInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intVal, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intVal
		}
	}
	return defaultValue
}