/**
 * HTML到Markdown转换模块
 * 基于 Turndown（vendor/turndown.js，含 GFM 插件），对外保留 convert(html, metadata) 接口
 */

const MarkdownConverter = {
  _turndown: null,

  /**
   * 获取（并按需初始化）Turndown 实例
   */
  getTurndown() {
    if (this._turndown) return this._turndown;

    const service = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      hr: '---',
      emDelimiter: '*'
    });
    // GFM 插件提供表格、删除线、任务列表支持
    service.use(turndownPluginGfm.gfm);
    service.remove(['script', 'style', 'noscript', 'template']);
    // 插件的删除线输出单波浪线，这里覆盖为兼容性更好的 ~~
    service.addRule('strikethroughDouble', {
      filter: ['del', 's', 'strike'],
      replacement: content => '~~' + content + '~~'
    });

    this._turndown = service;
    return service;
  },

  /**
   * 将HTML转换为Markdown
   * @param {string} html - HTML字符串
   * @param {Object} metadata - 元数据
   * @returns {string} Markdown字符串
   */
  convert(html, metadata = {}) {
    let markdown = this.generateFrontmatter(metadata);

    try {
      markdown += this.getTurndown().turndown(html);
    } catch (e) {
      console.warn('[MarkdownConverter] Turndown 转换失败，回退为纯文本', e);
      const temp = document.createElement('div');
      temp.innerHTML = html || '';
      markdown += temp.textContent || '';
    }

    return this.postProcess(markdown);
  },

  /**
   * 生成Frontmatter
   */
  generateFrontmatter(metadata) {
    const lines = ['---'];

    if (metadata.title) {
      lines.push(`title: "${this.escapeYaml(metadata.title)}"`);
    }

    if (metadata.url) {
      lines.push(`source: "${metadata.url}"`);
    }

    if (metadata.author) {
      lines.push(`author: "${this.escapeYaml(metadata.author)}"`);
    }

    if (metadata.siteName) {
      lines.push(`site: "${this.escapeYaml(metadata.siteName)}"`);
    }

    if (metadata.publishDate) {
      lines.push(`date: "${metadata.publishDate}"`);
    }

    // 添加归档日期
    lines.push(`archived: "${new Date().toISOString()}"`);

    lines.push('---\n');

    return lines.join('\n');
  },

  /**
   * 转义YAML字符串
   */
  escapeYaml(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
  },

  /**
   * 后处理
   */
  postProcess(markdown) {
    return markdown
      .replace(/\r\n?/g, '\n')
      // 移除多余的空行
      .replace(/\n{3,}/g, '\n\n')
      // 去掉行尾空格
      .replace(/[ \t]+$/gm, '')
      .trim();
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownConverter;
}
