package main

import (
	"log"
	"net/http"
	"os"

	"logview-goversion/controllers"
	"logview-goversion/database"
	"logview-goversion/utils"

	"github.com/gin-gonic/gin"
)

func main() {
	// 设置为发布模式以避免调试警告
	gin.SetMode(gin.ReleaseMode)

	// 初始化数据库
	db := database.NewDB()
	defer db.Close()

	// 初始化日志处理器
	processor := utils.NewLogProcessor()

	// 创建路由器
	r := gin.New()

	// 添加中间件
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// 设置静态文件服务
	r.Static("/static", "./static")

	// 设置模板
	r.LoadHTMLGlob("templates/*.html")

	// 主页路由
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", gin.H{
			"title": "日志查看器",
		})
	})

	// API路由
	api := r.Group("/api")
	{
		// 日志相关API
		api.GET("/logs", controllers.GetLogs(db))
		api.GET("/remote-logs", controllers.GetRemoteLogs())
		api.GET("/logs/:log_id", controllers.GetLog(db))
		api.POST("/download", controllers.DownloadLog(db, processor))
		api.GET("/logs/:log_id/files", controllers.GetLogFiles(db, processor))
		api.GET("/logs/:log_id/file", controllers.GetLogFile(db, processor))
		api.DELETE("/logs/:log_id", controllers.DeleteLog(db, processor))
		api.PUT("/logs/:log_id/tags", controllers.UpdateLogTags(db))
		api.PUT("/logs/:log_id/notes", controllers.UpdateLogNotes(db))
		api.PUT("/logs/:log_id/metadata", controllers.UpdateLogMetadata(db))
		
		// 设备检测API
		api.POST("/device-check", controllers.DeviceCheck())
	}

	// 启动服务器
	port := os.Getenv("PORT")
	if port == "" {
		port = "5001"
	}

	log.Printf("服务器启动在端口 %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("启动服务器失败:", err)
	}
}
