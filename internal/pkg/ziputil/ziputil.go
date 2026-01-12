package ziputil

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// ZipUtil ZIP工具
type ZipUtil struct{}

// NewZipUtil 创建ZIP工具
func NewZipUtil() *ZipUtil {
	return &ZipUtil{}
}

// IsValid 检查是否为有效的ZIP文件
func (z *ZipUtil) IsValid(filePath string) bool {
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

// Extract 解压ZIP文件
func (z *ZipUtil) Extract(zipPath, extractTo string) error {
	// 确保提取目录存在
	if err := os.MkdirAll(extractTo, 0755); err != nil {
		return fmt.Errorf("创建目录失败: %w", err)
	}

	// 打开ZIP文件
	reader, err := zip.OpenReader(zipPath)
	if err != nil {
		return fmt.Errorf("打开ZIP文件失败: %w", err)
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
			if err := os.MkdirAll(path, 0755); err != nil {
				return fmt.Errorf("创建目录失败: %w", err)
			}
		} else {
			// 创建父目录
			if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
				return fmt.Errorf("创建父目录失败: %w", err)
			}

			// 解压文件
			if err := z.extractFile(file, path); err != nil {
				return fmt.Errorf("解压文件 %s 失败: %w", file.Name, err)
			}
		}
	}

	return nil
}

// extractFile 解压单个文件
func (z *ZipUtil) extractFile(file *zip.File, destPath string) error {
	src, err := file.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	dst, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer dst.Close()

	_, err = io.Copy(dst, src)
	return err
}