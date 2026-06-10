const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { 
  getUserDocuments, 
  getDocumentById, 
  deleteDocument,
  getAllDocuments 
} = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { success, error, notFound, paginated } = require('../response');
const logger = require('../logger');

/**
 * 获取知识库文档列表
 * GET /api/documents
 * Headers: Authorization: Bearer <token>
 * Query: page, pageSize, sortBy, sortOrder
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const sortBy = req.query.sortBy || 'created_at';
    const sortOrder = req.query.sortOrder || 'DESC';

    // 参数验证
    if (page < 1 || pageSize < 1 || pageSize > 100) {
      return error(res, '分页参数无效', 400);
    }

    // 获取用户文档列表
    const result = getUserDocuments(userId, page, pageSize, sortBy, sortOrder);

    // 格式化文档数据
    const documents = result.documents.map(doc => ({
      id: doc.id,
      filename: doc.originalname,
      filetype: doc.filetype,
      filesize: doc.filesize,
      status: doc.status,
      createdAt: doc.created_at,
      // 添加文件大小格式化
      filesizeFormatted: formatFileSize(doc.filesize)
    }));

    logger.info(`获取文档列表: 用户${userId}`, { 
      total: result.total,
      page,
      pageSize 
    });

    paginated(res, documents, result.total, page, pageSize, '获取文档列表成功');

  } catch (err) {
    logger.error('获取文档列表错误', { error: err.message });
    error(res, '获取文档列表失败', 500);
  }
});

/**
 * 获取单个文档详情
 * GET /api/documents/:id
 * Headers: Authorization: Bearer <token>
 */
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    const document = getDocumentById(documentId, userId);
    if (!document) {
      return notFound(res, '文档不存在或无权访问');
    }

    success(res, {
      id: document.id,
      filename: document.originalname,
      filetype: document.filetype,
      filesize: document.filesize,
      filesizeFormatted: formatFileSize(document.filesize),
      status: document.status,
      createdAt: document.created_at,
      filepath: document.filepath
    }, '获取文档详情成功');

  } catch (err) {
    logger.error('获取文档详情错误', { error: err.message });
    error(res, '获取文档详情失败', 500);
  }
});

/**
 * 删除文档
 * DELETE /api/documents/:id
 * Headers: Authorization: Bearer <token>
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // 删除文档记录和相关数据
    const document = deleteDocument(documentId, userId);
    if (!document) {
      return notFound(res, '文档不存在或无权访问');
    }

    // 删除物理文件
    if (fs.existsSync(document.filepath)) {
      fs.unlinkSync(document.filepath);
      logger.info(`物理文件已删除: ${document.filepath}`);
    }

    logger.info(`文档删除成功: ${document.originalname}`, { 
      documentId, 
      userId 
    });

    success(res, {
      id: documentId,
      filename: document.originalname
    }, '文档删除成功');

  } catch (err) {
    logger.error('删除文档错误', { error: err.message });
    error(res, '删除文档失败', 500);
  }
});

/**
 * 批量删除文档
 * POST /api/documents/batch-delete
 * Headers: Authorization: Bearer <token>
 * Body: { ids: [1, 2, 3] }
 */
router.post('/batch-delete', authMiddleware, (req, res) => {
  try {
    const { ids } = req.body;
    const userId = req.user.id;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, '请提供要删除的文档ID列表', 400);
    }

    const results = {
      success: [],
      failed: []
    };

    for (const documentId of ids) {
      try {
        const document = deleteDocument(documentId, userId);
        if (document) {
          // 删除物理文件
          if (fs.existsSync(document.filepath)) {
            fs.unlinkSync(document.filepath);
          }
          results.success.push({
            id: documentId,
            filename: document.originalname
          });
        } else {
          results.failed.push({
            id: documentId,
            reason: '文档不存在或无权访问'
          });
        }
      } catch (err) {
        results.failed.push({
          id: documentId,
          reason: err.message
        });
      }
    }

    logger.info(`批量删除文档: 成功${results.success.length}个, 失败${results.failed.length}个`, { userId });

    success(res, results, `成功删除${results.success.length}个文档`);

  } catch (err) {
    logger.error('批量删除文档错误', { error: err.message });
    error(res, '批量删除失败', 500);
  }
});

/**
 * 搜索文档
 * GET /api/documents/search
 * Headers: Authorization: Bearer <token>
 * Query: keyword, filetype, status
 */
router.get('/search/query', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { keyword, filetype, status } = req.query;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;

    // 获取所有文档
    const result = getUserDocuments(userId, 1, 1000);
    
    // 过滤文档
    let filtered = result.documents;
    
    if (keyword) {
      const lowerKeyword = keyword.toLowerCase();
      filtered = filtered.filter(doc => 
        doc.originalname.toLowerCase().includes(lowerKeyword)
      );
    }
    
    if (filetype) {
      filtered = filtered.filter(doc => doc.filetype === filetype);
    }
    
    if (status) {
      filtered = filtered.filter(doc => doc.status === status);
    }

    // 分页
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const documents = filtered.slice(start, start + pageSize);

    // 格式化
    const formattedDocs = documents.map(doc => ({
      id: doc.id,
      filename: doc.originalname,
      filetype: doc.filetype,
      filesize: doc.filesize,
      status: doc.status,
      createdAt: doc.created_at,
      filesizeFormatted: formatFileSize(doc.filesize)
    }));

    paginated(res, formattedDocs, total, page, pageSize, '搜索完成');

  } catch (err) {
    logger.error('搜索文档错误', { error: err.message });
    error(res, '搜索失败', 500);
  }
});

/**
 * 获取文档统计信息
 * GET /api/documents/stats
 * Headers: Authorization: Bearer <token>
 */
router.get('/stats/overview', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取所有文档
    const result = getUserDocuments(userId, 1, 1000);
    
    // 统计信息
    const stats = {
      total: result.documents.length,
      totalSize: 0,
      byType: {},
      byStatus: {}
    };
    
    result.documents.forEach(doc => {
      // 总大小
      stats.totalSize += doc.filesize || 0;
      
      // 按类型统计
      const type = doc.filetype || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // 按状态统计
      const status = doc.status || 'unknown';
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    });
    
    stats.totalSizeFormatted = formatFileSize(stats.totalSize);
    
    success(res, stats, '获取统计信息成功');

  } catch (err) {
    logger.error('获取统计信息错误', { error: err.message });
    error(res, '获取统计信息失败', 500);
  }
});

/**
 * 格式化文件大小
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, index);
  
  return `${size.toFixed(2)} ${units[index]}`;
}

module.exports = router;
