
import { createClient } from '@supabase/supabase-js';
import { Document, KnowledgeItem } from '../types';
import { EmbeddedChunk } from '../utils/vectorStore';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export class SupabaseService {
    async upsertDocuments(documents: Document[]) {
        if (!supabaseUrl || !supabaseAnonKey) return;

        const { error } = await supabase
            .from('documents')
            .upsert(documents.map(doc => ({
                id: doc.id,
                name: doc.name,
                type: doc.type,
                size: doc.size,
                content: doc.content,
                path: doc.path,
                module_name: doc.moduleName,
                is_joomla_manifest: doc.isJoomlaManifest,
                status: 'ready'
            })));

        if (error) console.error('Error syncing documents to Supabase:', error);
    }

    async upsertEmbeddings(chunks: EmbeddedChunk[]) {
        if (!supabaseUrl || !supabaseAnonKey) return;

        const { error } = await supabase
            .from('embeddings')
            .upsert(chunks.map(chunk => ({
                id: chunk.id,
                document_id: chunk.documentId,
                content: chunk.content,
                embedding: chunk.embedding,
                start_index: chunk.startIndex,
                end_index: chunk.endIndex
            })));

        if (error) console.error('Error syncing embeddings to Supabase:', error);
    }

    async upsertKnowledge(item: KnowledgeItem) {
        if (!supabaseUrl || !supabaseAnonKey) return;

        const { error } = await supabase
            .from('knowledge_base')
            .upsert({
                id: item.id,
                query: item.query,
                response: item.response,
                embedding: item.embedding,
                timestamp: item.timestamp
            });

        if (error) console.error('Error syncing knowledge to Supabase:', error);
    }

    async fetchAllSharedData() {
        if (!supabaseUrl || !supabaseAnonKey) return { documents: [], embeddings: [], knowledge: [] };

        const [docsRes, embeddingsRes, knowledgeRes] = await Promise.all([
            supabase.from('documents').select('*'),
            supabase.from('embeddings').select('*'),
            supabase.from('knowledge_base').select('*')
        ]);

        return {
            documents: docsRes.data || [],
            embeddings: embeddingsRes.data || [],
            knowledge: knowledgeRes.data || []
        };
    }
}

export const supabaseService = new SupabaseService();
