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
                <el-switch
                  v-model="debugMode"
                  active-text="Debug模式"
                  size="small"
                  style="margin-right: 10px"
                />
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
                      参考来源 ({{ msg.sources.length }})
                    </div>
                    <div
                      v-for="(source, sIndex) in msg.sources"
                      :key="sIndex"
                      class="source-item"
                    >
                      <div class="source-info">
                        <span class="source-doc">
                          <el-icon size="12"><Files /></el-icon>
                          {{ source.filename || `文档 #${source.documentId}` }}
                        </span>
                        <el-tag size="small" type="success">
                          相似度 {{ (source.similarity * 100).toFixed(1) }}%
                        </el-tag>
                      </div>
                      <div class="source-meta">
                        <span class="source-chunk"
                          >Chunk #{{ source.chunkIndex }}</span
                        >
                        <el-button
                          size="small"
                          text
                          type="primary"
                          @click="toggleSourceExpand(sIndex)"
                        >
                          {{ expandedSources[sIndex] ? "收起" : "展开" }}
                        </el-button>
                      </div>
                      <div
                        v-if="expandedSources[sIndex]"
                        class="source-content"
                      >
                        {{ source.text }}
                      </div>
                    </div>
                  </div>
                  <div v-if="debugMode && msg.debugInfo" class="message-debug">
                    <div class="debug-header">
                      <el-icon size="14"><Cpu /></el-icon>
                      Debug信息
                    </div>
                    <div class="debug-content">
                      <div class="debug-section">
                        <strong>检索耗时:</strong>
                        {{ msg.debugInfo.retrieveTime }}ms
                      </div>
                      <div class="debug-section">
                        <strong>生成耗时:</strong>
                        {{ msg.debugInfo.generateTime }}ms
                      </div>
                      <div class="debug-section">
                        <strong>总耗时:</strong> {{ msg.debugInfo.totalTime }}ms
                      </div>
                      <div class="debug-section">
                        <strong>模型:</strong> {{ msg.debugInfo.model }}
                      </div>
                      <div class="debug-section">
                        <strong>Provider:</strong> {{ msg.debugInfo.provider }}
                      </div>
                      <div class="debug-section">
                        <strong>Prompt:</strong>
                        <pre class="debug-prompt">{{
                          msg.debugInfo.prompt
                        }}</pre>
                      </div>
                    </div>
                  </div>

                  <div class="message-time">
                    {{ formatTime(msg.timestamp) }}
                  </div>
                </div>
              </div>

              <div v-if="chatStore.loading" class="loading-message">
                <el-spinner size="32" />
                <span>{{ loadingText }}</span>
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

<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
} from "vue";
import { useDocumentsStore } from "../stores/documents";
import { useChatStore } from "../stores/chat";
import { ElMessage, ElMessageBox } from "element-plus";
import type { Component } from "vue";
import Layout from "../components/Layout.vue";
import {
  Cpu,
  MagicStick,
  ChatRound,
  User,
  Document,
  Files,
} from "@element-plus/icons-vue";
import type {
  ChatMessage,
  ChatSource,
  ChatHistory,
  DebugInfo,
} from "../types/chat";
import type { Document as DocumentType } from "../types/document";

interface BotMessage extends ChatMessage {
  type: "bot";
  content: string;
  sources: ChatSource[];
  debugInfo?: DebugInfo;
  error: boolean;
}

type PhaseType = "retrieving" | "generating";

const documentsStore = useDocumentsStore();
const chatStore = useChatStore();

const messagesContainer = ref<HTMLDivElement | null>(null);
const question = ref<string>("");
const selectedDocumentId = ref<number | null>(null);
const currentHistoryIndex = ref<number>(-1);
const isStreaming = ref<boolean>(false);
const debugMode = ref<boolean>(false);
const expandedSources = ref<Record<number, boolean>>({});
const loadingText = ref<string>("正在思考...");

let abortController: AbortController | null = null;
let requestTimeoutId: ReturnType<typeof setTimeout> | null = null;
let scrollDebounceId: ReturnType<typeof setTimeout> | null = null;

const processedDocuments = computed<DocumentType[]>(() => {
  return documentsStore.documents.filter((d) => d.status === "processed");
});

const sampleQuestions: string[] = [
  "文档的主要内容是什么？",
  "请总结一下文档内容",
  "文档中有哪些关键点？",
];

function getFileIcon(type?: string): Component {
  switch (type?.toLowerCase()) {
    case "pdf":
      return Document;
    default:
      return Files;
  }
}

function getFileIconColor(type?: string): string {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "#e74c3c";
    case "md":
      return "#2ecc71";
    default:
      return "#3498db";
  }
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case "processed":
      return "已处理";
    case "uploaded":
      return "待处理";
    case "error":
      return "处理失败";
    default:
      return status || "";
  }
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function refreshDocuments(): void {
  documentsStore.loadDocuments();
}

