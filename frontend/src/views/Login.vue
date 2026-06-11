<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <div class="login-header">
          <div class="logo">
            <el-icon size="48" color="#667eea">
              <Cpu />
            </el-icon>
          </div>
          <h1>AI知识库</h1>
          <p>智能文档问答系统</p>
        </div>

        <el-form
          ref="loginForm"
          :model="form"
          :rules="rules"
          class="login-form"
        >
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              type="text"
              placeholder="请输入用户名"
              prefix-icon="User"
              :disabled="loading"
              @keydown.enter="handleLogin"
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码"
              prefix-icon="Lock"
              suffix-icon="Eye"
              :disabled="loading"
              @click:clear="form.password = ''"
              @keydown.enter="handleLogin"
            />
          </el-form-item>

          <div class="login-options">
            <el-checkbox v-model="form.rememberMe">记住我</el-checkbox>
            <a
              href="#"
              class="forgot-password"
              @click.prevent="showForgotPassword"
              >忘记密码？</a
            >
          </div>

          <el-button
            type="primary"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            {{ loading ? "登录中..." : "登 录" }}
          </el-button>
        </el-form>

        <div class="login-footer">
          <span>还没有账号？</span>
          <router-link to="/register" class="register-link"
            >立即注册</router-link
          >
        </div>
      </div>

      <div class="login-illustration">
        <div class="floating-icon">
          <el-icon size="64" color="#667eea">
            <MagicStick />
          </el-icon>
        </div>
        <div class="floating-icon delay-1">
          <el-icon size="48" color="#764ba2">
            <Document />
          </el-icon>
        </div>
        <div class="floating-icon delay-2">
          <el-icon size="40" color="#f093fb">
            <ChatRound />
          </el-icon>
        </div>
      </div>
    </div>

    <el-dialog title="忘记密码" v-model="showForgotModal" width="400px">
      <el-form ref="forgotForm" :model="forgotForm" :rules="forgotRules">
        <el-form-item prop="email">
          <el-input
            v-model="forgotForm.email"
            type="email"
            placeholder="请输入注册邮箱"
            prefix-icon="Mail"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForgotModal = false">取消</el-button>
        <el-button type="primary" @click="handleForgotPassword"
          >发送重置链接</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { ElMessage } from "element-plus";
import { Cpu, MagicStick, ChatRound, Document } from "@element-plus/icons-vue";

const router = useRouter();
const authStore = useAuthStore();

const loginForm = ref(null);
const showPassword = ref(false);
const loading = ref(false);
const showForgotModal = ref(false);

const form = reactive({
  username: "",
  password: "",
  rememberMe: false,
});

const forgotForm = reactive({
  email: "",
});

const rules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 3, max: 20, message: "用户名长度在3-20个字符", trigger: "blur" },
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, max: 32, message: "密码长度在6-32个字符", trigger: "blur" },
  ],
};

const forgotRules = {
  email: [
    { required: true, message: "请输入邮箱", trigger: "blur" },
    { type: "email", message: "请输入正确的邮箱格式", trigger: "blur" },
  ],
};

async function handleLogin() {
  if (!loginForm.value) return;

  loginForm.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;

      try {
        const result = await authStore.login(
          form.username,
          form.password,
          form.rememberMe
        );

        if (result.success) {
          ElMessage.success(result.message);
          router.push("/documents");
        } else {
          ElMessage.error(result.message);
        }
      } catch (error) {
        ElMessage.error(error.message || "登录失败");
      } finally {
        loading.value = false;
      }
    }
  });
}

function showForgotPassword() {
  showForgotModal.value = true;
}

function handleForgotPassword() {
  ElMessage.success("重置链接已发送至您的邮箱");
  showForgotModal.value = false;
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-container {
  display: flex;
  gap: 60px;
  align-items: center;
  max-width: 900px;
  width: 100%;
}

.login-card {
  background: white;
  border-radius: 20px;
  padding: 40px;
  width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.logo {
  margin-bottom: 15px;
}

.login-header h1 {
  font-size: 24px;
  color: #333;
  margin-bottom: 5px;
}

.login-header p {
  color: #999;
  font-size: 14px;
}

.login-form {
  margin-bottom: 20px;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 25px;
}

.forgot-password {
  color: #667eea;
  font-size: 14px;
  text-decoration: none;
}

.forgot-password:hover {
  text-decoration: underline;
}

.login-btn {
  width: 100%;
  height: 45px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
}

.login-footer {
  text-align: center;
  color: #999;
  font-size: 14px;
}

.register-link {
  color: #667eea;
  text-decoration: none;
  margin-left: 5px;
}

.register-link:hover {
  text-decoration: underline;
}

.login-illustration {
  position: relative;
  width: 400px;
  height: 400px;
  display: none;
}

@media (min-width: 768px) {
  .login-illustration {
    display: block;
  }
}

.floating-icon {
  position: absolute;
  animation: float 3s ease-in-out infinite;
}

.floating-icon.delay-1 {
  animation-delay: 0.5s;
  top: 30%;
  right: 20%;
}

.floating-icon.delay-2 {
  animation-delay: 1s;
  bottom: 30%;
  right: 40%;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-20px);
  }
}
</style>
