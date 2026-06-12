<template>
  <div class="upload-page">
    <Layout>
      <template #header>
        <div class="page-header">
          <h1>文档上传</h1>
          <p>上传文档到知识库，支持PDF、TXT、Markdown格式</p>
        </div>
      </template>

      <template #content>
        <div class="upload-container">
          <div
            class="upload-area"
            :class="{ 'drag-over': isDragOver, disabled: uploadDisabled }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop.prevent="handleDrop"
            @click="triggerFileInput"
          >
            <input
              ref="fileInput"
              type="file"
              accept=".pdf,.txt,.md"
              multiple
              class="file-input"
              @change="handleFileSelect"
              :disabled="uploadDisabled"
            />

            <div class="upload-icon-wrapper">
              <el-icon size="64" color="#667eea">
                <Upload />
              </el-icon>
            </div>
            <h3>{{ uploadDisabled ? "上传中..." : "拖拽文件到此处" }}</h3>
            <p>或点击选择文件</p>
            <div class="upload-hints">
              <span class="hint-tag">PDF</span>
              <span class="hint-tag">TXT</span>
              <span class="hint-tag">Markdown</span>
            </div>
            <p class="size-limit">单个文件不超过 50MB</p>
          </div>

          <div v-if="uploadQueue.length > 0" class="upload-queue">
            <h4 class="queue-title">上传队列</h4>
            <div v-for="item in uploadQueue" :key="item.id" class="queue-item">
              <div class="queue-item-header">
                <el-icon :size="20" :color="getFileIconColor(item)">
                  <component :is="getFileIcon(item)" />
                </el-icon>
                <span class="queue-item-name">{{ item.name }}</span>
                <el-button
                  size="small"
                  icon="Close"
                  v-if="item.status === 'uploading'"
                  @click="cancelUpload(item.id)"
                />
              </div>
              <div class="queue-item-progress">
                <el-progress
                  :percentage="item.progress"
                  :status="getProgressStatus(item.status)"
                  :show-text="false"
                  stroke-width="6"
                />
                <span class="progress-text">
                  {{
                    item.status === "uploading"
                      ? `${item.progress}%`
                      : item.status === "success"
                        ? "上传成功"
                        : item.status === "error"
                          ? item.error || "上传失败"
                          : ""
                  }}
                </span>
              </div>
            </div>
          </div>

          <div class="upload-tips">
            <h4>上传说明</h4>
            <ul>
              <li>支持 PDF、TXT、Markdown 格式文件</li>
              <li>单个文件大小不超过 50MB</li>
              <li>文档会自动切片并向量化存储</li>
              <li>处理完成后可用于智能问答</li>
            </ul>
          </div>
        </div>

        <div class="recent-documents">
          <h3>最近上传</h3>
          <div v-if="recentDocuments.length === 0" class="empty-state">
            <el-icon size="48" color="#ccc">
              <Files />
            </el-icon>
            <p>暂无上传记录</p>
          </div>
          <el-list v-else border class="document-list">
            <el-list-item v-for="doc in recentDocuments" :key="doc.id">
              <template #default>
                <div class="document-info">
                  <el-icon :size="24" :color="getFileIconColor(doc.file_type)">
                    <component :is="getFileIcon(doc.file_type)" />
                  </el-icon>
                  <div class="document-meta">
                    <span class="document-name">{{ doc.filename }}</span>
                    <span class="document-time">{{
                      formatTime(doc.created_at)
                    }}</span>
                  </div>
                </div>
                <el-tag :type="getStatusTagType(doc.status)">
                  {{ getStatusLabel(doc.status) }}
                </el-tag>
              </template>
            </el-list-item>
          </el-list>
        </div>
      </template>
    </Layout>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useDocumentsStore } from "../stores/documents";
import { ElMessage } from "element-plus";
import Layout from "../components/Layout.vue";
import { Upload, Files, Document } from "@element-plus/icons-vue";

const documentsStore = useDocumentsStore();

const fileInput = ref(null);
const isDragOver = ref(false);
const uploadQueue = ref([]);

const uploadDisabled = computed(() => {
  return uploadQueue.value.some((item) => item.status === "uploading");
});

const recentDocuments = computed(() => {
  return documentsStore.documents.slice(0, 5);
});

function triggerFileInput() {
  if (!uploadDisabled.value) {
    fileInput.value?.click();
  }
}

function handleFileSelect(event) {
  const files = event.target.files;
  if (files) {
    Array.from(files).forEach((file) => {
      addToQueue(file);
    });
  }
  event.target.value = "";
}

function handleDrop(event) {
  isDragOver.value = false;
  const files = event.dataTransfer.files;
  if (files) {
    Array.from(files).forEach((file) => {
      addToQueue(file);
    });
  }
}

