/**
 * 站点适配器模块
 * 针对不同网站提供定制化的内容提取逻辑
 */

const SiteAdapters = {
  // 注册所有适配器
  adapters: new Map(),

  /**
   * 注册适配器
   * @param {string} name - 适配器名称
   * @param {Object} adapter - 适配器对象
   */
  register(name, adapter) {
    this.adapters.set(name, adapter);
    console.log(`[SiteAdapters] Registered adapter: ${name}`);
  },

  /**
   * 获取匹配当前页面的适配器
   * @param {string} url - 页面URL
   * @returns {Object|null} 匹配的适配器
   */
  getAdapter(url) {
    for (const [name, adapter] of this.adapters) {
      if (adapter.match && adapter.match(url)) {
        return adapter;
      }
    }
    return null;
  },

  /**
   * 获取适配器名称
   * @param {string} url - 页面URL
   * @returns {string|null} 适配器名称
   */
  getAdapterName(url) {
    for (const [name, adapter] of this.adapters) {
      if (adapter.match && adapter.match(url)) {
        return name;
      }
    }
    return null;
  }
};

/**
 * 基础适配器类
 * 提供通用的提取方法，可被具体适配器继承
 */
class BaseAdapter {
  constructor(name) {
    this.name = name;
  }

  /**
   * 检查是否匹配当前URL
   * @param {string} url
   * @returns {boolean}
   */
  match(url) {
    return false;
  }

  /**
   * 提取内容
   * @param {Document} doc - 文档对象
   * @returns {Object} 提取结果
   */
  extract(doc) {
    return {
      title: this.extractTitle(doc),
      content: this.extractContent(doc),
      author: this.extractAuthor(doc),
      publishDate: this.extractDate(doc),
      url: doc.URL,
      siteName: this.getSiteName()
    };
  }

  /**
   * 提取标题
   */
  extractTitle(doc) {
    // 优先使用 og:title
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) return ogTitle.content;
    
    const h1 = doc.querySelector('h1');
    if (h1) return h1.textContent.trim();
    
    return doc.title || '无标题';
  }

  /**
   * 提取正文内容
   */
  extractContent(doc) {
    // 子类应该重写此方法
    return doc.body?.innerHTML || '';
  }

  /**
   * 提取作者
   */
  extractAuthor(doc) {
    return '';
  }

  /**
   * 提取日期
   */
  extractDate(doc) {
    return '';
  }

  /**
   * 获取站点名称
   */
  getSiteName() {
    return '';
  }

  /**
   * 清洗HTML
   */
  cleanHTML(html) {
    // 基础清洗逻辑
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // 移除脚本和样式
    temp.querySelectorAll('script, style, nav, header, footer').forEach(el => el.remove());
    
    return temp.innerHTML;
  }
}

/**
 * X (Twitter) 适配器
 */
class XAdapter extends BaseAdapter {
  constructor() {
    super('x');
  }

  match(url) {
    return /^(https?:\/\/)?(www\.)?(twitter\.com|x\.com)/i.test(url);
  }

  extract(doc) {
    const tweetData = this.extractTweet(doc);
    
    return {
      title: tweetData.title || this.extractTitle(doc),
      content: tweetData.content,
      author: tweetData.author,
      authorHandle: tweetData.authorHandle,
      publishDate: tweetData.date,
      url: doc.URL,
      siteName: 'X (Twitter)',
      tweetId: tweetData.tweetId,
      media: tweetData.media,
      isReply: tweetData.isReply,
      replyTo: tweetData.replyTo,
      stats: tweetData.stats
    };
  }

  /**
   * 提取推文数据
   */
  extractTweet(doc) {
    const result = {
      title: '',
      content: '',
      author: '',
      authorHandle: '',
      date: '',
      tweetId: '',
      media: [],
      isReply: false,
      replyTo: null,
      stats: { replies: 0, reposts: 0, likes: 0, views: 0 }
    };

    try {
      // 获取推文ID
      const urlMatch = doc.URL.match(/\/status\/(\d+)/);
      if (urlMatch) {
        result.tweetId = urlMatch[1];
      }

      // 尝试多种选择器来提取推文内容
      // X 的 DOM 结构经常变化，需要多个备选方案
      
      // 方案1: 使用 article 标签（新版 X）
      const article = this.findMainTweetArticle(doc);
      if (article) {
        this.parseArticle(article, result);
      }

      // 方案2: 使用 data-testid
      if (!result.content) {
        this.parseByTestId(doc, result);
      }

      // 方案3: 从 meta 标签获取
      if (!result.content) {
        this.parseFromMeta(doc, result);
      }

      // 生成标题
      if (result.content) {
        const preview = result.content.substring(0, 50).replace(/\n/g, ' ');
        result.title = `${result.authorHandle || 'X'}: ${preview}${result.content.length > 50 ? '...' : ''}`;
      }

    } catch (error) {
      console.error('[XAdapter] Error extracting tweet:', error);
    }

    return result;
  }

