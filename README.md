# AI知识库Web平台

基于Vue3 + Express + SQLite + Chroma构建的智能文档问答系统

## 功能特性

- **文档管理**: 支持PDF、TXT、Markdown等格式文件上传
- **文档处理**: 自动将文档切片并向量化存储
- **智能问答**: 基于RAG（检索增强生成）的问答系统
- **友好界面**: 直观的用户交互界面

## 技术架构

- **前端**: Vue3 + Vite + Element Plus
- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **向量库**: Chroma

## 快速开始

### 环境要求

- Node.js >= 18.0.0

### 安装依赖

```bash
# 后端依赖
cd backend
npm install

# 前端依赖
cd ../frontend
npm install
```

### 启动服务

```bash
# 启动后端服务 (端口: 3000)
cd backend
npm start

# 启动前端开发服务器 (端口: 5173)
cd frontend
npm run dev
```

### 访问应用

打开浏览器访问: http://localhost:5173

## 项目结构

```
tryKB/
├── backend/                    # 后端服务
│   ├── server.js              # 入口文件
│   ├── database.js            # SQLite数据库操作
│   ├── chroma.js              # Chroma向量库集成
│   ├── documentProcessor.js   # 文档处理模块
│   ├── routes/
│   │   ├── documents.js       # 文档管理API
│   │   └── qa.js              # 问答API
│   ├── uploads/               # 上传文件存储目录
│   └── chroma_db/             # Chroma向量库数据
├── frontend/                  # 前端应用
│   ├── src/
│   │   ├── main.js            # 入口文件
│   │   ├── App.vue            # 主组件
│   │   ├── api.js             # API请求封装
│   │   └── components/
│   │       ├── DocumentUpload.vue    # 文件上传组件
│   │       ├── DocumentList.vue      # 文档列表组件
│   │       └── QAChat.vue            # 问答交互组件
│   └── index.html
└── README.md
```

## API接口

### 文档管理

- `POST /api/documents` - 上传文档
- `GET /api/documents` - 获取文档列表
- `GET /api/documents/:id` - 获取单个文档
- `DELETE /api/documents/:id` - 删除文档

### 问答服务

- `POST /api/qa/ask` - 向知识库提问

## 使用说明

1. **上传文档**: 点击左侧上传区域，选择PDF/TXT/MD文件进行上传
2. **查看文档**: 上传成功后会在文档列表中显示
3. **提问**: 在右侧问答窗口输入问题，系统会从知识库中检索相关内容并回答
4. **删除文档**: 在文档列表中点击删除按钮移除文档

## License

MIT