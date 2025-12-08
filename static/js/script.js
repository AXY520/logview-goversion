// 全局变量
let currentLogId = null;
let currentFilePath = null;

// 时间格式化函数
function formatTimeAgo(timestamp) {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    let timeAgo = '';
    if (diffSecs < 60) {
        timeAgo = '刚刚';
    } else if (diffMins < 60) {
        timeAgo = `${diffMins}分钟前`;
    } else if (diffHours < 24) {
        timeAgo = `${diffHours}小时前`;
    } else if (diffDays < 30) {
        timeAgo = `${diffDays}天前`;
    } else {
        // 超过30天显示具体日期
        const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const month = months[time.getMonth()];
        const day = String(time.getDate()).padStart(2, '0');
        const hours = String(time.getHours()).padStart(2, '0');
        const minutes = String(time.getMinutes()).padStart(2, '0');
        const seconds = String(time.getSeconds()).padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
    
    // 添加具体时间
    const month = String(time.getMonth() + 1).padStart(2, '0');
    const day = String(time.getDate()).padStart(2, '0');
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');
    
    return `${timeAgo} (${month}-${day} ${hours}:${minutes}:${seconds})`;
}

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // 初始化组件
    initializeComponents();
    
    // 绑定事件
    bindEvents();
    
    // 搜索功能将在文件加载后初始化
    
    // 立即尝试加载日志列表
    console.log('Loading log list on page load...');
    loadLogList();
    
    // 如果第一次加载失败，稍后再次尝试
    setTimeout(() => {
        const itemsEl = document.getElementById('logItems');
        if (itemsEl && itemsEl.children.length === 0) {
            console.log('Retrying log list load...');
            loadLogList();
        }
    }, 500);
});

// 同时也监听window的load事件作为备用
window.addEventListener('load', function() {
    console.log('Window fully loaded, checking log list...');
    const itemsEl = document.getElementById('logItems');
    if (itemsEl && itemsEl.children.length === 0) {
        console.log('Window load: retrying log list load...');
        loadLogList();
    }
});

// 初始化组件
function initializeComponents() {
    // 初始化已完成，无特殊设置
}

// 绑定事件
function bindEvents() {
    // 下载按钮 - 显示远程日志列表
    document.getElementById('downloadBtn').addEventListener('click', showRemoteLogsList);
    
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', refreshAll);
    
    // 模态框关闭
    document.querySelector('.close').addEventListener('click', closeModal);
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('modal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // 下载表单提交
    document.getElementById('downloadForm').addEventListener('submit', downloadLog);
}

// 显示远程日志列表
function showRemoteLogsList() {
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    
    // 更新模态框内容 - 改为网格布局
    modalContent.innerHTML = `
        <span class="close">&times;</span>
        <h2>选择要下载的日志</h2>
        <div class="modal-body">
            <div class="manual-download-section">
                <h3><i class="fas fa-keyboard"></i> 手动输入日志编号</h3>
                <form id="manualDownloadForm" class="manual-download-form">
                    <div class="input-group">
                        <input type="text" id="manualLogIdInput" placeholder="请输入日志编号..." class="form-input">
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-download"></i>
                            下载
                        </button>
                    </div>
                </form>
            </div>
            
            <div class="remote-logs-section">
                <h3><i class="fas fa-list"></i> 可用日志列表</h3>
                <div id="remoteLogsLoading" class="loading">
                    <i class="fas fa-spinner"></i>
                    <p>正在加载远程日志列表...</p>
                </div>
                <div id="remoteLogsGrid" class="remote-logs-grid" style="display: none;">
                    <!-- 日志卡片将通过JavaScript动态生成 -->
                </div>
            </div>
        </div>
    `;
    
    // 重新绑定关闭按钮
    modalContent.querySelector('.close').addEventListener('click', closeModal);
    
    // 绑定手动下载表单
    modalContent.querySelector('#manualDownloadForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const logId = modalContent.querySelector('#manualLogIdInput').value.trim();
        if (logId) {
            downloadLogById(logId);
        }
    });
    
    modal.style.display = 'block';
    
    // 加载远程日志列表
    loadRemoteLogsList();
}

