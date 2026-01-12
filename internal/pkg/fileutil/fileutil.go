package fileutil

import (
	"encoding/json"
	"fmt"
	"io"
	"logview-goversion/internal/config"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

// FileUtil 文件工具
type FileUtil struct {
	cfg *config.Config
}

// NewFileUtil 创建文件工具
func NewFileUtil(cfg *config.Config) *FileUtil {
	// 确保目录存在
	os.MkdirAll(cfg.Storage.ZipDir, 0755)
	os.MkdirAll(cfg.Storage.ExtractDir, 0755)

	return &FileUtil{
		cfg: cfg,
	}
}

// BuildTree 构建文件树
func (f *FileUtil) BuildTree(rootPath, relativePath string) (*FileNode, error) {
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

			child, err := f.BuildTree(entryPath, relPath)
			if err != nil {
				continue
			}
			node.Children = append(node.Children, child)
		}

		// 按名称排序（目录优先，然后按名称）
		f.sortNodes(node.Children)
	} else {
		node.Type = "file"
		node.Size = fileInfo.Size()
	}

	return node, nil
}

// ReadFileContent 读取文件内容
func (f *FileUtil) ReadFileContent(filePath string) (string, error) {
	// 检查文件大小
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return "", err
	}

	fileSize := fileInfo.Size()

	// 如果文件超过最大限制，返回错误
	if fileSize > f.cfg.Storage.MaxFileSize {
		return "", fmt.Errorf("文件太大 (%.2f MB), 超过限制 (%.2f MB)",
			float64(fileSize)/(1024*1024),
			float64(f.cfg.Storage.MaxFileSize)/(1024*1024))
	}

	// 如果文件很大，只读取预览部分
	if fileSize > f.cfg.Storage.MaxPreview {
		return f.readFilePreview(filePath, f.cfg.Storage.MaxPreview)
	}

	// 尝试不同编码
	encodings := []string{"utf-8", "gbk", "latin-1"}

	for _, encoding := range encodings {
		content, err := f.readFileWithEncoding(filePath, encoding)
		if err == nil {
			return content, nil
		}
	}

	return "", fmt.Errorf("无法读取文件: %s", filePath)
}

// readFilePreview 读取文件的预览部分
func (f *FileUtil) readFilePreview(filePath string, maxBytes int64) (string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	buffer := make([]byte, maxBytes)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return "", err
	}

	preview := string(buffer[:n])
	return preview + fmt.Sprintf("\n\n... (文件太大，仅显示前 %.2f KB)", float64(maxBytes)/1024), nil
}

// readFileWithEncoding 使用指定编码读取文件
func (f *FileUtil) readFileWithEncoding(filePath, encoding string) (string, error) {
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

// DetectFileType 检测文件类型
func (f *FileUtil) DetectFileType(filename, content string) string {
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
		if f.isJSON(content) {
			return "json"
		}
		return "text"
	}
}

// isJSON 检查是否为JSON
func (f *FileUtil) isJSON(content string) bool {
	var v interface{}
	return json.Unmarshal([]byte(content), &v) == nil
}

// FormatContent 格式化内容
func (f *FileUtil) FormatContent(content, fileType string) string {
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

// IsFile 检查是否为文件
func (f *FileUtil) IsFile(path string) bool {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !fileInfo.IsDir()
}

// sortNodes 排序文件节点（目录优先，然后按名称）
func (f *FileUtil) sortNodes(nodes []*FileNode) {
	sort.Slice(nodes, func(i, j int) bool {
		// 目录优先排序
		if nodes[i].Type != nodes[j].Type {
			return nodes[i].Type == "directory"
		}
		// 同类型按名称排序
		return nodes[i].Name < nodes[j].Name
	})
}

// FileNode 文件节点
type FileNode struct {
	Name     string      `json:"name"`
	Path     string      `json:"path"`
	Type     string      `json:"type"` // "file" or "directory"
	Size     int64       `json:"size,omitempty"`
	Children []*FileNode `json:"children,omitempty"`
}