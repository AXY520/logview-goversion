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
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', showRemoteLogsList);
    }
    
    // 设备检测按钮
    const deviceCheckBtn = document.getElementById('deviceCheckBtn');
    if (deviceCheckBtn) {
        deviceCheckBtn.addEventListener('click', showDeviceCheckDialog);
        console.log('设备检测按钮已绑定事件');
    } else {
        console.error('找不到设备检测按钮 #deviceCheckBtn');
    }
    
    // 刷新按钮
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshAll);
    }
    
    // 模态框关闭
    const closeBtn = document.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }
    
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('modal');
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // 下载表单提交
    const downloadForm = document.getElementById('downloadForm');
    if (downloadForm) {
        downloadForm.addEventListener('submit', downloadLog);
    }
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
            
            // 保存原始内容用于复制
            window.currentFileContent = data.content;
            
            // 显示文件内容
            contentContainerEl.style.display = 'block';
            
            // 根据文件类型应用格式化和高亮
            const isLogFile = applyContentFormatting(data.type, data.content, textContentEl, filePath);
            
            // 显示工具栏
            showContentToolbar(isLogFile);
            
            // 显示搜索控件
            showSearchControls();
            
            // 延迟初始化搜索功能，确保不影响文件加载
            setTimeout(() => {
                try {
                    initializeContentSearch();
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

// 显示内容工具栏
function showContentToolbar(isLogFile) {
    const toolbar = document.getElementById('contentToolbar');
    const filterGroup = document.getElementById('logFilterGroup');
    const lineCount = document.getElementById('lineCount');
    
    if (toolbar) {
        toolbar.style.display = 'flex';
        
        // 根据是否是日志文件显示过滤按钮
        if (filterGroup) {
            filterGroup.style.display = isLogFile ? 'flex' : 'none';
        }
        
        // 更新行数统计
        const lines = document.querySelectorAll('.log-line, .numbered-line');
        if (lineCount && lines.length > 0) {
            lineCount.textContent = `共 ${lines.length} 行`;
        }
        
        // 绑定复制按钮
        const copyBtn = document.getElementById('copyContentBtn');
        if (copyBtn) {
            copyBtn.onclick = copyFileContent;
        }
        
        // 绑定过滤按钮
        if (isLogFile) {
            bindLogFilterButtons();
        }
    }
}

// 复制文件内容
function copyFileContent() {
    if (!window.currentFileContent) return;
    
    navigator.clipboard.writeText(window.currentFileContent).then(() => {
        const btn = document.getElementById('copyContentBtn');
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> 已复制';
        btn.classList.add('btn-success');
        
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.remove('btn-success');
        }, 2000);
    }).catch(err => {
        console.error('复制失败:', err);
        alert('复制失败，请手动选择并复制');
    });
}

// 绑定日志过滤按钮
function bindLogFilterButtons() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.onclick = function() {
            const filter = this.getAttribute('data-filter');
            
            // 更新按钮状态
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 应用过滤
            filterLogLines(filter);
        };
    });
}

// 过滤日志行
function filterLogLines(filter) {
    const logLines = document.querySelectorAll('.log-line');
    const lineCount = document.getElementById('lineCount');
    let visibleCount = 0;
    
    logLines.forEach(line => {
        if (filter === 'all') {
            line.style.display = 'flex';
            visibleCount++;
        } else {
            const hasLevel = line.classList.contains(`log-${filter}`);
            line.style.display = hasLevel ? 'flex' : 'none';
            if (hasLevel) visibleCount++;
        }
    });
    
    // 更新行数统计
    if (lineCount) {
        if (filter === 'all') {
            lineCount.textContent = `共 ${logLines.length} 行`;
        } else {
            lineCount.textContent = `显示 ${visibleCount} / ${logLines.length} 行`;
        }
    }
}