// 加载远程日志列表
function loadRemoteLogsList() {
    const loadingEl = document.getElementById('remoteLogsLoading');
    const gridEl = document.getElementById('remoteLogsGrid');
    
    fetch('/api/remote-logs')
        .then(response => response.json())
        .then(data => {
            loadingEl.style.display = 'none';
            
            if (data.error) {
                gridEl.innerHTML = `<div class="error-message">${data.error}</div>`;
                gridEl.style.display = 'block';
                return;
            }
            
            if (data.length === 0) {
                gridEl.innerHTML = '<div class="empty-state"><p>没有可用的远程日志</p></div>';
                gridEl.style.display = 'block';
                return;
            }
            
            // 渲染远程日志网格卡片 - 只显示前20条
            gridEl.innerHTML = '';
            const limitedData = data.slice(0, 20); // 限制为20条
            limitedData.forEach(log => {
                const card = document.createElement('div');
                card.className = 'remote-log-card';
                
                card.innerHTML = `
                    <div class="remote-log-card-header">
                        <div class="remote-log-id">${log.id}</div>
                        <button class="download-btn-small" title="下载此日志">
                            <i class="fas fa-download"></i>
                        </button>
                    </div>
                    <div class="remote-log-card-body">
                        <div class="log-info-row">
                            <i class="fas fa-server"></i>
                            <span class="info-label">微服名:</span>
                            <span class="info-value">${log.boxname || '未知微服'}</span>
                        </div>
                        <div class="log-info-row">
                            <i class="fas fa-clock"></i>
                            <span class="info-label">时间:</span>
                            <span class="info-value">${formatTimeAgo(log.createat)}</span>
                        </div>
                    </div>
                `;
                
                // 绑定下载按钮事件
                const downloadBtn = card.querySelector('.download-btn-small');
                downloadBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    downloadLogById(log.id);
                });
                
                // 点击卡片任意位置也可下载
                card.addEventListener('click', function() {
                    downloadLogById(log.id);
                });
                
                gridEl.appendChild(card);
            });
            
            // 如果有更多数据，显示提示
            if (data.length > 20) {
                const moreInfo = document.createElement('div');
                moreInfo.className = 'more-logs-info';
                moreInfo.innerHTML = `
                    <i class="fas fa-info-circle"></i>
                    <span>显示前20条日志，共${data.length}条可用</span>
                `;
                gridEl.appendChild(moreInfo);
            }
            
            gridEl.style.display = 'grid';
        })
        .catch(error => {
            loadingEl.style.display = 'none';
            gridEl.innerHTML = `<div class="error-message">加载远程日志列表失败: ${error.message}</div>`;
            gridEl.style.display = 'block';
            console.error('Error loading remote logs:', error);
        });
}

// 根据ID下载日志（无需确认）
function downloadLogById(logId) {
    // 关闭模态框
    closeModal();
    
    // 显示下载提示
    showDownloadingMessage(logId);
    
    // 发送下载请求
    fetch('/api/download', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ log_id: logId })
    })
    .then(response => response.json())
    .then(data => {
        hideDownloadingMessage();
        if (data.error) {
            alert('下载失败: ' + data.error);
        } else {
            // 刷新日志列表
            loadLogList();
        }
    })
    .catch(error => {
        hideDownloadingMessage();
        console.error('Error:', error);
        alert('下载过程中发生错误');
    });
}

// 显示下载中的消息
function showDownloadingMessage(logId) {
    const message = document.createElement('div');
    message.id = 'downloadingMessage';
    message.className = 'downloading-message';
    message.innerHTML = `
        <i class="fas fa-spinner fa-spin"></i>
        <span>正在下载日志 ${logId}...</span>
    `;
    document.body.appendChild(message);
}

