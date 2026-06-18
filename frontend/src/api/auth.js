import api, { handleApiError } from "./index";

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