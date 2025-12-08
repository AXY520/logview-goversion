package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

type LogDatabase struct {
	db *sql.DB
}

type Log struct {
	ID           int    `json:"id"`
	LogID        string `json:"log_id"`
	FilePath     string `json:"file_path"`
	ExtractPath  string `json:"extract_path"`
	DownloadTime string `json:"download_time"`
	Tags         string `json:"tags"`
	Notes        string `json:"notes"`
}

func NewDB() *LogDatabase {
	// 确保数据库文件所在目录存在
	dbPath := "logs.db"
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Fatal("创建数据库目录失败:", err)
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal("打开数据库失败:", err)
	}

	// 创建表
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

	_, err = db.Exec(createTableSQL)
	if err != nil {
		log.Fatal("创建表失败:", err)
	}

	// 检查并添加新字段（用于现有数据库的升级）
	addColumnIfNotExists(db, "logs", "tags", "TEXT DEFAULT ''")
	addColumnIfNotExists(db, "logs", "notes", "TEXT DEFAULT ''")

	return &LogDatabase{db: db}
}

func (db *LogDatabase) Close() {
	db.db.Close()
}

func (db *LogDatabase) AddLog(logID, filePath, extractPath string) error {
	_, err := db.db.Exec(
		"INSERT OR REPLACE INTO logs (log_id, file_path, extract_path) VALUES (?, ?, ?)",
		logID, filePath, extractPath)
	return err
}

func (db *LogDatabase) GetAllLogs() ([]Log, error) {
	rows, err := db.db.Query(`
		SELECT id, log_id, file_path, extract_path,
			   datetime(download_time, 'localtime') as download_time,
			   tags, notes
		FROM logs ORDER BY download_time DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []Log
	for rows.Next() {
		var log Log
		err := rows.Scan(&log.ID, &log.LogID, &log.FilePath, &log.ExtractPath, &log.DownloadTime, &log.Tags, &log.Notes)
		if err != nil {
			return nil, err
		}
		logs = append(logs, log)
	}

	return logs, nil
}

func (db *LogDatabase) DeleteLog(logID string) (bool, error) {
	result, err := db.db.Exec("DELETE FROM logs WHERE log_id = ?", logID)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

func (db *LogDatabase) GetLog(logID string) (*Log, error) {
	var log Log
	err := db.db.QueryRow(
		"SELECT id, log_id, file_path, extract_path, datetime(download_time, 'localtime') as download_time, tags, notes FROM logs WHERE log_id = ?",
		logID).Scan(&log.ID, &log.LogID, &log.FilePath, &log.ExtractPath, &log.DownloadTime, &log.Tags, &log.Notes)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // 返回nil而不是错误，表示未找到
		}
		return nil, err
	}
	return &log, nil
}

// addColumnIfNotExists 检查并添加列（如果不存在）
func addColumnIfNotExists(db *sql.DB, tableName, columnName, columnDef string) {
	// 检查列是否存在
	var count int
	err := db.QueryRow(`
		SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?
	`, tableName, columnName).Scan(&count)

	if err != nil {
		log.Printf("检查列 %s.%s 时出错: %v", tableName, columnName, err)
		return
	}

	// 如果列不存在，则添加
	if count == 0 {
		alterSQL := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", tableName, columnName, columnDef)
		_, err = db.Exec(alterSQL)
		if err != nil {
			log.Printf("添加列 %s.%s 失败: %v", tableName, columnName, err)
		} else {
			log.Printf("成功添加列 %s.%s", tableName, columnName)
		}
	}
}

// UpdateLogTags 更新日志标签
func (db *LogDatabase) UpdateLogTags(logID, tags string) error {
	_, err := db.db.Exec("UPDATE logs SET tags = ? WHERE log_id = ?", tags, logID)
	return err
}

// UpdateLogNotes 更新日志备注
func (db *LogDatabase) UpdateLogNotes(logID, notes string) error {
	_, err := db.db.Exec("UPDATE logs SET notes = ? WHERE log_id = ?", notes, logID)
	return err
}

// UpdateLogTagsAndNotes 同时更新标签和备注
func (db *LogDatabase) UpdateLogTagsAndNotes(logID, tags, notes string) error {
	_, err := db.db.Exec("UPDATE logs SET tags = ?, notes = ? WHERE log_id = ?", tags, notes, logID)
	return err
}
