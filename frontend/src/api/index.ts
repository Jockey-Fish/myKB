import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import type { ApiResponse, ApiResult } from "../types";

/**
 * API基础地址
 * 所有接口请求都基于此地址进行拼接
 */
const BASE_URL = "http://localhost:3001/api";

/**
 * 创建axios实例，配置全局请求参数
 *
 * 配置说明：
 * - baseURL: /api，所有请求路径自动拼接此前缀
 * - timeout: 300000ms（5分钟），适配LLM生成的较长响应时间
 * - headers: 默认Content-Type为application/json
 */
const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 300000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * 请求拦截器
 *
 * 功能：自动为所有请求添加Authorization token
 * token获取优先级：localStorage > sessionStorage
 *
 * 执行时机：每个HTTP请求发送前执行
 *
 * @param config - axios请求配置对象
 * @returns 修改后的请求配置
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * 响应拦截器
 *
 * 功能：
 * 1. 自动提取响应数据：将AxiosResponse转换为ApiResponse（即response.data）
 *    注意：使用类型断言保持向后兼容，实际返回的是response.data
 * 2. 401未授权处理：清除本地存储的token和user信息，并跳转到登录页
 *
 * 执行时机：每个HTTP响应返回后执行
 *
 * @param response - axios响应对象，包含完整的响应信息
 * @returns 提取后的业务数据（ApiResponse类型）
 */
api.interceptors.response.use(
  (response: AxiosResponse<ApiResponse<unknown>>) => {
    return response.data as unknown as AxiosResponse;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

/**
 * 统一处理API错误
 *
 * 将axios错误转换为标准化的ApiResult格式，便于上层统一处理
 *
 * @template T - 返回数据的类型参数
 * @param error - 错误对象（axios错误或其他类型错误）
 * @returns ApiResult<T> - 标准化的错误结果对象
 *
 * 错误类型分类：
 * - HTTP错误（有response）：根据HTTP状态码返回对应错误信息
 * - 网络错误（有request但无response）：请求已发出但服务器无响应
 * - 请求错误（其他错误）：请求配置错误或其他异常
 *
 * HTTP状态码映射：
 * - 400: BAD_REQUEST - 请求参数错误
 * - 401: UNAUTHORIZED - 未授权，请重新登录
 * - 403: FORBIDDEN - 权限不足
 * - 404: NOT_FOUND - 资源未找到
 * - 409: CONFLICT - 资源冲突
 * - 429: TOO_MANY_REQUESTS - 请求过于频繁
 * - 500: INTERNAL_ERROR - 服务器内部错误
 * - 其他: HTTP_{status} - 请求失败(status)
 */
export function handleApiError<T>(error: unknown): ApiResult<T> {
  if (error && typeof error === "object" && "response" in error) {
    const responseError = error as {
      response: { status: number; data: { message?: string } };
    };
    const { status, data } = responseError.response;

    let message = "请求失败";
    let errorCode = "UNKNOWN_ERROR";

    switch (status) {
      case 400:
        message = data.message || "请求参数错误";
        errorCode = "BAD_REQUEST";
        break;
      case 401:
        message = data.message || "未授权，请重新登录";
        errorCode = "UNAUTHORIZED";
        break;
      case 403:
        message = data.message || "权限不足";
        errorCode = "FORBIDDEN";
        break;
      case 404:
        message = data.message || "资源未找到";
        errorCode = "NOT_FOUND";
        break;
      case 409:
        message = data.message || "资源冲突";
        errorCode = "CONFLICT";
        break;
      case 429:
        message = data.message || "请求过于频繁，请稍后重试";
        errorCode = "TOO_MANY_REQUESTS";
        break;
      case 500:
        message = data.message || "服务器内部错误";
        errorCode = "INTERNAL_ERROR";
        break;
      default:
        message = data.message || `请求失败 (${status})`;
        errorCode = `HTTP_${status}`;
    }

    return {
      success: false,
      message,
      errorCode,
      status,
    };
  } else if (error && typeof error === "object" && "request" in error) {
    return {
      success: false,
      message: "网络连接失败，请检查网络状态",
      errorCode: "NETWORK_ERROR",
      status: 0,
    };
  } else {
    const messageError = error as { message?: string };
    return {
      success: false,
      message: messageError.message || "请求失败",
      errorCode: "REQUEST_ERROR",
      status: 0,
    };
  }
}

export { BASE_URL };
export default api;
