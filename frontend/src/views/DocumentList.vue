<template>
  <div class="document-list-page">
    <Layout>
      <template #header>
        <div class="page-header">
          <h1>文档列表</h1>
          <p>管理您的知识库文档</p>
        </div>
      </template>

      <template #content>
        <div class="toolbar">
          <div class="search-box">
            <el-input
              v-model="searchText"
              placeholder="搜索文档名称..."
              prefix-icon="Search"
              @input="handleSearch"
            />
          </div>

          <div class="filter-section">
            <el-select
              v-model="filterType"
              placeholder="文件类型"
              class="filter-select"
            >
              <el-option label="全部" value="" />
              <el-option label="PDF" value="pdf" />
              <el-option label="TXT" value="txt" />
              <el-option label="Markdown" value="md" />
            </el-select>

            <el-select
              v-model="filterStatus"
              placeholder="状态"
              class="filter-select"
            >
              <el-option label="全部" value="" />
              <el-option label="已上传" value="uploaded" />
              <el-option label="已处理" value="processed" />
              <el-option label="处理失败" value="error" />
            </el-select>
          </div>

          <div class="action-buttons">
            <el-button type="primary" icon="Plus" @click="goToUpload">
              上传文档
            </el-button>
          </div>
        </div>

        <div class="stats-row">
          <div class="stat-card">
            <div class="stat-icon blue">
              <el-icon size="24">
                <Files />
              </el-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ totalCount }}</span>
              <span class="stat-label">全部文档</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon green">
              <el-icon size="24">
                <CircleCheck />
              </el-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ processedCount }}</span>
              <span class="stat-label">已处理</span>
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-icon orange">
              <el-icon size="24">
                <Clock />
              </el-icon>
            </div>
            <div class="stat-info">
              <span class="stat-value">{{ uploadedCount }}</span>
              <span class="stat-label">待处理</span>
            </div>
          </div>
        </div>

        <el-card class="document-table-card">
          <div class="table-header">
            <span class="table-title">文档列表</span>
            <div class="sort-options">
              <el-select
                v-model="sortField"
                placeholder="排序"
                class="sort-select"
              >
                <el-option label="上传时间" value="created_at" />
                <el-option label="文档名称" value="name" />
                <el-option label="文件类型" value="type" />
              </el-select>
              <el-button
                icon="ArrowUp"
                :class="{ active: sortOrder === 'asc' }"
                @click="sortOrder = 'asc'"
              />
              <el-button
                icon="ArrowDown"
                :class="{ active: sortOrder === 'desc' }"
                @click="sortOrder = 'desc'"
              />
            </div>
          </div>

          <el-table
            :data="filteredDocuments"
            :loading="documentsStore.loading"
            border
            stripe
            class="document-table"
            @row-click="handleRowClick"
          >
            <el-table-column type="index" label="#" width="60" />
            <el-table-column
              prop="original_name"
              label="文档名称"
              min-width="200"
            >
              <template #default="scope">
                <div class="document-name-cell">
                  <el-icon
                    :size="20"
                    :color="getFileIconColor(scope.row.file_type)"
                  >
                    <component :is="getFileIcon(scope.row.file_type)" />
                  </el-icon>
                  <span>{{ scope.row.original_name }}</span>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="file_type" label="文件类型" width="100">
              <template #default="scope">
                <el-tag :type="getFileTypeTagType(scope.row.file_type)">
                  {{ getFileTypeLabel(scope.row.file_type) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="chunk_count" label="切片数" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="getStatusTagType(scope.row.status)">
                  {{ getStatusLabel(scope.row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="上传时间" width="180">
              <template #default="scope">
                {{ formatTime(scope.row.created_at) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="scope">
                <el-button
                  size="small"
                  icon="Eye"
                  @click.stop="viewDocument(scope.row)"
                >
                  查看
                </el-button>
                <el-button
                  size="small"
                  type="primary"
                  icon="MessageSquare"
                  @click.stop="chatWithDocument(scope.row)"
                >
                  问答
                </el-button>
                <el-button
                  size="small"
                  type="danger"
                  icon="Delete"
                  @click.stop="deleteDocument(scope.row)"
                >
                  删除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="pagination-container">
            <el-pagination
              :total="filteredDocuments.length"
              :page-size="10"
              layout="prev, pager, next, jumper, ->, total"
              class="pagination"
            />
          </div>
        </el-card>

        <el-dialog title="文档详情" v-model="showDetailModal" width="600px">
          <div v-if="selectedDocument" class="document-detail">
            <div class="detail-header">
              <el-icon
                :size="48"
                :color="getFileIconColor(selectedDocument.file_type)"
              >
                <component :is="getFileIcon(selectedDocument.file_type)" />
              </el-icon>
              <div class="detail-info">
                <h3>{{ selectedDocument.original_name }}</h3>
                <div class="detail-meta">
                  <span
                    >类型:
                    {{ getFileTypeLabel(selectedDocument.file_type) }}</span
                  >
                  <span
                    >状态: {{ getStatusLabel(selectedDocument.status) }}</span
                  >
                </div>
              </div>
            </div>
            <div class="detail-content">
              <div class="detail-row">
                <span class="detail-label">文件路径:</span>
                <span class="detail-value">{{
                  selectedDocument.file_path
                }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">切片数量:</span>
                <span class="detail-value"
                  >{{ selectedDocument.chunk_count }} 块</span
                >
              </div>
              <div class="detail-row">
                <span class="detail-label">上传时间:</span>
                <span class="detail-value">{{
                  formatTime(selectedDocument.created_at)
                }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">更新时间:</span>
                <span class="detail-value">{{
                  formatTime(selectedDocument.updated_at)
                }}</span>
              </div>
            </div>
          </div>
        </el-dialog>
      </template>
    </Layout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDocumentsStore } from "../stores/documents";
import { ElMessage, ElMessageBox } from "element-plus";
import type { Component } from "vue";
import Layout from "../components/Layout.vue";
import {
  Files,
  CircleCheck,
  Clock,
  Document,
  User,
} from "@element-plus/icons-vue";
import type { Document as DocumentType } from "../types/document";

type SortField = "created_at" | "name" | "type";
type SortOrder = "asc" | "desc";
type FileType = "pdf" | "md" | "txt";
type DocumentStatus = "processing" | "processed" | "uploaded" | "error";
type TagType = "success" | "warning" | "danger" | "info";

const router = useRouter();
const documentsStore = useDocumentsStore();

const searchText = ref<string>("");
const filterType = ref<string>("");
const filterStatus = ref<string>("");
const sortField = ref<SortField>("created_at");
const sortOrder = ref<SortOrder>("desc");
const showDetailModal = ref<boolean>(false);
const selectedDocument = ref<DocumentType | null>(null);

const totalCount = computed(() => documentsStore.documents.length);
const processedCount = computed(
  () => documentsStore.documents.filter((d) => d.status === "processed").length,
);
const uploadedCount = computed(
  () => documentsStore.documents.filter((d) => d.status === "uploaded").length,
);

const filteredDocuments = computed<DocumentType[]>(() => {
  let result = [...documentsStore.documents];

  if (searchText.value) {
    const search = searchText.value.toLowerCase();
    result = result.filter((d) =>
      d.original_name.toLowerCase().includes(search),
    );
  }

  if (filterType.value) {
    result = result.filter((d) => d.file_type === filterType.value);
  }

  if (filterStatus.value) {
    result = result.filter((d) => d.status === filterStatus.value);
  }

  result.sort((a: DocumentType, b: DocumentType): number => {
    let aVal: string | number = "";
    let bVal: string | number = "";

    if (sortField.value === "created_at") {
      aVal = a.created_at || "";
      bVal = b.created_at || "";
    } else if (sortField.value === "name") {
      aVal = a.original_name;
      bVal = b.original_name;
    } else if (sortField.value === "type") {
      aVal = a.file_type;
      bVal = b.file_type;
    }

    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();

    return sortOrder.value === "asc"
      ? aVal > bVal
        ? 1
        : -1
      : aVal < bVal
        ? 1
        : -1;
  });

  return result;
});

function handleSearch(): void {}

function goToUpload(): void {
  router.push("/upload");
}

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

function getFileTypeTagType(type?: string): TagType {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "danger";
    case "md":
      return "success";
    default:
      return "info";
  }
}

function getFileTypeLabel(type?: string): string {
  switch (type?.toLowerCase()) {
    case "pdf":
      return "PDF";
    case "md":
      return "Markdown";
    default:
      return "TXT";
  }
}

function getStatusTagType(status?: string): TagType {
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
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleString("zh-CN");
}

function handleRowClick(row: DocumentType): void {
  selectedDocument.value = row;
  showDetailModal.value = true;
}

function viewDocument(row: DocumentType): void {
  router.push(`/documents/${row.id}`);
}

function chatWithDocument(row: DocumentType): void {
  documentsStore.selectDocument(row.id);
  router.push("/chat");
}

async function deleteDocument(row: DocumentType): Promise<void> {
  await ElMessageBox.confirm(
    `确定要删除文档 "${row.original_name}" 吗？`,
    "确认删除",
    { type: "warning" },
  );

  try {
    await documentsStore.removeDocument(row.id);
    ElMessage.success("删除成功");
  } catch {
    ElMessage.error("删除失败");
  }
}

onMounted(() => {
  documentsStore.loadDocuments();
});
</script>

<style scoped>
.document-list-page {
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

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.search-box {
  flex: 1;
  min-width: 200px;
  max-width: 300px;
}

.filter-section {
  display: flex;
  gap: 10px;
}

.filter-select {
  width: 120px;
}

.action-buttons {
  display: flex;
  gap: 10px;
}

.stats-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 15px;
  background: white;
  padding: 20px 25px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  min-width: 180px;
}

.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stat-icon.blue {
  background: #e8f4fd;
  color: #3498db;
}

.stat-icon.green {
  background: #e8f5e9;
  color: #2ecc71;
}

.stat-icon.orange {
  background: #fff3e0;
  color: #e65100;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #333;
}

.stat-label {
  font-size: 13px;
  color: #999;
}

.document-table-card {
  background: white;
  border-radius: 12px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.table-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.sort-options {
  display: flex;
  align-items: center;
  gap: 5px;
}

.sort-select {
  width: 120px;
}

.document-table {
  width: 100%;
}

.document-name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  padding: 15px 0;
}

.document-detail {
  padding: 10px;
}

.detail-header {
  display: flex;
  gap: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
  margin-bottom: 20px;
}

.detail-info h3 {
  margin-bottom: 10px;
  color: #333;
}

.detail-meta {
  display: flex;
  gap: 15px;
  font-size: 13px;
  color: #666;
}

.detail-content {
  background: #f9fafb;
  border-radius: 8px;
  padding: 15px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: #999;
  font-size: 14px;
}

.detail-value {
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-box {
    max-width: 100%;
  }

  .filter-section {
    justify-content: center;
  }

  .action-buttons {
    justify-content: center;
  }

  .stats-row {
    justify-content: center;
  }

  .stat-card {
    min-width: 100%;
  }
}
</style>
