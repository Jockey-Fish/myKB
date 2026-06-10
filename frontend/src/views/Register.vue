<template>
  <div class="register-page">
    <div class="register-container">
      <div class="register-form-wrapper">
        <div class="register-header">
          <el-icon size="48" color="#667eea">
            <Cpu />
          </el-icon>
          <h1>创建账户</h1>
          <p>注册您的AI知识库账户</p>
        </div>

        <el-form ref="registerForm" :model="form" :rules="rules" class="register-form">
          <el-form-item prop="username">
            <el-input
              v-model="form.username"
              type="text"
              placeholder="请输入用户名"
              prefix-icon="User"
              :disabled="loading"
            />
          </el-form-item>

          <el-form-item prop="email">
            <el-input
              v-model="form.email"
              type="email"
              placeholder="请输入邮箱"
              prefix-icon="Message"
              :disabled="loading"
            />
          </el-form-item>

          <el-form-item prop="password">
            <el-input
              v-model="form.password"
              :type="showPassword ? 'text' : 'password'"
              placeholder="请输入密码（6-20位）"
              prefix-icon="Lock"
              :disabled="loading"
            >
              <template #suffix>
                <el-icon
                  class="password-toggle"
                  @click="showPassword = !showPassword"
                >
                  <View v-if="!showPassword" />
                  <Hide v-else />
                </el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="confirmPassword">
            <el-input
              v-model="form.confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              placeholder="请确认密码"
              prefix-icon="Lock"
              :disabled="loading"
              @keydown.enter="handleRegister"
            >
              <template #suffix>
                <el-icon
                  class="password-toggle"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <View v-if="!showConfirmPassword" />
                  <Hide v-else />
                </el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item prop="agreement">
            <el-checkbox v-model="form.agreement">
              我已阅读并同意
              <a href="#" @click.prevent="showTerms">服务条款</a>
              和
              <a href="#" @click.prevent="showPrivacy">隐私政策</a>
            </el-checkbox>
          </el-form-item>

          <el-form-item>
            <el-button
              type="primary"
              :loading="loading"
              class="register-button"
              @click="handleRegister"
            >
              {{ loading ? "注册中..." : "立即注册" }}
            </el-button>
          </el-form-item>
        </el-form>

        <div class="register-footer">
          <span>已有账户？</span>
          <router-link to="/login" class="login-link">立即登录</router-link>
        </div>
      </div>

      <div class="register-illustration">
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
  </div>
</template>

<script setup>
import { ref, reactive } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { Cpu, MagicStick, ChatRound, Document, View, Hide } from "@element-plus/icons-vue";

const router = useRouter();

const registerForm = ref(null);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const loading = ref(false);

const form = reactive({
  username: "",
  email: "",
  password: "",
  confirmPassword: "",
  agreement: false,
});

const validatePass = (rule, value, callback) => {
  if (value === "") {
    callback(new Error("请输入密码"));
  } else if (value.length < 6 || value.length > 20) {
    callback(new Error("密码长度为6-20位"));
  } else {
    if (form.confirmPassword !== "") {
      registerForm.value.validateField("confirmPassword");
    }
    callback();
  }
};

const validatePass2 = (rule, value, callback) => {
  if (value === "") {
    callback(new Error("请再次输入密码"));
  } else if (value !== form.password) {
    callback(new Error("两次输入密码不一致"));
  } else {
    callback();
  }
};

const rules = {
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 3, max: 20, message: "用户名长度为3-20位", trigger: "blur" },
  ],
  email: [
    { required: true, message: "请输入邮箱", trigger: "blur" },
    { type: "email", message: "请输入有效的邮箱地址", trigger: "blur" },
  ],
  password: [{ required: true, validator: validatePass, trigger: "blur" }],
  confirmPassword: [{ required: true, validator: validatePass2, trigger: "blur" }],
  agreement: [
    {
      validator: (rule, value, callback) => {
        if (!value) {
          callback(new Error("请阅读并同意服务条款和隐私政策"));
        } else {
          callback();
        }
      },
      trigger: "change",
    },
  ],
};

function handleRegister() {
  registerForm.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;

      // 模拟注册请求
      setTimeout(() => {
        loading.value = false;
        ElMessage.success("注册成功，请登录");
        router.push("/login");
      }, 1500);
    }
  });
}

function showTerms() {
  ElMessage.info("服务条款页面开发中");
}

function showPrivacy() {
  ElMessage.info("隐私政策页面开发中");
}
</script>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.register-container {
  display: flex;
  align-items: center;
  gap: 60px;
  max-width: 1000px;
  width: 100%;
}

.register-form-wrapper {
  flex: 1;
  background: white;
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: slideIn 0.5s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.register-header {
  text-align: center;
  margin-bottom: 30px;
}

.register-header h1 {
  font-size: 28px;
  color: #333;
  margin: 15px 0 10px;
}

.register-header p {
  color: #999;
  font-size: 14px;
}

.register-form {
  margin-top: 20px;
}

.password-toggle {
  cursor: pointer;
  color: #999;
  transition: color 0.2s;
}

.password-toggle:hover {
  color: #667eea;
}

.register-button {
  width: 100%;
  height: 45px;
  font-size: 16px;
  border-radius: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  transition: transform 0.2s, box-shadow 0.2s;
}

.register-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

.register-footer {
  text-align: center;
  margin-top: 25px;
  padding-top: 20px;
  border-top: 1px solid #eee;
  color: #999;
  font-size: 14px;
}

.login-link {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
  margin-left: 5px;
  transition: color 0.2s;
}

.login-link:hover {
  color: #764ba2;
}

.register-illustration {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 30px;
  animation: fadeIn 0.8s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.floating-icon {
  animation: float 3s ease-in-out infinite;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.floating-icon.delay-1 {
  animation-delay: 0.5s;
}

.floating-icon.delay-2 {
  animation-delay: 1s;
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

@media (max-width: 768px) {
  .register-container {
    flex-direction: column;
    gap: 30px;
  }

  .register-illustration {
    order: -1;
    flex-direction: row;
    gap: 15px;
  }

  .floating-icon {
    padding: 15px;
  }

  .register-form-wrapper {
    padding: 30px 20px;
  }
}
</style>
