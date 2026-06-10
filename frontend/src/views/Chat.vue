<template>
  <div class="chat-page">
    <Layout>
      <template #header>
        <div class="page-header">
          <h1>AI问答</h1>
          <p>与知识库进行智能对话</p>
        </div>
      </template>

      <template #content>
        <div class="chat-container">
          <div class="chat-sidebar">
            <div class="sidebar-header">
              <h3>知识库文档</h3>
              <el-button
                size="small"
                icon="Refresh"
                @click="refreshDocuments"
              />
            </div>

            <div class="document-selector">
              <el-radio-group v-model="selectedDocumentId">
                <el-radio :label="null">全部文档</el-radio>
                <el-radio
                  v-for="doc in documentsStore.documents"
                  :key="doc.id"
                  :label="doc.id"
                  :disabled="doc.status !== 'processed'"
                >
                  <div class="radio-content">
                    <el-icon
                      :size="16"
                      :color="getFileIconColor(doc.file_type)"
                    >
                      <component :is="getFileIcon(doc.file_type)" />
                    </el-icon>
                    <span class="doc-name">{{ doc.original_name }}</span>
                    <el-tag
                      v-if="doc.status !== 'processed'"
                      type="warning"
                      size="small"
                    >
                      {{ getStatusLabel(doc.status) }}
                    </el-tag>
                  </div>
                </el-radio>
              </el-radio-group>
            </div>

            <div class="history-section">
              <h4>对话历史</h4>
              <el-list
                v-if="chatStore.histories.length > 0"
                class="history-list"
              >
                <el-list-item
                  v-for="(history, index) in chatStore.histories"
                  :key="index"
                  @click="loadHistory(history)"
                  :class="{ active: currentHistoryIndex === index }"
                >
                  <template #default>
                    <span class="history-preview">
                      {{ history.messages[0]?.question || "空对话" }}
                    </span>
                    <span class="history-count"
                      >{{ history.messages.length }} 条</span
                    >
                  </template>
                </el-list-item>
              </el-list>
              <div v-else class="empty-history">
                <el-icon size="32" color="#ccc">
                  <ChatRound />
                </el-icon>
                <p>暂无对话历史</p>
              </div>
            </div>
          </div>

          <div class="chat-main">
            <div class="chat-header">
              <div class="chat-title">
                <el-icon size="24" color="#667eea">
                  <Cpu />
                </el-icon>
                <span>智能助手</span>
              </div>
              <div class="chat-actions">
                <el-button size="small" icon="Trash" @click="clearChat">
                  清空对话
                </el-button>
              </div>
            </div>

            <div class="chat-messages" ref="messagesContainer">
              <div
                v-if="chatStore.messages.length === 0"
                class="welcome-message"
              >
                <el-icon size="64" color="#667eea">
                  <MagicStick />
                </el-icon>
                <h3>欢迎使用AI问答</h3>
                <p>选择知识库文档后，即可开始提问</p>
                <div
                  v-if="processedDocuments.length > 0"
                  class="quick-questions"
                >
                  <span class="quick-label">试试这些问题：</span>
                  <div class="quick-tags">
                    <el-tag
                      v-for="(question, index) in sampleQuestions"
                      :key="index"
                      @click="sendQuickQuestion(question)"
                    >
                      {{ question }}
                    </el-tag>
                  </div>
                </div>
              </div>

              <div
                v-for="(msg, index) in chatStore.messages"
                :key="msg.id"
                :class="['message-item', msg.type, { error: msg.error }]"
              >
                <div class="message-avatar">
                  <el-icon
                    :size="32"
                    :color="msg.type === 'user' ? '#667eea' : '#2ecc71'"
                  >
                    <component :is="msg.type === 'user' ? User : Cpu" />
                  </el-icon>
                </div>
                <div class="message-content">
                  <div class="message-text">{{ msg.content }}</div>
                  <div
                    v-if="msg.sources && msg.sources.length > 0"
                    class="message-sources"
                  >
                    <div class="sources-header">
                      <el-icon size="14">
                        <Document />
                      </el-icon>
                      参考来源
                    </div>
                    <div
                      v-for="(source, sIndex) in msg.sources"
                      :key="sIndex"
                      class="source-item"
                    >
                      <span class="source-doc"
                        >文档 #{{ source.documentId }}</span
                      >
                      <span class="source-similarity"
                        >相似度
                        {{ (source.similarity * 100).toFixed(1) }}%</span
                      >
                    </div>
                  </div>
                  <div class="message-time">
                    {{ formatTime(msg.timestamp) }}
                  </div>
                </div>
              </div>

              <div v-if="chatStore.loading" class="loading-message">
                <el-spinner size="32" />
                <span>正在思考...</span>
              </div>
            </div>

            <div class="chat-input-area">
              <el-input
                v-model="question"
                type="textarea"
                :rows="2"
                placeholder="输入您的问题..."
                :disabled="chatStore.loading || processedDocuments.length === 0"
                class="chat-input"
                @keydown.enter.exact.prevent="sendMessage"
              />
              <div class="input-actions">
                <span v-if="processedDocuments.length === 0" class="input-tip">
                  请先上传并处理至少一个文档
                </span>
                <el-button
                  type="primary"
                  icon="Send"
                  :disabled="
                    !question.trim() ||
                    chatStore.loading ||
                    processedDocuments.length === 0
                  "
                  @click="sendMessage"
                >
                  发送
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </template>
    </Layout>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from "vue";