// 应用内容格式化 - 优化版本
function applyContentFormatting(fileType, content, element, fileName) {
    const startTime = performance.now();
    element.className = 'content-text';
    
    // 判断是否是日志文件
    const isLogFile = fileType === 'text' || fileName.toLowerCase().includes('.log') ||
                      fileName.toLowerCase().includes('log') || content.includes('ERROR') ||
                      content.includes('WARN') || content.includes('INFO');
    
    // 检查文件大小（性能优化）
    const contentSize = content.length;
    const isLargeFile = contentSize > 500000; // 500KB
    
    if (isLargeFile) {
        console.warn(`大文件警告: ${(contentSize / 1024).toFixed(2)}KB, 使用简化渲染`);
    }
    
    if (fileType === 'json') {
        element.classList.add('json-content');
        try {
            const parsed = JSON.parse(content);
            const formatted = JSON.stringify(parsed, null, 2);
            
            // 大JSON文件简化渲染
            if (isLargeFile) {
                element.textContent = formatted;
            } else {
                element.innerHTML = addLineNumbers(syntaxHighlightJSON(formatted));
            }
        } catch (e) {
            console.log('JSON解析失败:', e);
            element.innerHTML = addLineNumbers(escapeHtml(content));
        }
        
        const endTime = performance.now();
        console.log(`JSON渲染完成: 耗时 ${(endTime - startTime).toFixed(2)}ms`);
        return false;
        
    } else if (isLogFile) {
        element.classList.add('log-content');
        
        // 大日志文件简化渲染（不高亮）
        if (isLargeFile) {
            element.textContent = content;
            console.log('大日志文件使用纯文本渲染以提升性能');
        } else {
            element.innerHTML = formatLogContent(content);
        }
        
        const endTime = performance.now();
        console.log(`日志渲染完成: 耗时 ${(endTime - startTime).toFixed(2)}ms`);
        return true;
        
    } else {
        element.classList.add('text-content');
        
        // 大文本文件简化渲染
        if (isLargeFile) {
            element.textContent = content;
        } else {
            element.innerHTML = addLineNumbers(escapeHtml(content));
        }
        
        const endTime = performance.now();
        console.log(`文本渲染完成: 耗时 ${(endTime - startTime).toFixed(2)}ms`);
        return false;
    }
}

// 格式化日志内容 - 优化版本
function formatLogContent(content) {
    const lines = content.split('\n');
    const MAX_LINES = 10000; // 限制最大行数
    
    // 如果行数过多，截断并警告
    if (lines.length > MAX_LINES) {
        console.warn(`日志行数过多 (${lines.length}行), 仅显示前${MAX_LINES}行`);
        lines.length = MAX_LINES;
    }
    
    // 使用数组join代替字符串拼接（性能优化）
    const htmlParts = ['<div class="log-viewer">'];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        const highlightedLine = highlightLogLine(line);
        const logLevel = detectLogLevel(line);
        
        htmlParts.push(
            `<div class="log-line ${logLevel}" data-line="${lineNum}">`,
            `<span class="line-number">${lineNum}</span>`,
            `<span class="line-content">${highlightedLine}</span>`,
            '</div>'
        );
    });
    
    htmlParts.push('</div>');
    return htmlParts.join('');
}

// 检测日志级别
function detectLogLevel(line) {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('ERROR') || upperLine.includes('FATAL') || upperLine.includes('SEVERE')) {
        return 'log-error';
    } else if (upperLine.includes('WARN') || upperLine.includes('WARNING')) {
        return 'log-warn';
    } else if (upperLine.includes('INFO')) {
        return 'log-info';
    } else if (upperLine.includes('DEBUG') || upperLine.includes('TRACE')) {
        return 'log-debug';
    }
    return '';
}

// 高亮日志行
function highlightLogLine(line) {
    let highlighted = escapeHtml(line);
    
    // 高亮时间戳 (支持多种格式)
    highlighted = highlighted.replace(
        /(\d{4}[-/]\d{2}[-/]\d{2}[\sT]\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})?)/g,
        '<span class="log-timestamp">$1</span>'
    );
    
    // 高亮日志级别
    highlighted = highlighted.replace(
        /\b(ERROR|FATAL|SEVERE|WARN|WARNING|INFO|DEBUG|TRACE)\b/gi,
        '<span class="log-level-keyword">$&</span>'
    );
    
    // 高亮异常类名
    highlighted = highlighted.replace(
        /\b([A-Z][a-zA-Z0-9]*Exception|[A-Z][a-zA-Z0-9]*Error)\b/g,
        '<span class="log-exception">$1</span>'
    );
    
    // 高亮IP地址
    highlighted = highlighted.replace(
        /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g,
        '<span class="log-ip">$1</span>'
    );
    
    // 高亮URL
    highlighted = highlighted.replace(
        /(https?:\/\/[^\s]+)/g,
        '<span class="log-url">$1</span>'
    );
    
    return highlighted;
}

