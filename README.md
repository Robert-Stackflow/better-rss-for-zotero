# Better RSS for Zotero

一个增强 Zotero RSS 功能的插件，使用 Readability 自动提取完整正文内容。

## ✨ 功能

- **🔍 RSS 条目正文提取**：自动从原始链接获取完整文章内容
- **🖱️ 右键菜单触发**：在 Feed 条目上右键点击即可提取
  - 支持多选批量提取
  - 支持跳过已提取条目
- **📂 智能文件夹管理**：支持路径保存模板
  - 可使用 %feedName%, %year%, %month%, %week%, %day% 等变量
- **🏷️ 自动标签添加**：为提取的条目添加标签
  - 可选添加 Feed 名称标签
  - 可选添加 "Better RSS" 通用标签
- **📝 生成 Note**：将提取的正文保存为格式化的 Note
- **📄 生成 Snapshot 附件**：将正文保存为 Snapshot 附件
- **🔗 原文链接回溯**：在 Note 和附件中保留原始 URL 和元数据

## 📦 安装

### 从 Release 安装

1. 从 [Releases](https://github.com/Robert-Stackflow/better-rss-for-zotero/releases) 下载最新的 `.xpi` 文件
2. 在 Zotero 中，进入 `工具` → `插件`
3. 点击右上角齿轮图标，选择 `Install Add-on From File`
4. 选择下载的 `.xpi` 文件

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/Robert-Stackflow/better-rss-for-zotero.git
cd better-rss-for-zotero

# 安装依赖
npm install

# 构建插件
npm run build

# 安装生成的 xpi 文件（位于 .scaffold/build/ 目录）
```

## 🚀 使用方法

1. 在 Zotero 中添加 RSS 订阅源
2. 选择一个或多个 RSS Feed 条目
3. 右键点击，选择 "Extract Full Content from RSS"
4. 等待提取完成（会显示进度）
5. 查看生成的 Note 和 HTML 附件

## 🛠️ 开发

### 项目结构

```
better-rss-for-zotero/
├── src/
│   ├── index.ts                 # 插件入口
│   ├── addon.ts                 # 插件主类
│   ├── hooks.ts                 # 生命周期钩子
│   ├── modules/
│   │   ├── contentExtractor.ts  # 正文提取模块
│   │   └── feedMenuManager.ts   # 菜单管理模块
│   └── utils/
│       ├── ztoolkit.ts          # Zotero Toolkit 封装
│       └── locale.ts            # 国际化工具
├── addon/
│   ├── locale/                  # 语言文件
│   │   ├── en-US/
│   │   └── zh-CN/
│   └── content/
│       └── icons/               # 图标资源
├── typings/                     # TypeScript 类型定义
├── package.json
├── tsconfig.json
└── zotero-plugin.config.ts      # 构建配置
```

### 开发命令

```bash
# 开发构建
npm run build:dev

# 生产构建
npm run build

# 启动开发服务器（自动重新加载）
npm run serve

# 代码检查
npm run lint

# 发布版本
npm run release
```

### 技术栈

- **TypeScript**: 类型安全的开发体验
- **Zotero Plugin Toolkit**: 现代化的 Zotero 插件开发工具
- **Zotero Plugin Scaffold**: 自动化构建和打包
- **@mozilla/readability**: 强大的网页正文提取库
- **ESBuild**: 快速的 TypeScript 编译器

### 核心 API

#### ContentExtractor

```typescript
const extractor = new ContentExtractor();
await extractor.extractAndSave(item); // 提取并保存内容
```

#### FeedMenuManager

```typescript
const menuManager = new FeedMenuManager();
menuManager.register(); // 注册右键菜单
```

## 🌍 国际化

插件支持多语言：

- English (en-US)
- 简体中文 (zh-CN)

语言文件位于 `addon/locale/` 目录下，使用 Fluent 格式。

## 🤝 贡献

欢迎提交 Pull Request 或创建 Issue！

## 📄 License

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Mozilla Readability](https://github.com/mozilla/readability) - 正文提取算法
- [Zotero Plugin Toolkit](https://github.com/windingwind/zotero-plugin-toolkit) - 插件开发工具
- [Zotero](https://www.zotero.org/) - 优秀的文献管理工具
