/**
 * HTML清洗模块
 * 移除无关元素，提取正文内容
 */

const HTMLCleaner = {
  // 要移除的标签选择器
  REMOVE_SELECTORS: [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    '.advertisement',
    '.ads',
    '.social-share',
    '.comments',
    '#comments',
    '.sidebar',
    '.widget',
    'iframe',
    'noscript',
    '[role="banner"]',
    '[role="navigation"]',
    '[role="complementary"]',
    '[role="contentinfo"]'
  ],

  // 要移除的属性
  REMOVE_ATTRIBUTES: [
    'onclick',
    'onload',
    'onerror',
    'data-*',
    'aria-*',
    'role',
    'tabindex',
    'style',
    'class'
  ],

  // 保留的class白名单（用于代码高亮等）
  ALLOWED_CLASSES: [
    'language-*',
    'hljs-*',
    'line-numbers',
    'copy-code'
  ],

  // 这些选择器命中 article/main 内部的元素时保留（文章自身的标题栏、署名栏常使用它们）
  KEEP_INSIDE_ARTICLE: ['header', 'footer', '[role="banner"]', '[role="contentinfo"]'],

  // src 匹配该模式时视为占位图，优先改用延迟加载属性里的真实地址
  PLACEHOLDER_SRC_RE: /(^data:|1x1|pixel|spacer|blank|placeholder|loading|transparent)/i,

  /**
   * 清洗HTML内容
   * @param {Document} doc - 文档对象
   * @returns {Object} 清洗后的内容和元数据
   */
  clean(doc) {
    // 克隆文档以避免修改原始页面
    const clone = doc.cloneNode(true);
    
    // 移除无关元素
    this.removeUnwantedElements(clone);
    
    // 提取主要内容
    const mainContent = this.extractMainContent(clone);
    
    // 清洗属性
    this.cleanAttributes(mainContent);
    
    // 处理图片链接
    this.processImages(mainContent, doc.baseURI);
    
    // 处理链接
    this.processLinks(mainContent, doc.baseURI);
    
    return {
      title: this.extractTitle(doc),
      content: mainContent.innerHTML,
      textContent: mainContent.textContent.trim(),
      url: doc.URL,
      author: this.extractAuthor(doc),
      publishDate: this.extractPublishDate(doc),
      siteName: this.extractSiteName(doc)
    };
  },

  /**
   * 移除无关元素
   */
  removeUnwantedElements(doc) {
    this.REMOVE_SELECTORS.forEach(selector => {
      try {
        const elements = doc.querySelectorAll(selector);
        elements.forEach(el => {
          if (this.KEEP_INSIDE_ARTICLE.includes(selector) && el.closest('article, main')) {
            return;
          }
          el.remove();
        });
      } catch (e) {
        console.warn(`移除选择器失败: ${selector}`, e);
      }
    });
  },

  /**
   * 提取主要内容
   * 使用启发式算法找到最可能是正文的元素
   */
  extractMainContent(doc) {
    // 优先选择语义化标签
    const semanticSelectors = [
      'article',
      'main',
      '[role="main"]',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.content',
      '#content',
      '.post',
      '.article'
    ];

    for (const selector of semanticSelectors) {
      const element = doc.querySelector(selector);
      if (element && this.hasEnoughContent(element)) {
        return element;
      }
    }

    // 使用启发式算法评分
    return this.findBestContentElement(doc);
  },

  /**
   * 检查元素是否有足够的内容
   * CJK 字符逐字计数：中文正文没有空格，按空格分词会误判为内容不足
   */
  hasEnoughContent(element) {
    const text = (element.textContent || '').trim();
    const cjkCount = (text.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    const wordCount = (text.replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ').match(/\S+/g) || []).length;
    return cjkCount + wordCount > 100;
  },

  /**
   * 使用启发式算法找到最佳内容元素
   */
  findBestContentElement(doc) {
    const candidates = [];
    const body = doc.body;
    
    if (!body) {
      const div = doc.createElement('div');
      div.innerHTML = doc.documentElement?.innerHTML || '';
      return div;
    }

    // 遍历所有段落和div
    const elements = body.querySelectorAll('p, div, section');
    
    elements.forEach(el => {
      const score = this.calculateContentScore(el);
      if (score > 0) {
        candidates.push({ element: el, score });
      }
    });

    // 按分数排序
    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0) {
      // 找到得分最高的元素的父容器
      let bestElement = candidates[0].element;
      
      // 向上查找包含更多内容的父元素
      for (let i = 0; i < 3; i++) {
        const parent = bestElement.parentElement;
        if (parent && parent !== body && this.hasEnoughContent(parent)) {
          bestElement = parent;
        } else {
          break;
        }
      }
      
      return bestElement;
    }

    return body;
  },

  /**
   * 计算元素的内容分数
   */
  calculateContentScore(element) {
    const text = element.textContent || '';
    const textLength = text.trim().length;
    
    if (textLength < 100) return 0;

    let score = textLength;
    
    // 加分项
    const tagName = element.tagName.toLowerCase();
    if (tagName === 'article') score *= 2;
    if (tagName === 'main') score *= 1.5;
    if (element.className.includes('content')) score *= 1.3;
    if (element.className.includes('article')) score *= 1.3;
    
    // 段落密度
    const paragraphs = element.querySelectorAll('p').length;
    if (paragraphs > 0) {
      score += paragraphs * 50;
    }

    // 减分项
    if (element.className.includes('comment')) score *= 0.3;
    if (element.className.includes('sidebar')) score *= 0.3;
    if (element.className.includes('footer')) score *= 0.3;
    
    // 链接密度（链接太多可能是导航）
    const linkDensity = this.calculateLinkDensity(element);
    if (linkDensity > 0.3) score *= 0.5;

    return score;
  },

  /**
   * 计算链接密度
   */
  calculateLinkDensity(element) {
    const textLength = (element.textContent || '').length;
    if (textLength === 0) return 0;
    
    const linkTextLength = Array.from(element.querySelectorAll('a'))
      .reduce((sum, a) => sum + (a.textContent || '').length, 0);
    
    return linkTextLength / textLength;
  },

  /**
   * 清洗属性
   */
  cleanAttributes(element) {
    const allElements = element.querySelectorAll('*');

    allElements.forEach(el => {
      const attributesToRemove = [];
      let classValue = '';

      for (const attr of el.attributes) {
        const attrName = attr.name.toLowerCase();

        // 特殊处理 class 属性：过滤白名单
        if (attrName === 'class') {
          classValue = this.filterAllowedClasses(attr.value);
          if (!classValue) {
            attributesToRemove.push(attr.name);
          }
          continue;
        }

        // 检查是否需要移除
        for (const pattern of this.REMOVE_ATTRIBUTES) {
          if (pattern.endsWith('*')) {
            if (attrName.startsWith(pattern.slice(0, -1))) {
              attributesToRemove.push(attr.name);
              break;
            }
          } else if (attrName === pattern) {
            attributesToRemove.push(attr.name);
            break;
          }
        }
      }

      // 移除标记的属性
      attributesToRemove.forEach(attr => el.removeAttribute(attr));

      // 如果有保留的 class，重新设置
      if (classValue) {
        el.setAttribute('class', classValue);
      }
    });
  },

  /**
   * 过滤保留的 class
   * @param {string} classValue - 原始 class 值
   * @returns {string} 过滤后的 class 值
   */
  filterAllowedClasses(classValue) {
    if (!classValue) return '';

    const classes = classValue.split(/\s+/);
    const allowed = classes.filter(cls => {
      const lowerCls = cls.toLowerCase();
      return this.ALLOWED_CLASSES.some(pattern => {
        if (pattern.endsWith('*')) {
          return lowerCls.startsWith(pattern.slice(0, -1).toLowerCase());
        }
        return lowerCls === pattern.toLowerCase();
      });
    });

    return allowed.join(' ');
  },

  /**
   * 处理图片链接
   */
  processImages(element, baseUrl) {
    const images = element.querySelectorAll('img');

    images.forEach(img => {
      // 优先使用延迟加载属性里的真实地址（src 可能是 1px 占位图）
      const lazySrc = ['data-src', 'data-original', 'data-lazy-src', 'data-lazy', 'data-url']
        .map(attr => img.getAttribute(attr))
        .find(Boolean);
      const currentSrc = img.getAttribute('src') || '';

      if (lazySrc && (!currentSrc || this.PLACEHOLDER_SRC_RE.test(currentSrc))) {
        img.setAttribute('src', lazySrc);
      }

      // 转换相对URL为绝对URL
      if (img.getAttribute('src')) {
        try {
          img.src = new URL(img.getAttribute('src'), baseUrl).href;
        } catch (e) {
          console.warn('图片URL转换失败:', img.src);
        }
      }

      // 移除空alt
      if (!img.alt) {
        img.alt = '';
      }
    });
  },

  /**
   * 处理链接
   */
  processLinks(element, baseUrl) {
    const links = element.querySelectorAll('a');
    
    links.forEach(a => {
      if (a.href) {
        try {
          a.href = new URL(a.href, baseUrl).href;
        } catch (e) {
          console.warn('链接URL转换失败:', a.href);
        }
      }
      
      // 在新标签页打开外部链接
      try {
        const url = new URL(a.href);
        if (url.hostname !== new URL(baseUrl).hostname) {
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
        }
      } catch (e) {}
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