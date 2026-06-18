import axios from "axios";

const BASE_URL = "http://localhost:3001/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    return response.data;
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

export function handleApiError(error) {
  if (error.response) {
    const { status, data } = error.response;

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
  } else if (error.request) {
    return {
      success: false,
      message: "网络连接失败，请检查网络状态",
      errorCode: "NETWORK_ERROR",
      status: 0,
    };
  } else {
    return {
      success: false,
      message: error.message || "请求失败",
      errorCode: "REQUEST_ERROR",
      status: 0,
    };
  }
}

export { BASE_URL };
export default api;
