/**
 * HTML清洗模块
 * 基于 Mozilla Readability 提取正文（vendor/Readability.js），对外保留 clean(doc) 接口
 */

const HTMLCleaner = {
  // src 匹配该模式时视为占位图，优先改用延迟加载属性里的真实地址
  PLACEHOLDER_SRC_RE: /(^data:|1x1|pixel|spacer|blank|placeholder|loading|transparent)/i,

  LAZY_SRC_ATTRS: ['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-url'],

  /**
   * 清洗HTML内容
   * @param {Document} doc - 文档对象
   * @returns {Object} 清洗后的内容和元数据
   */
  clean(doc) {
    const clone = doc.cloneNode(true);
    this.fixLazyImages(clone);
    clone.querySelectorAll('script, style, noscript, template').forEach(el => el.remove());

    let parsed = null;
    try {
      if (typeof Readability !== 'undefined' && clone.documentElement) {
        // keepClasses 保留 class（如 language-*），供 Turndown 识别代码块语言
        parsed = new Readability(clone, { keepClasses: true }).parse();
      }
    } catch (e) {
      console.warn('[HTMLCleaner] Readability 解析失败，回退到整体提取', e);
    }

    if (parsed && parsed.content && (parsed.textContent || '').trim()) {
      return {
        title: parsed.title || this.extractTitle(doc),
        content: parsed.content,
        textContent: (parsed.textContent || '').trim(),
        url: doc.URL,
        author: parsed.byline || this.extractAuthor(doc),
        publishDate: parsed.publishedTime || this.extractPublishDate(doc),
        siteName: parsed.siteName || this.extractSiteName(doc)
      };
    }

    // Readability 无法识别正文时的回退：保留 body 全部内容
    const source = doc.body || doc.documentElement;
    const fallback = source ? source.cloneNode(true) : null;
    if (fallback) {
      fallback.querySelectorAll('script, style, noscript, template, svg').forEach(el => el.remove());
      this.fixLazyImages(fallback);
    }

    return {
      title: this.extractTitle(doc),
      content: fallback ? fallback.innerHTML : '',
      textContent: fallback ? (fallback.textContent || '').trim() : '',
      url: doc.URL,
      author: this.extractAuthor(doc),
      publishDate: this.extractPublishDate(doc),
      siteName: this.extractSiteName(doc)
    };
  },

  /**
   * 将延迟加载属性中的真实图片地址写入 src
   */
  fixLazyImages(root) {
    root.querySelectorAll('img').forEach(img => {
      const lazySrc = this.LAZY_SRC_ATTRS.map(attr => img.getAttribute(attr)).find(Boolean);
      const currentSrc = img.getAttribute('src') || '';
      if (lazySrc && (!currentSrc || this.PLACEHOLDER_SRC_RE.test(currentSrc))) {
        img.setAttribute('src', lazySrc);
      }
    });
  },

  /**
   * 提取标题
   */
  extractTitle(doc) {
    // 尝试各种标题来源
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) return ogTitle.content;

    const twitterTitle = doc.querySelector('meta[name="twitter:title"]');
    if (twitterTitle) return twitterTitle.content;

    const h1 = doc.querySelector('h1');
    if (h1) return h1.textContent.trim();

    return doc.title || '无标题';
  },

  /**
   * 提取作者
   */
  extractAuthor(doc) {
    const selectors = [
      'meta[name="author"]',
      'meta[property="article:author"]',
      'meta[name="twitter:creator"]',
      '.author',
      '.byline',
      '[rel="author"]'
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
      'meta[name="publishdate"]',
      'meta[name="date"]',
      'time[datetime]',
      '.published',
      '.date'
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

    const twitterSite = doc.querySelector('meta[name="twitter:site"]');
    if (twitterSite) return twitterSite.content;

    try {
      return new URL(doc.URL).hostname;
    } catch (e) {
      return '';
    }
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HTMLCleaner;
}
