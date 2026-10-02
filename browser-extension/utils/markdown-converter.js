/**
 * HTML到Markdown转换模块
 */

const MarkdownConverter = {
  /**
   * 将HTML转换为Markdown
   * @param {string} html - HTML字符串
   * @param {Object} metadata - 元数据
   * @returns {string} Markdown字符串
   */
  convert(html, metadata = {}) {
    // 创建临时容器
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // 生成Frontmatter
    let markdown = this.generateFrontmatter(metadata);
    
    // 转换内容
    markdown += this.convertElement(temp);
    
    // 清理
    markdown = this.postProcess(markdown);
    
    return markdown;
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
   * 转换元素
   */
  convertElement(element) {
    if (!element) return '';
    
    // 处理子元素
    let result = '';
    
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += this.escapeText(node.textContent);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        result += this.convertNode(node);
      }
    }
    
    return result;
  },

  /**
   * 转换单个节点
   */
  convertNode(node) {
    const tagName = node.tagName.toLowerCase();
    
    switch (tagName) {
      case 'h1':
        return `\n# ${this.convertElement(node)}\n\n`;
      case 'h2':
        return `\n## ${this.convertElement(node)}\n\n`;
      case 'h3':
        return `\n### ${this.convertElement(node)}\n\n`;
      case 'h4':
        return `\n#### ${this.convertElement(node)}\n\n`;
      case 'h5':
        return `\n##### ${this.convertElement(node)}\n\n`;
      case 'h6':
        return `\n###### ${this.convertElement(node)}\n\n`;
        
      case 'p':
        return `\n${this.convertElement(node)}\n\n`;
        
      case 'br':
        return '\n';
        
      case 'strong':
      case 'b':
        return `**${this.convertElement(node)}**`;
        
      case 'em':
      case 'i':
        return `*${this.convertElement(node)}*`;
        
      case 'del':
      case 's':
        return `~~${this.convertElement(node)}~~`;
        
      case 'code': {
        // 行内代码使用原始文本，避免 escapeText 把代码里的 *、_ 等字符转义坏
        const codeText = node.textContent;
        if (codeText.includes('`')) {
          return '``' + codeText + '``';
        }
        return '`' + codeText + '`';
      }
        
      case 'pre':
        const codeBlock = this.getCodeContent(node);
        const lang = this.detectLanguage(node);
        return `\n\`\`\`${lang}\n${codeBlock}\n\`\`\`\n\n`;
        
      case 'a':
        const href = node.getAttribute('href') || '';
        const text = this.convertElement(node);
        if (!href || href === text) {
          return text;
        }
        return `[${text}](${href})`;
        
      case 'img':
        const src = node.getAttribute('src') || '';
        const alt = node.getAttribute('alt') || '';
        if (!src) return '';
        return `\n![${alt}](${src})\n`;
        
      case 'ul':
        return this.convertList(node, '- ');
        
      case 'ol':
        return this.convertList(node, '1. ', true);
        
      case 'li':
        return this.convertElement(node);
        
      case 'blockquote':
        const quote = this.convertElement(node).trim();
        return quote.split('\n').map(line => `> ${line}`).join('\n') + '\n\n';
        
      case 'hr':
        return '\n\n---\n\n';
        
      case 'table':
        return this.convertTable(node);
        
      case 'thead':
      case 'tbody':
      case 'tfoot':
        return this.convertElement(node);
        
      case 'tr':
        return this.convertTableRow(node);
        
      case 'th':
      case 'td':
        return this.convertElement(node).trim();
        
      case 'div':
      case 'section':
      case 'article':
      case 'main':
      return `\n${this.convertElement(node)}\n\n`;
        
      case 'span':
        return this.convertElement(node);
        
      case 'figure':
        return `\n${this.convertElement(node)}\n`;
        
      case 'figcaption':
        return `*${this.convertElement(node)}*\n`;
        
      default:
        return this.convertElement(node);
    }
  },

  /**
   * 转义文本
   */
  escapeText(text) {
    if (!text) return '';
    // 规范化文本空白，避免标签间挤在一起
    const normalized = text
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ');
    // 转义Markdown特殊字符
    return normalized
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  /**
   * 获取代码内容
   */
  getCodeContent(preElement) {
    const code = preElement.querySelector('code');
    if (code) {
      return code.textContent;
    }
    return preElement.textContent;
  },

  /**
   * 检测代码语言
   */
  detectLanguage(preElement) {
    const code = preElement.querySelector('code');
    if (code) {
      // 检查class
      const className = code.className || '';
      const match = className.match(/language-(\w+)/);
      if (match) return match[1];
      
      // 检查其他常见class模式
      const langMatch = className.match(/\b(javascript|python|java|cpp|c|csharp|php|ruby|go|rust|swift|kotlin|typescript|html|css|sql|bash|shell|json|xml|yaml|markdown)\b/i);
      if (langMatch) return langMatch[1].toLowerCase();
    }
    return '';
  },

  /**
   * 转换列表
   */
  convertList(listElement, prefix, numbered = false) {
    const items = Array.from(listElement.children).filter(child => child.tagName.toLowerCase() === 'li');
    
    let result = '\n';
    items.forEach((item, index) => {
      const itemPrefix = numbered ? `${index + 1}. ` : prefix;
      const content = this.convertElement(item).trim();
      
      // 处理嵌套列表
      const lines = content.split('\n');
      lines.forEach((line, lineIndex) => {
        if (lineIndex === 0) {
          result += `${itemPrefix}${line}\n`;
        } else if (line.trim()) {
          result += `  ${line}\n`;
        }
      });
    });
    
    return result + '\n\n';
  },

  /**
   * 转换表格
   */
  convertTable(tableElement) {
    const rows = tableElement.querySelectorAll('tr');
    if (rows.length === 0) return '';
    
    let result = '\n';
    
    rows.forEach((row, rowIndex) => {
      const cells = row.querySelectorAll('th, td');
      if (cells.length === 0) return;
      
      const cellContents = Array.from(cells).map(cell => {
        return this.convertElement(cell).trim().replace(/\|/g, '\\|');
      });
      
      result += '| ' + cellContents.join(' | ') + ' |\n';
      
      // 添加表头分隔符
      if (rowIndex === 0) {
        const separators = Array(cells.length).fill('---');
        result += '| ' + separators.join(' | ') + ' |\n';
      }
    });
    
    return result + '\n';
  },

  /**
   * 转换表格行
   */
  convertTableRow(rowElement) {
    return this.convertElement(rowElement);
  },

  /**
   * 后处理
   */
  postProcess(markdown) {
    return markdown
      .replace(/\r\n?/g, '\n')
      // 移除多余的空行
      .replace(/\n{3,}/g, '\n\n')
      // 修复链接中的空格
      .replace(/\]\s+\(/g, '](')
      // 普通段落与块元素之间补空行，避免 Obsidian 误解析
      .replace(
        /^(?!\s*(?:#{1,6}\s|> |\* |- |\d+\. |\| |```|---\s*$))([^\n]*\S[^\n]*)\n(?=\s*(?:#{1,6}\s|> |\* |- |\d+\. |\| |```|---\s*$))/gm,
        '$1\n\n'
      )
      // 去掉行尾空格
      .replace(/[ \t]+$/gm, '')
      .trim();
  }
};

// 导出模块
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MarkdownConverter;
}
