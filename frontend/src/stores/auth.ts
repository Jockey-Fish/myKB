import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { login as apiLogin, getCurrentUser } from "../api/auth";
import type { User, LoginRequest } from "../types/auth";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string>(localStorage.getItem("token") || "");
  const user = ref<User | null>(JSON.parse(localStorage.getItem("user") || "null"));
  const rememberMe = ref<boolean>(false);

  const isLoggedIn = computed(() => !!token.value);

  async function login(username: string, password: string, remember: boolean) {
    token.value = "";
    user.value = null;

    try {
      const result = await apiLogin({ username, password });

      if (result.success && result.data) {
        token.value = result.data.token;
        user.value = result.data.user || { username } as unknown as User;
        rememberMe.value = remember;

        if (remember) {
          localStorage.setItem("token", token.value);
          localStorage.setItem("user", JSON.stringify(user.value));
        } else {
          sessionStorage.setItem("token", token.value);
          sessionStorage.setItem("user", JSON.stringify(user.value));
        }

        return { success: true, message: "登录成功" };
      } else {
        return { success: false, message: result.message || "登录失败" };
      }
    } catch (error) {
      return { success: false, message: (error as Error).message || "登录失败" };
    }
  }

  async function refreshUser() {
    try {
      const result = await getCurrentUser();
      if (result.success && result.data) {
        user.value = result.data;
        if (rememberMe.value) {
          localStorage.setItem("user", JSON.stringify(user.value));
        } else {
          sessionStorage.setItem("user", JSON.stringify(user.value));
        }
        return { success: true };
      }
    } catch (error) {
      console.error("刷新用户信息失败:", error);
    }
    return { success: false };
  }

  function logout() {
    token.value = "";
    user.value = null;
    rememberMe.value = false;
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
  }

  return {
    token,
    user,
    rememberMe,
    isLoggedIn,
    login,
    logout,
    refreshUser,
  };
});
