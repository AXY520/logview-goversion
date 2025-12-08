package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"logview-goversion/database"
	"logview-goversion/utils"

	"github.com/gin-gonic/gin"
)

// GetLogs 获取所有日志列表
func GetLogs(db *database.LogDatabase) gin.HandlerFunc {
	return func(c *gin.Context) {
		logs, err := db.GetAllLogs()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, logs)
	}
}

// GetRemoteLogs 获取远程日志列表
func GetRemoteLogs() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 调用远程API获取日志列表
		url := "https://hlogs.lazycat.cloud/api/v1/search?queryType=1&keyword="

		// 创建HTTP请求
		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// 设置认证信息
		req.SetBasicAuth("lnks", "N5JKpyiw97zhrY0U")

		// 创建HTTP客户端
		client := &http.Client{
			Timeout: 10 * time.Second,
		}

		// 发送请求
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("HTTP error: %d", resp.StatusCode)})
			return
		}

		// 解析响应
		var remoteLogs []map[string]interface{}
		if err := json.NewDecoder(resp.Body).Decode(&remoteLogs); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// 格式化数据
		var formattedLogs []map[string]interface{}
		for _, log := range remoteLogs {
			formattedLog := map[string]interface{}{
				"id":          convertToString(log["id"]),
				"boxname":     getString(log, "x-boxname"),
				"createat":    log["createat"],
				"description": getString(log, "description"),
			}
			formattedLogs = append(formattedLogs, formattedLog)
		}

		c.JSON(http.StatusOK, formattedLogs)
	}
}

// GetLog 获取特定日志信息
func GetLog(db *database.LogDatabase) gin.HandlerFunc {
	return func(c *gin.Context) {
		logID := c.Param("log_id")
		log, err := db.GetLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if log == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
			return
		}
		c.JSON(http.StatusOK, log)
	}
}

// DownloadLog 下载日志
func DownloadLog(db *database.LogDatabase, processor *utils.LogProcessor) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req struct {
			LogID interface{} `json:"log_id"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		var logID string
		if req.LogID == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Log ID is required"})
			return
		}

		// 处理不同类型的log_id
		switch v := req.LogID.(type) {
		case string:
			logID = v
		case float64: // JSON数字默认解析为float64
			logID = fmt.Sprintf("%.0f", v)
		case int:
			logID = fmt.Sprintf("%d", v)
		case int64:
			logID = fmt.Sprintf("%d", v)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid log_id type"})
			return
		}

		result, err := processor.DownloadLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if !result["success"].(bool) {
			c.JSON(http.StatusInternalServerError, gin.H{"error": result["error"]})
			return
		}

		// 保存到数据库
		err = db.AddLog(logID, result["file_path"].(string), result["extract_path"].(string))
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"status": "success",
			"log_id": logID,
		})
	}
}

// GetLogFiles 获取日志文件结构
func GetLogFiles(db *database.LogDatabase, processor *utils.LogProcessor) gin.HandlerFunc {
	return func(c *gin.Context) {
		logID := c.Param("log_id")

		// 检查日志是否存在
		log, err := db.GetLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if log == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
			return
		}

		// 获取文件结构
		fileStructure, err := processor.GetFileStructure(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, fileStructure)
	}
}

// GetLogFile 获取日志文件内容
func GetLogFile(db *database.LogDatabase, processor *utils.LogProcessor) gin.HandlerFunc {
	return func(c *gin.Context) {
		logID := c.Param("log_id")
		filePath := c.Query("path")

		if filePath == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "File path is required"})
			return
		}

		// 检查日志是否存在
		log, err := db.GetLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if log == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
			return
		}

		// 获取文件内容
		content, err := processor.GetFileContent(logID, filePath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, content)
	}
}

// DeleteLog 删除日志
func DeleteLog(db *database.LogDatabase, processor *utils.LogProcessor) gin.HandlerFunc {
	return func(c *gin.Context) {
		logID := c.Param("log_id")

		// 从数据库删除
		success, err := db.DeleteLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if !success {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
			return
		}

		// 删除文件
		err = processor.DeleteLogFiles(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success"})
	}
}

// getString 从map中获取字符串值，如果不存在返回空字符串
func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

// convertToString 将interface{}值转换为字符串
func convertToString(val interface{}) string {
	if val == nil {
		return ""
	}

	switch v := val.(type) {
	case string:
		return v
	case float64: // JSON数字默认解析为float64
		return fmt.Sprintf("%.0f", v)
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	default:
		return fmt.Sprintf("%v", v)
	}
}

// UpdateLogTags 更新日志标签
func UpdateLogTags(db *database.LogDatabase) gin.HandlerFunc {
	return func(c *gin.Context) {
		logID := c.Param("log_id")

		var req struct {
			Tags string `json:"tags"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 检查日志是否存在
		log, err := db.GetLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if log == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
			return
		}

		// 更新标签
		err = db.UpdateLogTags(logID, req.Tags)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success", "tags": req.Tags})
	}
}

// UpdateLogNotes 更新日志备注
func UpdateLogNotes(db *database.LogDatabase) gin.HandlerFunc {
	return func(c *gin.Context) {
		logID := c.Param("log_id")

		var req struct {
			Notes string `json:"notes"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 检查日志是否存在
		log, err := db.GetLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if log == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
			return
		}

		// 更新备注
		err = db.UpdateLogNotes(logID, req.Notes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success", "notes": req.Notes})
	}
}

// UpdateLogMetadata 同时更新标签和备注
func UpdateLogMetadata(db *database.LogDatabase) gin.HandlerFunc {
	return func(c *gin.Context) {
		logID := c.Param("log_id")

		var req struct {
			Tags  string `json:"tags"`
			Notes string `json:"notes"`
		}

		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 检查日志是否存在
		log, err := db.GetLog(logID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if log == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log not found"})
			return
		}

		// 更新标签和备注
		err = db.UpdateLogTagsAndNotes(logID, req.Tags, req.Notes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "success", "tags": req.Tags, "notes": req.Notes})
	}
}