// 隐藏下载中的消息
function hideDownloadingMessage() {
    const message = document.getElementById('downloadingMessage');
    if (message) {
        message.remove();
    }
}

// 关闭模态框
function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// 刷新所有数据
function refreshAll() {
    loadLogList();
    if (currentLogId) {
        loadFileTree(currentLogId);
    }
    if (currentFilePath) {
        loadFileContent(currentLogId, currentFilePath);
    }
}

// 加载日志列表
function loadLogList() {
    const loadingEl = document.getElementById('logListLoading');
    const emptyEl = document.getElementById('logListEmpty');
    const itemsEl = document.getElementById('logItems');
    
    // 检查元素是否存在
    if (!loadingEl || !emptyEl || !itemsEl) {
        console.error('Log list elements not found');
        return;
    }
    
    // 显示加载状态
    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';
    itemsEl.innerHTML = '';
    
    fetch('/api/logs')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            loadingEl.style.display = 'none';
            
            console.log('Loaded logs:', data); // 添加调试日志
            
            if (!data || data.length === 0) {
                emptyEl.style.display = 'block';
                return;
            }
            
            // 清空现有内容
            itemsEl.innerHTML = '';
            
            // 渲染日志列表
            data.forEach(log => {
                const li = document.createElement('li');
                li.className = 'log-item';
                li.setAttribute('data-log-id', log.log_id);
                
                // 处理标签显示
                const tagsHtml = log.tags ?
                    `<div class="log-tags">
                        ${log.tags.split(',').map(tag =>
                            `<span class="tag">${tag.trim()}</span>`
                        ).join('')}
                    </div>` : '';
                
                // 处理备注显示
                const notesHtml = log.notes ?
                    `<div class="log-notes" title="${log.notes}">${log.notes}</div>` : '';
                
                li.innerHTML = `
                    <div class="log-main-info">
                        <div class="log-id">${log.log_id}</div>
                        <div class="log-time">${formatTimeAgo(log.download_time)}</div>
                        ${tagsHtml}
                        ${notesHtml}
                    </div>
                    <div class="log-actions">
                        <button class="btn btn-secondary btn-sm edit-btn" data-log-id="${log.log_id}" title="编辑标签和备注">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-danger btn-sm delete-btn" data-log-id="${log.log_id}">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                `;
                
                // 添加点击事件
                li.addEventListener('click', function(e) {
                    if (!e.target.closest('.delete-btn') && !e.target.closest('.edit-btn')) {
                        selectLog(log.log_id, this);
                    }
                });
                
                // 添加编辑按钮事件
                const editBtn = li.querySelector('.edit-btn');
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    showEditModal(log.log_id, log.tags, log.notes);
                });
                
                // 添加删除按钮事件
                const deleteBtn = li.querySelector('.delete-btn');
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    deleteLog(log.log_id);
                });
                
                itemsEl.appendChild(li);
            });
        })
        .catch(error => {
            loadingEl.style.display = 'none';
            console.error('Error loading logs:', error);
            // 显示错误信息
            itemsEl.innerHTML = `<div class="error-message">加载日志列表失败: ${error.message}</div>`;
        });
}

// 选择日志
function selectLog(logId, element) {
    currentLogId = logId;
    
    // 更新UI选中状态
    document.querySelectorAll('.log-item').forEach(item => {
        item.classList.remove('active');
    });
    if (element) {
        element.classList.add('active');
    }
    
    // 加载文件树
    loadFileTree(logId);
    
    // 清空文件内容
    clearFileContent();
}

