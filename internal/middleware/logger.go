package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// Logger 自定义日志中间件
func Logger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		method := c.Request.Method
		clientIP := c.ClientIP()

		if query != "" {
			path = path + "?" + query
		}

		log.Printf("[%s] %s %s | Status: %d | Latency: %v | IP: %s",
			time.Now().Format("2006-01-02 15:04:05"),
			method,
			path,
			status,
			latency,
			clientIP,
		)
	}
}