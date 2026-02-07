## 项目概述
开发一个浏览器插件，实现网页内容一键捕获、清洗并发送到Obsidian的完整工作流。

## 技术架构

### 项目结构
```
archive/
├── browser-extension/          # 浏览器插件目录
│   ├── manifest.json           # 插件配置(Manifest V3)
│   ├── popup/                  # 弹出窗口UI
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   ├── content/                # 内容脚本
│   │   └── content.js
│   ├── background/             # 后台服务
│   │   └── background.js
│   ├── options/                # 设置页面
│   │   ├── options.html
│   │   └── options.js
│   ├── utils/                  # 工具函数
│   │   ├── html-cleaner.js     # HTML清洗
│   │   └── markdown-converter.js # Markdown转换
│   └── icons/                  # 图标资源
└── docs/                       # 文档
    ├── README.md
    └── architecture.md
```

## 核心功能模块

### 1. 内容捕获 (Content Script)
- 页面选择模式：点击选择要捕获的区域
- 智能提取：自动识别正文内容
- 元数据收集：标题、URL、时间戳、作者等

### 2. HTML清洗 (html-cleaner.js)
- 移除：script, style, nav, footer, ad等无关元素
- 保留：article, main, 正文段落、图片、链接
- 属性清理：移除onclick等事件属性
- 参考Readability算法实现

### 3. Markdown转换 (markdown-converter.js)
- HTML → Markdown转换
- 图片链接处理
- 表格、列表、代码块格式保留
- 生成Frontmatter元数据

### 4. Obsidian API集成 (background.js)
- 调用Obsidian Local REST API
- 支持创建/更新笔记
- 可配置目标文件夹和文件名格式
- 错误处理和状态反馈

### 5. 用户界面
- **Popup**: 快速捕获、状态显示、快捷设置
- **Options**: API配置、文件夹设置、模板配置
- **Content UI**: 选择高亮、捕获确认

## 配置项
- Obsidian API密钥
- API端口(默认:27124)
- 目标文件夹路径
- 文件名格式模板
- 笔记内容模板
- 是否保留图片

## 开发步骤
1. 创建manifest.json和基础目录结构
2. 实现content.js页面内容提取
3. 实现html-cleaner.js清洗逻辑
4. 实现markdown-converter.js转换逻辑
5. 实现background.js API调用
6. 开发popup和options界面
7. 集成测试和优化

## 依赖
- 纯原生JavaScript，无外部框架依赖
- Obsidian Local REST API插件需预先安装