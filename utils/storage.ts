import { Document, KnowledgeItem } from '../types';
import { EmbeddedChunk } from './vectorStore';

const DB_NAME = 'DocumindDB';
const STORE_NAME = 'documents';
const EMBEDDINGS_STORE_NAME = 'embeddings';
const KNOWLEDGE_STORE_NAME = 'knowledge_base';
const CONVERSATIONS_STORE_NAME = 'conversations';
const CHAT_MESSAGES_STORE_NAME = 'chat_messages';
const DB_VERSION = 4; // Increment version for new stores

export const initDB = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(EMBEDDINGS_STORE_NAME)) {
        db.createObjectStore(EMBEDDINGS_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(KNOWLEDGE_STORE_NAME)) {
        db.createObjectStore(KNOWLEDGE_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CONVERSATIONS_STORE_NAME)) {
        db.createObjectStore(CONVERSATIONS_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(CHAT_MESSAGES_STORE_NAME)) {
        const messagesStore = db.createObjectStore(CHAT_MESSAGES_STORE_NAME, { keyPath: 'id' });
        messagesStore.createIndex('conversation_id', 'conversation_id', { unique: false });
      }
    };
  });
};

export const saveDocuments = (documents: Document[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Clear existing and add new to ensure sync
      store.clear().onsuccess = () => {
        if (documents.length === 0) return;
        documents.forEach(doc => store.put(doc));
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
};

export const loadDocuments = (): Promise<Document[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
};

export const saveEmbeddings = (chunks: EmbeddedChunk[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(EMBEDDINGS_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(EMBEDDINGS_STORE_NAME);

      chunks.forEach(chunk => store.put(chunk));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
};

export const loadEmbeddings = (): Promise<EmbeddedChunk[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(EMBEDDINGS_STORE_NAME, 'readonly');
      const store = transaction.objectStore(EMBEDDINGS_STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
};

export const saveKnowledge = (item: KnowledgeItem): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(KNOWLEDGE_STORE_NAME, 'readwrite');
      const store = transaction.objectStore(KNOWLEDGE_STORE_NAME);

      store.put(item);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
};

export const loadKnowledge = (): Promise<KnowledgeItem[]> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(KNOWLEDGE_STORE_NAME, 'readonly');
      const store = transaction.objectStore(KNOWLEDGE_STORE_NAME);
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
  });
};
export const clearAllData = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction([STORE_NAME, EMBEDDINGS_STORE_NAME], 'readwrite');

      transaction.objectStore(STORE_NAME).clear();
      transaction.objectStore(EMBEDDINGS_STORE_NAME).clear();

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
};
