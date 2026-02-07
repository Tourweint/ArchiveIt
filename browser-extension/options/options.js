/**
 * Options 页面脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素
  const apiKeyInput = document.getElementById('apiKey');
  const portInput = document.getElementById('port');
  const folderInput = document.getElementById('folder');
  const filenameTemplateInput = document.getElementById('filenameTemplate');
  const btnTestConnection = document.getElementById('btnTestConnection');
  const connectionResult = document.getElementById('connectionResult');
  const btnSave = document.getElementById('btnSave');
  const saveResult = document.getElementById('saveResult');

  // 加载配置
  async function loadConfig() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getConfig' });
      if (response && response.success) {
        const config = response.config;
        apiKeyInput.value = config.apiKey || '';
        portInput.value = config.port || 27123;
        folderInput.value = config.folder || 'Archive';
        filenameTemplateInput.value = config.filenameTemplate || '{{title}}';
      }
    } catch (error) {
      console.error('加载配置失败:', error);
    }
  }

  // 保存配置
  async function saveConfig() {
    const config = {
      apiKey: apiKeyInput.value.trim(),
      port: parseInt(portInput.value) || 27123,
      folder: folderInput.value.trim(),
      filenameTemplate: filenameTemplateInput.value.trim() || '{{title}}'
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'setConfig',
        config: config
      });

      if (response && response.success) {
        showResult(saveResult, '保存成功!', 'success');
      } else {
        showResult(saveResult, response?.error || '保存失败', 'error');
      }
    } catch (error) {
      showResult(saveResult, '保存失败: ' + error.message, 'error');
    }
  }

  // 测试连接
  async function testConnection() {
    // 先保存当前配置
    const config = {
      apiKey: apiKeyInput.value.trim(),
      port: parseInt(portInput.value) || 27124,
      folder: folderInput.value.trim(),
      filenameTemplate: filenameTemplateInput.value.trim() || '{{title}}'
    };

    if (!config.apiKey) {
      showResult(connectionResult, '请先输入API密钥', 'error');
      return;
    }

    // 临时保存配置用于测试
    try {
      await chrome.runtime.sendMessage({
        action: 'setConfig',
        config: config
      });
    } catch (error) {
      console.error('临时保存配置失败:', error);
    }

    showResult(connectionResult, '测试中...', 'loading');

    try {
      const response = await chrome.runtime.sendMessage({ action: 'testConnection' });
      
      if (response && response.connected) {
        showResult(connectionResult, '连接成功!', 'success');
      } else {
        showResult(connectionResult, '连接失败，请检查Obsidian是否运行且插件已启用', 'error');
      }
    } catch (error) {
      showResult(connectionResult, '连接失败: ' + error.message, 'error');
    }
  }

  // 显示结果
  function showResult(element, message, type) {
    element.textContent = message;
    element.className = 'result ' + type;
    
    if (type !== 'loading') {
      setTimeout(() => {
        element.textContent = '';
        element.className = 'result';
      }, 3000);
    }
  }

  // 事件监听
  btnSave.addEventListener('click', saveConfig);
  btnTestConnection.addEventListener('click', testConnection);

  // 加载配置
  loadConfig();
});