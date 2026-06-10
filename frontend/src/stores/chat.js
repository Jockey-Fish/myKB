import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { askQuestion } from '../api'

export const useChatStore = defineStore('chat', () => {
  const messages = ref([])
  const loading = ref(false)
  const selectedDocumentId = ref(null)
  const histories = ref([])

  const currentHistory = computed(() => {
    return histories.value.find(h => h.documentId === selectedDocumentId.value) || null
  })

  async function sendMessage(question) {
    if (!question.trim() || loading.value) return

    messages.value.push({
      id: Date.now(),
      type: 'user',
      content: question.trim(),
      timestamp: new Date()
    })

    loading.value = true

    try {
      const result = await askQuestion(question)
      
      messages.value.push({
        id: Date.now() + 1,
        type: 'bot',
        content: result.answer,
        sources: result.sources,
        timestamp: new Date()
      })

      if (!histories.value.find(h => h.documentId === selectedDocumentId.value)) {
        histories.value.push({
          documentId: selectedDocumentId.value,
          messages: []
        })
      }
      
      const history = histories.value.find(h => h.documentId === selectedDocumentId.value)
      if (history) {
        history.messages.push({
          question,
          answer: result.answer,
          timestamp: new Date()
        })
      }
    } catch (error) {
      messages.value.push({
        id: Date.now() + 1,
        type: 'bot',
        content: error.response?.data?.error || '服务暂时不可用，请稍后重试',
        timestamp: new Date(),
        error: true
      })
    } finally {
      loading.value = false
    }
  }

  function setSelectedDocument(id) {
    selectedDocumentId.value = id
    messages.value = []
  }

  function clearMessages() {
    messages.value = []
  }

  return {
    messages,
    loading,
    selectedDocumentId,
    histories,
    currentHistory,
    sendMessage,
    setSelectedDocument,
    clearMessages
  }
})