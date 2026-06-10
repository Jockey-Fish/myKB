# AI问答系统使用指南

## 系统架构

```
用户问题 → 向量检索(RAG) → 构建提示词 → LLM生成 → 流式输出
```

## 一、环境准备

### 1. 安装Ollama（推荐本地运行）

**Windows:**
```powershell
# 下载并安装Ollama
# 访问 https://ollama.ai 下载Windows版本

# 安装完成后，拉取中文模型
ollama pull qwen2:7b
ollama pull qwen2:1.5b  # 轻量级模型，适合低配置机器
```

**验证Ollama运行:**
```powershell
ollama list
# 应该显示已安装的模型列表
```

### 2. 安装依赖

```powershell
cd backend
npm install
```

### 3. 配置环境变量

复制配置文件：
```powershell
copy .env.example .env
```

编辑 `.env` 文件，配置LLM参数：
```env
# 使用Ollama本地模型
LLM_PROVIDER=ollama
LLM_BASE_URL=http://localhost:11434
LLM_MODEL=qwen2:7b
```

### 4. 启动服务

```powershell
# 启动后端
cd backend
npm run dev

# 启动前端（新终端）
cd frontend
npm run dev
```

---

## 二、API接口文档

### 1. AI问答（非流式）

**接口:** `POST /api/chat/ask`

**请求头:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "question": "什么是机器学习？",
  "topK": 5,
  "maxTokens": 2048,
  "temperature": 0.7
}
```

**响应:**
```json
{
  "code": 200,
  "message": "查询成功",
  "data": {
    "question": "什么是机器学习？",
    "answer": "机器学习是人工智能的一个分支...",
    "sources": [
      {
        "id": "chunk_0",
        "text": "机器学习是人工智能的一个分支...",
        "distance": 0.35,
        "documentId": "doc_001"
      }
    ],
    "metadata": {
      "queryTime": 50,
      "retrieveTime": 30,
      "generateTime": 2000,
      "totalTime": 2080,
      "relevantDocsCount": 3,
      "model": "qwen2:7b",
      "provider": "ollama"
    }
  }
}
```

### 2. AI问答（流式SSE）

**接口:** `POST /api/chat/stream`

**请求头:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体:**
```json
{
  "question": "什么是机器学习？",
  "topK": 5,
  "maxTokens": 2048,
  "temperature": 0.7
}
```

**响应格式（SSE流）:**
```
data: {"type":"sources","data":[...]}

data: {"type":"content","data":"机器","done":false}

data: {"type":"content","data":"学习","done":false}

data: {"type":"content","data":"是","done":false}

data: {"type":"done","data":{"totalTime":2080,"relevantDocsCount":3}}

data: [DONE]
```

### 3. 添加文档到知识库

**接口:** `POST /api/chat/document`

**请求体:**
```json
{
  "text": "这是一篇关于人工智能的文章内容...",
  "documentId": "doc_001"
}
```

**响应:**
```json
{
  "code": 200,
  "message": "文档添加成功",
  "data": {
    "documentId": "doc_001",
    "chunksCount": 15,
    "storedCount": 15
  }
}
```

### 4. 获取服务状态

**接口:** `GET /api/chat/status`

**响应:**
```json
{
  "code": 200,
  "message": "获取状态成功",
  "data": {
    "initialized": true,
    "vectorStore": {
      "initialized": true,
      "documentCount": 150
    },
    "llm": {
      "provider": "ollama",
      "model": "qwen2:7b",
      "initialized": true,
      "baseUrl": "http://localhost:11434",
      "available": true,
      "models": ["qwen2:7b", "qwen2:1.5b"]
    }
  }
}
```

---

## 三、前端集成示例

### 使用fetch调用流式API

```javascript
async function askQuestion(question) {
  const token = localStorage.getItem('token');
  
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      question,
      topK: 5,
      maxTokens: 2048,
      temperature: 0.7
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        const event = JSON.parse(data);
        
        if (event.type === 'sources') {
          // 显示参考来源
          console.log('参考来源:', event.data);
        } else if (event.type === 'content') {
          // 打字机效果追加内容
          appendToMessage(event.data);
        } else if (event.type === 'done') {
          // 生成完成
          console.log('完成:', event.data);
        }
      }
    }
  }
}
```

---

## 四、性能优化建议

### 1. 向量检索优化
- 调整 `topK` 参数（默认5，建议3-10）
- 设置合理的相似度阈值（默认0.3）
- 限制上下文长度（默认3000字符）

### 2. LLM生成优化
- 选择合适的模型大小（7B平衡性能与质量）
- 调整temperature（0.7适合一般问答，0.3适合精确回答）
- 设置合理的maxTokens（避免生成过长）

### 3. 并发处理
- 系统支持至少10个并发会话
- 每个用户每分钟最多20次请求（可调整）

---

## 五、常见问题

### Q1: Ollama连接失败
```
错误: Ollama服务不可用
解决: 确保Ollama正在运行，执行 ollama serve
```

### Q2: 向量检索无结果
```
原因: 知识库中没有相关文档
解决: 先上传文档并添加到向量库
```

### Q3: 生成速度慢
```
原因: 模型太大或机器配置低
解决: 使用更小的模型，如 qwen2:1.5b
```

### Q4: 内存占用高
```
原因: 向量模型和LLM同时加载
解决: 使用量化模型，减少maxTokens
```

---

## 六、安全注意事项

1. **JWT认证**: 所有接口需要有效的JWT令牌
2. **请求限流**: 防止滥用和暴力攻击
3. **参数验证**: 严格验证所有输入参数
4. **错误处理**: 不暴露敏感错误信息
5. **数据隔离**: 用户只能访问自己的数据

---

## 七、扩展配置

### 使用OpenAI兼容API

编辑 `.env` 文件：
```env
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.openai.com
LLM_API_KEY=sk-your-api-key
LLM_MODEL=gpt-3.5-turbo
```

### 使用其他兼容服务

支持任何OpenAI兼容的API服务：
- DeepSeek
- 通义千问
- 智谱AI
- 本地vLLM服务

只需配置对应的 `LLM_BASE_URL` 和 `LLM_API_KEY` 即可。
