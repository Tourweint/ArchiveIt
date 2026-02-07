/**
 * 内容脚本 - 页面内容捕获
 */

// 加载工具模块
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(url);
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// 内容捕获器
const ContentCapture = {
  isSelecting: false,
  selectedElement: null,
  highlightOverlay: null,

  /**
   * 初始化
   */
  init() {
    this.createHighlightOverlay();
    this.bindEvents();
    this.listenToBackground();
  },

  /**
   * 创建高亮遮罩
   */
  createHighlightOverlay() {
    this.highlightOverlay = document.createElement('div');
    this.highlightOverlay.id = 'archive-highlight-overlay';
    this.highlightOverlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483646;
      background: rgba(59, 130, 246, 0.2);
      border: 2px solid rgba(59, 130, 246, 0.8);
      border-radius: 4px;
      transition: all 0.15s ease;
      display: none;
    `;
    document.body.appendChild(this.highlightOverlay);
  },

  /**
   * 绑定事件
   */
  bindEvents() {
    // 鼠标移动高亮
    document.addEventListener('mousemove', (e) => {
      if (!this.isSelecting) return;
      
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (element && element !== this.selectedElement) {
        this.highlightElement(element);
      }
    });

    // 点击选择
    document.addEventListener('click', (e) => {
      if (!this.isSelecting) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (element) {
        this.selectElement(element);
      }
    }, true);

    // ESC取消选择模式
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSelecting) {
        this.stopSelectionMode();
      }
    });
  },

  /**
   * 监听后台消息
   */
  listenToBackground() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case 'ping':
          // 响应后台的 ping 检查
          sendResponse({ success: true, pong: true });
          break;
          
        case 'startSelection':
          this.startSelectionMode();
          sendResponse({ success: true });
          break;
          
        case 'capturePage':
          this.captureFullPage()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true; // 保持消息通道开启
          
        case 'captureSelection':
          this.captureCurrentSelection()
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
          return true;
          
        case 'getPageInfo':
          sendResponse({
            success: true,
            data: {
              title: document.title,
              url: location.href,
              hasSelection: window.getSelection().toString().length > 0
            }
          });
          break;
      }
    });
  },

  /**
   * 开始选择模式
   */
  startSelectionMode() {
    this.isSelecting = true;
    document.body.style.cursor = 'crosshair';
    
    // 显示提示
    this.showToast('点击选择要捕获的区域，按ESC取消');
  },

  /**
   * 停止选择模式
   */
  stopSelectionMode() {
    this.isSelecting = false;
    this.selectedElement = null;
    document.body.style.cursor = '';
    this.highlightOverlay.style.display = 'none';
    this.hideToast();
  },

  /**
   * 高亮元素
   */
  highlightElement(element) {
    const rect = element.getBoundingClientRect();
    this.highlightOverlay.style.display = 'block';
    this.highlightOverlay.style.top = `${rect.top + window.scrollY}px`;
    this.highlightOverlay.style.left = `${rect.left + window.scrollX}px`;
    this.highlightOverlay.style.width = `${rect.width}px`;
    this.highlightOverlay.style.height = `${rect.height}px`;
  },

  /**
   * 选择元素
   */
  selectElement(element) {
    this.selectedElement = element;
    this.isSelecting = false;
    document.body.style.cursor = '';
    
    // 捕获选中元素
    this.captureElement(element)
      .then(data => {
        this.sendToBackground(data);
        this.highlightOverlay.style.display = 'none';
      })
      .catch(error => {
        console.error('捕获失败:', error);
        this.showToast('捕获失败: ' + error.message, 'error');
        this.highlightOverlay.style.display = 'none';
      });
  },

  /**
   * 捕获整个页面
   */
  async captureFullPage() {
    // 检查是否有站点适配器
    const adapter = SiteAdapters.getAdapter(location.href);
    
    if (adapter) {
      console.log(`[ContentCapture] Using adapter: ${adapter.name}`);
      const data = adapter.extract(document);
      const markdown = this.convertAdapterDataToMarkdown(data);
      
      return {
        title: data.title,
        content: markdown,
        url: data.url,
        author: data.author,
        authorHandle: data.authorHandle,
        publishDate: data.publishDate,
        siteName: data.siteName,
        captureType: 'full',
        adapter: adapter.name,
        metadata: {
          tweetId: data.tweetId,
          media: data.media,
          isReply: data.isReply,
          replyTo: data.replyTo,
          stats: data.stats
        }
      };
    }
    
    // 使用默认的HTMLCleaner清洗内容
    const cleaned = this.cleanDocument(document);
    const markdown = this.convertToMarkdown(cleaned);
    
    return {
      title: cleaned.title,
      content: markdown,
      url: cleaned.url,
      author: cleaned.author,
      publishDate: cleaned.publishDate,
      siteName: cleaned.siteName,
      captureType: 'full'
    };
  },

  /**
   * 捕获当前文本选择
   */
  async captureCurrentSelection() {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (!selectedText) {
      throw new Error('没有选中的文本');
    }

    // 获取选中的HTML
    const range = selection.getRangeAt(0);
    const container = document.createElement('div');
    container.appendChild(range.cloneContents());
    
    const cleaned = this.cleanElement(container);
    const markdown = this.convertToMarkdown({
      ...cleaned,
      title: document.title
    });

    return {
      title: document.title,
      content: markdown,
      url: location.href,
      author: this.extractAuthor(document),
      publishDate: this.extractPublishDate(document),
      siteName: this.extractSiteName(document),
      captureType: 'selection',
      selectedText: selectedText
    };
  },

  /**
   * 捕获指定元素
   */
  async captureElement(element) {
    const cleaned = this.cleanElement(element);
    const markdown = this.convertToMarkdown({
      ...cleaned,
      title: document.title
    });

    return {
      title: document.title,
      content: markdown,
      url: location.href,
      author: this.extractAuthor(document),
      publishDate: this.extractPublishDate(document),
      siteName: this.extractSiteName(document),
      captureType: 'element'
    };
  },

  /**
   * 清洗文档
   */
  cleanDocument(doc) {
    return HTMLCleaner.clean(doc);
  },

  /**
   * 清洗元素
   */
  cleanElement(element) {
    const container = element.cloneNode(true);
    
    // 移除脚本和样式
    container.querySelectorAll('script, style').forEach(el => el.remove());
    
    // 处理图片
    container.querySelectorAll('img').forEach(img => {
      if (img.src) {
        try {
          img.src = new URL(img.src, location.href).href;
        } catch (e) {}
      }
    });
    
    // 处理链接
    container.querySelectorAll('a').forEach(a => {
      if (a.href) {
        try {
          a.href = new URL(a.href, location.href).href;
        } catch (e) {}
      }
    });

    return {
      content: container.innerHTML,
      textContent: container.textContent.trim()
    };
  },

  /**
   * 转换为Markdown
   */
  convertToMarkdown(data) {
    return MarkdownConverter.convert(data.content, {
      title: data.title,
      url: data.url,
      author: data.author,
      siteName: data.siteName,
      publishDate: data.publishDate
    });
  },

  /**
   * 将适配器数据转换为Markdown（针对特殊站点如X）
   */
  convertAdapterDataToMarkdown(data) {
    // X (Twitter) 特殊处理
    if (data.siteName === 'X (Twitter)') {
      return this.convertXTweetToMarkdown(data);
    }
    
    // 默认处理
    return MarkdownConverter.convert(data.content, {
      title: data.title,
      url: data.url,
      author: data.author,
      siteName: data.siteName,
      publishDate: data.publishDate
    });
  },

  /**
   * 转换X推文为Markdown
   */
  convertXTweetToMarkdown(data) {
    const lines = [];
    
    // Frontmatter
    lines.push('---');
    lines.push(`title: "${this.escapeMarkdown(data.title)}"`);
    lines.push(`source: "${data.url}"`);
    lines.push(`author: "${data.author || ''}"`);
    lines.push(`authorHandle: "${data.authorHandle || ''}"`);
    lines.push(`site: "${data.siteName}"`);
    if (data.publishDate) {
      lines.push(`date: "${data.publishDate}"`);
    }
    lines.push(`archived: "${new Date().toISOString()}"`);
    if (data.tweetId) {
      lines.push(`tweetId: "${data.tweetId}"`);
    }
    if (data.isReply) {
      lines.push(`isReply: true`);
    }
    lines.push('---\n');
    
    // 作者信息
    if (data.author && data.authorHandle) {
      lines.push(`**${data.author}** ${data.authorHandle}\n`);
    }
    
    // 推文内容
    if (data.content) {
      lines.push(data.content);
      lines.push('');
    }
    
    // 媒体
    if (data.media && data.media.length > 0) {
      lines.push('');
      data.media.forEach(media => {
        if (media.type === 'image') {
          lines.push(`![图片](${media.url})`);
        }
      });
      lines.push('');
    }
    
    // 统计
    if (data.stats) {
      const stats = [];
      if (data.stats.replies) stats.push(`💬 ${data.stats.replies}`);
      if (data.stats.reposts) stats.push(`🔄 ${data.stats.reposts}`);
      if (data.stats.likes) stats.push(`❤️ ${data.stats.likes}`);
      if (stats.length > 0) {
        lines.push('');
        lines.push(stats.join(' | '));
      }
    }
    
    // 原始链接
    lines.push('');
    lines.push(`[查看原文](${data.url})`);
    
    return lines.join('\n');
  },

  /**
   * 转义Markdown特殊字符
   */
  escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/"/g, '\\"').replace(/\n/g, ' ');
  },

  /**
   * 提取作者
   */
  extractAuthor(doc) {
    const selectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      '.author',
      '.byline'
    ];
    
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el) {
        return el.content || el.textContent.trim();
      }
    }
    return '';
  },

  /**
   * 提取发布日期
   */
  extractPublishDate(doc) {
    const selectors = [
      'meta[property="article:published_time"]',
      'meta[name="date"]',
      'time[datetime]'
    ];
    
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el) {
        return el.content || el.datetime || el.textContent.trim();
      }
    }
    return '';
  },

  /**
   * 提取网站名称
   */
  extractSiteName(doc) {
    const ogSite = doc.querySelector('meta[property="og:site_name"]');
    if (ogSite) return ogSite.content;
    
    try {
      return new URL(location.href).hostname;
    } catch (e) {
      return '';
    }
  },

  /**
   * 发送到后台
   */
  sendToBackground(data) {
    chrome.runtime.sendMessage({
      action: 'sendToObsidian',
      data: data
    }, (response) => {
      if (response && response.success) {
        this.showToast('已发送到Obsidian!', 'success');
      } else {
        this.showToast('发送失败: ' + (response?.error || '未知错误'), 'error');
      }
    });
  },

  /**
   * 显示提示
   */
  showToast(message, type = 'info') {
    // 移除现有toast
    const existing = document.getElementById('archive-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'archive-toast';
    
    const colors = {
      info: { bg: '#3b82f6', border: '#2563eb' },
      success: { bg: '#10b981', border: '#059669' },
      error: { bg: '#ef4444', border: '#dc2626' }
    };
    
    const color = colors[type] || colors.info;
    
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      background: ${color.bg};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border: 1px solid ${color.border};
      max-width: 300px;
      word-wrap: break-word;
      animation: archive-slide-in 0.3s ease;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);

    // 自动隐藏
    if (type !== 'info') {
      setTimeout(() => this.hideToast(), 3000);
    }
  },

  /**
   * 隐藏提示
   */
  hideToast() {
    const toast = document.getElementById('archive-toast');
    if (toast) {
      toast.style.animation = 'archive-slide-out 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }
  }
};

// 添加动画样式
const style = document.createElement('style');
style.textContent = `
  @keyframes archive-slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes archive-slide-out {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ContentCapture.init());
} else {
  ContentCapture.init();
}