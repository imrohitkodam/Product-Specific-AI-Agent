
import { Message } from '../types';

export interface Conversation {
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
}

export interface ChatMessage extends Message {
    id: string;
    conversation_id: string;
}

// Add these to the end of storage.ts file
const CONVERSATIONS_STORE_NAME = 'conversations';
const CHAT_MESSAGES_STORE_NAME = 'chat_messages';
const DB_NAME = 'DocumindDB';
const DB_VERSION = 4;

// Conversations
export const saveConversation = (conversation: Conversation): Promise<void> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(CONVERSATIONS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
            store.put(conversation);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };
    });
};

export const loadConversations = (): Promise<Conversation[]> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(CONVERSATIONS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(CONVERSATIONS_STORE_NAME);
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => {
                const conversations = getAllRequest.result as Conversation[];
                // Sort by updated_at descending
                conversations.sort((a, b) => b.updated_at - a.updated_at);
                resolve(conversations);
            };
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
    });
};

export const deleteConversation = (id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([CONVERSATIONS_STORE_NAME, CHAT_MESSAGES_STORE_NAME], 'readwrite');

            // Delete conversation
            transaction.objectStore(CONVERSATIONS_STORE_NAME).delete(id);

            // Delete all messages in this conversation
            const messagesStore = transaction.objectStore(CHAT_MESSAGES_STORE_NAME);
            const index = messagesStore.index('conversation_id');
            const range = IDBKeyRange.only(id);
            const cursorRequest = index.openCursor(range);

            cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest).result;
                if (cursor) {
                    messagesStore.delete(cursor.primaryKey);
                    cursor.continue();
                }
            };

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };
    });
};

// Messages
export const saveChatMessage = (message: ChatMessage): Promise<void> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(CHAT_MESSAGES_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(CHAT_MESSAGES_STORE_NAME);
            store.put(message);
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        };
    });
};

export const loadChatMessages = (conversationId: string): Promise<ChatMessage[]> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction(CHAT_MESSAGES_STORE_NAME, 'readonly');
            const store = transaction.objectStore(CHAT_MESSAGES_STORE_NAME);
            const index = store.index('conversation_id');
            const range = IDBKeyRange.only(conversationId);
            const getAllRequest = index.getAll(range);

            getAllRequest.onsuccess = () => {
                const messages = getAllRequest.result as ChatMessage[];
                // Sort by timestamp ascending
                messages.sort((a, b) => a.timestamp - b.timestamp);
                resolve(messages);
            };
            getAllRequest.onerror = () => reject(getAllRequest.error);
        };
    });
};
