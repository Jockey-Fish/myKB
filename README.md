# AI知识库Web平台

基于Vue3 + Express + SQLite + LanceDB构建的智能文档问答系统

## 功能特性

- **文档管理**: 支持PDF、TXT、Markdown等格式文件上传
- **文档处理**: 自动将文档切片并向量化存储
- **智能问答**: 基于RAG（检索增强生成）的问答系统
- **多用户隔离**: 每个用户拥有独立的知识库空间
- **友好界面**: 直观的用户交互界面

## 技术架构

- **前端**: Vue3 + Vite + Element Plus
- **后端**: Node.js + Express
- **数据库**: SQLite (better-sqlite3)
- **向量库**: LanceDB (嵌入式本地存储，无需Python依赖)

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
# 启动后端服务 (端口: 3001)
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
│   ├── routes/
│   │   ├── documents.js       # 文档管理API
│   │   ├── upload.js          # 文件上传API
│   │   ├── extract.js         # 文档内容提取API
│   │   └── chat.js            # 问答API
│   ├── services/
│   │   ├── rag_service.js     # RAG问答服务
│   │   └── llm_service.js     # LLM服务
│   ├── rag/
│   │   ├── text_splitter.js   # 文本切片器
│   │   ├── text_vectorizer.js # 文本向量化器
│   │   └── lance_store.js     # LanceDB向量存储
│   ├── uploads/               # 上传文件存储目录
│   └── lance_db/              # LanceDB向量库数据(自动生成)
├── frontend/                  # 前端应用
│   ├── src/
│   │   ├── main.js            # 入口文件
│   │   ├── App.vue            # 主组件
│   │   ├── api/               # API请求封装
│   │   │   ├── index.js       # axios封装
│   │   │   ├── auth.js        # 认证接口
│   │   │   ├── document.js    # 文档接口
│   │   │   └── chat.js        # 聊天接口
│   │   ├── views/
│   │   │   ├── DocumentList.vue      # 文档列表页
│   │   │   ├── DocumentDetail.vue    # 文档详情页
│   │   │   ├── DocumentUpload.vue    # 文件上传页
│   │   │   ├── Chat.vue              # 问答页
│   │   │   ├── Login.vue             # 登录页
│   │   │   └── Register.vue          # 注册页
│   │   └── stores/            # Pinia状态管理
│   └── index.html
└── README.md
```

## API接口

### 文档管理

- `POST /api/documents/upload` - 上传文档
- `GET /api/documents` - 获取文档列表
- `GET /api/documents/:id` - 获取单个文档
- `GET /api/documents/:id/content` - 获取文档内容
- `GET /api/documents/:id/chunks` - 获取文档切片
- `DELETE /api/documents/:id` - 删除文档

### 问答服务

- `POST /api/chat/ask` - 向知识库提问（非流式）
- `POST /api/chat/stream` - 向知识库提问（流式）

## 使用说明

1. **注册登录**: 注册账号并登录系统
2. **上传文档**: 点击上传按钮，选择PDF/TXT/MD文件进行上传
3. **等待处理**: 文档会自动进行内容提取、切片和向量化
4. **查看文档**: 在文档列表中点击查看，可查看原文、切片和检索测试
5. **提问**: 在问答页面输入问题，系统会从知识库中检索相关内容并回答
6. **删除文档**: 在文档列表中点击删除按钮移除文档

## 向量库迁移说明

本项目已从原有的 ChromaDB 和自研 JSON 向量库方案迁移至 LanceDB：

- **移除**: ChromaDB (chromadb包)、自研JSON向量库(chroma_db/目录)
- **新增**: LanceDB (@lancedb/lancedb包，嵌入式本地存储)
- **优势**:
  - 无需Python环境，纯Node.js运行
  - 嵌入式模式，无需独立服务部署
  - 列式存储，检索性能更优
  - 完整的事务支持和数据一致性

## License

MIT