// 删除日志
function deleteLog(logId) {
    if (!confirm(`确定要删除日志 ${logId} 吗？此操作不可恢复。`)) {
        return;
    }
    
    fetch(`/api/logs/${logId}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('删除失败: ' + data.error);
        } else {
            alert('日志删除成功');
            // 如果删除的是当前选中的日志，清空相关显示
            if (currentLogId === logId) {
                currentLogId = null;
                clearFileTree();
                clearFileContent();
            }
            loadLogList();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('删除过程中发生错误');
    });
}

// 加载文件树
function loadFileTree(logId) {
    const loadingEl = document.getElementById('fileTreeLoading');
    const emptyEl = document.getElementById('fileTreeEmpty');
    const containerEl = document.getElementById('treeContainer');
    
    // 显示加载状态
    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';
    containerEl.innerHTML = '';
    
    fetch(`/api/logs/${logId}/files`)
        .then(response => response.json())
        .then(data => {
            loadingEl.style.display = 'none';
            
            console.log('File tree data:', data); // 添加调试日志
            
            if (data.error) {
                emptyEl.style.display = 'block';
                return;
            }
            
            // 渲染文件树
            const treeHtml = renderFileTree(data, logId);
            containerEl.innerHTML = treeHtml;
            
            // 绑定文件树事件
            bindTreeEvents();
            
            // 绑定搜索功能
            bindSearchEvents();
            
            // 保存初始文件夹状态
            saveInitialFolderStates();
            
            // 默认打开nettype.json文件
            setTimeout(() => {
                openDefaultFile(logId);
            }, 100);
        })
        .catch(error => {
            loadingEl.style.display = 'none';
            console.error('Error loading file tree:', error);
        });
}

// 渲染文件树
function renderFileTree(nodes, logId, depth = 0) {
    console.log('Rendering file tree with nodes:', nodes, 'logId:', logId); // 添加调试日志
    
    // 检查是否是单个节点对象而不是数组
    if (nodes && typeof nodes === 'object' && !Array.isArray(nodes)) {
        // 如果是单个节点（根目录），使用其子节点作为渲染对象
        if (nodes.children && nodes.children.length > 0) {
            nodes = nodes.children;
        } else {
            // 如果根目录没有子节点，显示空状态
            return '<div class="empty-state"><i class="fas fa-folder-open"></i><p>该日志没有文件</p></div>';
        }
    }
    
    if (!nodes || nodes.length === 0) {
        return '<div class="empty-state"><i class="fas fa-folder-open"></i><p>该日志没有文件</p></div>';
    }
    
    let html = '<ul class="tree-children expanded">';
    
    nodes.forEach(node => {
        const nodeId = `node-${logId}-${node.path.replace(/[^a-zA-Z0-9]/g, '-')}`;
        const iconClass = node.type === 'directory' ? 'fas fa-folder' : 'fas fa-file';
        const indentStyle = `style="padding-left: ${depth * 20}px;"`;
        
        const displayName = truncateFileName(node.name);
        html += `
            <li class="tree-node ${node.type} ${node.type === 'directory' ? 'collapsed' : ''}" data-path="${node.path}" data-type="${node.type}" id="${nodeId}" data-name="${node.name.toLowerCase()}" data-depth="${depth}" title="${node.name}" ${indentStyle}>
                ${node.type === 'directory' ? '<span class="toggle"></span>' : '<span class="toggle" style="visibility: hidden;"></span>'}
                <span class="icon"><i class="${iconClass}"></i></span>
                <span class="node-name">${displayName}</span>
                ${node.size !== undefined ? `<span class="node-size">(${formatFileSize(node.size)})</span>` : ''}
            </li>
        `;
        
        // 如果是目录且有子节点，递归渲染
        if (node.type === 'directory' && node.children && node.children.length > 0) {
            // 默认折叠子目录
            html += `<ul class="tree-children collapsed" data-parent="${nodeId}">`;
            html += renderFileTree(node.children, logId, depth + 1);
            html += '</ul>';
        }
    });
    
    html += '</ul>';
    return html;
}

// 绑定文件树事件
function bindTreeEvents() {
    // 绑定文件节点点击事件
    document.querySelectorAll('.tree-node').forEach(node => {
        node.addEventListener('click', function(e) {
            const path = this.getAttribute('data-path');
            const type = this.getAttribute('data-type');
            
            e.stopPropagation();
            
            if (type === 'directory') {
                // 切换文件夹展开/折叠状态
                toggleFolder(this);
            } else {
                // 选择文件
                selectFile(this);
            }
        });
    });
}

// 保存初始文件夹状态
function saveInitialFolderStates() {
    window.initialFolderStates = {};
    document.querySelectorAll('.tree-node.directory').forEach(folder => {
        const nodeId = folder.getAttribute('id');
        const isExpanded = folder.classList.contains('expanded');
        window.initialFolderStates[nodeId] = isExpanded;
    });
}

// 恢复初始文件夹状态
function restoreInitialFolderStates() {
    if (!window.initialFolderStates) return;
    
    Object.keys(window.initialFolderStates).forEach(nodeId => {
        const folder = document.getElementById(nodeId);
        const childrenContainer = document.querySelector(`[data-parent="${nodeId}"]`);
        
        if (folder && childrenContainer) {
            const wasExpanded = window.initialFolderStates[nodeId];
            if (wasExpanded) {
                folder.classList.remove('collapsed');
                folder.classList.add('expanded');
                childrenContainer.classList.remove('collapsed');
                childrenContainer.classList.add('expanded');
                childrenContainer.style.display = '';
            } else {
                folder.classList.remove('expanded');
                folder.classList.add('collapsed');
                childrenContainer.classList.remove('expanded');
                childrenContainer.classList.add('collapsed');
                childrenContainer.style.display = 'none';
            }
        }
    });
}

// 绑定搜索事件
function bindSearchEvents() {
    const searchInput = document.getElementById('fileSearch');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterFiles(this.value);
        });
    }
}

// 过滤文件
function filterFiles(searchTerm) {
    const nodes = document.querySelectorAll('.tree-node');
    const term = searchTerm.toLowerCase().trim();
    
    if (term === '') {
        // 清空搜索，恢复所有节点和初始状态
        nodes.forEach(node => {
            node.style.display = '';
            node.classList.remove('highlighted');
        });
        
        // 恢复所有容器的显示
        document.querySelectorAll('.tree-children').forEach(container => {
            container.style.display = '';
        });
        
        // 恢复初始文件夹状态
        restoreInitialFolderStates();
    } else {
        // 有搜索词时的过滤逻辑
        let hasVisibleNodes = false;
        nodes.forEach(node => {
            const fileName = node.getAttribute('data-name');
            
            if (fileName.includes(term)) {
                // 匹配的文件
                node.style.display = '';
                node.classList.add('highlighted');
                hasVisibleNodes = true;
                
                // 展开并显示所有父级目录
                let parent = node.closest('.tree-children');
                while (parent) {
                    parent.style.display = '';
                    const parentFolder = document.querySelector(`[data-parent="${parent.getAttribute('data-parent')}"]`);
                    if (parentFolder) {
                        parentFolder.classList.remove('collapsed');
                        parentFolder.classList.add('expanded');
                        parentFolder.style.display = '';
                    }
                    parent = parent.parentElement.closest('.tree-children');
                }
            } else {
                // 不匹配的文件
                node.style.display = 'none';
                node.classList.remove('highlighted');
            }
        });
        
        // 隐藏空的容器
        document.querySelectorAll('.tree-children').forEach(container => {
            const visibleChildren = container.querySelectorAll('.tree-node:not([style*="display: none"])');
            if (visibleChildren.length === 0) {
                container.style.display = 'none';
            } else {
                container.style.display = '';
            }
        });
    }
}

// 切换文件夹展开/折叠状态
function toggleFolder(folderNode) {
    const nodeId = folderNode.getAttribute('id');
    const childrenContainer = document.querySelector(`[data-parent="${nodeId}"]`);
    
    if (!childrenContainer) return;
    
    if (folderNode.classList.contains('collapsed')) {
        // 展开
        folderNode.classList.remove('collapsed');
        folderNode.classList.add('expanded');
        childrenContainer.classList.remove('collapsed');
        childrenContainer.classList.add('expanded');
        childrenContainer.style.display = '';
    } else {
        // 折叠
        folderNode.classList.remove('expanded');
        folderNode.classList.add('collapsed');
        childrenContainer.classList.remove('expanded');
        childrenContainer.classList.add('collapsed');
        childrenContainer.style.display = 'none';
    }
}

// 选择文件
function selectFile(fileNode) {
    // 更新选中状态
    document.querySelectorAll('.tree-node').forEach(n => {
        n.classList.remove('active');
    });
    fileNode.classList.add('active');
    
    // 加载文件内容
    const path = fileNode.getAttribute('data-path');
    if (currentLogId) {
        currentFilePath = path;
        loadFileContent(currentLogId, path);
    }
}

// 打开默认文件
function openDefaultFile(logId) {
    // 查找nettype.json文件
    const nettypeNode = document.querySelector('.tree-node[data-path="nettype.json"]');
    if (nettypeNode) {
        // 模拟点击事件
        selectFile(nettypeNode);
    }
}

// 清空文件树
function clearFileTree() {
    const emptyEl = document.getElementById('fileTreeEmpty');
    const containerEl = document.getElementById('treeContainer');
    
    emptyEl.style.display = 'block';
    containerEl.innerHTML = '';
}

// 加载文件内容
function loadFileContent(logId, filePath) {
    const loadingEl = document.getElementById('fileContentLoading');
    const emptyEl = document.getElementById('fileContentEmpty');
    const contentContainerEl = document.getElementById('contentContainer');
    const textContentEl = document.getElementById('textContent');
    const errorEl = document.getElementById('errorMessage');
    const errorTextEl = document.getElementById('errorText');
    const fileInfoEl = document.getElementById('fileInfo');
    
    // 显示加载状态
    loadingEl.style.display = 'block';
    emptyEl.style.display = 'none';
    contentContainerEl.style.display = 'none';
    errorEl.style.display = 'none';
    
    // 更新文件信息
    fileInfoEl.textContent = filePath;
    
    fetch(`/api/logs/${logId}/file?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            loadingEl.style.display = 'none';
            
            if (data.error) {
                errorEl.style.display = 'block';
                errorTextEl.textContent = data.error;
                return;
            }
            
            // 显示文件内容
            contentContainerEl.style.display = 'block';
            textContentEl.textContent = data.content;
            
            // 根据文件类型应用语法高亮
            applySyntaxHighlighting(data.type, textContentEl);
            
            // 延迟初始化搜索功能，确保不影响文件加载
            setTimeout(() => {
                try {
                    initSimpleSearch();
                } catch (error) {
                    console.error('搜索功能初始化失败:', error);
                }
            }, 100);
        })
        .catch(error => {
            loadingEl.style.display = 'none';
            errorEl.style.display = 'block';
            errorTextEl.textContent = '加载文件内容时发生错误';
            console.error('Error loading file content:', error);
        });
}

