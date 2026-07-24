import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { getDocuments, uploadDocument, deleteDocument } from "../api/document";
import type { Document, UploadQueueItem, DocumentListResponse } from "../types/document";

export const useDocumentsStore = defineStore("documents", () => {
  const documents = ref<Document[]>([]);
  const loading = ref<boolean>(false);
  const uploadQueue = ref<UploadQueueItem[]>([]);
  const selectedDocumentId = ref<number | null>(null);

  const selectedDocument = computed(() => {
    return documents.value.find((doc) => doc.id === selectedDocumentId.value) || null;
  });

  async function loadDocuments() {
    loading.value = true;
    try {
      const result = await getDocuments();

      let documentsData: Document[] = [];
      if (result.success) {
        if (Array.isArray(result.data)) {
          documentsData = result.data;
        } else if (result.data && Array.isArray((result.data as DocumentListResponse).list)) {
          documentsData = (result.data as DocumentListResponse).list;
        }
      }

      documents.value = documentsData;

      if (documentsData.length === 0) {
        console.warn("文档列表为空");
      }
    } catch (error) {
      documents.value = [];
      console.error("加载文档失败:", error);
    } finally {
      loading.value = false;
    }
  }

  async function addDocument(file: File) {
    const uploadItem: UploadQueueItem = {
      id: Date.now(),
      file,
      name: file.name,
      progress: 0,
      status: "uploading",
    };
    uploadQueue.value.push(uploadItem);

    try {
      uploadItem.progress = 30;
      const result = await uploadDocument(file);
      uploadItem.progress = 100;
      uploadItem.status = "success";
      await loadDocuments();

      setTimeout(() => {
        uploadQueue.value = uploadQueue.value.filter((item) => item.id !== uploadItem.id);
      }, 2000);

      return result;
    } catch (error) {
      uploadItem.status = "error";
      uploadItem.error = (error as { response?: { data?: { error?: string } } }).response?.data?.error || "上传失败";
      throw error;
    }
  }

  async function removeDocument(id: number) {
    try {
      await deleteDocument(id);
      documents.value = documents.value.filter((doc) => doc.id !== id);
      if (selectedDocumentId.value === id) {
        selectedDocumentId.value = null;
      }
    } catch (error) {
      throw error;
    }
  }

  function selectDocument(id: number) {
    selectedDocumentId.value = id;
  }

  return {
    documents,
    loading,
    uploadQueue,
    selectedDocumentId,
    selectedDocument,
    loadDocuments,
    addDocument,
    removeDocument,
    selectDocument,
  };
});
