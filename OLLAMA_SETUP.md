# Ollama本地RAG问答系统升级指南

## 概述

本项目已成功升级为基于Ollama的本地RAG问答系统，完全脱离外部付费API，支持本地运行。

## 技术栈

- **LLM模型**: Qwen2.5:7b (默认)
- **Embedding模型**: nomic-embed-text
- **向量数据库**: LanceDB
- **流式传输**: Server-Sent Events (SSE)

## 安装步骤

### 1. 安装Ollama

#### Windows
```bash
# 下载并安装Ollama
# 访问 https://ollama.com/download 下载Windows版本
# 或使用winget安装
winget install Ollama.Ollama
```

#### macOS
```bash
brew install ollama
```

#### Linux
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. 拉取模型

```bash
# 拉取LLM模型 (Qwen2.5:7b)
ollama pull qwen2.5:7b

# 拉取Embedding模型 (nomic-embed-text)
ollama pull nomic-embed-text
```

### 3. 启动Ollama服务

```bash
# 启动Ollama服务
ollama serve

# 验证服务是否正常运行
curl http://localhost:11434/api/tags
```

### 4. 配置环境变量

在 `backend/.env` 文件中添加以下配置：

```env
# Ollama配置
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# RAG配置
TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.3
RAG_MAX_CONTEXT_LENGTH=3000
```

### 5. 安装后端依赖

```bash
cd backend
npm install
```

### 6. 启动后端服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

### 7. 启动前端服务

```bash
cd frontend
npm install
npm run dev
```

## 使用说明

### 1. 上传文档

1. 登录系统
2. 进入"文档管理"页面
3. 上传PDF、TXT或MD文件
4. 等待文档处理完成（自动切片、向量化、存储）

### 2. 开始问答

1. 进入"AI问答"页面
2. 选择要查询的文档（或选择"全部文档"）
3. 输入问题并发送
4. 系统将自动检索相关内容并生成回答

### 3. 查看来源引用

每个AI回答下方都会显示：
- **参考来源数量**: 显示检索到的相关文档片段数量
- **文档信息**: 文件名和文档ID
- **相似度分数**: 显示每个片段的相似度百分比
- **Chunk编号**: 显示文本片段的索引
- **展开/收起**: 点击可查看完整的Chunk内容

### 4. Debug模式

开启Debug模式后，每个回答下方会显示：
- **检索耗时**: 向量检索的毫秒数
- **生成耗时**: LLM生成的毫秒数
- **总耗时**: 整个流程的总毫秒数
- **模型信息**: 使用的LLM模型名称
- **Provider信息**: 服务提供商（ollama）
- **Prompt**: 实际发送给LLM的完整提示词

## 加载状态说明

系统会在不同阶段显示不同的加载状态：

1. **"检索知识库中..."**: 正在进行向量相似度检索
2. **"AI生成答案中..."**: 正在调用Ollama生成回答

## 模型选择

### LLM模型推荐

| 模型 | 大小 | 性能 | 适用场景 |
|------|------|------|----------|
| qwen2.5:7b | ~4.7GB | 平衡 | 通用问答 |
| qwen2.5:3b | ~2.1GB | 较快 | 资源受限环境 |
| qwen2.5:14b | ~9GB | 较好 | 高质量回答 |

### Embedding模型推荐

| 模型 | 向量维度 | 特点 |
|------|----------|------|
| nomic-embed-text | 768 | 多语言支持，性能优秀 |
| mxbai-embed-large | 1024 | 高质量向量 |

## 故障排查

### 1. Ollama连接失败

**问题**: 提示"Ollama服务不可用"

**解决方案**:
```bash
# 检查Ollama服务是否运行
curl http://localhost:11434/api/tags

# 如果未运行，启动服务
ollama serve
```

### 2. 模型未找到

**问题**: 提示"模型未找到"

**解决方案**:
```bash
# 查看已安装的模型
ollama list

# 拉取缺失的模型
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

### 3. 向量维度不匹配

**问题**: 提示"向量维度不匹配"

**解决方案**:
- 确保使用正确的Embedding模型
- 删除旧的向量数据库: `rm -rf backend/lance_db`
- 重新上传文档

### 4. 内存不足

**问题**: 系统运行缓慢或崩溃

**解决方案**:
- 使用更小的模型（如 qwen2.5:3b）
- 减少 TOP_K 值
- 减少 RAG_MAX_CONTEXT_LENGTH 值

## 性能优化建议

### 1. 模型选择

- **资源受限**: 使用 qwen2.5:3b
- **平衡性能**: 使用 qwen2.5:7b
- **追求质量**: 使用 qwen2.5:14b

### 2. 参数调优

```env
# 减少检索数量，提高速度
TOP_K=3

# 提高相似度阈值，提高准确性
RAG_SIMILARITY_THRESHOLD=0.5

# 减少上下文长度，减少Token消耗
RAG_MAX_CONTEXT_LENGTH=2000
```

### 3. 硬件要求

| 配置 | 最低要求 | 推荐配置 |
|------|----------|----------|
| CPU | 4核心 | 8核心+ |
| 内存 | 8GB | 16GB+ |
| GPU | 无 | 8GB+ VRAM |

## 完整RAG流程

```
用户提问
    ↓
问题Embedding (nomic-embed-text)
    ↓
向量检索 (LanceDB)
    ↓
获取TopK相关Chunk
    ↓
构建Prompt
    ↓
调用Ollama (Qwen2.5)
    ↓
生成答案
    ↓
返回答案和引用来源
```

## API接口

### 流式问答

```http
POST /api/chat/stream?debug=true
Content-Type: application/json
Authorization: Bearer <token>

{
  "question": "你的问题",
  "topK": 5,
  "maxTokens": 2048,
  "temperature": 0.7,
  "document_id": "可选文档ID"
}
```

### SSE事件类型

| 事件类型 | 说明 |
|----------|------|
| sources | 检索到的相关文档片段 |
| content | 流式生成的回答内容 |
| done | 生成完成 |
| error | 错误信息 |
| debug | Debug信息（需开启debug模式） |

## 注意事项

1. **首次运行**: 首次使用需要下载模型，可能需要较长时间
2. **端口占用**: 确保11434端口未被占用
3. **网络环境**: Ollama完全本地运行，无需网络连接
4. **数据安全**: 所有数据存储在本地，不会上传到云端

## 更新日志

### v2.0.0 (2026-06-23)

- ✅ 升级为Ollama本地LLM服务
- ✅ 使用nomic-embed-text进行向量化
- ✅ 优化Prompt模板，增强知识库依赖
- ✅ 新增来源引用展示功能
- ✅ 新增Debug模式
- ✅ 新增加载状态提示
- ✅ 优化向量维度（384 → 768）
- ✅ 完全脱离外部付费API

## 技术支持

如有问题，请查看：
1. [Ollama官方文档](https://ollama.com/docs)
2. [LanceDB文档](https://lancedb.github.io/lancedb/)
3. 项目日志文件: `backend/logs/`