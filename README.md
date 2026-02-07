# 网页归档助手

一个浏览器插件，可以将网页内容一键捕获、清洗并发送到 Obsidian。

## 功能特性

- **多种捕获方式**
  - 归档整个页面
  - 归档选中的文本
  - 选择页面区域归档
  - 右键菜单快速归档

- **智能内容清洗**
  - 自动移除广告、导航等无关元素
  - 提取正文内容
  - 保留图片和链接

- **Markdown 转换**
  - HTML 自动转换为 Markdown
  - 生成 Frontmatter 元数据
  - 支持代码块、表格等格式

- **Obsidian 集成**
  - 通过 Local REST API 直接发送
  - 支持自定义文件夹和文件名
  - 自动检测重复并追加内容

## 安装方法

### 1. 安装 Obsidian 插件

1. 在 Obsidian 中打开设置 → 社区插件
2. 关闭安全模式
3. 浏览社区插件，搜索 "Local REST API"（[GitHub](https://github.com/coddingtonbear/obsidian-local-rest-api)）
4. 安装并启用插件
5. **勾选"启用非加密 HTTP"选项**（插件默认使用 HTTPS，扩展使用 HTTP 端口 27123）
6. 在插件设置中复制 API Key

### 2. 安装浏览器插件

#### Chrome / Edge

1. 打开浏览器扩展管理页面 (`chrome://extensions` 或 `edge://extensions`)
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `browser-extension` 文件夹

#### Firefox

1. 打开 `about:debugging`
2. 点击"此 Firefox"
3. 点击"临时载入附加组件"
4. 选择 `browser-extension/manifest.json`

### 3. 配置插件

1. 点击浏览器工具栏上的插件图标
2. 点击"设置"
3. 粘贴 Obsidian 的 API Key
4. 点击"测试连接"验证配置
5. 保存设置

## 使用方法

### 方式一：点击插件图标

1. 点击浏览器工具栏上的归档助手图标
2. 选择要使用的归档方式：

    - **归档整个页面** - 捕获当前页面全部内容
    - **归档选中内容** - 仅捕获选中的文本（需先选中文字）
    - **选择区域归档** - 在页面上点击选择要捕获的区域

### 方式二：右键菜单

在页面上右键，选择：

- **归档整个页面到 Obsidian**
- **归档选中内容到 Obsidian**（选中文字时可用）
- **归档链接到 Obsidian**（在链接上右键时可用）

### 文件名模板

支持以下变量：

- `{{title}}` - 页面标题
- `{{date}}` - 当前日期 (YYYY-MM-DD)
- `{{time}}` - 当前时间 (HH-MM-SS)
- `{{url}}` - 页面 URL
- `{{site}}` - 网站名称

默认模板：`{{title}}`

生成的文件名示例：`2024-01-15-网页标题.md`

## 项目结构

```
browser-extension/
├── manifest.json          # 插件配置
├── background/            # 后台服务
│   └── background.js
├── content/               # 内容脚本
│   ├── content.js
│   └── content.css
├── popup/                 # 弹出窗口
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── options/               # 设置页面
│   ├── options.html
│   ├── options.css
│   └── options.js
├── utils/                 # 工具模块
│   ├── html-cleaner.js    # HTML 清洗
│   └── markdown-converter.js  # Markdown 转换
└── icons/                 # 图标
    ├── icon.svg           # SVG 源文件
    ├── icon16.png         # 16x16 图标
    ├── icon48.png         # 48x48 图标
    └── icon128.png        # 128x128 图标
```

## 技术说明

### HTML 清洗算法

采用启发式算法识别正文内容：
1. 优先选择语义化标签（article、main 等）
2. 计算元素的内容分数（文本长度、段落密度等）
3. 排除导航、广告等低分元素

### Markdown 转换

支持转换的 HTML 元素：
- 标题：h1-h6
- 段落、换行
- 强调：strong、em、del
- 链接和图片
- 列表：ul、ol
- 代码：code、pre
- 表格
- 引用：blockquote

### Obsidian API

使用 Local REST API 插件提供的 HTTP 接口：
- `GET /vault/{filepath}` - 读取文件
- `PUT /vault/{filepath}` - 创建/更新文件

## 注意事项

1. Obsidian 必须处于运行状态才能接收内容
2. 首次使用前需要在 Obsidian 中启用 Local REST API 插件
3. API Key 请妥善保管，不要分享给他人
4. 部分动态加载内容的页面可能无法完整捕获
5. 某些网站有 CSP (内容安全策略) 限制，可能导致无法正常工作
6. 需要登录才能查看的内容无法捕获（扩展无法获取你的登录状态）

## 许可证

MIT License
