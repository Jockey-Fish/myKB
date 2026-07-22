import api, { handleApiError } from "./index";
import type { ApiResult } from "../types";
import type {
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  User,
  VerifyTokenResponse,
} from "../types/auth";

/**
 * 用户登录
 * @param data - 登录表单数据
 * @param data.username - 用户名
 * @param data.password - 密码
 * @returns Promise<ApiResult<LoginResponse>> - 登录结果，包含token和用户信息
 */
export async function login(
  data: LoginRequest,
): Promise<ApiResult<LoginResponse>> {
  try {
    const response = await api.post<LoginResponse>("/auth/login", data);
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
 * @param data - 注册表单数据
 * @param data.username - 用户名
 * @param data.password - 密码
 * @param data.email - 邮箱
 * @returns Promise<ApiResult<User>> - 注册成功后的用户信息
 */
export async function register(
  data: RegisterRequest,
): Promise<ApiResult<User>> {
  try {
    const response = await api.post<User>("/auth/register", data);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 获取当前登录用户信息
 * @returns Promise<ApiResult<User>> - 当前用户信息
 */
export async function getCurrentUser(): Promise<ApiResult<User>> {
  try {
    const response = await api.get<User>("/auth/me");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * 验证token有效性
 * @returns Promise<ApiResult<VerifyTokenResponse>> - token验证结果
 */
export async function verifyToken(): Promise<ApiResult<VerifyTokenResponse>> {
  try {
    const response = await api.get<VerifyTokenResponse>("/auth/verify");
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return handleApiError(error);
  }
}
