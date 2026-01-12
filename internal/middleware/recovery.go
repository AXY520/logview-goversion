package middleware

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Recovery 恢复中间件
func Recovery() gin.HandlerFunc {
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				log.Printf("Panic recovered: %v", err)
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": "服务器内部错误",
				})
				c.Abort()
			}
		}()
		c.Next()
	}
}