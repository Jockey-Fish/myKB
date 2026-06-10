import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))
  const rememberMe = ref(false)

  const isLoggedIn = computed(() => !!token.value)

  function login(username, password, remember) {
    if (username && password) {
      token.value = 'mock-token-' + Date.now()
      user.value = { username, name: '用户' }
      rememberMe.value = remember
      
      if (remember) {
        localStorage.setItem('token', token.value)
        localStorage.setItem('user', JSON.stringify(user.value))
      } else {
        sessionStorage.setItem('token', token.value)
        sessionStorage.setItem('user', JSON.stringify(user.value))
      }
      
      return true
    }
    return false
  }

  function logout() {
    token.value = ''
    user.value = null
    rememberMe.value = false
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
  }

  return {
    token,
    user,
    rememberMe,
    isLoggedIn,
    login,
    logout
  }
})