
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import { Document, Message, RAGResponse } from './types';
import { processFile } from './utils/fileProcessor';
import { geminiService } from './services/geminiService';
import { crewService } from './services/crewService';
import { learningService } from './services/learningService';
import { shadowIndexer } from './services/shadowIndexer';
import { initDB, loadDocuments, saveDocuments, saveEmbeddings, loadEmbeddings, clearAllData, saveKnowledge } from './utils/storage';
import { splitTextIntoChunks } from './utils/textSplitter';
import { findMostRelevantChunks, EmbeddedChunk } from './utils/vectorStore';
import { supabaseService } from './services/supabaseService';

const App: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [requiresKey, setRequiresKey] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    return localStorage.getItem('is_admin_mode') === 'true';
  });
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initDB();

        // 1. Load from Local Storage (IndexedDB)
        const storedDocs = await loadDocuments();
        if (storedDocs.length > 0) {
          setDocuments(storedDocs);
        }

        // 2. Load from Shared Storage (Supabase) if local is empty or for public users
        if (storedDocs.length === 0 || !isAdmin) {
          console.log("Fetching shared data from Supabase...");
          const { documents: sharedDocs, embeddings: sharedEmbeddings, knowledge: sharedKnowledge } = await supabaseService.fetchAllSharedData();

          if (sharedDocs.length > 0) {
            // Map Supabase fields to local Document interface
            const mappedDocs: Document[] = sharedDocs.map((d: any) => ({
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
              isSelected: true
            }));

            setDocuments(mappedDocs);
            await saveDocuments(mappedDocs);

            // Save shared embeddings to local storage
            if (sharedEmbeddings.length > 0) {
              const mappedEmbeddings: EmbeddedChunk[] = sharedEmbeddings.map((e: any) => ({
                id: e.id,
                documentId: e.document_id,
                content: e.content,
                embedding: e.embedding,
                startIndex: e.start_index || 0,
                endIndex: e.end_index || 0
              }));
              await saveEmbeddings(mappedEmbeddings);
            }

            // Save shared knowledge to local storage
            if (sharedKnowledge.length > 0) {
              for (const k of sharedKnowledge) {
                await saveKnowledge(k);
              }
            }
          }
        }
      } catch (error) {
        console.error('Failed to load documents:', error);
      } finally {
        setIsStorageReady(true);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (isStorageReady) {
      saveDocuments(documents).catch(err => console.error('Failed to save documents:', err));
    }
  }, [documents, isStorageReady]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === '1') {
      setIsAdmin(true);
      localStorage.setItem('is_admin_mode', 'true');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setIsAdmin(prev => {
          const newState = !prev;
          localStorage.setItem('is_admin_mode', String(newState));
          if (!newState) setIsSidebarOpen(false);
          return newState;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const checkKey = async () => {
      const aistudio = (window as any).aistudio;
      if (aistudio) {
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
          setRequiresKey(true);
        }
      }
    };
    checkKey();

    // Setup Shadow Indexer Callback
    shadowIndexer.setStatusCallback(async (docId, status) => {
      setDocuments(prev => prev.map(d => d.id === docId ? { ...d, indexingStatus: status } : d));

      // If indexing completed and we are admin, sync to Supabase
      if (status === 'completed' && isAdmin) {
        const allDocs = await loadDocuments();
        const doc = allDocs.find(d => d.id === docId);
        if (doc) {
          await supabaseService.upsertDocuments([doc]);
          // Also sync embeddings for this doc
          const allEmbeddings = await loadEmbeddings();
          const docEmbeddings = allEmbeddings.filter(e => e.documentId === docId);
          if (docEmbeddings.length > 0) {
            await supabaseService.upsertEmbeddings(docEmbeddings);
          }
        }
      }
    });

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenKeyDialog = async () => {
    const aistudio = (window as any).aistudio;
    if (aistudio) {
      await aistudio.openSelectKey();
      setRequiresKey(false);
    }
  };

  const handleRemoveAll = async () => {
    if (window.confirm('Are you sure you want to remove all files and their embeddings? This cannot be undone.')) {
      try {
        await clearAllData();
        setDocuments([]);
      } catch (error) {
        console.error('Failed to clear all data:', error);
      }
    }
  };

  const handleFileUpload = async (files: FileList | File[]) => {
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
        if (Array.isArray(result)) {
          const newDocs = result.map(data => ({
            id: Math.random().toString(36).substring(7),
            name: data.name || 'extracted_file',
            path: data.path,
            type: data.type || 'text/plain',
            size: data.content?.length || 0,
            content: data.content || '',
            status: 'ready',
            isSelected: true,
            isJoomlaManifest: data.isJoomlaManifest,
            moduleName: data.moduleName
          } as Document));
          setDocuments(prev => [...prev.filter(d => d.id !== id), ...newDocs]);
          results.push(...newDocs);
        } else {
          const updatedDoc = { ...initialDoc, ...result, status: 'ready' } as Document;
          setDocuments(prev => prev.map(d => d.id === id ? updatedDoc : d));
          results.push(updatedDoc);
        }

        // Queue for Shadow Indexing (Background)
        const docsToQueue = Array.isArray(result) ? results.slice(results.length - result.length) : [results[results.length - 1]];

        for (const doc of docsToQueue) {
          if (doc.type.startsWith('image/')) continue;

          // Set initial status
          setDocuments(prev => prev.map(d => d.id === doc.id ? { ...d, indexingStatus: 'pending' } : d));

          // Add to queue
          shadowIndexer.queueDocument(doc);
        }

      } catch (err) {
        setDocuments(prev => prev.map(d => d.id === id ? { ...d, status: 'error' } as Document : d));
      }
    }
    setIsProcessing(false);
    return results;
  };

  const handleSendMessage = async (content: string, pendingFiles?: File[]) => {
    let currentDocs = [...documents];

    // Process any files attached to this message first
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
      // 1. Check Knowledge Base (Self-Learning)
      // Only check if we are not uploading files (pure query)
      if (!pendingFiles || pendingFiles.length === 0) {
        const cachedSolution = await learningService.findSimilarSolution(content);
        if (cachedSolution) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `\n\n${cachedSolution.response.answer}`,
            issueType: cachedSolution.response.issueType,
            suggestedPatch: cachedSolution.response.suggestedPatch,
            citations: cachedSolution.response.citations,
            timestamp: Date.now()
          }]);
          setIsLoading(false);
          return; // Exit early!
        }
      }

      // Vector Search Logic
      let contextString: string | undefined = undefined;

      // Only perform vector search if we have text documents selected
      if (selectedDocs.some(d => !d.type.startsWith('image/'))) {
        try {
          const queryEmbeddings = await geminiService.getEmbeddings([content]);
          if (queryEmbeddings.length > 0) {
            const queryEmbedding = queryEmbeddings[0];
            const allChunks = await loadEmbeddings();

            const selectedDocIds = new Set(selectedDocs.map(d => d.id));
            const relevantChunks = allChunks.filter(c => selectedDocIds.has(c.documentId));

            if (relevantChunks.length > 0) {
              const topChunks = findMostRelevantChunks(queryEmbedding, relevantChunks, 15);
              contextString = topChunks
                .map(c => `--- FILE: ${documents.find(d => d.id === c.documentId)?.name} ---\n${c.content}\n`)
                .join('\n\n');
            }
          }
        } catch (e) {
          console.error("Vector search failed, falling back to full context:", e);
        }
      }

      // SMART ROUTING: Use CrewAI only for code issues, direct Gemini for docs
      const selectedCodeFiles = selectedDocs.filter(doc => doc.category === 'code');
      const selectedDocsFiles = selectedDocs.filter(doc => doc.category === 'docs');

      // Detect if query is code-related
      const codeKeywords = ['error', 'bug', 'fix', 'issue', 'not working', 'class', 'function', 'deprecated', 'fatal', 'warning', 'exception', 'undefined', 'not found'];
      const isCodeQuery = codeKeywords.some(kw => content.toLowerCase().includes(kw)) || selectedCodeFiles.length > 0;

      let response: RAGResponse;

      if (isCodeQuery && selectedCodeFiles.length > 0) {
        // CODE ISSUE → Use CrewAI (3 agents for detailed analysis)
        const tempMsgId = Date.now();
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "Processing...",
          timestamp: tempMsgId
        }]);

        response = await crewService.runCrewWorkflow(content, contextString || "", (status) => {
          setMessages(prev => prev.map(msg =>
            msg.timestamp === tempMsgId ? { ...msg, content: "Processing..." } : msg
          ));
        });

        // Update the temporary message with the final response
        setMessages(prev => prev.map(msg =>
          msg.timestamp === tempMsgId ? {
            ...msg,
            content: response.answer,
            issueType: response.issueType,
            suggestedPatch: response.suggestedPatch,
            citations: response.citations
          } : msg
        ));
      } else {
        // DOCS QUESTION → Use direct Gemini (fast, 1 call)
        response = await geminiService.queryDocuments(content, selectedDocs, contextString);

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: response.answer,
          issueType: response.issueType,
          suggestedPatch: response.suggestedPatch,
          citations: response.citations,
          timestamp: Date.now()
        }]);
      }

      // 4. Learn from this interaction
      await learningService.learnSolution(content, response);

    } catch (error: any) {
      const errorMessage = error.message || '';
      if (errorMessage.includes("Requested entity was not found") || (error.status === 404) || (error.code === 404)) {
        if (isAdmin) setRequiresKey(true);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: "System is optimizing performance. Please wait a moment.",
          timestamp: Date.now()
        }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: "Our support engine is currently busy. Please describe the issue again.", timestamp: Date.now() }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#1a1b1e] text-white overflow-hidden relative">
      {requiresKey && isAdmin && (
        <div className="absolute inset-0 bg-[#1a1b1e]/95 z-50 flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-[#1e1f22] border notebook-border p-8 rounded-2xl shadow-2xl">
            <h2 className="text-2xl font-bold mb-4">Admin API Setup</h2>
            <p className="text-gray-400 text-sm mb-4">Required: Use a paid API key for high-priority coding analysis.</p>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-purple-400 text-xs hover:underline mb-6 block">Gemini Billing Dashboard</a>
            <button onClick={handleOpenKeyDialog} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 rounded-xl transition-all shadow-lg active:scale-95">Select Paid API Key</button>
            <p className="mt-4 text-[10px] text-gray-400">Authenticated as Developer</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {isAdmin && (
          <div className={`transition-all duration-300 ease-in-out h-full overflow-hidden absolute lg:relative z-30 shadow-2xl ${isSidebarOpen ? 'w-[340px] translate-x-0' : 'w-0 -translate-x-full lg:translate-x-0 lg:w-0'}`}>
            <Sidebar
              documents={documents} onFileUpload={handleFileUpload}
              onRemoveDoc={(id) => setDocuments(d => d.filter(x => x.id !== id))}
              onRemoveAll={handleRemoveAll}
              onToggleDocSelection={(id) => setDocuments(docs => docs.map(d => d.id === id ? { ...d, isSelected: !d.isSelected } : d))}
              isProcessing={isProcessing}
              onToggleSidebar={() => setIsSidebarOpen(false)}
            />
          </div>
        )}
        <ChatWindow
          messages={messages} onSendMessage={handleSendMessage}
          onFileUpload={handleFileUpload} isLoading={isLoading}
          hasDocs={documents.some(d => d.status === 'ready')}
          selectedDocCount={documents.filter(d => d.isSelected).length}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
};

export default App;