// 添加行号 - 优化版本
function addLineNumbers(content) {
    const lines = content.split('\n');
    const MAX_LINES = 10000; // 限制最大行数
    
    // 如果行数过多，截断并警告
    if (lines.length > MAX_LINES) {
        console.warn(`文件行数过多 (${lines.length}行), 仅显示前${MAX_LINES}行`);
        lines.length = MAX_LINES;
    }
    
    // 使用数组join代替字符串拼接（性能优化）
    const htmlParts = ['<div class="line-numbered-content">'];
    
    lines.forEach((line, index) => {
        const lineNum = index + 1;
        htmlParts.push(
            `<div class="numbered-line" data-line="${lineNum}">`,
            `<span class="line-number">${lineNum}</span>`,
            `<span class="line-content">${line}</span>`,
            '</div>'
        );
    });
    
    htmlParts.push('</div>');
    return htmlParts.join('');
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// JSON语法高亮
function syntaxHighlightJSON(json) {
    if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
    }
    
    json = escapeHtml(json);
    
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
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
    hideSearchControls();
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

// 文件内容搜索功能 - 优化版本
let originalFileContent = '';
let currentSearchTerm = '';
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_DELAY = 300; // 300ms 防抖延迟

// 初始化文件内容搜索
function initializeContentSearch() {
    const searchInput = document.getElementById('contentSearchInput');
    const prevBtn = document.getElementById('contentSearchPrevBtn');
    const nextBtn = document.getElementById('contentSearchNextBtn');
    const clearBtn = document.getElementById('contentSearchClearBtn');
    
    if (searchInput) {
        // 防抖搜索 - 避免频繁触发
        searchInput.addEventListener('input', function() {
            const searchValue = this.value;
            
            // 清除之前的定时器
            if (searchDebounceTimer) {
                clearTimeout(searchDebounceTimer);
            }
            
            // 设置新的定时器
            searchDebounceTimer = setTimeout(() => {
                performSearch(searchValue);
            }, SEARCH_DEBOUNCE_DELAY);
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


// 执行搜索 - 优化版本
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
    
    // 搜索词太短，不执行搜索（性能优化）
    if (currentSearchTerm.length < 2) {
        return;
    }
    
    // 使用 DocumentFragment 优化DOM操作
    const startTime = performance.now();
    
    // 创建正则表达式（不区分大小写）
    const regex = new RegExp(escapeRegExp(currentSearchTerm), 'gi');
    
    // 检查是否有匹配
    const matches = originalFileContent.match(regex);
    const hasMatches = matches && matches.length > 0;
    
    if (hasMatches) {
        // 对于大文件，限制匹配数量（性能优化）
        const MAX_HIGHLIGHTS = 1000;
        if (matches.length > MAX_HIGHLIGHTS) {
            console.warn(`搜索结果过多 (${matches.length}个), 仅高亮前${MAX_HIGHLIGHTS}个`);
        }
        
        // 高亮所有匹配（使用更高效的方式）
        const highlightedContent = originalFileContent.replace(regex, (match, offset, string) => {
            // 限制高亮数量
            const currentCount = (string.substring(0, offset).match(regex) || []).length;
            if (currentCount >= MAX_HIGHLIGHTS) {
                return match;
            }
            return `<mark class="search-highlight">${match}</mark>`;
        });
        
        textContent.innerHTML = highlightedContent;
        
        const endTime = performance.now();
        console.log(`搜索完成: 找到 ${Math.min(matches.length, MAX_HIGHLIGHTS)} 个匹配项, 耗时 ${(endTime - startTime).toFixed(2)}ms`);
        
        // 滚动到第一个匹配项
        requestAnimationFrame(() => {
            scrollToHighlight(0);
        });
    } else {
        // 没有匹配项
        textContent.textContent = originalFileContent;
    }
}

// 滚动到指定高亮 - 优化版本
function scrollToHighlight(index) {
    const highlights = document.querySelectorAll('.search-highlight');
    if (highlights.length === 0) return;
    
    // 确保索引在有效范围内
    index = Math.max(0, Math.min(index, highlights.length - 1));
    
    // 使用 requestAnimationFrame 优化性能
    requestAnimationFrame(() => {
        // 批量移除类（减少重绘）
        highlights.forEach(h => h.classList.remove('current-highlight'));
        
        // 添加当前高亮
        highlights[index].classList.add('current-highlight');
        
        // 使用更平滑的滚动
        highlights[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
        });
        
        currentHighlightIndex = index;
    });
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

// ====== 设备检测相关功能 ======

// 显示设备检测对话框
function showDeviceCheckDialog() {
    const modal = document.getElementById('deviceCheckModal');
    const resultDiv = document.getElementById('deviceCheckResult');
    
    // 初始化对话框内容
    resultDiv.innerHTML = `
        <div class="device-check-input">
            <div class="form-group">
                <label for="deviceNameInput">
                    <i class="fas fa-server"></i> 请输入设备名称:
                </label>
                <input type="text" id="deviceNameInput" class="form-input" placeholder="例如: axy" autofocus>
                <small class="form-hint">完整地址格式: [设备名].heiyu.space</small>
            </div>
            <button id="checkDeviceBtn" class="btn btn-primary btn-block">
                <i class="fas fa-search"></i> 检测设备
            </button>
        </div>
    `;
    
    // 显示模态框
    modal.style.display = 'block';
    
    // 绑定关闭按钮
    const closeBtn = modal.querySelector('.device-check-close');
    closeBtn.onclick = function() {
        modal.style.display = 'none';
    };
    
    // 点击模态框外部关闭
    window.onclick = function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // 绑定检测按钮
    const checkBtn = document.getElementById('checkDeviceBtn');
    checkBtn.addEventListener('click', performDeviceCheck);
    
    // 绑定回车键检测
    const deviceInput = document.getElementById('deviceNameInput');
    deviceInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performDeviceCheck();
        }
    });
    
    // 自动聚焦到输入框
    setTimeout(() => {
        deviceInput.focus();
    }, 100);
}

// 执行设备检测
function performDeviceCheck() {
    const deviceInput = document.getElementById('deviceNameInput');
    const deviceName = deviceInput.value.trim();
    
    if (!deviceName) {
        alert('请输入设备名称');
        deviceInput.focus();
        return;
    }
    
    const resultDiv = document.getElementById('deviceCheckResult');
    
    // 显示加载状态
    resultDiv.innerHTML = `
        <div class="device-check-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <p>正在检测设备 <strong>${deviceName}.heiyu.space</strong>...</p>
            <small>这可能需要几秒钟时间</small>
        </div>
    `;
    
    // 调用后端API
    fetch('/api/device-check', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device_name: deviceName })
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            showDeviceCheckError(deviceName, data.error);
        } else {
            showDeviceCheckResult(deviceName, data);
        }
    })
    .catch(error => {
        showDeviceCheckError(deviceName, '网络请求失败: ' + error.message);
    });
}

