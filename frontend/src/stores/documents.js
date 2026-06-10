import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getDocuments, uploadDocument, deleteDocument } from '../api'

export const useDocumentsStore = defineStore('documents', () => {
  const documents = ref([])
  const loading = ref(false)
  const uploadQueue = ref([])
  const selectedDocumentId = ref(null)

  const selectedDocument = computed(() => {
    return documents.value.find(doc => doc.id === selectedDocumentId.value) || null
  })

  async function loadDocuments() {
    loading.value = true
    try {
      const data = await getDocuments()
      documents.value = data
    } catch (error) {
      console.error('加载文档失败:', error)
    } finally {
      loading.value = false
    }
  }

  async function addDocument(file) {
    const uploadItem = {
      id: Date.now(),
      file,
      name: file.name,
      progress: 0,
      status: 'uploading'
    }
    uploadQueue.value.push(uploadItem)

    try {
      uploadItem.progress = 30
      const result = await uploadDocument(file)
      uploadItem.progress = 100
      uploadItem.status = 'success'
      await loadDocuments()
      
      setTimeout(() => {
        uploadQueue.value = uploadQueue.value.filter(item => item.id !== uploadItem.id)
      }, 2000)
      
      return result
    } catch (error) {
      uploadItem.status = 'error'
      uploadItem.error = error.response?.data?.error || '上传失败'
      throw error
    }
  }

  async function removeDocument(id) {
    try {
      await deleteDocument(id)
      documents.value = documents.value.filter(doc => doc.id !== id)
      if (selectedDocumentId.value === id) {
        selectedDocumentId.value = null
      }
    } catch (error) {
      throw error
    }
  }

  function selectDocument(id) {
    selectedDocumentId.value = id
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
    selectDocument
  }
})