function toggleSourceExpand(index: number): void {
  expandedSources.value[index] = !expandedSources.value[index];
}

function updateLoadingText(phase: PhaseType): void {
  switch (phase) {
    case "retrieving":
      loadingText.value = "检索知识库中...";
      break;
    case "generating":
      loadingText.value = "AI生成答案中...";
      break;
    default:
      loadingText.value = "正在思考...";
  }
}

/**
 * 发送消息进行AI问答（流式响应）
 * 健壮性修复：异常捕获、SSE解析兼容、AbortController中断、状态兜底
 */
async function sendMessage(): Promise<void> {
  if (!question.value.trim() || isStreaming.value) return;

  const userQuestion = question.value.trim();
  question.value = "";

  const userMsg: ChatMessage = {
    id: Date.now(),
    type: "user",
    content: userQuestion,
    timestamp: new Date().toISOString(),
  };
  chatStore.messages.push(userMsg);

  const botMsg = reactive<BotMessage>({
    id: Date.now() + 1,
    type: "bot",
    content: "",
    sources: [],
    timestamp: new Date().toISOString(),
    error: false,
  });
  chatStore.messages.push(botMsg);

  // 设置全局loading状态
  isStreaming.value = true;
  chatStore.loading = true;
  updateLoadingText("retrieving");

  // 创建AbortController用于中断请求
  abortController = new AbortController();
  const { signal } = abortController;

  // 设置30秒超时自动终止流式请求
  requestTimeoutId = setTimeout(() => {
    if (abortController && !signal.aborted) {
      abortController.abort();
      botMsg.content = "请求超时，请稍后重试";
      botMsg.error = true;
      ElMessage.warning("请求超时，已自动终止");
    }
  }, 300000);

  try {
    // 获取token（同时检查localStorage和sessionStorage）
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      throw new Error("未登录，请先登录");
    }

    // 调用流式API，绑定AbortController signal
    // 对于流式请求，直接连接后端以避免Vite代理问题
    const streamUrl = import.meta.env.DEV
      ? "http://localhost:3001/api/chat/stream"
      : "/api/chat/stream";

    const response = await fetch(streamUrl, {
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
        ...(selectedDocumentId.value && {
          document_id: selectedDocumentId.value,
        }),
      }),
      signal, // 绑定中断信号
    });

    // 401登录过期精细化处理
    if (response.status === 401) {
      // 同时清除localStorage和sessionStorage的token
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("user");
      // 自动跳转到登录页
      window.location.href = "/login";
      throw new Error("登录已过期，请重新登录");
    }

    if (!response.ok) {
      const errorData = await response
        .json()
        .catch(() => ({ message: "请求失败" }));
      throw new Error(errorData.message || `请求失败(${response.status})`);
    }

    // 处理SSE流式响应
    if (!response.body) {
      throw new Error("响应体为空");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // 流式读取循环
    while (true) {
      // 内层try/catch捕获流读取异常，防止逃逸
      try {
        const { done, value } = await reader.read();

        // 流正常结束
        if (done) {
          // 清除超时定时器
          if (requestTimeoutId) {
            clearTimeout(requestTimeoutId);
            requestTimeoutId = null;
          }
          break;
        }

        // 解码数据并追加到缓冲区
        buffer += decoder.decode(value, { stream: true });

        // SSE数据解析兼容：统一替换\r换行符，兼容Windows \r\n格式
        buffer = buffer.replace(/\r/g, "");

        // 按换行符分割
        const lines = buffer.split("\n");
        // 保留最后一个可能不完整的行
        buffer = lines.pop() || "";

        // 处理每一行SSE数据
        for (const line of lines) {
          // 过滤空行、空白无效行再解析
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith("data: ")) {
            continue;
          }

          const data = trimmedLine.slice(6);
          if (data === "[DONE]") {
            continue;
          }

          interface SSEEvent {
            type: string;
            data: unknown;
          }

          try {
            const event: SSEEvent = JSON.parse(data);

            if (event.type === "sources") {
              botMsg.sources = (event.data as ChatSource[]) || [];
              updateLoadingText("generating");
            } else if (event.type === "content") {
              botMsg.content += (event.data as string) || "";
              scrollToBottomDebounced();
            } else if (event.type === "done") {
              console.log("生成完成:", event.data);
            } else if (event.type === "error") {
              throw new Error((event.data as string) || "生成失败");
            } else if (event.type === "debug") {
              if (debugMode.value) {
                botMsg.debugInfo = event.data as DebugInfo;
              }
            }
          } catch (parseError) {
            // SSE解析错误：单条数据解析失败静默丢弃，避免控制台大量冗余报错
            // 仅打印简易调试日志
            console.log("SSE数据解析跳过:", data.substring(0, 50));
          }
        }
      } catch (streamError) {
        // 区分主动取消请求和真实异常
        if (signal.aborted) {
          // 主动中断，不显示错误
          console.log("请求已中断");
          break;
        }
        // 真实流读取异常
        const streamErr = streamError as Error;
        console.error("流读取异常:", streamErr);
        botMsg.content = `流式响应异常：${streamErr.message}`;
        botMsg.error = true;
        break;
      }
    }

    // 释放reader读取锁
    try {
      reader.releaseLock();
    } catch (e) {
      // reader可能已关闭，忽略释放锁错误
    }
  } catch (error) {
    const err = error as Error & { name?: string };
    console.error("发送消息失败:", err);

    if (err.name === "AbortError") {
      if (!botMsg.content) {
        botMsg.content = "请求已中断";
        botMsg.error = true;
      }
    } else if (err.message.includes("未登录")) {
      botMsg.content = "请先登录后再进行问答";
      botMsg.error = true;
      ElMessage.warning("请先登录");
    } else if (err.message.includes("过期")) {
      botMsg.content = "登录已过期，请重新登录";
      botMsg.error = true;
    } else if (
      err.message.includes("网络") ||
      err.message.includes("ECONNREFUSED")
    ) {
      botMsg.content = "网络连接失败，请检查网络状态";
      botMsg.error = true;
      ElMessage.error("网络异常");
    } else if (err.message.includes("Ollama")) {
      botMsg.content = "AI服务暂时不可用，请检查Ollama服务是否已启动";
      botMsg.error = true;
      ElMessage.error("AI服务不可用");
    } else if (err.message.includes("ECONNREFUSED")) {
      botMsg.content =
        "无法连接到AI服务，请确认Ollama已启动并运行在 http://127.0.0.1:11434";
      botMsg.error = true;
      ElMessage.error("AI服务连接失败");
    } else {
      botMsg.content = `抱歉，发生了错误：${err.message}`;
      botMsg.error = true;
      ElMessage.error(err.message);
    }
  } finally {
    // 状态兜底：无论成功、失败、中断，统一重置loading状态
    isStreaming.value = false;
    chatStore.loading = false;

    // 清理所有定时器，防止内存泄漏
    if (requestTimeoutId) {
      clearTimeout(requestTimeoutId);
      requestTimeoutId = null;
    }
    if (scrollDebounceId) {
      clearTimeout(scrollDebounceId);
      scrollDebounceId = null;
    }

    // 清理AbortController
    abortController = null;

    // 最终滚动到底部
    scrollToBottomDebounced();
  }
}