async function addToQueue(file) {
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
  const validExtensions = [".pdf", ".txt", ".md"];

  if (!validExtensions.includes(ext)) {
    ElMessage.error(`不支持的文件格式: ${file.name}`);
    return;
  }

  if (file.size > 50 * 1024 * 1024) {
    ElMessage.error(`文件大小超过限制: ${file.name}`);
    return;
  }

  const item = {
    id: Date.now() + Math.random(),
    file,
    name: file.name,
    progress: 0,
    status: "uploading",
  };

  uploadQueue.value.push(item);

  try {
    item.progress = 30;
    await documentsStore.addDocument(file);
    item.progress = 100;
    item.status = "success";

    setTimeout(() => {
      uploadQueue.value = uploadQueue.value.filter((i) => i.id !== item.id);
    }, 3000);

    ElMessage.success(`文件上传成功: ${file.name}`);
  } catch (error) {
    item.status = "error";
    item.error = error.response?.data?.error || "上传失败";
    ElMessage.error(`文件上传失败: ${file.name}`);
  }
}

function cancelUpload(id) {
  const item = uploadQueue.value.find((i) => i.id === id);
  if (item) {
    item.status = "cancelled";
    uploadQueue.value = uploadQueue.value.filter((i) => i.id !== id);
  }
}

function getFileIcon(item) {
  if (typeof item === "string") {
    // 处理文档类型字符串（来自文档列表）
    switch (item.toLowerCase()) {
      case "pdf":
        return Document;
      default:
        return Files;
    }
  }
  if (item.file) {
    const ext = item.file.name
      .toLowerCase()
      .substring(item.file.name.lastIndexOf("."));
    switch (ext) {
      case ".pdf":
        return Document;
      default:
        return Files;
    }
  }
  return Files;
}

function getFileIconColor(item) {
  if (typeof item === "string") {
    // 处理文档类型字符串（来自文档列表）
    switch (item.toLowerCase()) {
      case "pdf":
        return "#e74c3c";
      case "md":
        return "#2ecc71";
      default:
        return "#3498db";
    }
  }
  if (item.file) {
    const ext = item.file.name
      .toLowerCase()
      .substring(item.file.name.lastIndexOf("."));
    switch (ext) {
      case ".pdf":
        return "#e74c3c";
      case ".md":
        return "#2ecc71";
      default:
        return "#3498db";
    }
  }
  return "#666";
}

function getProgressStatus(status) {
  switch (status) {
    case "success":
      return "success";
    case "error":
      return "exception";
    default:
      return "loading";
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

function formatTime(timestamp) {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

onMounted(() => {
  documentsStore.loadDocuments();
});
</script>

<style scoped>
.upload-page {
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

.upload-container {
  max-width: 600px;
  margin: 0 auto;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 16px;
  padding: 40px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  margin-bottom: 20px;
}

.upload-area:hover:not(.disabled) {
  border-color: #667eea;
  background: #f8f9ff;
}

.upload-area.drag-over {
  border-color: #667eea;
  background: #f0f4ff;
  transform: scale(1.02);
}

.upload-area.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.file-input {
  display: none;
}

.upload-icon-wrapper {
  margin-bottom: 20px;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.upload-area h3 {
  font-size: 18px;
  color: #333;
  margin-bottom: 8px;
}

.upload-area p {
  color: #999;
  font-size: 14px;
  margin-bottom: 15px;
}

.upload-hints {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-bottom: 10px;
}

.hint-tag {
  padding: 4px 12px;
  background: #f0f0f0;
  border-radius: 20px;
  font-size: 12px;
  color: #666;
}

.size-limit {
  font-size: 12px;
  color: #ccc;
}

.upload-queue {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
}

.queue-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 15px;
}

.queue-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
}

.queue-item:last-child {
  margin-bottom: 0;
}

.queue-item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.queue-item-name {
  flex: 1;
  font-size: 14px;
  color: #333;
}

.queue-item-progress {
  display: flex;
  align-items: center;
  gap: 15px;
}

.progress-text {
  font-size: 13px;
  color: #666;
  min-width: 100px;
}

.upload-tips {
  background: white;
  border-radius: 12px;
  padding: 20px;
}

.upload-tips h4 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 15px;
}

.upload-tips ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.upload-tips li {
  padding: 8px 0;
  padding-left: 20px;
  position: relative;
  color: #666;
  font-size: 14px;
}

.upload-tips li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 12px;
  width: 6px;
  height: 6px;
  background: #667eea;
  border-radius: 50%;
}

.recent-documents {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-top: 30px;
}

.recent-documents h3 {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  margin-bottom: 15px;
}

.empty-state {
  text-align: center;
  padding: 30px;
  color: #999;
}

.document-list {
  max-height: 300px;
  overflow-y: auto;
}

.document-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.document-meta {
  display: flex;
  flex-direction: column;
}

.document-name {
  font-size: 14px;
  color: #333;
}

.document-time {
  font-size: 12px;
  color: #999;
}

@media (max-width: 768px) {
  .upload-area {
    padding: 30px 20px;
  }
}
</style>
