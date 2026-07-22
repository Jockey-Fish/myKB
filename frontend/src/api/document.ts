import api, { handleApiError } from "./index";
import type { ApiResult } from "../types";
import type {
  DocumentListResponse,
  DocumentDetailResponse,
  DocumentContentResponse,
  DocumentChunksResponse,
  UploadResponse,
  DeleteResponse,
} from "../types/document";
import type { AskQuestionResponse } from "../types/chat";

/**
 * 上传文档
 * 使用multipart/form-data格式上传文件
 *
 * @param file - 文件对象
 * @returns Promise<ApiResult<UploadResponse>> - 上传结果，包含文档ID和状态
 */
export async function uploadDocument(
  file: File,
): Promise<ApiResult<UploadResponse>> {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await api.post<UploadResponse>(
      "/documents/upload",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取文档列表（分页）
 *
 * @param params - 查询参数
 * @param params.page - 页码（默认1）
 * @param params.pageSize - 每页数量（默认10）
 * @returns Promise<ApiResult<DocumentListResponse>> - 文档列表及分页信息
 */
export async function getDocuments(params?: {
  page?: number;
  pageSize?: number;
}): Promise<ApiResult<DocumentListResponse>> {
  try {
    const response = await api.get<DocumentListResponse>("/documents", {
      params,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取文档详情
 *
 * @param id - 文档ID
 * @returns Promise<ApiResult<DocumentDetailResponse>> - 文档详细信息
 */
export async function getDocument(
  id: number,
): Promise<ApiResult<DocumentDetailResponse>> {
  try {
    const response = await api.get<DocumentDetailResponse>(`/documents/${id}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 删除文档
 * 删除文档同时会清理对应的向量数据
 *
 * @param id - 文档ID
 * @returns Promise<ApiResult<DeleteResponse>> - 删除结果
 */
export async function deleteDocument(
  id: number,
): Promise<ApiResult<DeleteResponse>> {
  try {
    const response = await api.delete<DeleteResponse>(`/documents/${id}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取文档原文内容
 *
 * @param id - 文档ID
 * @returns Promise<ApiResult<DocumentContentResponse>> - 文档内容
 */
export async function getDocumentContent(
  id: number,
): Promise<ApiResult<DocumentContentResponse>> {
  try {
    const response = await api.get<DocumentContentResponse>(
      `/extract/${id}/content`,
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取文档切片列表
 * 文档上传后会被切分为多个chunk存储到向量库
 *
 * @param id - 文档ID
 * @returns Promise<ApiResult<DocumentChunksResponse>> - 切片列表
 */
export async function getDocumentChunks(
  id: number,
): Promise<ApiResult<DocumentChunksResponse>> {
  try {
    const response = await api.get<DocumentChunksResponse>(
      `/extract/${id}/chunks`,
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 文档检索测试
 * 在指定文档中检索相关内容，用于验证检索效果
 *
 * @param params - 检索参数
 * @param params.document_id - 文档ID
 * @param params.query - 查询关键词
 * @param params.topK - 返回数量（默认5）
 * @returns Promise<ApiResult<AskQuestionResponse>> - 检索结果
 */
export async function testRetrieval(params: {
  document_id: number;
  query: string;
  topK?: number;
}): Promise<ApiResult<AskQuestionResponse>> {
  try {
    const response = await api.post<AskQuestionResponse>("/chat/ask", {
      question: params.query,
      top_k: params.topK || 5,
      document_id: params.document_id,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}