/**
 * 停止生成（手动中断请求）
 */
function stopGeneration(): void {
  if (abortController && isStreaming.value) {
    abortController.abort();
    ElMessage.info("已停止生成");
  }
}

/**
 * scrollToBottom防抖版本（100ms）
 * 避免流式输出高频滚动造成页面卡顿
 */
function scrollToBottomDebounced(): void {
  if (scrollDebounceId) {
    clearTimeout(scrollDebounceId);
  }
  scrollDebounceId = setTimeout(() => {
    nextTick(() => {
      if (messagesContainer.value) {
        messagesContainer.value.scrollTop =
          messagesContainer.value.scrollHeight;
      }
    });
    scrollDebounceId = null;
  }, 100);
}

/**
 * 原scrollToBottom保留，用于非流式场景
 */
function scrollToBottom(): void {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
    }
  });
}

function sendQuickQuestion(q: string): void {
  question.value = q;
  sendMessage();
}

function clearChat(): void {
  ElMessageBox.confirm("确定要清空对话吗？", "确认清空", { type: "warning" })
    .then(() => {
      chatStore.clearMessages();
      ElMessage.success("对话已清空");
    })
    .catch(() => {});
}

function loadHistory(history: ChatHistory): void {
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

watch(() => chatStore.messages, scrollToBottom, { deep: true });

onMounted(() => {
  documentsStore.loadDocuments();
});

// 组件卸载时清理资源，防止内存泄漏
onUnmounted(() => {
  // 中断正在进行的流式请求
  if (abortController) {
    abortController.abort();
    abortController = null;
  }

  // 清理所有定时器
  if (requestTimeoutId) {
    clearTimeout(requestTimeoutId);
    requestTimeoutId = null;
  }
  if (scrollDebounceId) {
    clearTimeout(scrollDebounceId);
    scrollDebounceId = null;
  }

  // 重置loading状态
  isStreaming.value = false;
  chatStore.loading = false;
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

.source-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.source-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #999;
}

.source-chunk {
  font-size: 11px;
  color: #666;
}

.source-content {
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 12px;
  color: #555;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.message-debug {
  margin-top: 12px;
  padding: 12px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 10px;
  font-size: 12px;
}

.debug-header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #856404;
  margin-bottom: 10px;
  font-weight: 600;
}

.debug-section {
  margin-bottom: 8px;
  color: #856404;
}

.debug-prompt {
  background: white;
  padding: 8px;
  border-radius: 4px;
  margin-top: 4px;
  max-height: 150px;
  overflow-y: auto;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
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
