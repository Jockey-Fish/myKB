import axios from 'axios'

const BASE_URL = 'http://localhost:3000/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000
})

export async function uploadDocument(file) {
  const formData = new FormData()
  formData.append('file', file)
  
  const response = await api.post('/documents', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })
  
  return response.data
}

export async function getDocuments() {
  const response = await api.get('/documents')
  return response.data
}

export async function getDocument(id) {
  const response = await api.get(`/documents/${id}`)
  return response.data
}

export async function deleteDocument(id) {
  const response = await api.delete(`/documents/${id}`)
  return response.data
}

export async function askQuestion(question) {
  const response = await api.post('/qa/ask', { question })
  return response.data
}

export default api