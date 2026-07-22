import api, { handleApiError, BASE_URL } from "./index";
import type { ApiResult } from "../types";
import type { AskQuestionRequest, AskQuestionResponse } from "../types/chat";

/**
 * AI问答（非流式）
 * 适用于对响应速度要求不高、需要完整答案的场景
 *
 * @param data - 问答参数
 * @param data.question - 用户问题
 * @param data.topK - 检索相关文档数量（默认5）
 * @param data.maxTokens - 最大生成token数
 * @param data.temperature - 生成温度（0-1，越高越随机）
 * @param data.document_id - 指定文档ID（可选，不传则检索全库）
 * @returns Promise<ApiResult<AskQuestionResponse>> - 问答结果，包含答案、来源和元数据
 */
export async function askQuestion(
  data: AskQuestionRequest,
): Promise<ApiResult<AskQuestionResponse>> {
  try {
    const response = await api.post<AskQuestionResponse>("/chat/ask", data);
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
 * 适用于对响应速度要求高、需要实时显示打字效果的场景
 * 使用原生fetch实现SSE流式响应，不经过axios拦截器
 *
 * @param data - 问答参数
 * @param data.question - 用户问题
 * @param data.topK - 检索相关文档数量（默认5）
 * @param data.maxTokens - 最大生成token数
 * @param data.temperature - 生成温度（0-1，越高越随机）
 * @param data.document_id - 指定文档ID（可选，不传则检索全库）
 * @returns Promise<Response | ApiResult> - 成功返回Response对象，失败返回错误信息
 */
export async function askQuestionStream(
  data: AskQuestionRequest,
): Promise<Response | ApiResult> {
  try {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    return response;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "网络请求失败",
      errorCode: "NETWORK_ERROR",
    };
  }
}
