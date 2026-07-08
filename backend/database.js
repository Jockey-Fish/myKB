const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

let db;
const dbPath = path.join(__dirname, "knowledge_base.db");

// 初始化数据库
async function initDatabase() {
  const SQL = await initSqlJs();

  // 尝试加载现有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      originalname TEXT NOT NULL,
      filepath TEXT NOT NULL,
      filetype TEXT NOT NULL,
      filesize INTEGER,
      status TEXT DEFAULT 'pending',
      chunk_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS document_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    )
  `);

  // 保存数据库
  saveDatabase();

  // 创建默认管理员
  await createDefaultAdmin();
}

// 保存数据库到文件
function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// 创建默认管理员
async function createDefaultAdmin() {
  const result = db.exec('SELECT id FROM users WHERE username = "admin"');

  if (result.length === 0 || result[0].values.length === 0) {
    const hashedPassword = await bcrypt.hash("admin123", 10);
    db.run(
      "INSERT INTO users (username, email, password, name) VALUES (?, ?, ?, ?)",
      ["admin", "admin@example.com", hashedPassword, "管理员"],
    );
    saveDatabase();
    console.log("默认管理员账户已创建: admin / admin123");
  }
}

// ==================== 用户相关操作 ====================

async function createUser(username, email, password, name) {
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    db.run(
      "INSERT INTO users (username, email, password, name) VALUES (?, ?, ?, ?)",
      [username, email, hashedPassword, name],
    );
    saveDatabase();

    const result = db.exec("SELECT last_insert_rowid()");
    const id = result[0].values[0][0];
    return { id, username, email, name };
  } catch (error) {
    throw new Error("用户名或邮箱已存在");
  }
}

function findUserByUsername(username) {
  const result = db.exec("SELECT * FROM users WHERE username = ?", [username]);
  if (result.length === 0 || result[0].values.length === 0) return null;

  const columns = result[0].columns;
  const values = result[0].values[0];
  return columns.reduce((obj, col, i) => ({ ...obj, [col]: values[i] }), {});
}

function findUserById(id) {
  const result = db.exec(
    "SELECT id, username, email, name, created_at, last_login FROM users WHERE id = ?",
    [id],
  );
  if (result.length === 0 || result[0].values.length === 0) return null;

  const columns = result[0].columns;
  const values = result[0].values[0];
  return columns.reduce((obj, col, i) => ({ ...obj, [col]: values[i] }), {});
}

function updateLastLogin(userId) {
  db.run("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?", [
    userId,
  ]);
  saveDatabase();
}

async function verifyPassword(plainPassword, hashedPassword) {
  return await bcrypt.compare(plainPassword, hashedPassword);
}

// ==================== 文档相关操作 ====================

function insertDocument(
  userId,
  filename,
  originalname,
  filepath,
  filetype,
  filesize,
) {
  db.run(
    'INSERT INTO documents (user_id, filename, originalname, filepath, filetype, filesize, status) VALUES (?, ?, ?, ?, ?, ?, "uploading")',
    [userId, filename, originalname, filepath, filetype, filesize],
  );

  // 先获取插入的ID，再保存数据库
  const result = db.exec("SELECT last_insert_rowid()");
  const documentId = result[0].values[0][0];

  saveDatabase();

  return documentId;
}

function getUserDocuments(
  userId,
  page = 1,
  pageSize = 10,
  sortBy = "created_at",
  sortOrder = "DESC",
) {
  const offset = (page - 1) * pageSize;
  const validSortFields = ["created_at", "filesize", "originalname"];
  const sortField = validSortFields.includes(sortBy) ? sortBy : "created_at";
  const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

  const docsResult = db.exec(
    `SELECT id, filename, originalname, filetype, filesize, status, created_at, chunk_count FROM documents WHERE user_id = ? ORDER BY ${sortField} ${order} LIMIT ? OFFSET ?`,
    [userId, pageSize, offset],
  );

  const documents =
    docsResult.length > 0
      ? docsResult[0].values.map((row) => ({
          id: row[0],
          filename: row[1],
          originalname: row[2],
          filetype: row[3],
          filesize: row[4],
          status: row[5],
          created_at: row[6],
          chunk_count: row[7] || 0,
        }))
      : [];

  const totalResult = db.exec(
    "SELECT COUNT(*) as count FROM documents WHERE user_id = ?",
    [userId],
  );
  const total = totalResult[0].values[0][0];

  return { documents, total, page, pageSize };
}

function getDocumentById(documentId, userId) {
  const result = db.exec(
    "SELECT * FROM documents WHERE id = ? AND user_id = ?",
    [documentId, userId],
  );

  if (result.length === 0 || result[0].values.length === 0) return null;

  const columns = result[0].columns;
  const values = result[0].values[0];
  return columns.reduce((obj, col, i) => ({ ...obj, [col]: values[i] }), {});
}

function deleteDocument(documentId, userId) {
  const doc = getDocumentById(documentId, userId);
  if (!doc) return null;

  db.run("DELETE FROM document_chunks WHERE document_id = ?", [documentId]);
  db.run("DELETE FROM documents WHERE id = ?", [documentId]);
  saveDatabase();

  return doc;
}

function getAllDocuments(page = 1, pageSize = 10) {
  const offset = (page - 1) * pageSize;

  const docsResult = db.exec(
    `SELECT d.id, d.filename, d.originalname, d.filetype, d.filesize, d.status, d.created_at, d.user_id, u.username, d.chunk_count
     FROM documents d LEFT JOIN users u ON d.user_id = u.id 
     ORDER BY d.created_at DESC LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );

  const documents =
    docsResult.length > 0
      ? docsResult[0].values.map((row) => ({
          id: row[0],
          filename: row[1],
          originalname: row[2],
          filetype: row[3],
          filesize: row[4],
          status: row[5],
          created_at: row[6],
          user_id: row[7],
          username: row[8],
          chunk_count: row[9] || 0,
        }))
      : [];

  const totalResult = db.exec("SELECT COUNT(*) as count FROM documents");
  const total = totalResult[0].values[0][0];

  return { documents, total, page, pageSize };
}

