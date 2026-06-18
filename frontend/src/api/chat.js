import api, { handleApiError, BASE_URL } from "./index";

/**
 * AI问答（非流式）
 * @param {Object} data - 问答数据
 * @param {string} data.question - 问题
 * @param {number} [data.topK=5] - 检索数量
 * @returns {Promise}
 */
export async function askQuestion(data) {
  try {
    const response = await api.post("/chat/ask", data);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * AI问答（流式）
 * @param {Object} data - 问答数据
 * @param {string} data.question - 问题
 * @param {number} [data.topK=5] - 检索数量
 * @returns {Promise}
 */
export async function askQuestionStream(data) {
  try {
    const response = await fetch(`${BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}`,
      },
      body: JSON.stringify(data),
    });
    return response;
  } catch (error) {
    return {
      success: false,
      message: error.message || "网络请求失败",
      errorCode: "NETWORK_ERROR",
    };
  }
}