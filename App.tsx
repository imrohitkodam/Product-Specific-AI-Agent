import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import { ChatSidebar } from './components/ChatSidebar';
import { Auth } from './components/Auth';
import { Document, Message, RAGResponse } from './types';
import { processFile } from './utils/fileProcessor';
import { geminiService } from './services/geminiService';
import { crewService } from './services/crewService';
import { learningService } from './services/learningService';
import { shadowIndexer } from './services/shadowIndexer';
import { splitTextIntoChunks } from './utils/textSplitter';
import { findMostRelevantChunks, EmbeddedChunk } from './utils/vectorStore';
import { supabaseService, CloudConversation, CloudChatMessage } from './services/supabaseService';
import { User } from '@supabase/supabase-js';

// Local types for UI compatibility
interface Conversation {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

const App: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [allEmbeddings, setAllEmbeddings] = useState<EmbeddedChunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(true);
  const [requiresKey, setRequiresKey] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('is_admin_mode') === 'true';
  });

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Chat History State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // 1. Auth Sync
  useEffect(() => {
    const unsubscribe = supabaseService.onAuthStateChange((newUser) => {
      setUser(newUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Initialization (Documents & Chats)
  useEffect(() => {
    const initData = async () => {
      try {
        console.log("Syncing from Cloud...");
        const { documents: sharedDocs, embeddings: sharedEmbeddings } = await supabaseService.fetchAllSharedData();

        // Sync Documents
        if (sharedDocs.length > 0) {
          setDocuments(sharedDocs.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type || 'text/plain',
            size: d.size || 0,
            content: d.content,
            path: d.path,
            moduleName: d.module_name,
            isJoomlaManifest: d.is_joomla_manifest,
            status: 'ready',
            indexingStatus: 'completed',
            isSelected: true,
            category: d.path?.endsWith('.php') || d.path?.endsWith('.js') || d.path?.endsWith('.ts') ? 'code' : 'docs'
          })));
        }

        // Sync Embeddings (In-memory cache for Vector Search)
        if (sharedEmbeddings.length > 0) {
          setAllEmbeddings(sharedEmbeddings.map((e: any) => ({
            id: e.id,
            documentId: e.document_id,
            content: e.content,
            embedding: e.embedding,
            startIndex: e.start_index || 0,
            endIndex: e.end_index || 0
          })));
        }
      } catch (error) {
        console.error('Initial cloud sync failed:', error);
      }
    };

    initData();
  }, []);

  // 3. Load user-specific chats when user is authenticated
  useEffect(() => {
    if (user) {
      loadChats();
    }
  }, [user]);

  const loadChats = async () => {
    if (!user) return;
    try {
      const convs = await supabaseService.fetchConversations(user.id);
      const mappedConvs: Conversation[] = convs.map(c => ({
        id: c.id,
        title: c.title,
        created_at: Number(c.created_at),
        updated_at: Number(c.updated_at)
      }));

      setConversations(mappedConvs);

      if (mappedConvs.length === 0) {
        await createNewConversation();
      } else {
        const firstConvId = mappedConvs[0].id;
        setCurrentConversationId(firstConvId);
        const msgs = await supabaseService.loadChatMessages(firstConvId);
        setMessages(msgs.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: Number(m.timestamp),
          issueType: m.issueType,
          suggestedPatch: m.suggestedPatch,
          citations: m.citations
        })));
      }
    } catch (e) {
      console.error("Failed to load cloud chats:", e);
    }
  };

  // 4. Admin Event Handlers (Direct Cloud Sync)
  const handleFileUpload = async (files: FileList | File[]) => {
    if (!isAdmin) return [];
    setIsProcessing(true);
    const results: Document[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const id = Math.random().toString(36).substring(7);

      const initialDoc: Document = {
        id, name: file.name, type: file.type || 'application/octet-stream',
        size: file.size, content: '', status: 'processing', isSelected: true
      };
      setDocuments(prev => [...prev, initialDoc]);

      try {
        const result = await processFile(file);
        const processedDocs = Array.isArray(result) ? result.map(data => ({
          id: Math.random().toString(36).substring(7),
          name: data.name || 'extracted_file',
          path: data.path,
          type: data.type || 'text/plain',
          size: data.content?.length || 0,
          content: data.content || '',
          status: 'ready',
          isSelected: true,
          isJoomlaManifest: data.isJoomlaManifest,
          moduleName: data.moduleName,
          category: data.path?.endsWith('.php') || data.path?.endsWith('.js') || data.path?.endsWith('.ts') ? 'code' : 'docs'
        } as Document)) : [{
          ...initialDoc,
          ...result,
          status: 'ready',
          category: result.path?.endsWith('.php') || result.path?.endsWith('.js') || result.path?.endsWith('.ts') ? 'code' : 'docs'
        } as Document];

        setDocuments(prev => [...prev.filter(d => d.id !== id), ...processedDocs]);
        results.push(...processedDocs);

        // SYNC TO CLOUD (Admin only)
        await supabaseService.upsertDocuments(processedDocs);

        // Queue for Shadow Indexing
        processedDocs.forEach(doc => {
          if (!doc.type.startsWith('image/')) {
            setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, indexingStatus: 'pending' } : d));
            shadowIndexer.queueDocument(doc);
          }
        });

      } catch (err) {
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: 'error' } as Document : d));
      }
    }
    setIsProcessing(false);
    return results;
  };

  const handleRemoveDoc = async (id: string) => {
    if (!isAdmin) return;
    setDocuments(prev => prev.filter(d => d.id !== id));
    setAllEmbeddings(prev => prev.filter(e => e.documentId !== id));
    await supabaseService.deleteDocument(id);
  };

  const handleRemoveAll = async () => {
    if (!isAdmin) return;
    if (window.confirm('Delete all cloud documents and embeddings?')) {
      setDocuments([]);
      setAllEmbeddings([]);
      await supabaseService.deleteAllDocuments();
    }
  };

  // 5. Shadow Indexing Integration
  useEffect(() => {
    shadowIndexer.setStatusCallback((docId, status) => {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, indexingStatus: status } : d));
    });

    shadowIndexer.setDataCallback(async (docId, chunks) => {
      if (isAdmin) {
        console.log(`Cloud Syncing Embeddings for ${docId}...`);
        await supabaseService.upsertEmbeddings(chunks);
        setAllEmbeddings(prev => [...prev, ...chunks]);
      }
    });
  }, [isAdmin]);

  // 6. Conversation Management
  const createNewConversation = async () => {
    if (!user) return;
    const newConv: Conversation = {
      id: `conv_${Date.now()}`,
      title: 'New Chat',
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await supabaseService.saveConversation({
      id: newConv.id,
      user_id: user.id,
      title: newConv.title,
      created_at: newConv.created_at,
      updated_at: newConv.updated_at
    });

    setConversations(prev => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setMessages([]);
  };

  const switchConversation = async (id: string) => {
    setCurrentConversationId(id);
    const msgs = await supabaseService.loadChatMessages(id);
    setMessages(msgs.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: Number(m.timestamp),
      issueType: m.issueType,
      suggestedPatch: m.suggestedPatch,
      citations: m.citations
    })));
  };

  const handleDeleteConversation = async (id: string) => {
    await supabaseService.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversationId === id) {
      const remaining = conversations.filter(c => c.id !== id);
      if (remaining.length > 0) switchConversation(remaining[0].id);
      else createNewConversation();
    }
  };

  // 7. Chat Logic
  const handleSendMessage = async (content: string, pendingFiles?: File[]) => {
    let currentDocs = [...documents];
    if (pendingFiles && pendingFiles.length > 0) {
      setIsLoading(true);
      const newDocs = await handleFileUpload(pendingFiles);
      currentDocs = [...currentDocs, ...newDocs];
    }

    const selectedDocs = currentDocs.filter(doc => doc.isSelected && doc.status === 'ready');
    const userMsg: Message = { role: 'user', content, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Vector Search (In-memory cache)
      let contextString: string | undefined = undefined;
      if (selectedDocs.some(d => !d.type.startsWith('image/'))) {
        const queryEmbeds = await geminiService.getEmbeddings([content]);
        if (queryEmbeds.length > 0) {
          const selectedIds = new Set(selectedDocs.map(d => d.id));
          const relevantChunks = allEmbeddings.filter(c => selectedIds.has(c.documentId));
          if (relevantChunks.length > 0) {
            const topChunks = findMostRelevantChunks(queryEmbeds[0], relevantChunks, 15);
            contextString = topChunks
              .map(c => `--- FILE: ${documents.find(d => d.id === c.documentId)?.name} ---\n${c.content}\n`)
              .join('\n\n');
          }
        }
      }

      // Routing & AI Call
      const selectedCode = selectedDocs.filter(doc => doc.category === 'code');
      const codeKeywords = ['error', 'bug', 'fix', 'issue', 'not working', 'function', 'deprecated'];
      const isCodeQuery = codeKeywords.some(kw => content.toLowerCase().includes(kw)) || selectedCode.length > 0;

      let response: RAGResponse;
      if (isCodeQuery && selectedCode.length > 0) {
        const tempId = Date.now();
        setMessages(prev => [...prev, { role: 'assistant', content: "Thinking...", timestamp: tempId }]);
        response = await crewService.runCrewWorkflow(content, contextString || "", () => { });
        setMessages(prev => prev.map(m => m.timestamp === tempId ? { ...m, ...response, content: response.answer } : m));
      } else {
        response = await geminiService.queryDocuments(content, selectedDocs, contextString);
        setMessages(prev => [...prev, { role: 'assistant', ...response, content: response.answer, timestamp: Date.now() }]);
      }

      // Cloud Sync interaction
      if (currentConversationId && user) {
        await supabaseService.saveChatMessage({
          id: `msg_${Date.now()}_user`,
          conversation_id: currentConversationId,
          user_id: user.id,
          ...userMsg
        });
        await supabaseService.saveChatMessage({
          id: `msg_${Date.now()}_assistant`,
          conversation_id: currentConversationId,
          user_id: user.id,
          role: 'assistant',
          content: response.answer,
          timestamp: Date.now(),
          issueType: response.issueType,
          suggestedPatch: response.suggestedPatch,
          citations: response.citations
        });

        // Title Auto-update
        const currentConv = conversations.find(c => c.id === currentConversationId);
        if (currentConv && currentConv.title === 'New Chat') {
          const newTitle = content.slice(0, 40) + '...';
          const updated = { ...currentConv, title: newTitle, updated_at: Date.now() };
          await supabaseService.saveConversation({ ...updated, user_id: user.id });
          setConversations(prev => prev.map(c => c.id === currentConversationId ? updated : c));
        }
      }

    } catch (err: any) {
      console.error("Chat Error:", err);
      setMessages(prev => [...prev, { role: 'assistant', content: "Something went wrong. Please try again.", timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><div className="w-8 h-8 border-4 border-purple-500/2 border-t-purple-500 rounded-full animate-spin"></div></div>;
  }

  if (!user) return <Auth />;

  return (
    <div className="flex flex-col h-screen w-full bg-[#1a1b1e] text-white overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`transition-all duration-300 ease-in-out h-full overflow-hidden absolute lg:relative z-30 shadow-2xl ${isChatSidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'}`}>
          <ChatSidebar
            conversations={conversations}
            currentConversationId={currentConversationId}
            onSelectConversation={switchConversation}
            onNewConversation={createNewConversation}
            onDeleteConversation={handleDeleteConversation}
            user={user}
            onSignOut={() => supabaseService.signOut()}
          />
        </div>

        <ChatWindow
          messages={messages} onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload} isLoading={isLoading}
          hasDocs={documents.some(d => d.status === 'ready')}
          selectedDocCount={documents.filter(d => d.isSelected).length}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          onToggleChatSidebar={() => setIsChatSidebarOpen(!isChatSidebarOpen)}
          isChatSidebarOpen={isChatSidebarOpen}
          isAdmin={isAdmin}
        />

        {isAdmin && (
          <div className={`transition-all duration-300 ease-in-out h-full overflow-hidden absolute lg:relative z-30 shadow-2xl ${isSidebarOpen ? 'w-[340px] translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'}`}>
            <Sidebar
              documents={documents} onFileUpload={handleFileUpload}
              onRemoveDoc={handleRemoveDoc}
              onRemoveAll={handleRemoveAll}
              onToggleDocSelection={(id) => setDocuments(docs => docs.map(d => d.id === id ? { ...d, isSelected: !d.isSelected } : d))}
              isProcessing={isProcessing}
              onToggleSidebar={() => setIsSidebarOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
