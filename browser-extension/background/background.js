/**
 * 后台服务 - 处理API请求和消息传递
 */

// Obsidian API 配置
const DEFAULT_CONFIG = {
  apiKey: '',
  port: 27123,
  folder: 'ArchiveBox',
  filenameTemplate: '{{date}}-{{title}}',
  noteTemplate: '',
  includeImages: true
};

// 后台服务
const BackgroundService = {
  config: null,

  /**
   * 初始化
   */
  async init() {
    // 加载配置
    await this.loadConfig();
    
    // 设置消息监听
    this.setupMessageListeners();
    
    // 设置右键菜单
    this.setupContextMenus();
    
    console.log('Archive extension background service initialized');
  },

  /**
   * 加载配置
   */
  async loadConfig() {
    const result = await chrome.storage.sync.get('archiveConfig');
    this.config = { ...DEFAULT_CONFIG, ...result.archiveConfig };
  },

  /**
   * 保存配置
   */
  async saveConfig(config) {
    this.config = { ...this.config, ...config };
    await chrome.storage.sync.set({ archiveConfig: this.config });
  },

  /**
   * 设置消息监听
   */
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开启
    });
  },

  /**
   * 处理消息
   */
  async handleMessage(request, sender, sendResponse) {
    try {
      // 获取 tabId：优先使用请求中的，其次使用 sender.tab
      const tabId = request.tabId || sender.tab?.id;
      
      switch (request.action) {
        case 'sendToObsidian':
          const result = await this.sendToObsidian(request.data);
          sendResponse({ success: true, data: result });
          break;
          
        case 'capturePage':
          if (!tabId) {
            sendResponse({ success: false, error: '无法获取当前页面' });
            break;
          }
          const pageData = await this.capturePage(tabId);
          const pageResult = await this.sendToObsidian(pageData);
          sendResponse({ success: true, data: pageResult });
          break;
          
        case 'captureSelection':
          if (!tabId) {
            sendResponse({ success: false, error: '无法获取当前页面' });
            break;
          }
          const selectionData = await this.captureSelection(tabId);
          const selectionResult = await this.sendToObsidian(selectionData);
          sendResponse({ success: true, data: selectionResult });
          break;
          
        case 'startSelection':
          if (!tabId) {
            sendResponse({ success: false, error: '无法获取当前页面' });
            break;
          }
          await this.injectContentScript(tabId);
          chrome.tabs.sendMessage(tabId, { action: 'startSelection' });
          sendResponse({ success: true });
          break;
          
        case 'getConfig':
          sendResponse({ success: true, config: this.config });
          break;
          
        case 'setConfig':
          await this.saveConfig(request.config);
          sendResponse({ success: true });
          break;
          
        case 'testConnection':
          const testResult = await this.testObsidianConnection();
          sendResponse({ success: true, connected: testResult });
          break;
          
        case 'injectScript':
          // 注入 content script
          if (!request.tabId) {
            sendResponse({ success: false, error: '缺少 tabId' });
            break;
          }
          try {
            await this.injectContentScript(request.tabId);
            sendResponse({ success: true });
          } catch (error) {
            sendResponse({ success: false, error: error.message });
          }
          break;
          
        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ success: false, error: error.message });
    }
  },

  /**
   * 设置右键菜单
   */
  setupContextMenus() {
    // 移除现有菜单
    chrome.contextMenus.removeAll();

    // 创建父菜单（在页面右键时显示）
    chrome.contextMenus.create({
      id: 'archive-parent',
      title: '归档到Obsidian',
      contexts: ['page']
    });

    // 子菜单：归档整个页面
    chrome.contextMenus.create({
      id: 'archive-page',
      title: '归档整个页面',
      contexts: ['page'],
      parentId: 'archive-parent'
    });

    // 子菜单：选择区域归档
    chrome.contextMenus.create({
      id: 'archive-select-element',
      title: '选择区域归档',
      contexts: ['page'],
      parentId: 'archive-parent'
    });

    // 选中内容时显示的菜单
    chrome.contextMenus.create({
      id: 'archive-selection',
      title: '归档选中内容到Obsidian',
      contexts: ['selection']
    });

    // 链接右键菜单
    chrome.contextMenus.create({
      id: 'archive-link',
      title: '归档链接到Obsidian',
      contexts: ['link']
    });

    // 监听点击
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      this.handleContextMenuClick(info, tab);
    });
  },

  /**
   * 处理右键菜单点击
   */
  async handleContextMenuClick(info, tab) {
    try {
      // 检查 tab 是否存在
      if (!tab || !tab.id) {
        console.error('Tab is undefined or has no id', info, tab);
        this.showNotification('无法访问当前页面', 'basic');
        return;
      }

      switch (info.menuItemId) {
        case 'archive-page':
          await this.injectContentScript(tab.id);
          const pageData = await this.capturePage(tab.id);
          await this.sendToObsidian(pageData);
          chrome.tabs.sendMessage(tab.id, { action: 'showToast', message: '页面已归档到Obsidian', type: 'success' });
          break;

        case 'archive-selection':
          await this.injectContentScript(tab.id);
          const selectionData = await this.captureSelection(tab.id);
          await this.sendToObsidian(selectionData);
          chrome.tabs.sendMessage(tab.id, { action: 'showToast', message: '选中内容已归档到Obsidian', type: 'success' });
          break;

        case 'archive-link':
          const linkData = {
            title: '链接: ' + (info.linkText || info.linkUrl),
            content: `[${info.linkText || info.linkUrl}](${info.linkUrl})`,
            url: info.linkUrl,
            captureType: 'link'
          };
          await this.sendToObsidian(linkData);
          chrome.tabs.sendMessage(tab.id, { action: 'showToast', message: '链接已归档到Obsidian', type: 'success' });
          break;

        case 'archive-select-element':
          await this.injectContentScript(tab.id);
          chrome.tabs.sendMessage(tab.id, { action: 'startSelection' });
          chrome.tabs.sendMessage(tab.id, { action: 'showToast', message: '请点击页面上的元素进行归档', type: 'info' });
          break;
      }
    } catch (error) {
      console.error('Context menu error:', error);
      if (tab && tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: 'showToast', message: '归档失败: ' + error.message, type: 'error' });
      }
    }
  },

  /**
   * 注入内容脚本
   */
  async injectContentScript(tabId) {
    // 先尝试 ping，如果成功说明已经注入
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      console.log('[Background] Content script already injected');
      return;
    } catch (e) {
      // 未注入，继续执行注入
    }

    console.log('[Background] Injecting content scripts...');
    
    // 注入脚本
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'utils/vendor/Readability.js',
        'utils/vendor/turndown.js',
        'utils/vendor/turndown-plugin-gfm.js',
        'utils/site-adapters.js',
        'utils/html-cleaner.js',
        'utils/markdown-converter.js',
        'content/content.js'
      ]
    });

    // 注入样式
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content/content.css']
    });

    // 等待脚本初始化完成（最多等待3秒）
    let retries = 10;
    while (retries > 0) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        console.log('[Background] Content script ready');
        return;
      } catch (e) {
        retries--;
      }
    }
    
    throw new Error('内容脚本注入超时');
  },

  /**
   * 捕获页面
   */
  async capturePage(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: 'capturePage' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '捕获失败'));
        }
      });
    });
  },

  /**
   * 捕获选中内容
   */
  async captureSelection(tabId) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, { action: 'captureSelection' }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '捕获失败'));
        }
      });
    });
  },

  /**
   * 发送到Obsidian
   */
  async sendToObsidian(data) {
    // 检查配置
    if (!this.config.apiKey) {
      throw new Error('请先在设置中配置Obsidian API密钥');
    }

    // 生成文件名（确保扩展名不被截断）
    const filename = this.generateFilenameWithExt(data, '.md');
    
    // 构建文件路径
    let filePath = this.config.folder 
      ? `${this.config.folder}/${filename}`
      : `${filename}`;
    filePath = this.ensureFilePathExt(filePath, '.md');

    // 准备内容
    const content = data.content;

    // 调试：确认生成的文件名与路径（可在扩展后台控制台查看）
    console.info('[Archive] filename:', filename, 'filePath:', filePath);

    try {
      // 检查文件是否存在
      const exists = await this.checkFileExists(filePath);
      
      if (exists) {
        // 更新现有文件
        await this.updateFile(filePath, content);
      } else {
        // 创建新文件
        await this.createFile(filePath, content);
      }

      return { filePath, updated: exists };
    } catch (error) {
      console.error('Obsidian API error:', error);
      throw new Error('发送到Obsidian失败: ' + error.message);
    }
  },

  /**
   * 生成文件名
   */
  generateFilename(data) {
    let filename = this.config.filenameTemplate;
    
    // 替换模板变量
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    
    filename = filename
      .replace(/{{title}}/g, this.sanitizeFilename(data.title || 'untitled'))
      .replace(/{{date}}/g, dateStr)
      .replace(/{{time}}/g, timeStr)
      .replace(/{{url}}/g, this.sanitizeFilename(data.url || ''))
      .replace(/{{site}}/g, this.sanitizeFilename(data.siteName || ''));

    // 如果模板中没有变量，使用标题
    if (!filename || filename === this.config.filenameTemplate) {
      filename = this.sanitizeFilename(data.title || 'untitled');
    }

    // 添加日期前缀（如果文件名中没有日期）
    if (!filename.includes(dateStr)) {
      filename = `${dateStr}-${filename}`;
    }

    return filename;
  },

  /**
   * 清理文件名（不包含扩展名）
   */
  sanitizeFilename(str) {
    return str
      .replace(/[<>:"/\\|?*]/g, '-')  // 替换非法字符
      .replace(/\s+/g, '-')            // 空格替换为连字符
      .replace(/-+/g, '-')             // 多个连字符合并
      .replace(/^-|-$/g, '')           // 移除首尾连字符
      .substring(0, 100);              // 限制长度
  },

  /**
   * 生成文件名（包含扩展名，确保扩展名不被截断）
   */
  generateFilenameWithExt(data, ext = '.md') {
    let baseName = this.generateFilename(data);
    const extLower = ext.toLowerCase();

    // 如果模板已经包含扩展名，先剥离，避免重复
    if (baseName.toLowerCase().endsWith(extLower)) {
      baseName = baseName.substring(0, baseName.length - ext.length);
    }

    // 清理尾部无效字符，避免出现结尾为 "-" 或 "." 的文件名
    baseName = baseName.replace(/[.\s-]+$/g, '');
    if (!baseName) {
      baseName = 'untitled';
    }

    // 如果基础名已经太长，截断并添加扩展名
    const maxBaseLength = 100 - ext.length;
    if (baseName.length > maxBaseLength) {
      baseName = baseName.substring(0, maxBaseLength);
    }

    return baseName + ext;
  },

  /**
   * 确保文件路径以指定扩展名结尾（只处理最后一段）
   */
  ensureFilePathExt(filePath, ext = '.md') {
    const extLower = ext.toLowerCase();
    const parts = filePath.split('/');
    let name = parts.pop() || '';
    if (!name.toLowerCase().endsWith(extLower)) {
      name = name.replace(/[.\s-]+$/g, '');
      if (!name) {
        name = 'untitled';
      }
      name = name + ext;
    }
    parts.push(name);
    return parts.join('/');
  },

  /**
   * URL 编码文件路径（保留目录分隔符）
   */
  encodeFilePath(filePath) {
    return filePath
      .split('/')
      .map(part => encodeURIComponent(part))
      .join('/');
  },

  /**
   * 检查文件是否存在
   */
  async checkFileExists(filePath) {
    try {
      const encodedPath = this.encodeFilePath(filePath);
      const response = await fetch(`http://localhost:${this.config.port}/vault/${encodedPath}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  /**
   * 创建文件
   */
  async createFile(filePath, content) {
    const encodedPath = this.encodeFilePath(filePath);
    const response = await fetch(`http://localhost:${this.config.port}/vault/${encodedPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'text/markdown'
      },
      body: content
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`创建文件失败: ${error}`);
    }

    return response;
  },

  /**
   * 更新文件
   */
  async updateFile(filePath, content) {
    // 先读取现有内容
    const encodedPath = this.encodeFilePath(filePath);
    const existingResponse = await fetch(`http://localhost:${this.config.port}/vault/${encodedPath}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    if (!existingResponse.ok) {
      throw new Error('读取现有文件失败');
    }

    const existingContent = await existingResponse.text();
    
    // 追加内容
    const updatedContent = existingContent + '\n\n---\n\n' + content;

    // 写入更新后的内容
    const response = await fetch(`http://localhost:${this.config.port}/vault/${encodedPath}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'text/markdown'
      },
      body: updatedContent
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`更新文件失败: ${error}`);
    }

    return response;
  },

  /**
   * 测试Obsidian连接
   */
  async testObsidianConnection() {
    try {
      const response = await fetch(`http://localhost:${this.config.port}/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  /**
   * 显示通知
   */
  showNotification(message, type = 'basic') {
    const iconUrl = chrome.runtime.getURL('icons/icon128.png');
    chrome.notifications.create({
      type: type,
      iconUrl: iconUrl,
      title: '网页归档助手',
      message: message
    });
  }
};

// 初始化
BackgroundService.init();
