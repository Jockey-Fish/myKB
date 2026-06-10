const express = require('express');
const router = express.Router();
const { querySimilar } = require('../chroma');

router.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question || question.trim().length === 0) {
      return res.status(400).json({ error: '请输入问题' });
    }
    
    const results = await querySimilar(question, 3);
    
    const context = results.documents.join('\n\n');
    
    const answer = generateAnswer(question, context);
    
    res.json({
      question,
      answer,
      sources: results.metadatas.map((meta, index) => ({
        documentId: meta.document_id,
        chunkIndex: meta.chunk_index,
        content: results.documents[index],
        similarity: Math.max(0, 1 - results.distances[index])
      }))
    });
  } catch (error) {
    console.error('QA Error:', error);
    res.status(500).json({ error: '问答服务错误: ' + error.message });
  }
});

function generateAnswer(question, context) {
  if (!context || context.trim().length === 0) {
    return '抱歉，知识库中没有找到相关信息。请尝试上传文档后再提问。';
  }
  
  const answer = `根据知识库中的信息，关于您的问题"${question}"，以下是相关内容：\n\n${context}\n\n---\n注：以上内容来自知识库文档，仅供参考。`;
  
  return answer;
}

module.exports = router;