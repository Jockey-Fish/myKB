<template>
  <div class="layout">
    <header class="layout-header">
      <div class="header-content">
        <div class="logo" @click="goHome">
          <el-icon size="32" color="#667eea">
            <Cpu />
          </el-icon>
          <span class="logo-text">AI知识库</span>
        </div>

        <nav class="header-nav" v-if="isLoggedIn">
          <el-menu mode="horizontal" class="nav-menu">
            <el-menu-item
              index="1"
              :class="{ active: currentRoute === '/documents' }"
              @click="navigateTo('/documents')"
            >
              <el-icon size="18">
                <Files />
              </el-icon>
              文档列表
            </el-menu-item>
            <el-menu-item
              index="2"
              :class="{ active: currentRoute === '/upload' }"
              @click="navigateTo('/upload')"
            >
              <el-icon size="18">
                <Upload />
              </el-icon>
              上传文档
            </el-menu-item>
            <el-menu-item
              index="3"
              :class="{ active: currentRoute === '/chat' }"
              @click="navigateTo('/chat')"
            >
              <el-icon size="18">
                <ChatRound />
              </el-icon>
              AI问答
            </el-menu-item>
          </el-menu>
        </nav>

        <div class="header-right" v-if="isLoggedIn">
          <el-dropdown>
            <span class="user-info">
              <el-icon size="20" class="user-icon">
                <User />
              </el-icon>
              <span>{{ authStore.user?.name || "用户" }}</span>
              <el-icon size="16" class="dropdown-icon">
                <CaretBottom />
              </el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item>
                  <el-icon size="16">
                    <User />
                  </el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item divided @click="handleLogout">
                  <el-icon size="16">
                    <TurnOff />
                  </el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </div>
    </header>

    <main class="layout-main">
      <slot name="header" />
      <slot name="content" />
    </main>

    <footer class="layout-footer">
      <p>AI知识库 © 2024 - 智能文档问答系统</p>
    </footer>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ElMessage } from "element-plus";
import {
  Cpu,
  Files,
  Upload,
  ChatRound,
  User,
  CaretBottom,
  TurnOff,
} from "@element-plus/icons-vue";

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const isLoggedIn = computed(() => authStore.isLoggedIn);
const currentRoute = computed(() => route.path);

function goHome() {
  if (isLoggedIn.value) {
    router.push("/documents");
  } else {
    router.push("/login");
  }
}

function navigateTo(path) {
  router.push(path);
}

function handleLogout() {
  authStore.logout();
  router.push("/login");
  ElMessage.success("退出成功");
}
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.layout-header {
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
}

.logo-text {
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.header-nav {
  flex: 1;
  margin-left: 40px;
}

.nav-menu :deep(.el-menu-item) {
  margin: 0 10px;
}

.nav-menu :deep(.el-menu-item.active) {
  color: #667eea;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 20px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f5f7fa;
}

.user-icon {
  color: #667eea;
}

.dropdown-icon {
  color: #999;
}

.layout-main {
  flex: 1;
  padding: 30px 20px;
  max-width: 1400px;
  width: 100%;
  margin: 0 auto;
}

.layout-footer {
  background: #f8f9fa;
  padding: 20px;
  text-align: center;
  color: #999;
  font-size: 13px;
  border-top: 1px solid #eee;
}

@media (max-width: 768px) {
  .header-content {
    padding: 0 15px;
  }

  .logo-text {
    display: none;
  }

  .header-nav {
    margin-left: 15px;
  }

  .nav-menu :deep(.el-menu-item) {
    margin: 0 5px;
    padding: 0 10px;
  }

  .nav-menu :deep(.el-menu-item span) {
    display: none;
  }

  .layout-main {
    padding: 20px 15px;
  }
}
</style>
