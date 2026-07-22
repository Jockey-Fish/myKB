export interface Document {
  id: number;
  filename: string;
  original_name: string;
  file_type: string;
  filesize: number;
  filesize_formatted: string;
  status: "uploading" | "processing" | "processed" | "error";
  created_at: string;
  chunk_count?: number;
}

export interface DocumentListResponse {
  list: Document[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface DocumentDetailResponse {
  id: number;
  filename: string;
  original_name: string;
  file_type: string;
  filesize: number;
  filesize_formatted: string;
  status: string;
  created_at: string;
  chunk_count?: number;
}

export interface DocumentContentResponse {
  id: number;
  filename: string;
  content: string;
}

export interface DocumentChunk {
  id: string;
  text: string;
  startPosition: string;
  endPosition: string;
}

export interface DocumentChunksResponse {
  id: number;
  filename: string;
  chunks: DocumentChunk[];
  totalChunks: number;
}

export interface UploadResponse {
  id: number;
  filename: string;
  status: string;
  message: string;
}

export interface DeleteResponse {
  success: boolean;
  message: string;
}
