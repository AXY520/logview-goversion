package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"archive/zip"
)

type LogProcessor struct {
	BaseDir    string
	ZipDir     string
	ExtractDir string
}

type FileNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	Type     string      `json:"type"` // "file" or "directory"
	Size     int64       `json:"size,omitempty"`
	Children []*FileNode `json:"children,omitempty"`
}

func NewLogProcessor() *LogProcessor {
	baseDir := "."
	zipDir := filepath.Join(baseDir, "storage", "zips")
	extractDir := filepath.Join(baseDir, "storage", "extracted")

	// 确保目录存在
	os.MkdirAll(zipDir, 0755)
	os.MkdirAll(extractDir, 0755)

	return &LogProcessor{
		BaseDir:    baseDir,
		ZipDir:     zipDir,
		ExtractDir: extractDir,
	}
}

func (lp *LogProcessor) DownloadLog(logID string) (map[string]interface{}, error) {
	// 构建下载URL
	urlStr := fmt.Sprintf("https://hlogs.lazycat.cloud/api/v1/download-log/%s", url.QueryEscape(logID))

	// 创建HTTP请求
	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %v", err)
	}

	// 设置认证信息
	req.SetBasicAuth("lnks", "N5JKpyiw97zhrY0U")

	// 创建HTTP客户端
	client := &http.Client{
		Timeout: 300 * time.Second,
	}

	// 发送请求
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("发送请求失败: %v", err)
	}
	defer resp.Body.Close()

	// 检查响应状态
	if resp.StatusCode == 404 {
		return map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("日志 %s 不存在或已过期", logID),
		}, nil
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP错误: %d", resp.StatusCode)
	}

	// 保存文件
	zipPath := filepath.Join(lp.BaseDir, fmt.Sprintf("%s.zip", logID))

	file, err := os.Create(zipPath)
	if err != nil {
		return nil, fmt.Errorf("创建文件失败: %v", err)
	}
	defer file.Close()

	_, err = io.Copy(file, resp.Body)
	if err != nil {
		return nil, fmt.Errorf("保存文件失败: %v", err)
	}

	// 验证ZIP文件
	if !lp.isValidZip(zipPath) {
		return map[string]interface{}{
			"success": false,
			"error":   "下载的文件不是有效的ZIP文件",
		}, nil
	}

	// 解压文件
	extractPath := filepath.Join(lp.ExtractDir, logID)
	if err := lp.extractZip(zipPath, extractPath); err != nil {
		// 解压失败时清理临时文件
		os.Remove(zipPath)
		return map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("解压失败: %v", err),
		}, nil
	}

	// 解压完成后删除压缩包
	if err := os.Remove(zipPath); err != nil {
		return map[string]interface{}{
			"success": false,
			"error":   fmt.Sprintf("删除压缩包失败: %v", err),
		}, nil
	}

	return map[string]interface{}{
		"success":      true,
		"file_path":    "", // 不再保存ZIP文件路径
		"extract_path": extractPath,
	}, nil
}

func (lp *LogProcessor) isValidZip(filePath string) bool {
	file, err := os.Open(filePath)
	if err != nil {
		return false
	}
	defer file.Close()

	// 获取文件信息以获取大小
	fileInfo, err := file.Stat()
	if err != nil {
		return false
	}

	// 尝试读取ZIP文件头
	_, err = zip.NewReader(file, fileInfo.Size())
	return err == nil
}

func (lp *LogProcessor) extractZip(zipPath, extractTo string) error {
	// 确保提取目录存在
	os.MkdirAll(extractTo, 0755)

	// 打开ZIP文件
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer reader.Close()

	// 解压所有文件
	for _, file := range reader.File {
		path := filepath.Join(extractTo, file.Name)

		// 确保路径安全
		if !strings.HasPrefix(path, filepath.Clean(extractTo)+string(os.PathSeparator)) {
			continue
		}

		if file.FileInfo().IsDir() {
			// 创建目录
			os.MkdirAll(path, 0755)
		} else {
			// 创建父目录
			os.MkdirAll(filepath.Dir(path), 0755)

			// 解压文件
			src, err := file.Open()
			if err != nil {
				return err
			}

			dst, err := os.Create(path)
			if err != nil {
				src.Close()
				return err
			}

			_, err = io.Copy(dst, src)
			src.Close()
			dst.Close()

			if err != nil {
				return err
			}
		}
	}

	return nil
}

