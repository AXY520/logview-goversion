package main

import (
	"log"
	"net/http"

	"logview-goversion/internal/config"
	"logview-goversion/internal/handlers"
	"logview-goversion/internal/middleware"
	"logview-goversion/internal/repository"
	"logview-goversion/internal/services"

	"github.com/gin-gonic/gin"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 设置Gin模式
	gin.SetMode(cfg.Server.Mode)

	// 初始化数据库
	logRepo, err := repository.NewLogRepository(cfg.Database.Path)
	if err != nil {
		log.Fatal("初始化数据库失败:", err)
	}
	defer logRepo.Close()

	// 初始化服务
	logService := services.NewLogService(logRepo)
	remoteService := services.NewRemoteService(cfg)
	fileService := services.NewFileService(cfg)
	deviceService := services.NewDeviceService()

	// 初始化处理器
	logHandler := handlers.NewLogHandler(logService, fileService)
	remoteHandler := handlers.NewRemoteHandler(remoteService)
	deviceHandler := handlers.NewDeviceHandler(deviceService)

	// 创建路由器
	r := gin.New()

	// 添加中间件
	r.Use(middleware.Logger())
	r.Use(middleware.Recovery())
	r.Use(middleware.CORS())

	// 设置静态文件服务
	r.Static("/static", "./web/static")

	// 设置模板
	r.LoadHTMLGlob("web/templates/*.html")

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
		api.GET("/logs", logHandler.GetLogs)
		api.GET("/remote-logs", remoteHandler.GetRemoteLogs)
		api.GET("/logs/:log_id", logHandler.GetLog)
		api.POST("/download", logHandler.DownloadLog)
		api.GET("/logs/:log_id/files", logHandler.GetLogFiles)
		api.GET("/logs/:log_id/file", logHandler.GetLogFile)
		api.DELETE("/logs/:log_id", logHandler.DeleteLog)
		api.PUT("/logs/:log_id/tags", logHandler.UpdateLogTags)
		api.PUT("/logs/:log_id/notes", logHandler.UpdateLogNotes)
		api.PUT("/logs/:log_id/metadata", logHandler.UpdateLogMetadata)

		// 设备检测API
		api.POST("/device-check", deviceHandler.CheckDevice)
	}

	// 启动服务器
	port := cfg.Server.Port
	log.Printf("服务器启动在端口 %s", port)
	log.Printf("访问地址: http://localhost:%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatal("启动服务器失败:", err)
	}
}