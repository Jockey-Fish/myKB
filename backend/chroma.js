const { ChromaClient } = require('chromadb');
require('dotenv').config();

const client = new ChromaClient({
  path: process.env.CHROMA_PATH || './chroma_db'
});

const COLLECTION_NAME = 'knowledge_base';

let collection = null;

async function initChroma() {
  try {
    const collections = await client.listCollections();
    const exists = collections.some(c => c.name === COLLECTION_NAME);
    
    if (exists) {
      collection = await client.getCollection(COLLECTION_NAME);
    } else {
      collection = await client.createCollection(COLLECTION_NAME);
    }
    console.log('Chroma collection initialized:', COLLECTION_NAME);
  } catch (error) {
    console.error('Failed to initialize Chroma:', error);
    throw error;
  }
}

async function addDocuments(documentId, chunks) {
  if (!collection) await initChroma();
  
  const ids = chunks.map((_, index) => `${documentId}_${index}`);
  const documents = chunks.map(c => c.content);
  const metadatas = chunks.map((c, index) => ({
    document_id: documentId,
    chunk_index: index
  }));
  
  const result = await collection.add({
    ids,
    documents,
    metadatas
  });
  
  return result.ids;
}

async function querySimilar(query, nResults = 3) {
  if (!collection) await initChroma();
  
  const results = await collection.query({
    queryTexts: [query],
    nResults
  });
  
  return {
    documents: results.documents[0] || [],
    metadatas: results.metadatas[0] || [],
    distances: results.distances[0] || []
  };
}

async function deleteByDocumentId(documentId) {
  if (!collection) await initChroma();
  
  const allIds = await collection.get();
  const idsToDelete = allIds.ids.filter(id => id.startsWith(`${documentId}_`));
  
  if (idsToDelete.length > 0) {
    await collection.delete({ ids: idsToDelete });
  }
}

module.exports = {
  initChroma,
  addDocuments,
  querySimilar,
  deleteByDocumentId
};