/**
 * Popup 脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素
  const pageTitle = document.getElementById('pageTitle');
  const pageUrl = document.getElementById('pageUrl');
  const btnCapturePage = document.getElementById('btnCapturePage');
  const btnCaptureSelection = document.getElementById('btnCaptureSelection');
  const btnSelectElement = document.getElementById('btnSelectElement');
  const status = document.getElementById('status');
  const linkOptions = document.getElementById('linkOptions');
  const connectionStatus = document.getElementById('connectionStatus');

  // 当前标签页信息
  let currentTab = null;

  // 初始化
  async function init() {
    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      currentTab = tabs[0];

      if (!currentTab) {
        pageTitle.textContent = '无法获取当前页面';
        return;
      }

      // 显示页面 URL
      pageUrl.textContent = currentTab.url || '';

      // 先注入 content script
      await chrome.runtime.sendMessage({ 
        action: 'injectScript', 
        tabId: currentTab.id 
      });

      // 获取页面信息
      const response = await sendMessageToTab({ action: 'getPageInfo' });
      if (response && response.success) {
        pageTitle.textContent = response.data.title || '无标题';
        
        // 如果有选中文本，启用"归档选中内容"按钮
        if (response.data.hasSelection) {
          btnCaptureSelection.disabled = false;
        }
      } else {
        // 使用 tab 的信息作为备选
        pageTitle.textContent = currentTab.title || '无标题';
      }
    } catch (error) {
      console.error('Popup init error:', error);
      pageTitle.textContent = currentTab?.title || '无法访问页面';
      pageUrl.textContent = currentTab?.url || '';
    }

    // 检查连接状态
    checkConnection();
  }

  // 发送消息到内容脚本
  function sendMessageToTab(message) {
    return new Promise((resolve) => {
      if (!currentTab) {
        resolve(null);
        return;
      }
      chrome.tabs.sendMessage(currentTab.id, message, (response) => {
        resolve(response);
      });
    });
  }

  // 检查Obsidian连接
  async function checkConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testConnection' });
      if (response && response.connected) {
        connectionStatus.textContent = '已连接';
        connectionStatus.className = 'status-connected';
      } else {
        connectionStatus.textContent = '未连接';
        connectionStatus.className = 'status-disconnected';
      }
    } catch (error) {
      connectionStatus.textContent = '未连接';
      connectionStatus.className = 'status-disconnected';
    }
  }

  // 显示状态消息
  function showStatus(message, type = 'info') {
    const statusClass = type === 'success' ? 'status-success' : 
                       type === 'error' ? 'status-error' : 'status-loading';
    
    status.innerHTML = `
      <div class="status-message ${statusClass}">
        ${type === 'loading' ? '<div class="spinner"></div>' : ''}
        <span>${message}</span>
      </div>
    `;

    // 3秒后清除状态
    if (type !== 'loading') {
      setTimeout(() => {
        status.innerHTML = '';
      }, 3000);
    }
  }

  // 归档整个页面
  btnCapturePage.addEventListener('click', async () => {
    showStatus('正在归档页面...', 'loading');
    btnCapturePage.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'capturePage',
        tabId: currentTab.id
      });

      if (response && response.success) {
        showStatus(`已保存到: ${response.data.filePath}`, 'success');
      } else {
        showStatus(response?.error || '归档失败', 'error');
      }
    } catch (error) {
      showStatus('归档失败: ' + error.message, 'error');
    } finally {
      btnCapturePage.disabled = false;
    }
  });

  // 归档选中内容
  btnCaptureSelection.addEventListener('click', async () => {
    showStatus('正在归档选中内容...', 'loading');
    btnCaptureSelection.disabled = true;

    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'captureSelection',
        tabId: currentTab.id
      });

      if (response && response.success) {
        showStatus(`已保存到: ${response.data.filePath}`, 'success');
      } else {
        showStatus(response?.error || '归档失败', 'error');
      }
    } catch (error) {
      showStatus('归档失败: ' + error.message, 'error');
    } finally {
      btnCaptureSelection.disabled = false;
    }
  });

  // 选择区域归档
  btnSelectElement.addEventListener('click', async () => {
    try {
      await chrome.runtime.sendMessage({ 
        action: 'startSelection',
        tabId: currentTab.id
      });
      
      // 关闭popup，让用户在页面上选择
      window.close();
    } catch (error) {
      showStatus('启动选择模式失败: ' + error.message, 'error');
    }
  });

  // 打开设置页面
  linkOptions.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // 启动
  init();
});