import { useDocumentsStore } from "../stores/documents";
import { useChatStore } from "../stores/chat";
import { ElMessage, ElMessageBox } from "element-plus";
import Layout from "../components/Layout.vue";
import {
  Cpu,
  MagicStick,
  ChatRound,
  User,
  Document,
  Files,
} from "@element-plus/icons-vue";

const documentsStore = useDocumentsStore();
const chatStore = useChatStore();

const messagesContainer = ref(null);
const question = ref("");
const selectedDocumentId = ref(null);
const currentHistoryIndex = ref(-1);
const isStreaming = ref(false);

const processedDocuments = computed(() => {
  return documentsStore.documents.filter((d) => d.status === "processed");
});

const sampleQuestions = [
  "文档的主要内容是什么？",
  "请总结一下文档内容",
  "文档中有哪些关键点？",
];

function getFileIcon(type) {
  switch (type?.toLowerCase()) {
    case "pdf":
      return Document;
    default:
      return Files;
  }
}

function getFileIconColor(type) {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "#e74c3c";
    case "md":
      return "#2ecc71";
    default:
      return "#3498db";
  }
}

function getStatusLabel(status) {
  switch (status) {
    case "processed":
      return "已处理";
    case "uploaded":
      return "待处理";
    case "error":
      return "处理失败";
    default:
      return status;
  }
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refreshDocuments() {
  documentsStore.loadDocuments();
}

async function sendMessage() {
  if (!question.value.trim() || isStreaming.value) return;

  const userQuestion = question.value.trim();
  question.value = "";

  // 添加用户消息
  const userMsg = {
    id: Date.now(),
    type: "user",
    content: userQuestion,
    timestamp: new Date().toISOString(),
  };
  chatStore.messages.push(userMsg);

  // 添加AI消息占位
  const botMsg = {
    id: Date.now() + 1,
    type: "bot",
    content: "",
    sources: [],
    timestamp: new Date().toISOString(),
  };
  chatStore.messages.push(botMsg);

  isStreaming.value = true;
  chatStore.loading = true;

  try {
    // 获取token
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("未登录，请先登录");
    }

    // 调用流式API
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        question: userQuestion,
        topK: 5,
        maxTokens: 2048,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "请求失败");
    }

    // 处理SSE流式响应
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") {
            continue;
          }

          try {
            const event = JSON.parse(data);

            if (event.type === "sources") {
              // 更新参考来源
              botMsg.sources = event.data;
            } else if (event.type === "content") {
              // 流式追加内容（打字机效果）
              botMsg.content += event.data;
              scrollToBottom();
            } else if (event.type === "done") {
              // 完成
              console.log("生成完成:", event.data);
            } else if (event.type === "error") {
              throw new Error(event.data);
            }
          } catch (e) {
            if (e.message !== "Unexpected end of JSON input") {
              console.error("解析SSE数据失败:", e);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("发送消息失败:", error);
    botMsg.content = `抱歉，发生了错误：${error.message}`;
    botMsg.error = true;
    ElMessage.error(error.message);
  } finally {
    isStreaming.value = false;
    chatStore.loading = false;
    scrollToBottom();
  }
}

function sendQuickQuestion(q) {
  question.value = q;
  sendMessage();
}

function clearChat() {
  ElMessageBox.confirm("确定要清空对话吗？", "确认清空", { type: "warning" })
    .then(() => {
      chatStore.clearMessages();
      ElMessage.success("对话已清空");
    })
    .catch(() => {});
}

