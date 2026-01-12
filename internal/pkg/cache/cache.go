package cache

import (
	"sync"
	"time"
)

// CacheItem 缓存项
type CacheItem struct {
	Value      interface{}
	Expiration int64 // 过期时间戳
}

// Cache 内存缓存
type Cache struct {
	items map[string]*CacheItem
	mu    sync.RWMutex
	ttl   time.Duration
}

// NewCache 创建缓存
func NewCache(ttl time.Duration) *Cache {
	return &Cache{
		items: make(map[string]*CacheItem),
		ttl:   ttl,
	}
}

// Get 获取缓存
func (c *Cache) Get(key string) (interface{}, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	item, exists := c.items[key]
	if !exists {
		return nil, false
	}

	// 检查是否过期
	if item.Expiration > 0 && time.Now().UnixNano() > item.Expiration {
		delete(c.items, key)
		return nil, false
	}

	return item.Value, true
}

// Set 设置缓存
func (c *Cache) Set(key string, value interface{}) {
	c.mu.Lock()
	defer c.mu.Unlock()

	expiration := time.Now().Add(c.ttl).UnixNano()
	c.items[key] = &CacheItem{
		Value:      value,
		Expiration: expiration,
	}
}

// Delete 删除缓存
func (c *Cache) Delete(key string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.items, key)
}

// Clear 清空缓存
func (c *Cache) Clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*CacheItem)
}

// DeleteExpired 删除过期项
func (c *Cache) DeleteExpired() {
	c.mu.Lock()
	defer c.mu.Unlock()

	now := time.Now().UnixNano()
	for key, item := range c.items {
		if item.Expiration > 0 && now > item.Expiration {
			delete(c.items, key)
		}
	}
}

// StartCleanup 启动定期清理（后台运行）
func (c *Cache) StartCleanup(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			c.DeleteExpired()
		}
	}()
}

// TTL 返回缓存的生存时间
func (c *Cache) TTL() time.Duration {
	return c.ttl
}
