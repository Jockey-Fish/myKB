import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { askQuestion } from "../api/chat";
import type {
  ChatMessage,
  ChatHistory,
  AskQuestionResponse,
  AskQuestionRequest,
} from "../types/chat";

export const useChatStore = defineStore("chat", () => {
  const messages = ref<ChatMessage[]>([]);
  const loading = ref<boolean>(false);
  const selectedDocumentId = ref<number | null>(null);
  const histories = ref<ChatHistory[]>([]);

  const currentHistory = computed(() => {
    return (
      histories.value.find((h) => h.documentId === selectedDocumentId.value) ||
      null
    );
  });

  async function sendMessage(question: string) {
    if (!question.trim() || loading.value) return;

    messages.value.push({
      id: Date.now(),
      type: "user",
      content: question.trim(),
      timestamp: new Date(),
    });

    loading.value = true;

    try {
      const request: AskQuestionRequest = {
        question,
        topK: 5,
        maxTokens: 2048,
        temperature: 0.7,
        ...(selectedDocumentId.value && {
          document_id: selectedDocumentId.value,
        }),
      };
      const result = await askQuestion(request);

      if (result.success && result.data) {
        const response = result.data;

        messages.value.push({
          id: Date.now() + 1,
          type: "bot",
          content: response.answer,
          sources: response.sources,
          timestamp: new Date(),
        });

        if (
          !histories.value.find(
            (h) => h.documentId === selectedDocumentId.value,
          )
        ) {
          histories.value.push({
            documentId: selectedDocumentId.value,
            messages: [],
          });
        }

        const history = histories.value.find(
          (h) => h.documentId === selectedDocumentId.value,
        );
        if (history) {
          history.messages.push({
            question,
            answer: response.answer,
            timestamp: new Date(),
          });
        }
      } else {
        messages.value.push({
          id: Date.now() + 1,
          type: "bot",
          content: result.message || "服务暂时不可用，请稍后重试",
          timestamp: new Date(),
          error: true,
        });
      }
    } catch (error) {
      messages.value.push({
        id: Date.now() + 1,
        type: "bot",
        content:
          (error as { response?: { data?: { error?: string } } }).response?.data
            ?.error || "服务暂时不可用，请稍后重试",
        timestamp: new Date(),
        error: true,
      });
    } finally {
      loading.value = false;
    }
  }

  function setSelectedDocument(id: number | null) {
    selectedDocumentId.value = id;
    messages.value = [];
  }

  function clearMessages() {
    messages.value = [];
  }

  return {
    messages,
    loading,
    selectedDocumentId,
    histories,
    currentHistory,
    sendMessage,
    setSelectedDocument,
    clearMessages,
  };
});