function loadHistory(history) {
  chatStore.setSelectedDocument(history.documentId);
  selectedDocumentId.value = history.documentId;

  chatStore.clearMessages();
  history.messages.forEach((msg, index) => {
    setTimeout(() => {
      chatStore.messages.push({
        id: Date.now() + index,
        type: "user",
        content: msg.question,
        timestamp: msg.timestamp,
      });
      chatStore.messages.push({
        id: Date.now() + index + 100,
        type: "bot",
        content: msg.answer,
        timestamp: msg.timestamp,
      });
    }, index * 200);
  });
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

watch(() => chatStore.messages, scrollToBottom, { deep: true });

onMounted(() => {
  documentsStore.loadDocuments();
});
</script>

<style scoped>
.chat-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.page-header h1 {
  font-size: 24px;
  color: #333;
  margin-bottom: 5px;
}

.page-header p {
  color: #999;
  font-size: 14px;
}

.chat-container {
  display: flex;
  gap: 20px;
  height: calc(100vh - 180px);
}

.chat-sidebar {
  width: 320px;
  background: white;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.sidebar-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin: 0;
}

.document-selector {
  padding: 15px;
  border-bottom: 1px solid #eee;
  max-height: 250px;
  overflow-y: auto;
}

.radio-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.doc-name {
  flex: 1;
  font-size: 13px;
  color: #333;
}

.history-section {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
}

.history-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 15px;
}

.history-list {
  border: none;
}

.history-list :deep(.el-list-item) {
  padding: 10px 12px;
  cursor: pointer;
  border-radius: 8px;
  margin-bottom: 5px;
  transition: background 0.2s;
}

.history-list :deep(.el-list-item:hover) {
  background: #f5f7fa;
}

.history-list :deep(.el-list-item.active) {
  background: #e8f4fd;
}

.history-preview {
  flex: 1;
  font-size: 13px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-count {
  font-size: 12px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 10px;
}

.empty-history {
  text-align: center;
  padding: 30px 20px;
  color: #999;
}

.empty-history p {
  margin-top: 10px;
  font-size: 14px;
}

.chat-main {
  flex: 1;
  background: white;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
}

.chat-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.welcome-message {
  text-align: center;
  padding: 60px 20px;
}

.welcome-message h3 {
  font-size: 20px;
  color: #333;
  margin: 20px 0 10px;
}

.welcome-message p {
  color: #999;
  font-size: 14px;
}

.quick-questions {
  margin-top: 30px;
}

.quick-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 15px;
  display: block;
}

.quick-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
}

.quick-tags :deep(.el-tag) {
  cursor: pointer;
  background: #f0f4ff;
  color: #667eea;
  border: none;
}

.quick-tags :deep(.el-tag:hover) {
  background: #667eea;
  color: white;
}

.message-item {
  display: flex;
  gap: 12px;
  margin-bottom: 25px;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-item.user .message-content {
  align-items: flex-end;
}

.message-avatar {
  flex-shrink: 0;
}

.message-content {
  max-width: 70%;
  display: flex;
  flex-direction: column;
}

.message-text {
  padding: 15px 18px;
  border-radius: 18px;
  font-size: 14px;
  line-height: 1.6;
}

.message-item.user .message-text {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 6px;
}

.message-item.bot .message-text {
  background: #f5f7fa;
  color: #333;
  border-bottom-left-radius: 6px;
}

.message-item.error .message-text {
  background: #fff0f0;
  color: #c62828;
}

.message-sources {
  margin-top: 12px;
  padding: 12px;
  background: white;
  border: 1px solid #eee;
  border-radius: 10px;
  font-size: 12px;
}

.sources-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #666;
  margin-bottom: 10px;
}

.source-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid #f0f0f0;
}

.source-item:last-child {
  border-bottom: none;
}

.source-doc {
  color: #667eea;
}

.source-similarity {
  color: #2ecc71;
}

.message-time {
  font-size: 11px;
  color: #ccc;
  margin-top: 6px;
}

.message-item.user .message-time {
  text-align: right;
}

.loading-message {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: #667eea;
}

.chat-input-area {
  padding: 20px;
  border-top: 1px solid #eee;
}

.chat-input {
  margin-bottom: 15px;
}

.chat-input :deep(.el-textarea__inner) {
  border-radius: 12px;
  resize: none;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-tip {
  font-size: 13px;
  color: #999;
}

.input-actions :deep(.el-button) {
  border-radius: 20px;
  padding: 8px 24px;
}

@media (max-width: 768px) {
  .chat-container {
    flex-direction: column;
    height: auto;
  }

  .chat-sidebar {
    width: 100%;
    height: 200px;
  }

  .chat-main {
    height: calc(100vh - 400px);
  }

  .message-content {
    max-width: 85%;
  }
}
</style>
