const express = require('express');
const router = express.Router();
const TextSplitter = require('../rag/text_splitter');
const TextVectorizer = require('../rag/text_vectorizer');
const ChromaVectorStore = require('../rag/vector_store');

const textSplitter = new TextSplitter({
  chunkSize: 500,
  chunkOverlap: 50
});

const textVectorizer = new TextVectorizer();

const vectorStore = new ChromaVectorStore({
  collectionName: 'knowledge_base',
  persistPath: './chroma_db'
});

router.post('/ingest', async (req, res) => {
  try {
    const { text, documentId } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: text',
        data: null
      });
    }

    const chunks = textSplitter.splitTextByParagraphs(text);
    
    const chunksWithDocumentId = chunks.map((chunk, index) => ({
      ...chunk,
      documentId: documentId || `doc_${Date.now()}`,
      chunkIndex: index
    }));

    const embeddedChunks = await textVectorizer.embedChunks(chunksWithDocumentId);

    const result = await vectorStore.addDocuments(embeddedChunks);

    res.json({
      code: 200,
      message: '文档向量化并存储成功',
      data: {
        documentId: chunksWithDocumentId[0]?.documentId,
        chunksCount: chunks.length,
        storedCount: result.count
      }
    });
  } catch (error) {
    console.error('文档处理失败:', error);
    res.status(500).json({
      code: 500,
      message: `文档处理失败: ${error.message}`,
      data: null
    });
  }
});

router.post('/query', async (req, res) => {
  try {
    const { query, k = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: query',
        data: null
      });
    }

    if (!Number.isInteger(k) || k < 1 || k > 20) {
      return res.status(400).json({
        code: 400,
        message: '参数k必须是1-20之间的整数',
        data: null
      });
    }

    const [queryVector] = await textVectorizer.embed(query);

    const results = await vectorStore.query(queryVector, { k });

    res.json({
      code: 200,
      message: '查询成功',
      data: {
        query,
        results,
        total: results.length
      }
    });
  } catch (error) {
    console.error('查询失败:', error);
    res.status(500).json({
      code: 500,
      message: `查询失败: ${error.message}`,
      data: null
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const count = await vectorStore.getDocumentCount();
    
    res.json({
      code: 200,
      message: '获取统计信息成功',
      data: {
        documentCount: count,
        vectorDimension: textVectorizer.getVectorDimension(),
        modelName: textVectorizer.modelName
      }
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      code: 500,
      message: `获取统计信息失败: ${error.message}`,
      data: null
    });
  }
});

router.delete('/documents', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: ids（数组）',
        data: null
      });
    }

    const result = await vectorStore.deleteDocuments(ids);

    res.json({
      code: 200,
      message: '删除成功',
      data: result
    });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({
      code: 500,
      message: `删除失败: ${error.message}`,
      data: null
    });
  }
});

router.delete('/document/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: documentId',
        data: null
      });
    }

    const result = await vectorStore.deleteByDocumentId(documentId);

    res.json({
      code: 200,
      message: '删除成功',
      data: result
    });
  } catch (error) {
    console.error('删除失败:', error);
    res.status(500).json({
      code: 500,
      message: `删除失败: ${error.message}`,
      data: null
    });
  }
});

router.delete('/clear', async (req, res) => {
  try {
    const result = await vectorStore.clearCollection();

    res.json({
      code: 200,
      message: '向量库已清空',
      data: result
    });
  } catch (error) {
    console.error('清空失败:', error);
    res.status(500).json({
      code: 500,
      message: `清空失败: ${error.message}`,
      data: null
    });
  }
});

router.post('/split', async (req, res) => {
  try {
    const { text, chunkSize = 500, chunkOverlap = 50 } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: text',
        data: null
      });
    }

    const customSplitter = new TextSplitter({ chunkSize, chunkOverlap });
    const chunks = customSplitter.splitTextByParagraphs(text);

    res.json({
      code: 200,
      message: '文本切片成功',
      data: {
        totalChunks: chunks.length,
        chunks
      }
    });
  } catch (error) {
    console.error('文本切片失败:', error);
    res.status(500).json({
      code: 500,
      message: `文本切片失败: ${error.message}`,
      data: null
    });
  }
});

router.post('/embed', async (req, res) => {
  try {
    const { texts } = req.body;

    if (!texts || (!Array.isArray(texts) && typeof texts !== 'string')) {
      return res.status(400).json({
        code: 400,
        message: '缺少必要参数: texts（字符串或字符串数组）',
        data: null
      });
    }

    const vectors = await textVectorizer.embed(texts);

    res.json({
      code: 200,
      message: '向量化成功',
      data: {
        count: vectors.length,
        dimension: vectors[0]?.length || 0,
        vectors
      }
    });
  } catch (error) {
    console.error('向量化失败:', error);
    res.status(500).json({
      code: 500,
      message: `向量化失败: ${error.message}`,
      data: null
    });
  }
});

module.exports = router;
