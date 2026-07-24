import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { useAuthStore } from "../stores/auth";

/**
 * 路由配置列表
 *
 * 路由权限说明：
 * - requiresAuth: true  → 需要登录才能访问
 * - requiresAuth: false → 公开访问（登录页、注册页）
 */
const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/Login.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("../views/Register.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/documents",
    name: "DocumentList",
    component: () => import("../views/DocumentList.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/upload",
    name: "DocumentUpload",
    component: () => import("../views/DocumentUpload.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/chat",
    name: "Chat",
    component: () => import("../views/Chat.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/documents/:id",
    name: "DocumentDetail",
    component: () => import("../views/DocumentDetail.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/",
    redirect: "/documents",
  },
];

/**
 * 创建路由实例
 * 使用HTML5 History模式（无需#号）
 */
const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * 全局前置守卫
 *
 * 权限控制逻辑：
 * 1. 需要认证的路由，用户未登录 → 重定向到登录页
 * 2. 登录页，用户已登录 → 重定向到文档列表页
 * 3. 其他情况 → 正常跳转
 */
router.beforeEach((to, from, next) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    next("/login");
  } else if (to.path === "/login" && authStore.isLoggedIn) {
    next("/documents");
  } else {
    next();
  }
});

export default router;