// ==================== 文档切片相关操作 ====================

function insertDocumentChunk(documentId, chunkIndex, content) {
  db.run(
    "INSERT INTO document_chunks (document_id, chunk_index, content) VALUES (?, ?, ?)",
    [documentId, chunkIndex, content],
  );
  saveDatabase();

  const result = db.exec("SELECT last_insert_rowid()");
  return result[0].values[0][0];
}

function getDocumentChunks(documentId) {
  const result = db.exec(
    "SELECT * FROM document_chunks WHERE document_id = ? ORDER BY chunk_index",
    [documentId],
  );

  if (result.length === 0) return [];

  return result[0].values.map((row) => ({
    id: row[0],
    document_id: row[1],
    chunk_index: row[2],
    content: row[3],
    created_at: row[4],
  }));
}

function updateDocumentStatus(documentId, status) {
  db.run("UPDATE documents SET status = ? WHERE id = ?", [status, documentId]);
  saveDatabase();
}

function updateDocumentChunkCount(documentId, chunkCount) {
  const result = db.run("UPDATE documents SET chunk_count = ? WHERE id = ?", [
    chunkCount,
    documentId,
  ]);
  console.log(
    `更新文档 ${documentId} 的 chunk_count 为 ${chunkCount}, 影响行数: ${result.changes}`,
  );
  saveDatabase();
}

module.exports = {
  initDatabase,
  createUser,
  findUserByUsername,
  findUserById,
  updateLastLogin,
  verifyPassword,
  insertDocument,
  getUserDocuments,
  getDocumentById,
  deleteDocument,
  getAllDocuments,
  insertDocumentChunk,
  getDocumentChunks,
  updateDocumentStatus,
  updateDocumentChunkCount,
};