// 显示设备检测结果
function showDeviceCheckResult(deviceName, data) {
    const resultDiv = document.getElementById('deviceCheckResult');
    
    // 解析返回的数据
    const output = data.output || '';
    const isOnline = data.success && output.includes('Connected');
    
    // 提取关键信息
    let peerInfo = '';
    let connectionInfo = '';
    let protocols = '';
    let addresses = '';
    
    // 解析输出获取详细信息
    const lines = output.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('Connected')) {
            peerInfo = line.trim();
        } else if (line.includes('ADDRS:')) {
            addresses = line.replace('ADDRS:', '').trim();
        } else if (line.includes('Protocols:')) {
            protocols = line.replace('Protocols:', '').trim();
        } else if (line.includes('共') && line.includes('peer')) {
            connectionInfo = line.trim();
        }
    }
    
    const statusClass = isOnline ? 'status-online' : 'status-offline';
    const statusIcon = isOnline ? 'fa-check-circle' : 'fa-times-circle';
    const statusText = isOnline ? '在线' : '离线';
    
    resultDiv.innerHTML = `
        <div class="device-check-success">
            <div class="device-status ${statusClass}">
                <i class="fas ${statusIcon}"></i>
                <h3>${deviceName}.heiyu.space</h3>
                <p class="status-text">${statusText}</p>
            </div>
            
            ${isOnline ? `
                <div class="device-details">
                    ${peerInfo ? `
                        <div class="detail-section">
                            <h4><i class="fas fa-info-circle"></i> 设备信息</h4>
                            <p class="detail-text">${escapeHtml(peerInfo)}</p>
                        </div>
                    ` : ''}
                    
                    ${connectionInfo ? `
                        <div class="detail-section">
                            <h4><i class="fas fa-link"></i> 连接信息</h4>
                            <p class="detail-text">${escapeHtml(connectionInfo)}</p>
                        </div>
                    ` : ''}
                </div>
            ` : ''}
            
            <div class="raw-output">
                <details>
                    <summary><i class="fas fa-terminal"></i> 查看完整输出</summary>
                    <pre class="output-pre">${escapeHtml(output)}</pre>
                </details>
            </div>
            
            <div class="device-check-actions">
                <button class="btn btn-secondary" onclick="showDeviceCheckDialog()">
                    <i class="fas fa-redo"></i> 重新检测
                </button>
                <button class="btn btn-primary" onclick="closeDeviceCheckModal()">
                    <i class="fas fa-check"></i> 完成
                </button>
            </div>
        </div>
    `;
}

// 显示设备检测错误
function showDeviceCheckError(deviceName, errorMsg) {
    const resultDiv = document.getElementById('deviceCheckResult');
    
    resultDiv.innerHTML = `
        <div class="device-check-error">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h3>检测失败</h3>
            <p class="error-message">${escapeHtml(errorMsg)}</p>
            <div class="error-details">
                <p>设备: <strong>${deviceName}.heiyu.space</strong></p>
            </div>
            <div class="device-check-actions">
                <button class="btn btn-secondary" onclick="showDeviceCheckDialog()">
                    <i class="fas fa-redo"></i> 重试
                </button>
                <button class="btn btn-primary" onclick="closeDeviceCheckModal()">
                    <i class="fas fa-times"></i> 关闭
                </button>
            </div>
        </div>
    `;
}

// 关闭设备检测模态框
function closeDeviceCheckModal() {
    const modal = document.getElementById('deviceCheckModal');
    modal.style.display = 'none';
}