import api, { handleApiError } from "./index";

/**
 * 上传文档
 * @param {File} file - 文件对象
 * @returns {Promise}
 */
export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await api.post("/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
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
 * 获取文档列表
 * @param {Object} params - 查询参数
 * @param {number} [params.page] - 页码
 * @param {number} [params.pageSize] - 每页数量
 * @returns {Promise}
 */
export async function getDocuments(params = {}) {
  try {
    const response = await api.get("/documents", { params });
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
 * @param {number} id - 文档ID
 * @returns {Promise}
 */
export async function getDocument(id) {
  try {
    const response = await api.get(`/documents/${id}`);
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
 * @param {number} id - 文档ID
 * @returns {Promise}
 */
export async function deleteDocument(id) {
  try {
    const response = await api.delete(`/documents/${id}`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取文档内容（原文预览）
 * @param {number} id - 文档ID
 * @returns {Promise}
 */
export async function getDocumentContent(id) {
  try {
    const response = await api.get(`/extract/${id}/content`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取文档切片
 * @param {number} id - 文档ID
 * @returns {Promise}
 */
export async function getDocumentChunks(id) {
  try {
    const response = await api.get(`/extract/${id}/chunks`);
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
 * @param {Object} params - 检索参数
 * @param {number} params.document_id - 文档ID
 * @param {string} params.query - 查询文本
 * @param {number} [params.topK=5] - 返回数量
 * @returns {Promise}
 */
export async function testRetrieval(params) {
  try {
    const response = await api.post("/chat/ask", {
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