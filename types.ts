
export type IssueType = 'CODE_ISSUE' | 'CONFIGURATION_ISSUE' | 'UNKNOWN';

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  path?: string; // Preserve folder structure
  isJoomlaManifest?: boolean;
  moduleName?: string;
  status: 'processing' | 'ready' | 'error';
  indexingStatus?: 'pending' | 'indexing' | 'completed' | 'failed';
  isSelected: boolean;
}

export interface Citation {
  source: string;
  text: string;
  page?: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  issueType?: IssueType;
  suggestedPatch?: string;
  citations?: Citation[];
  timestamp: number;
}

export interface RAGResponse {
  answer: string;
  issueType: IssueType;
  suggestedPatch?: string;
  citations: Citation[];
}

export interface KnowledgeItem {
  id: string;
  query: string;
  response: RAGResponse;
  embedding: number[];
  timestamp: number;
}
