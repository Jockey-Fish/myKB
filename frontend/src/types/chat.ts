export interface AskQuestionRequest {
  question: string;
  topK?: number;
  top_k?: number;
  maxTokens?: number;
  temperature?: number;
  document_id?: number;
}

export interface ChatSource {
  id: string;
  text: string;
  similarity: number;
  documentId: string;
  filename: string;
  chunkIndex: number;
  metadata: {
    chunkIndex: number;
    startPosition: string;
    endPosition: string;
  };
}

export interface ChatMetadata {
  queryTime: number;
  retrieveTime: number;
  generateTime: number;
  totalTime: number;
  relevantDocsCount: number;
  model: string;
  provider: string;
}

export interface AskQuestionResponse {
  question: string;
  answer: string;
  sources: ChatSource[];
  metadata: ChatMetadata;
}

export interface StreamEvent {
  type: "sources" | "content" | "end";
  data: ChatSource[] | string | ChatMetadata;
}

export interface RetrievalTestRequest {
  document_id: number;
  query: string;
  topK?: number;
}

export interface ChatMessage {
  id: number;
  type: "user" | "bot";
  content: string;
  sources?: ChatSource[];
  timestamp: Date;
  error?: boolean;
}

export interface ChatHistory {
  documentId: number | null;
  messages: Array<{
    question: string;
    answer: string;
    timestamp: Date;
  }>;
}
