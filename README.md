<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# CHRONOS — 3D 时光隧道

**一个赛博朋克风格的 3D 照片时间线应用**

将你的照片注入时空矩阵，在星空中穿越回忆。

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r182-000000?logo=threedotjs)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vite.dev)
[![Gemini AI](https://img.shields.io/badge/Gemini_AI-Powered-4285F4?logo=google)](https://ai.google.dev)

</div>

---

## ✨ 功能特性

- 🌌 **3D 时光隧道** — 照片按时间线排列在螺旋星空隧道中，滚轮穿越时空
- 🤖 **AI 智能解析** — Gemini AI 自动分析照片，生成赛博朋克风格标题与描述
- 🎙️ **AI 语音朗读** — Gemini TTS 用科幻语调朗读照片描述
- 📅 **时间管理** — 上传时可选择年月，管理面板可随时修改时间锚点
- 🔍 **搜索与过滤** — 按标题、描述、年份搜索，年份下拉筛选
- ▶️ **自动播放** — 一键自动穿越隧道，可调节速度
- 💾 **本地持久化** — IndexedDB 存储，刷新不丢失
- ☁️ **云存储支持** — 可选接入七牛云 OSS（图片 + CDN）
- 🎨 **赛博朋克 UI** — 深色玻璃拟态、青色光效、微动画

## 🚀 快速开始

### 环境要求

- [Node.js](https://nodejs.org) >= 18

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/<your-username>/chronos-3d.git
cd chronos-3d

# 安装依赖
npm install

# 配置环境变量（见下方说明）
cp .env.local.example .env.local

# 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:3000` 即可体验。

### 环境变量

在 `.env.local` 中配置：

```env
# （必填）Gemini API Key — 用于 AI 图片解析和语音朗读
GEMINI_API_KEY=your_gemini_api_key

# （可选）存储模式：local（默认，IndexedDB）| qiniu（七牛云）
STORAGE_PROVIDER=local

# （仅 qiniu 模式）七牛云配置
QINIU_BUCKET=your-bucket
QINIU_DOMAIN=your-cdn-domain.com
QINIU_ACCESS_KEY=your-access-key
QINIU_SECRET_KEY=your-secret-key
QINIU_TOKEN_ENDPOINT=/api/qiniu/upload-token
```

> 💡 不配置 `GEMINI_API_KEY` 也可以使用，只是 AI 解析功能不可用，照片会以文件名作为标题。

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 3D 渲染 | Three.js + React Three Fiber + Drei |
| AI | Google Gemini (图片分析 + TTS) |
| 构建 | Vite 6 |
| 样式 | TailwindCSS (CDN) |
| 图标 | Lucide React |
| 存储 | IndexedDB / 七牛云 OSS |
| 测试 | Vitest |

## 📁 项目结构

```
├── App.tsx                  # 主应用（状态管理、AI 逻辑）
├── index.html               # 入口 HTML
├── index.tsx                # React 挂载点
├── types.ts                 # TypeScript 类型定义
├── constants.ts             # 常量（月份名、隧道参数）
├── translations.ts          # 多语言文本
├── components/
│   ├── Experience.tsx       # 3D 场景（相机、滚动、照片布局）
│   ├── PhotoMesh.tsx        # 单张照片 3D 网格
│   ├── Starfield.tsx        # 星空粒子系统
│   ├── Overlay.tsx          # UI 覆盖层（搜索、上传、详情）
│   └── ManagementPanel.tsx  # 照片管理侧边栏
├── hooks/
│   └── useStorage.ts        # 存储 Hook（IndexedDB / 云端）
├── services/
│   ├── data/                # PhotoRepository（IndexedDB CRUD）
│   └── storage/             # StorageManager + QiniuProvider
├── server/
│   └── qiniuServerPlugin.ts # Vite 中间件（七牛云 Token）
└── tests/                   # 单元测试
```

## 🎮 使用指南

| 操作 | 方式 |
|------|------|
| 穿越时光 | 鼠标滚轮 / 触控滑动 |
| 查看详情 | 点击 3D 照片 |
| 上传照片 | 右上角「注入记忆」按钮 |
| 修改时间 | 上传时选择 / 管理面板编辑 |
| 自动播放 | ▶ 按钮，可调整速度 |
| 搜索 | 标题栏搜索框 |
| 年份筛选 | 搜索框旁下拉菜单 |
| 管理照片 | ⚙ 齿轮按钮 |
| 关闭弹窗 | ESC 键 |
| AI 朗读 | 详情页「唤醒听觉」按钮 |

## 📜 Scripts

```bash
npm run dev       # 启动开发服务器
npm run build     # 构建生产版本
npm run preview   # 预览生产构建
npm run test      # 运行测试
npm run test:watch # 监听模式测试
```

## 📄 License

MIT

---

<div align="center">
<sub>Built with ☕ and a love for cyberpunk aesthetics</sub>
</div>
