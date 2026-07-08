<template>
  <div class="document-detail-page">
    <Layout>
      <template #header>
        <div class="page-header">
          <div class="header-left">
            <el-button icon="ArrowLeft" @click="goBack">返回</el-button>
            <h1>文档详情</h1>
          </div>
          <div class="header-right">
            <el-button type="primary" icon="ChatLineSquare" @click="goToChat">
              问答
            </el-button>
            <el-button type="danger" icon="Delete" @click="handleDelete">
              删除
            </el-button>
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="loading" class="loading-container">
          <el-skeleton :rows="10" animated />
        </div>

        <div v-else-if="error" class="error-container">
          <el-result icon="error" :title="error" sub-title="文档加载失败">
            <template #extra>
              <el-button type="primary" @click="loadDocument"
                >重新加载</el-button
              >
            </template>
          </el-result>
        </div>

        <div v-else-if="document" class="detail-container">
          <el-card class="document-header-card">
            <div class="document-header">
              <el-icon :size="48" :color="getFileIconColor(document.file_type)">
                <component :is="getFileIcon(document.file_type)" />
              </el-icon>
              <div class="document-info">
                <h2>{{ document.original_name }}</h2>
                <div class="document-meta">
                  <el-tag :type="getStatusTagType(document.status)">
                    {{ getStatusLabel(document.status) }}
                  </el-tag>
                  <span class="meta-item">
                    <el-icon><Files /></el-icon>
                    {{ getFileTypeLabel(document.file_type) }}
                  </span>
                  <span class="meta-item">
                    <el-icon><Document /></el-icon>
                    {{ formatFileSize(document.filesize) }}
                  </span>
                  <span class="meta-item">
                    <el-icon><Clock /></el-icon>
                    {{ formatTime(document.created_at) }}
                  </span>
                </div>
              </div>
            </div>
          </el-card>

          <el-card class="detail-tabs-card">
            <el-tabs v-model="activeTab" type="border-card">
              <!-- Tab1: 基本信息 -->
              <el-tab-pane label="基本信息" name="basic">
                <el-descriptions :column="2" border>
                  <el-descriptions-item label="文档名称">
                    {{ document.original_name }}
                  </el-descriptions-item>
                  <el-descriptions-item label="文件类型">
                    <el-tag :type="getFileTypeTagType(document.file_type)">
                      {{ getFileTypeLabel(document.file_type) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="文件大小">
                    {{ formatFileSize(document.filesize) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="文档状态">
                    <el-tag :type="getStatusTagType(document.status)">
                      {{ getStatusLabel(document.status) }}
                    </el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="切片数量">
                    <el-tag type="info">{{ document.chunk_count }} 块</el-tag>
                  </el-descriptions-item>
                  <el-descriptions-item label="文件路径">
                    <el-text truncated>{{ document.file_path }}</el-text>
                  </el-descriptions-item>
                  <el-descriptions-item label="上传时间" :span="2">
                    {{ formatTime(document.created_at) }}
                  </el-descriptions-item>
                  <el-descriptions-item label="更新时间" :span="2">
                    {{ formatTime(document.updated_at) }}
                  </el-descriptions-item>
                </el-descriptions>
              </el-tab-pane>

              <!-- Tab2: 原文预览 -->
              <el-tab-pane label="原文预览" name="preview">
                <div v-if="contentLoading" class="loading-container">
                  <el-skeleton :rows="10" animated />
                </div>
                <div v-else-if="contentError" class="error-container">
                  <el-result icon="warning" :title="contentError">
                    <template #extra>
                      <el-button type="primary" @click="loadContent"
                        >重新加载</el-button
                      >
                    </template>
                  </el-result>
                </div>
                <div v-else-if="documentContent" class="content-preview">
                  <div
                    v-if="document.file_type === 'md'"
                    class="markdown-content"
                    v-html="renderedMarkdown"
                  ></div>
                  <pre v-else class="plain-text-content">{{
                    documentContent
                  }}</pre>
                </div>
                <div v-else class="empty-container">
                  <el-empty description="暂无内容" />
                </div>
              </el-tab-pane>

              <!-- Tab3: 切片预览 -->
              <el-tab-pane label="切片预览" name="chunks">
                <div class="chunks-toolbar">
                  <el-input
                    v-model="chunkSearchText"
                    placeholder="搜索切片内容..."
                    prefix-icon="Search"
                    style="width: 300px"
                    clearable
                  />
                  <el-button icon="Refresh" @click="loadChunks">刷新</el-button>
                </div>

                <div v-if="chunksLoading" class="loading-container">
                  <el-skeleton :rows="5" animated />
                </div>
                <div v-else-if="chunksError" class="error-container">
                  <el-result icon="warning" :title="chunksError">
                    <template #extra>
                      <el-button type="primary" @click="loadChunks"
                        >重新加载</el-button
                      >
                    </template>
                  </el-result>
                </div>
                <div
                  v-else-if="filteredChunks.length > 0"
                  class="chunks-container"
                >
                  <div
                    v-for="(chunk, index) in filteredChunks"
                    :key="chunk.id || index"
                    class="chunk-card"
                  >
                    <el-card>
                      <template #header>
                        <div class="chunk-header">
                          <div class="chunk-title">
                            <el-tag type="primary"
                              >Chunk {{ chunk.chunk_index }}</el-tag
                            >
                            <span class="chunk-stats">
                              <el-icon><Document /></el-icon>
                              {{ chunk.content.length }} 字符
                            </span>
                            <span class="chunk-stats">
                              <el-icon><Coin /></el-icon>
                              {{ estimateTokens(chunk.content) }} tokens
                            </span>
                          </div>
                          <el-button
                            size="small"
                            icon="CopyDocument"
                            @click="copyChunk(chunk.content)"
                          >
                            复制
                          </el-button>
                        </div>
                      </template>
                      <div class="chunk-content">
                        <el-collapse>
                          <el-collapse-item :name="index">
                            <template #title>
                              <span class="chunk-preview">
                                {{ chunk.content.substring(0, 100) }}...
                              </span>
                            </template>
                            <p class="chunk-text">{{ chunk.content }}</p>
                          </el-collapse-item>
                        </el-collapse>
                      </div>
                    </el-card>
                  </div>
                </div>
                <div v-else class="empty-container">
                  <el-empty description="暂无切片数据" />
                </div>
              </el-tab-pane>

              <!-- Tab4: 检索测试 -->
              <el-tab-pane label="检索测试" name="retrieval">
                <div class="retrieval-container">
                  <el-card class="retrieval-input-card">
                    <div class="retrieval-input">
                      <el-input
                        v-model="retrievalQuery"
                        type="textarea"
                        :rows="3"
                        placeholder="输入测试问题，验证知识库检索效果..."
                      />
                      <div class="retrieval-controls">
                        <div class="control-item">
                          <span>TopK:</span>
                          <el-input-number
                            v-model="topK"
                            :min="1"
                            :max="20"
                            :step="1"
                            size="small"
                          />
                        </div>
                        <el-button
                          type="primary"
                          icon="Search"
                          :loading="retrievalLoading"
                          @click="testRetrieval"
                        >
                          测试检索
                        </el-button>
                      </div>
                    </div>
                  </el-card>

                  <div v-if="retrievalLoading" class="loading-container">
                    <el-skeleton :rows="5" animated />
                  </div>
                  <div v-else-if="retrievalError" class="error-container">
                    <el-result icon="warning" :title="retrievalError">
                      <template #extra>
                        <el-button type="primary" @click="testRetrieval"
                          >重新测试</el-button
                        >
                      </template>
                    </el-result>
                  </div>
                  <div
                    v-else-if="retrievalResults.length > 0"
                    class="retrieval-results"
                  >
                    <div
                      v-for="(result, index) in retrievalResults"
                      :key="result.id"
                      class="retrieval-result-card"
                    >
                      <el-card>
                        <div class="result-header">
                          <el-tag :type="getRankTagType(index)">
                            Top{{ index + 1 }}
                          </el-tag>
                          <div class="result-similarity">
                            <el-icon><TrendCharts /></el-icon>
                            相似度:
                            {{ result.similarity?.toFixed(2) || "0.00" }}
                          </div>
                        </div>
                        <div class="result-meta">
                          <span class="meta-item">
                            <el-icon><Document /></el-icon>
                            {{ document.original_name }}
                          </span>
                          <span
                            v-if="result.metadata?.chunkIndex !== undefined"
                            class="meta-item"
                          >
                            <el-icon><Files /></el-icon>
                            Chunk {{ result.metadata.chunkIndex }}
                          </span>
                        </div>
                        <div class="result-content">
                          <p>{{ result.text }}</p>
                        </div>
                      </el-card>
                    </div>
                  </div>
                  <div v-else class="empty-container">
                    <el-empty description="输入问题后点击测试检索" />
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </el-card>
        </div>
      </template>
    </Layout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import Layout from "../components/Layout.vue";
import {
  Files,
  Document,
  Clock,
  ArrowLeft,
  ChatLineSquare,
  Delete,
  CopyDocument,
  Coin,
  TrendCharts,
  Search,
  Refresh,
} from "@element-plus/icons-vue";
import { marked } from "marked";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import {
  getDocument,
  deleteDocument as deleteDocApi,
  getDocumentContent,
  getDocumentChunks,
  testRetrieval as testRetrievalApi,
} from "../api/document";

// 配置 marked
marked.setOptions({
  highlight: function (code, lang) {
    const language = hljs.getLanguage(lang) ? lang : "plaintext";
    return hljs.highlight(code, { language }).value;
  },
  breaks: true,
  gfm: true,
});

const router = useRouter();
const route = useRoute();

// 状态管理
const loading = ref(false);
const error = ref("");
const document = ref(null);
const activeTab = ref("basic");

// 内容预览
const contentLoading = ref(false);
const contentError = ref("");
const documentContent = ref("");

// 切片预览
const chunksLoading = ref(false);
const chunksError = ref("");
const chunks = ref([]);
const chunkSearchText = ref("");

// 检索测试
const retrievalQuery = ref("");
const topK = ref(5);
const retrievalLoading = ref(false);
const retrievalError = ref("");
const retrievalResults = ref([]);

// 计算属性
const filteredChunks = computed(() => {
  if (!chunkSearchText.value) return chunks.value;
  const search = chunkSearchText.value.toLowerCase();
  return chunks.value.filter((chunk) =>
    chunk.content.toLowerCase().includes(search),
  );
});

const renderedMarkdown = computed(() => {
  if (!documentContent.value) return "";
  return marked(documentContent.value);
});

// 监听标签页切换
watch(activeTab, (newTab) => {
  if (!document.value) return;

  switch (newTab) {
    case "preview":
      loadContent();
      break;
    case "chunks":
      loadChunks();
      break;
    case "retrieval":
      // 检索测试不需要自动加载，等待用户输入
      break;
    default:
      break;
  }
});

// 方法
async function loadDocument() {
  loading.value = true;
  error.value = "";

  try {
    const documentId = route.params.id;
    const response = await getDocument(documentId);

    if (response.success && response.data) {
      document.value = response.data;
    } else {
      error.value = response.message || "文档加载失败";
    }
  } catch (err) {
    error.value = err.message || "网络请求失败";
  } finally {
    loading.value = false;
  }
}

async function loadContent() {
  contentLoading.value = true;
  contentError.value = "";

  try {
    const response = await getDocumentContent(document.value.id);

    if (response.success && response.data) {
      documentContent.value = response.data.content || response.data;
    } else {
      contentError.value = response.message || "内容加载失败";
    }
  } catch (err) {
    contentError.value = err.message || "网络请求失败";
  } finally {
    contentLoading.value = false;
  }
}

async function loadChunks() {
  chunksLoading.value = true;
  chunksError.value = "";

  try {
    const response = await getDocumentChunks(document.value.id);

    if (response.success && response.data) {
      const chunksData = response.data.chunks || response.data;
      chunks.value = chunksData.map((chunk) => ({
        ...chunk,
        chunk_index: chunk.index,
      }));
    } else {
      chunksError.value = response.message || "切片加载失败";
    }
  } catch (err) {
    chunksError.value = err.message || "网络请求失败";
  } finally {
    chunksLoading.value = false;
  }
}

async function testRetrieval() {
  if (!retrievalQuery.value.trim()) {
    ElMessage.warning("请输入测试问题");
    return;
  }

  retrievalLoading.value = true;
  retrievalError.value = "";

  try {
    const response = await testRetrievalApi({
      query: retrievalQuery.value,
      topK: topK.value,
      document_id: document.value.id,
    });

    if (response.code === 200 && response.data) {
      retrievalResults.value =
        response.data.sources || response.data.results || [];
      if (retrievalResults.value.length === 0) {
        ElMessage.info("未找到相关内容");
      }
    } else {
      retrievalError.value = response.message || "检索失败";
    }
  } catch (err) {
    retrievalError.value = err.message || "网络请求失败";
  } finally {
    retrievalLoading.value = false;
  }
}

function estimateTokens(text) {
  // 简单的 token 估算：中文字符按 1 token，英文单词按 0.75 token
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  return Math.ceil(chineseChars + englishWords * 0.75);
}

function copyChunk(content) {
  navigator.clipboard
    .writeText(content)
    .then(() => {
      ElMessage.success("复制成功");
    })
    .catch(() => {
      ElMessage.error("复制失败");
    });
}

function goBack() {
  router.back();
}

function goToChat() {
  router.push("/chat");
}

async function handleDelete() {
  await ElMessageBox.confirm(
    `确定要删除文档 "${document.value.original_name}" 吗？`,
    "确认删除",
    { type: "warning" },
  );

  try {
    await deleteDocApi(document.value.id);
    ElMessage.success("删除成功");
    router.push("/documents");
  } catch (err) {
    ElMessage.error("删除失败");
  }
}

// 工具函数
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

function getFileTypeTagType(type) {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "danger";
    case "md":
      return "success";
    default:
      return "info";
  }
}

function getFileTypeLabel(type) {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "PDF";
    case "md":
      return "Markdown";
    default:
      return "TXT";
  }
}

function getStatusTagType(status) {
  switch (status) {
    case "processed":
      return "success";
    case "uploaded":
      return "warning";
    case "error":
      return "danger";
    default:
      return "info";
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

function formatFileSize(bytes) {
  if (!bytes) return "-";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
}

function formatTime(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("zh-CN");
}

function getRankTagType(index) {
  if (index === 0) return "danger";
  if (index === 1) return "warning";
  if (index === 2) return "success";
  return "info";
}

// 生命周期
onMounted(() => {
  loadDocument();
});
</script>

<style scoped>
.document-detail-page {
  min-height: 100vh;
  background: #f5f7fa;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-left h1 {
  font-size: 24px;
  color: #333;
  margin: 0;
}

.header-right {
  display: flex;
  gap: 10px;
}

.document-header-card {
  margin-bottom: 20px;
}

.document-header {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.document-info h2 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 20px;
}

.document-meta {
  display: flex;
  gap: 15px;
  align-items: center;
  flex-wrap: wrap;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #666;
  font-size: 14px;
}

.detail-tabs-card {
  min-height: 600px;
}

.loading-container,
.error-container,
.empty-container {
  padding: 40px 20px;
  text-align: center;
}

/* 内容预览样式 */
.content-preview {
  padding: 20px;
  max-height: 800px;
  overflow-y: auto;
}

.markdown-content {
  line-height: 1.8;
  color: #333;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
}

.markdown-content :deep(p) {
  margin-bottom: 1em;
}

.markdown-content :deep(code) {
  background: #f6f8fa;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: "Courier New", monospace;
}

.markdown-content :deep(pre) {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  margin-bottom: 1em;
}

.markdown-content :deep(pre code) {
  background: none;
  padding: 0;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 16px;
  color: #666;
  margin: 1em 0;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  padding-left: 2em;
  margin-bottom: 1em;
}

.plain-text-content {
  background: #f6f8fa;
  padding: 20px;
  border-radius: 6px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: "Courier New", monospace;
  line-height: 1.6;
  margin: 0;
}

/* 切片预览样式 */
.chunks-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
}

.chunks-container {
  padding: 20px;
  max-height: 800px;
  overflow-y: auto;
}

.chunk-card {
  margin-bottom: 15px;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chunk-title {
  display: flex;
  gap: 15px;
  align-items: center;
}

.chunk-stats {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #666;
  font-size: 13px;
}

.chunk-content {
  margin-top: 10px;
}

.chunk-preview {
  color: #666;
  font-size: 14px;
}

.chunk-text {
  margin: 0;
  line-height: 1.8;
  color: #333;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 检索测试样式 */
.retrieval-container {
  padding: 20px;
}

.retrieval-input-card {
  margin-bottom: 20px;
}

.retrieval-input {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.retrieval-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.retrieval-results {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.retrieval-result-card {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.result-similarity {
  display: flex;
  align-items: center;
  gap: 5px;
  color: #666;
  font-size: 14px;
}

.result-meta {
  display: flex;
  gap: 15px;
  margin-bottom: 10px;
  color: #999;
  font-size: 13px;
}

.result-content {
  background: #f6f8fa;
  padding: 15px;
  border-radius: 6px;
  line-height: 1.8;
  color: #333;
}

.result-content p {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .header-right {
    width: 100%;
    justify-content: flex-start;
  }

  .document-header {
    flex-direction: column;
  }

  .document-meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .chunks-toolbar {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }

  .retrieval-controls {
    flex-direction: column;
    gap: 10px;
    align-items: stretch;
  }
}
</style>
