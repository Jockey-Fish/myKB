const { ChromaClient, Collection } = require('chromadb');
const path = require('path');

class ChromaVectorStore {
  constructor(options = {}) {
    this.client = null;
    this.collection = null;
    this.collectionName = options.collectionName || 'knowledge_base';
    this.persistPath = options.persistPath || path.join(__dirname, '../chroma_db');
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      this.client = new ChromaClient({
        path: this.persistPath
      });

      const collections = await this.client.listCollections();
      const exists = collections.some(col => col.name === this.collectionName);

      if (exists) {
        this.collection = await this.client.getCollection(this.collectionName);
      } else {
        this.collection = await this.client.createCollection(this.collectionName);
      }

      this.initialized = true;
      console.log(`Chroma向量库初始化完成，集合: ${this.collectionName}`);
    } catch (error) {
      console.error('Chroma向量库初始化失败:', error);
      throw new Error(`Chroma初始化失败: ${error.message}`);
    }
  }

  async addDocuments(documents) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!Array.isArray(documents) || documents.length === 0) {
      throw new Error('文档数组不能为空');
    }

    try {
      const ids = documents.map(doc => doc.id);
      const embeddings = documents.map(doc => doc.vector);
      const metadatas = documents.map(doc => ({
        text: doc.text,
        startPosition: doc.startPosition,
        endPosition: doc.endPosition,
        length: doc.length,
        documentId: doc.documentId || '',
        chunkIndex: doc.chunkIndex || 0
      }));
      const texts = documents.map(doc => doc.text);

      await this.collection.add({
        ids,
        embeddings,
        metadatas,
        documents: texts
      });

      console.log(`成功添加 ${documents.length} 个文档到向量库`);
      return { count: documents.length, ids };
    } catch (error) {
      console.error('添加文档到向量库失败:', error);
      throw new Error(`添加文档失败: ${error.message}`);
    }
  }

  async query(queryVector, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const k = options.k || 5;
    const include = options.include || ['metadatas', 'documents', 'distances'];

    try {
      const results = await this.collection.query({
        queryEmbeddings: [queryVector],
        nResults: k,
        include
      });

      const formattedResults = results.results[0].documents.map((doc, index) => ({
        id: results.results[0].ids[index],
        text: doc,
        metadata: results.results[0].metadatas[index],
        distance: results.results[0].distances[index]
      }));

      return formattedResults;
    } catch (error) {
      console.error('向量查询失败:', error);
      throw new Error(`向量查询失败: ${error.message}`);
    }
  }

  async getDocumentCount() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const count = await this.collection.count();
      return count;
    } catch (error) {
      console.error('获取文档数量失败:', error);
      throw new Error(`获取文档数量失败: ${error.message}`);
    }
  }

  async deleteDocuments(ids) {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new Error('ID数组不能为空');
    }

    try {
      await this.collection.delete({
        ids
      });

      console.log(`成功删除 ${ids.length} 个文档`);
      return { count: ids.length };
    } catch (error) {
      console.error('删除文档失败:', error);
      throw new Error(`删除文档失败: ${error.message}`);
    }
  }

  async deleteByDocumentId(documentId) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.collection.delete({
        where: { documentId }
      });

      console.log(`成功删除文档 ${documentId} 的所有分块`);
      return { documentId };
    } catch (error) {
      console.error('删除文档分块失败:', error);
      throw new Error(`删除文档分块失败: ${error.message}`);
    }
  }

  async clearCollection() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.client.deleteCollection(this.collectionName);
      this.collection = await this.client.createCollection(this.collectionName);
      console.log('向量库已清空');
      return { success: true };
    } catch (error) {
      console.error('清空向量库失败:', error);
      throw new Error(`清空向量库失败: ${error.message}`);
    }
  }
}

module.exports = ChromaVectorStore;