  /**
   * 找到主推文 article
   */
  findMainTweetArticle(doc) {
    // 找到包含当前 URL 的 article
    const articles = doc.querySelectorAll('article[data-testid="tweet"]');
    
    for (const article of articles) {
      // 检查是否包含当前推文链接
      const links = article.querySelectorAll('a[href*="/status/"]');
      for (const link of links) {
        if (link.href.includes(doc.URL)) {
          return article;
        }
      }
    }

    // 如果没有找到，返回第一个 article
    return articles[0];
  }

  /**
   * 解析 article 元素
   */
  parseArticle(article, result) {
    try {
      // 作者信息
      const userLink = article.querySelector('a[href^="/"]');
      if (userLink) {
        const href = userLink.getAttribute('href');
        if (href && href.startsWith('/') && !href.includes('/status/')) {
          result.authorHandle = href.replace('/', '@');
        }
      }

      // 作者名称
      const nameEl = article.querySelector('[data-testid="User-Name"]');
      if (nameEl) {
        const nameLink = nameEl.querySelector('a');
        if (nameLink) {
          result.author = nameLink.textContent.trim();
        }
      }

      // 推文内容
      const textEl = article.querySelector('[data-testid="tweetText"]');
      if (textEl) {
        result.content = this.cleanTweetText(textEl.innerHTML);
      }

      // 时间
      const timeEl = article.querySelector('time');
      if (timeEl) {
        result.date = timeEl.getAttribute('datetime') || timeEl.textContent;
      }

      // 媒体
      const mediaEls = article.querySelectorAll('[data-testid="tweetPhoto"], [data-testid="tweetVideo"]');
      mediaEls.forEach(el => {
        const img = el.querySelector('img');
        if (img && img.src) {
          result.media.push({
            type: 'image',
            url: img.src
          });
        }
      });

      // 统计
      const stats = article.querySelectorAll('[data-testid$="-count"]');
      stats.forEach(stat => {
        const text = stat.textContent.toLowerCase();
        const num = this.parseNumber(text);
        
        if (text.includes('reply') || stat.getAttribute('data-testid')?.includes('reply')) {
          result.stats.replies = num;
        } else if (text.includes('repost') || stat.getAttribute('data-testid')?.includes('retweet')) {
          result.stats.reposts = num;
        } else if (text.includes('like') || stat.getAttribute('data-testid')?.includes('like')) {
          result.stats.likes = num;
        }
      });

    } catch (error) {
      console.error('[XAdapter] Error parsing article:', error);
    }
  }

  /**
   * 通过 data-testid 解析
   */
  parseByTestId(doc, result) {
    // 推文文本
    const tweetText = doc.querySelector('[data-testid="tweetText"]');
    if (tweetText) {
      result.content = this.cleanTweetText(tweetText.innerHTML);
    }

    // 用户信息
    const userName = doc.querySelector('[data-testid="User-Name"]');
    if (userName) {
      const links = userName.querySelectorAll('a');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && href.startsWith('/')) {
          if (!result.authorHandle) {
            result.authorHandle = href.replace('/', '@');
          }
          if (!result.author) {
            result.author = link.textContent.trim();
          }
        }
      });
    }

    // 时间
    const timeEl = doc.querySelector('time');
    if (timeEl) {
      result.date = timeEl.getAttribute('datetime');
    }
  }

  /**
   * 从 meta 标签解析
   */
  parseFromMeta(doc, result) {
    // description 通常包含推文内容
    const descMeta = doc.querySelector('meta[property="og:description"], meta[name="description"]');
    if (descMeta && descMeta.content) {
      result.content = descMeta.content;
    }

    // 作者
    const authorMeta = doc.querySelector('meta[property="og:title"]');
    if (authorMeta && authorMeta.content) {
      const match = authorMeta.content.match(/(.+?)\s*\(@(.+?)\)/);
      if (match) {
        result.author = match[1].trim();
        result.authorHandle = '@' + match[2];
      }
    }
  }

  /**
   * 清洗推文文本
   */
  cleanTweetText(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // 处理链接
    temp.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      const text = a.textContent;
      
      // 如果是话题标签或提及
      if (text.startsWith('#') || text.startsWith('@')) {
        a.outerHTML = text;
      } else if (href) {
        // 完整链接
        const fullUrl = href.startsWith('http') ? href : 'https://x.com' + href;
        a.outerHTML = `[${text}](${fullUrl})`;
      }
    });

    return temp.textContent.trim();
  }

  /**
   * 解析数字
   */
  parseNumber(text) {
    if (!text) return 0;
    
    const num = text.replace(/[^\d.km]/gi, '');
    if (!num) return 0;
    
    if (num.includes('k')) {
      return parseFloat(num) * 1000;
    } else if (num.includes('m')) {
      return parseFloat(num) * 1000000;
    }
    
    return parseInt(num) || 0;
  }

  getSiteName() {
    return 'X (Twitter)';
  }
}

// 注册适配器
SiteAdapters.register('x', new XAdapter());

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SiteAdapters, BaseAdapter, XAdapter };
}