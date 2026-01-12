package services

import (
	"fmt"
	"logview-goversion/internal/config"
	"logview-goversion/internal/models"
	"logview-goversion/internal/pkg/cache"
	"logview-goversion/internal/pkg/fileutil"
	"logview-goversion/internal/pkg/httpclient"
	"logview-goversion/internal/pkg/ziputil"
	"net/url"
	"os"
	"path/filepath"
	"time"
)

// FileService 文件服务
type FileService struct {
	cfg        *config.Config
	httpClient *httpclient.Client
	fileUtil   *fileutil.FileUtil
	zipUtil    *ziputil.ZipUtil
	treeCache  *cache.Cache  // 文件树缓存
}

// NewFileService 创建文件服务
func NewFileService(cfg *config.Config) *FileService {
	svc := &FileService{
		cfg:        cfg,
		httpClient: httpclient.NewClient(cfg),
		fileUtil:   fileutil.NewFileUtil(cfg),
		zipUtil:    ziputil.NewZipUtil(),
		treeCache:  cache.NewCache(5 * time.Minute), // 5分钟缓存
	}
	
	// 启动缓存清理
	svc.treeCache.StartCleanup(1 * time.Minute)
	
	return svc
}

// DownloadLog 下载日志
func (s *FileService) DownloadLog(logID string) (*models.DownloadResult, error) {
	urlStr := fmt.Sprintf("%s/download-log/%s", s.cfg.RemoteAPI.BaseURL, url.QueryEscape(logID))

	// 下载文件
	zipPath := filepath.Join(s.cfg.Storage.BaseDir, fmt.Sprintf("%s.zip", logID))
	err := s.httpClient.DownloadWithAuth(urlStr, zipPath)
	if err != nil {
		return &models.DownloadResult{
			Success: false,
			Error:   fmt.Sprintf("下载失败: %v", err),
		}, nil
	}

	// 验证ZIP文件
	if !s.zipUtil.IsValid(zipPath) {
		os.Remove(zipPath)
		return &models.DownloadResult{
			Success: false,
			Error:   "下载的文件不是有效的ZIP文件",
		}, nil
	}

	// 解压文件
	extractPath := filepath.Join(s.cfg.Storage.ExtractDir, logID)
	if err := s.zipUtil.Extract(zipPath, extractPath); err != nil {
		os.Remove(zipPath)
		return &models.DownloadResult{
			Success: false,
			Error:   fmt.Sprintf("解压失败: %v", err),
		}, nil
	}

	// 删除压缩包
	os.Remove(zipPath)

	return &models.DownloadResult{
		Success:     true,
		FilePath:    "",
		ExtractPath: extractPath,
	}, nil
}

// GetFileStructure 获取文件结构（带缓存）
func (s *FileService) GetFileStructure(logID string) (*models.FileNode, error) {
	// 尝试从缓存获取
	cacheKey := "tree:" + logID
	if cached, ok := s.treeCache.Get(cacheKey); ok {
		return cached.(*models.FileNode), nil
	}

	extractPath := filepath.Join(s.cfg.Storage.ExtractDir, logID)

	if _, err := os.Stat(extractPath); os.IsNotExist(err) {
		return nil, fmt.Errorf(models.ErrLogNotFound)
	}

	fileNode, err := s.fileUtil.BuildTree(extractPath, "")
	if err != nil {
		return nil, err
	}

	result := s.convertFileNode(fileNode)
	
	// 存入缓存
	s.treeCache.Set(cacheKey, result)
	
	return result, nil
}

// InvalidateTreeCache 使指定日志的文件树缓存失效
func (s *FileService) InvalidateTreeCache(logID string) {
	cacheKey := "tree:" + logID
	s.treeCache.Delete(cacheKey)
}

// convertFileNode 转换 fileutil.FileNode 到 models.FileNode
func (s *FileService) convertFileNode(fn *fileutil.FileNode) *models.FileNode {
	if fn == nil {
		return nil
	}

	node := &models.FileNode{
		Name: fn.Name,
		Path: fn.Path,
		Type: fn.Type,
		Size: fn.Size,
	}

	if fn.Children != nil {
		node.Children = make([]*models.FileNode, len(fn.Children))
		for i, child := range fn.Children {
			node.Children[i] = s.convertFileNode(child)
		}
	}

	return node
}

// GetFileContent 获取文件内容
func (s *FileService) GetFileContent(logID, filePath string) (*models.FileContent, error) {
	extractPath := filepath.Join(s.cfg.Storage.ExtractDir, logID)
	fullPath := filepath.Join(extractPath, filePath)

	if _, err := os.Stat(fullPath); os.IsNotExist(err) || !s.fileUtil.IsFile(fullPath) {
		return nil, fmt.Errorf(models.ErrFileNotFound)
	}

	content, err := s.fileUtil.ReadFileContent(fullPath)
	if err != nil {
		return &models.FileContent{
			Content: fmt.Sprintf("读取文件时出错: %v", err),
			Type:    "error",
			Size:    0,
		}, nil
	}

	fileType := s.fileUtil.DetectFileType(filePath, content)
	formattedContent := s.fileUtil.FormatContent(content, fileType)

	return &models.FileContent{
		Content: formattedContent,
		Type:    fileType,
		Size:    len(content),
	}, nil
}

// DeleteLogFiles 删除日志文件
func (s *FileService) DeleteLogFiles(logID string) error {
	extractPath := filepath.Join(s.cfg.Storage.ExtractDir, logID)

	if _, err := os.Stat(extractPath); err == nil {
		return os.RemoveAll(extractPath)
	}

	return nil
}