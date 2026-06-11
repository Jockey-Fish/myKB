import axios from "axios";

const BASE_URL = "http://localhost:3001/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 请求拦截器 - 添加token
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

// 响应拦截器 - 处理token过期
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      // 401未授权 - token过期或无效
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

// ==================== 认证相关API ====================

/**
 * 用户登录
 * @param {Object} data - 登录数据
 * @param {string} data.username - 用户名
 * @param {string} data.password - 密码
 * @returns {Promise}
 */
export async function login(data) {
  try {
    const response = await api.post("/auth/login", data);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 用户注册
 * @param {Object} data - 注册数据
 * @param {string} data.username - 用户名
 * @param {string} data.password - 密码
 * @param {string} data.email - 邮箱
 * @returns {Promise}
 */
export async function register(data) {
  try {
    const response = await api.post("/auth/register", data);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取当前用户信息
 * @returns {Promise}
 */
export async function getCurrentUser() {
  try {
    const response = await api.get("/auth/me");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 验证token
 * @returns {Promise}
 */
export async function verifyToken() {
  try {
    const response = await api.get("/auth/verify");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

// ==================== 文档相关API ====================

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

// ==================== AI问答API ====================

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

// ==================== 错误处理 ====================

/**
 * 统一API错误处理
 * @param {Error} error - 错误对象
 * @returns {Object} - 错误响应
 */
function handleApiError(error) {
  if (error.response) {
    // 请求已发出，服务器返回状态码
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
    // 请求已发出，但没有收到响应
    return {
      success: false,
      message: "网络连接失败，请检查网络状态",
      errorCode: "NETWORK_ERROR",
      status: 0,
    };
  } else {
    // 请求配置过程中发生错误
    return {
      success: false,
      message: error.message || "请求失败",
      errorCode: "REQUEST_ERROR",
      status: 0,
    };
  }
}

export default api;
