
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Message } from '../types';
import { CodePatchViewer } from './CodePatchViewer';

interface ChatWindowProps {
  messages: Message[];
  onSendMessage: (content: string, pendingFiles?: File[]) => void;
  onFileUpload: (files: FileList) => void;
  isLoading: boolean;
  hasDocs: boolean;
  selectedDocCount: number;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  onToggleChatSidebar: () => void;
  isChatSidebarOpen: boolean;
  isAdmin: boolean;
}

const SparkleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0 mt-1">
    <path d="M12 4L14.5 9.5L20 12L14.5 14.5L12 20L9.5 14.5L4 12L9.5 9.5L12 4Z" fill="url(#sparkle-gradient)" />
    <defs>
      <linearGradient id="sparkle-gradient" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4285F4" />
        <stop offset="1" stopColor="#9B72CB" />
      </linearGradient>
    </defs>
  </svg>
);

const CopyButton = ({ text }: { text: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
      title={isCopied ? "Copied!" : "Copy response"}
    >
      {isCopied ? (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      )}
    </button>
  );
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  messages, onSendMessage, onFileUpload, isLoading, hasDocs, selectedDocCount,
  onToggleSidebar, isSidebarOpen, onToggleChatSidebar, isChatSidebarOpen, isAdmin
}) => {
  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || pendingFiles.length > 0) && !isLoading) {
      onSendMessage(input, pendingFiles);
      setInput('');
      setPendingFiles([]);
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setPendingFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#131314] text-[#e3e3e3] font-sans relative">
      {/* Header */}
      <div className="flex items-center px-4 py-3 justify-between z-10 absolute top-0 left-0 right-0">
        <div className="flex items-center gap-2">
          {/* Chat History Toggle (Left) */}
          <button
            onClick={onToggleChatSidebar}
            className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isChatSidebarOpen ? 'bg-white/10' : ''}`}
            title="Chat History"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>

          {isAdmin && (
            <button
              onClick={onToggleSidebar}
              className={`p-2 rounded-full hover:bg-white/10 transition-colors ${isSidebarOpen ? 'bg-white/10' : ''}`}
              title="Knowledge Base"
            >
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col pt-16 pb-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            <h1 className="text-5xl md:text-6xl font-medium mb-8 bg-gradient-to-r from-[#4285f4] via-[#9b72cb] to-[#d96570] bg-clip-text text-transparent tracking-tight">
              Hello, User
            </h1>
            <p className="text-[#c4c7c5] text-xl md:text-2xl font-medium mb-12 text-center max-w-2xl">
              How can I help you today?
            </p>

            {/* Suggestion Cards */}
            {/* <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-4xl w-full px-4">
              {[
                { icon: 'code', text: 'Debug React code' },
                { icon: 'lightbulb', text: 'Explain a concept' },
                { icon: 'image', text: 'Analyze an image' },
                { icon: 'edit', text: 'Write a story' }
              ].map((item, i) => (
                <button key={i} className="bg-[#1e1f20] hover:bg-[#28292a] p-4 rounded-xl text-left transition-colors group h-32 flex flex-col justify-between">
                  <span className="text-[#e3e3e3] text-sm font-medium">{item.text}</span>
                  <div className="self-end p-2 rounded-full bg-[#131314] group-hover:bg-white/10 transition-colors">
                    <svg className="w-5 h-5 text-[#c4c7c5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {item.icon === 'code' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />}
                      {item.icon === 'lightbulb' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />}
                      {item.icon === 'image' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />}
                      {item.icon === 'edit' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />}
                    </svg>
                  </div>
                </button>
              ))}
            </div> */}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto w-full px-4 space-y-8">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>

                <div className={`flex flex-col max-w-[100%] ${msg.role === 'user' ? 'items-end' : 'items-start w-full'}`}>
                  {msg.role === 'assistant' && (
                    <div className="mb-1">
                      <SparkleIcon />
                    </div>
                  )}
                  {msg.role === 'user' ? (
                    <div className="group/user relative">
                      <div className="bg-[#282a2c] text-[#e3e3e3] px-5 py-3 rounded-[20px] rounded-tr-sm text-[15px] leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </div>
                      {/* Edit & Copy buttons on hover */}
                      <div className="absolute -bottom-8 right-0 opacity-0 group-hover/user:opacity-100 transition-opacity flex gap-2">
                        <button
                          onClick={() => {
                            setInput(msg.content);
                            textareaRef.current?.focus();
                          }}
                          className="p-2 bg-[#1e1f20] hover:bg-[#282a2c] rounded-lg border border-gray-800 transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => navigator.clipboard.writeText(msg.content)}
                          className="p-2 bg-[#1e1f20] hover:bg-[#282a2c] rounded-lg border border-gray-800 transition-colors"
                          title="Copy"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[#e3e3e3] text-[15px] leading-relaxed group/msg markdown-content">
                      <ReactMarkdown
                        components={{
                          h1: ({ node, ...props }) => <h1 className="text-2xl font-bold mb-4 mt-6 text-white" {...props} />,
                          h2: ({ node, ...props }) => <h2 className="text-xl font-bold mb-3 mt-5 text-white" {...props} />,
                          h3: ({ node, ...props }) => <h3 className="text-lg font-bold mb-2 mt-4 text-white" {...props} />,
                          ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-0.5" {...props} />,
                          ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5" {...props} />,
                          li: ({ node, ...props }) => <li className="mb-0.5 leading-relaxed pl-1" {...props} />,
                          p: ({ node, ...props }) => <p className="mb-2 leading-relaxed last:mb-0" {...props} />,
                          strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                          code: ({ node, ...props }) => {
                            const match = /language-(\w+)/.exec(props.className || '')
                            return match ? (
                              <div className="rounded-lg overflow-hidden my-4 bg-[#1e1f20] border border-white/10">
                                <div className="bg-[#2d2e30] px-4 py-2 text-xs text-gray-400 border-b border-white/5 font-mono flex justify-between items-center">
                                  <span>{match[1]}</span>
                                </div>
                                <code className="block p-4 text-sm font-mono overflow-x-auto" {...props} />
                              </div>
                            ) : (
                              <code className="bg-[#1e1f20] px-1.5 py-0.5 rounded text-sm font-mono text-gray-300" {...props} />
                            )
                          }
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      {msg.suggestedPatch && isAdmin && (
                        <CodePatchViewer patchText={msg.suggestedPatch} />
                      )}
                      <div className="mt-2 opacity-0 group-hover/msg:opacity-100 transition-opacity flex gap-2">
                        <CopyButton text={msg.content} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}


            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex gap-4">
                <div className="flex flex-col items-start w-full">
                  <div className="mb-1">
                    {/* <SparkleIcon /> */}
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                    <span className="text-sm">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Section */}
      <div className="w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
        <div className="bg-[#1e1f20] rounded-[28px] p-2 transition-all shadow-lg relative">
          {/* Pending Files */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 px-4 pt-2 pb-1">
              {pendingFiles.map((file, idx) => (
                <div key={idx} className="relative group/file bg-[#282a2c] border border-white/5 rounded-md p-1.5 flex items-center gap-2 pr-6">
                  <span className="text-[11px] text-gray-300 truncate max-w-[120px]">{file.name}</span>
                  <button onClick={() => removePendingFile(idx)} className="absolute right-1 top-1 p-0.5 text-gray-500 hover:text-white transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-[#c4c7c5] hover:text-[#e3e3e3] hover:bg-[#282a2c] rounded-full transition-colors mb-1 ml-1"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              accept="image/*,.pdf,.txt,.md,.php,.xml,.json"
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI"
              className="w-full bg-transparent border-none focus:ring-0 focus:outline-none outline-none text-[#e3e3e3] placeholder-[#c4c7c5] py-3.5 px-2 resize-none max-h-60 min-h-[56px] text-[16px]"
              rows={1}
            />

            {(input.trim() || pendingFiles.length > 0) && (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="p-3 bg-purple-600 hover:bg-purple-500 text-white rounded-full transition-all mb-1 mr-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div className="text-center mt-3">
          <p className="text-[11px] text-[#c4c7c5]">AI can make mistakes, so double-check it</p>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3c4043;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #5f6368;
        }
        textarea:focus, input:focus, select:focus, button:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
};

export default ChatWindow;