// 应用语法高亮
function applySyntaxHighlighting(fileType, element) {
    // 清除之前的类
    element.className = 'content-text';
    
    switch (fileType) {
        case 'json':
            element.classList.add('json-content');
            // 尝试格式化JSON
            try {
                const parsed = JSON.parse(element.textContent);
                element.textContent = JSON.stringify(parsed, null, 2);
            } catch (e) {
                // 如果解析失败，保持原样
                console.log('JSON解析失败:', e);
            }
            break;
        case 'xml':
            element.classList.add('xml-content');
            break;
        case 'html':
            element.classList.add('html-content');
            break;
        default:
            element.classList.add('text-content');
    }
}

// 清空文件内容
function clearFileContent() {
    const emptyEl = document.getElementById('fileContentEmpty');
    const contentContainerEl = document.getElementById('contentContainer');
    const textContentEl = document.getElementById('textContent');
    const fileInfoEl = document.getElementById('fileInfo');
    
    emptyEl.style.display = 'block';
    contentContainerEl.style.display = 'none';
    textContentEl.textContent = '';
    fileInfoEl.textContent = '';
    currentFilePath = null;
    
    // 隐藏搜索控件并清除搜索
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) {
        searchContainer.style.display = 'none';
    }
    simpleSearchData.originalContent = '';
    simpleSearchData.currentIndex = 0;
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 截断文件名
function truncateFileName(fileName, maxLength = 30) {
    if (fileName.length <= maxLength) {
        return fileName;
    }
    
    const extension = fileName.includes('.') ? fileName.substring(fileName.lastIndexOf('.')) : '';
    const nameWithoutExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
    
    if (extension.length > 0) {
        const maxNameLength = maxLength - extension.length - 3; // 3 for "..."
        if (maxNameLength > 5) {
            return nameWithoutExt.substring(0, maxNameLength) + '...' + extension;
        }
    }
    
    return fileName.substring(0, maxLength - 3) + '...';
}

