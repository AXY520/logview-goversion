package repository

import (
	"database/sql"
	"fmt"
	"logview-goversion/internal/models"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

// LogRepository 日志数据访问层
type LogRepository struct {
	db *sql.DB
}

// NewLogRepository 创建日志数据访问层
func NewLogRepository(dbPath string) (*LogRepository, error) {
	// 确保数据库文件所在目录存在
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("创建数据库目录失败: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}

	// 配置连接池 - 优化性能
	db.SetMaxOpenConns(25)           // 最大打开连接数
	db.SetMaxIdleConns(5)            // 最大空闲连接数
	db.SetConnMaxLifetime(5 * time.Minute)  // 连接最大生命周期

	// 创建 repository 实例
	repo := &LogRepository{db: db}

	// 初始化数据库表和索引
	if err := repo.initializeDB(db); err != nil {
		return nil, err
	}

	return repo, nil
}

// Close 关闭数据库连接
func (r *LogRepository) Close() error {
	return r.db.Close()
}

// Create 创建日志
func (r *LogRepository) Create(logID, filePath, extractPath string) error {
	_, err := r.db.Exec(
		"INSERT OR REPLACE INTO logs (log_id, file_path, extract_path) VALUES (?, ?, ?)",
		logID, filePath, extractPath)
	return err
}

// GetAll 获取所有日志
func (r *LogRepository) GetAll() ([]models.Log, error) {
	rows, err := r.db.Query(`
		SELECT id, log_id, file_path, extract_path,
			   datetime(download_time, 'localtime') as download_time,
			   tags, notes
		FROM logs ORDER BY download_time DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.Log
	for rows.Next() {
		var log models.Log
		var downloadTimeStr string
		err := rows.Scan(&log.ID, &log.LogID, &log.FilePath, &log.ExtractPath, &downloadTimeStr, &log.Tags, &log.Notes)
		if err != nil {
			return nil, err
		}
		// 解析时间
		if downloadTimeStr != "" {
			log.DownloadTime, _ = time.Parse("2006-01-02 15:04:05", downloadTimeStr)
		}
		logs = append(logs, log)
	}

	return logs, nil
}

// GetByID 根据ID获取日志
func (r *LogRepository) GetByID(logID string) (*models.Log, error) {
	var log models.Log
	var downloadTimeStr string
	err := r.db.QueryRow(
		"SELECT id, log_id, file_path, extract_path, datetime(download_time, 'localtime') as download_time, tags, notes FROM logs WHERE log_id = ?",
		logID).Scan(&log.ID, &log.LogID, &log.FilePath, &log.ExtractPath, &downloadTimeStr, &log.Tags, &log.Notes)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	// 解析时间
	if downloadTimeStr != "" {
		log.DownloadTime, _ = time.Parse("2006-01-02 15:04:05", downloadTimeStr)
	}
	return &log, nil
}

// Delete 删除日志
func (r *LogRepository) Delete(logID string) (bool, error) {
	result, err := r.db.Exec("DELETE FROM logs WHERE log_id = ?", logID)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

// UpdateTags 更新标签
func (r *LogRepository) UpdateTags(logID, tags string) error {
	_, err := r.db.Exec("UPDATE logs SET tags = ? WHERE log_id = ?", tags, logID)
	return err
}

// UpdateNotes 更新备注
func (r *LogRepository) UpdateNotes(logID, notes string) error {
	_, err := r.db.Exec("UPDATE logs SET notes = ? WHERE log_id = ?", notes, logID)
	return err
}

// UpdateTagsAndNotes 同时更新标签和备注
func (r *LogRepository) UpdateTagsAndNotes(logID, tags, notes string) error {
	_, err := r.db.Exec("UPDATE logs SET tags = ?, notes = ? WHERE log_id = ?", tags, notes, logID)
	return err
}

// initializeDB 初始化数据库（创建表和索引）
func (r *LogRepository) initializeDB(db *sql.DB) error {
	// 创建主表
	if err := r.createTables(db); err != nil {
		return fmt.Errorf("创建表失败: %w", err)
	}

	// 创建索引以优化查询性能
	if err := r.createIndexes(db); err != nil {
		return fmt.Errorf("创建索引失败: %w", err)
	}

	// 执行必要的迁移
	if err := r.runMigrations(db); err != nil {
		return fmt.Errorf("执行迁移失败: %w", err)
	}

	return nil
}

// createTables 创建表
func (r *LogRepository) createTables(db *sql.DB) error {
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		log_id TEXT UNIQUE NOT NULL,
		file_path TEXT NOT NULL,
		extract_path TEXT NOT NULL,
		download_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		tags TEXT DEFAULT '',
		notes TEXT DEFAULT ''
	);`

	_, err := db.Exec(createTableSQL)
	return err
}

// createIndexes 创建索引以优化查询性能
func (r *LogRepository) createIndexes(db *sql.DB) error {
	indexes := []string{
		"CREATE INDEX IF NOT EXISTS idx_logs_log_id ON logs(log_id)",
		"CREATE INDEX IF NOT EXISTS idx_logs_download_time ON logs(download_time DESC)",
		"CREATE INDEX IF NOT EXISTS idx_logs_tags ON logs(tags)",
	}

	for _, index := range indexes {
		if _, err := db.Exec(index); err != nil {
			// 索引可能已存在，忽略重复创建错误
			if !strings.Contains(err.Error(), "already exists") {
				return err
			}
		}
	}

	return nil
}

// runMigrations 运行数据库迁移
func (r *LogRepository) runMigrations(db *sql.DB) error {
	migrations := []struct {
		sql   string
		check string
	}{
		{
			"ALTER TABLE logs ADD COLUMN tags TEXT DEFAULT ''",
			"SELECT COUNT(*) FROM pragma_table_info('logs') WHERE name = 'tags'",
		},
		{
			"ALTER TABLE logs ADD COLUMN notes TEXT DEFAULT ''",
			"SELECT COUNT(*) FROM pragma_table_info('logs') WHERE name = 'notes'",
		},
	}

	for _, m := range migrations {
		var count int
		if err := db.QueryRow(m.check).Scan(&count); err != nil {
			return fmt.Errorf("检查迁移条件失败: %w", err)
		}
		if count == 0 {
			if _, err := db.Exec(m.sql); err != nil {
				// 忽略列已存在的错误
				if !strings.Contains(err.Error(), "duplicate column name") {
					return fmt.Errorf("迁移失败: %w", err)
				}
			}
		}
	}

	return nil
}