func (lp *LogProcessor) GetFileStructure(logID string) (*FileNode, error) {
	logID = fmt.Sprintf("%s", logID)
	extractPath := filepath.Join(lp.ExtractDir, logID)

	if _, err := os.Stat(extractPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("日志 %s 不存在", logID)
	}

	return lp.buildTree(extractPath, "")
}

func (lp *LogProcessor) buildTree(rootPath, relativePath string) (*FileNode, error) {
	node := &FileNode{
		Name: filepath.Base(rootPath),
		Path: relativePath,
	}

	fileInfo, err := os.Stat(rootPath)
	if err != nil {
		return nil, err
	}

	if fileInfo.IsDir() {
		node.Type = "directory"
		node.Children = []*FileNode{}

		entries, err := os.ReadDir(rootPath)
		if err != nil {
			return nil, err
		}

		for _, entry := range entries {
			entryPath := filepath.Join(rootPath, entry.Name())
			relPath := filepath.Join(relativePath, entry.Name())

			child, err := lp.buildTree(entryPath, relPath)
			if err != nil {
				continue
			}
			node.Children = append(node.Children, child)
		}

		// 按名称排序
		for i := 0; i < len(node.Children)-1; i++ {
			for j := i + 1; j < len(node.Children); j++ {
				if node.Children[i].Name > node.Children[j].Name {
					node.Children[i], node.Children[j] = node.Children[j], node.Children[i]
				}
			}
		}
	} else {
		node.Type = "file"
		node.Size = fileInfo.Size()
	}

	return node, nil
}

func (lp *LogProcessor) GetFileContent(logID, filePath string) (map[string]interface{}, error) {
	logID = fmt.Sprintf("%s", logID)
	extractPath := filepath.Join(lp.ExtractDir, logID)
	fullPath := filepath.Join(extractPath, filePath)

	if _, err := os.Stat(fullPath); os.IsNotExist(err) || !isFile(fullPath) {
		return nil, fmt.Errorf("文件不存在: %s", filePath)
	}

	content, err := lp.readFileContent(fullPath)
	if err != nil {
		return map[string]interface{}{
			"content": fmt.Sprintf("读取文件时出错: %v", err),
			"type":    "error",
			"size":    0,
		}, nil
	}

	fileType := lp.detectFileType(filePath, content)
	formattedContent := lp.formatContent(content, fileType)

	return map[string]interface{}{
		"content": formattedContent,
		"type":    fileType,
		"size":    len(content),
	}, nil
}

func isFile(path string) bool {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !fileInfo.IsDir()
}

func (lp *LogProcessor) readFileContent(filePath string) (string, error) {
	// 尝试不同编码
	encodings := []string{"utf-8", "gbk", "latin-1"}

	for _, encoding := range encodings {
		content, err := lp.readFileWithEncoding(filePath, encoding)
		if err == nil {
			return content, nil
		}
	}

	// 如果所有编码都失败，返回错误
	return "", fmt.Errorf("无法读取文件: %s", filePath)
}

func (lp *LogProcessor) readFileWithEncoding(filePath, encoding string) (string, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	switch encoding {
	case "utf-8":
		return string(data), nil
	case "gbk":
		// 这里简化处理，实际应用中可能需要更复杂的转换
		return string(data), nil
	default:
		return string(data), nil
	}
}

func (lp *LogProcessor) detectFileType(filename, content string) string {
	ext := strings.ToLower(filepath.Ext(filename))

	switch ext {
	case ".json":
		return "json"
	case ".log", ".txt":
		return "text"
	case ".xml":
		return "xml"
	case ".yaml", ".yml":
		return "yaml"
	case ".html", ".htm":
		return "html"
	default:
		// 尝试解析为JSON
		if lp.isJSON(content) {
			return "json"
		}
		return "text"
	}
}

func (lp *LogProcessor) isJSON(content string) bool {
	var v interface{}
	return json.Unmarshal([]byte(content), &v) == nil
}

func (lp *LogProcessor) formatContent(content, fileType string) string {
	switch fileType {
	case "json":
		var v interface{}
		if err := json.Unmarshal([]byte(content), &v); err == nil {
			formatted, err := json.MarshalIndent(v, "", "  ")
			if err == nil {
				return string(formatted)
			}
		}
		return content
	default:
		return content
	}
}

func (lp *LogProcessor) DeleteLogFiles(logID string) error {
	logID = fmt.Sprintf("%s", logID)
	extractPath := filepath.Join(lp.ExtractDir, logID)

	// 删除解压目录
	if _, err := os.Stat(extractPath); err == nil {
		os.RemoveAll(extractPath)
	}

	return nil
}