// 显示编辑标签和备注的模态框
function showEditModal(logId, currentTags, currentNotes) {
    const modal = document.getElementById('modal');
    const modalContent = modal.querySelector('.modal-content');
    
    modalContent.innerHTML = `
        <span class="close">&times;</span>
        <h2>编辑标签和备注</h2>
        <div class="edit-form">
            <div class="form-group">
                <label for="tagsInput">标签 (用逗号分隔):</label>
                <input type="text" id="tagsInput" class="form-input" placeholder="例如: 重要, 错误, 生产环境" value="${currentTags || ''}">
            </div>
            <div class="form-group">
                <label for="notesInput">备注:</label>
                <textarea id="notesInput" class="form-textarea" placeholder="添加备注信息..." rows="4">${currentNotes || ''}</textarea>
            </div>
            <div class="form-actions">
                <button type="button" id="cancelEditBtn" class="btn btn-secondary">取消</button>
                <button type="button" id="saveEditBtn" class="btn btn-primary">保存</button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
    
    // 绑定事件
    modalContent.querySelector('.close').addEventListener('click', closeModal);
    modalContent.querySelector('#cancelEditBtn').addEventListener('click', closeModal);
    modalContent.querySelector('#saveEditBtn').addEventListener('click', function() {
        saveLogMetadata(logId);
    });
    
    // 点击模态框外部关闭
    modal.addEventListener('click', function(event) {
        if (event.target === modal) {
            closeModal();
        }
    });
}

// 保存日志标签和备注
function saveLogMetadata(logId) {
    const tagsInput = document.getElementById('tagsInput');
    const notesInput = document.getElementById('notesInput');
    
    const tags = tagsInput.value.trim();
    const notes = notesInput.value.trim();
    
    // 显示保存中状态
    const saveBtn = document.getElementById('saveEditBtn');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
    saveBtn.disabled = true;
    
    fetch(`/api/logs/${logId}/metadata`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            tags: tags,
            notes: notes
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert('保存失败: ' + data.error);
        } else {
            // 关闭模态框
            closeModal();
            // 刷新日志列表
            loadLogList();
        }
    })
    .catch(error => {
        console.error('Error:', error);
        alert('保存过程中发生错误');
    })
    .finally(() => {
        // 恢复按钮状态
        saveBtn.innerHTML = originalText;
        saveBtn.disabled = false;
    });
}

// 文件内容搜索功能 - 简化版本
let originalFileContent = '';
let currentSearchTerm = '';

// 初始化文件内容搜索
function initializeContentSearch() {
    const searchInput = document.getElementById('contentSearchInput');
    const prevBtn = document.getElementById('contentSearchPrevBtn');
    const nextBtn = document.getElementById('contentSearchNextBtn');
    const clearBtn = document.getElementById('contentSearchClearBtn');
    
    if (searchInput) {
        // 实时搜索
        searchInput.addEventListener('input', function() {
            performSearch(this.value);
        });
        
        // 回车键搜索
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                findNext();
            } else if (e.key === 'F3' || (e.ctrlKey && e.key === 'g')) {
                e.preventDefault();
                if (e.shiftKey) {
                    findPrevious();
                } else {
                    findNext();
                }
            }
        });
    }
    
    if (prevBtn) {
        prevBtn.addEventListener('click', findPrevious);
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', findNext);
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', clearSearch);
    }
}


// 执行搜索
function performSearch(searchTerm) {
    currentSearchTerm = searchTerm.trim();
    currentHighlightIndex = 0;
    
    const textContent = document.getElementById('textContent');
    if (!textContent) return;
    
    // 保存原始内容（如果还没有保存）
    if (!originalFileContent) {
        originalFileContent = textContent.textContent;
    }
    
    // 如果搜索词为空，显示原始内容
    if (!currentSearchTerm) {
        textContent.textContent = originalFileContent;
        return;
    }
    
    // 创建正则表达式（不区分大小写）
    const regex = new RegExp(escapeRegExp(currentSearchTerm), 'gi');
    
    // 检查是否有匹配
    const matches = originalFileContent.match(regex);
    const hasMatches = matches && matches.length > 0;
    
    if (hasMatches) {
        // 高亮所有匹配
        const highlightedContent = originalFileContent.replace(regex, '<mark class="search-highlight">$&</mark>');
        textContent.innerHTML = highlightedContent;
        
        // 滚动到第一个匹配项
        setTimeout(() => {
            scrollToHighlight(0);
        }, 100);
    } else {
        // 没有匹配项
        textContent.textContent = originalFileContent;
    }
}

// 滚动到指定高亮
function scrollToHighlight(index) {
    const highlights = document.querySelectorAll('.search-highlight');
    if (highlights.length === 0) return;
    
    // 移除所有当前高亮
    highlights.forEach(h => h.classList.remove('current-highlight'));
    
    // 添加当前高亮
    highlights[index].classList.add('current-highlight');
    
    // 滚动到高亮位置
    highlights[index].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });
    
    currentHighlightIndex = index;
}

// 查找下一个
function findNext() {
    const highlights = document.querySelectorAll('.search-highlight');
    if (highlights.length === 0) return;
    
    const nextIndex = (currentHighlightIndex + 1) % highlights.length;
    scrollToHighlight(nextIndex);
}

// 查找上一个
function findPrevious() {
    const highlights = document.querySelectorAll('.search-highlight');
    if (highlights.length === 0) return;
    
    const prevIndex = (currentHighlightIndex - 1 + highlights.length) % highlights.length;
    scrollToHighlight(prevIndex);
}

// 清除搜索
function clearSearch() {
    currentSearchTerm = '';
    originalFileContent = '';
    currentHighlightIndex = 0;
    
    const searchInput = document.getElementById('contentSearchInput');
    const textContent = document.getElementById('textContent');
    
    if (searchInput) searchInput.value = '';
    if (textContent) {
        // 移除高亮，恢复原始文本
        const cleanText = textContent.textContent;
        textContent.textContent = cleanText;
    }
}

// 显示搜索控件
function showSearchControls() {
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) {
        searchContainer.style.display = 'flex';
    }
}

// 隐藏搜索控件
function hideSearchControls() {
    const searchContainer = document.getElementById('searchContainer');
    if (searchContainer) {
        searchContainer.style.display = 'none';
    }
    clearSearch();
}

// 转义正则表达式特殊字符
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}