import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Document, KnowledgeItem, Message } from '../types';
import { EmbeddedChunk } from '../utils/vectorStore';

export interface CloudConversation {
    id: string;
    user_id: string;
    title: string;
    created_at: number;
    updated_at: number;
}

export interface CloudChatMessage extends Message {
    id: string;
    conversation_id: string;
    user_id: string;
}

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// Lazy initialization to avoid error when env vars are not set
let supabase: SupabaseClient | null = null;
const getSupabase = (): SupabaseClient | null => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    if (!supabase) {
        supabase = createClient(supabaseUrl, supabaseAnonKey);
    }
    return supabase;
};

export class SupabaseService {
    // Auth Methods
    async signUp(email: string, pass: string) {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');
        return await client.auth.signUp({ email, password: pass });
    }

    async signIn(email: string, pass: string) {
        const client = getSupabase();
        if (!client) throw new Error('Supabase client not initialized');
        return await client.auth.signInWithPassword({ email, password: pass });
    }

    async signOut() {
        const client = getSupabase();
        if (!client) return;
        return await client.auth.signOut();
    }

    async getSession() {
        const client = getSupabase();
        if (!client) return null;
        const { data } = await client.auth.getSession();
        return data.session;
    }

    onAuthStateChange(callback: (user: User | null) => void) {
        const client = getSupabase();
        if (!client) {
            callback(null);
            return () => { };
        }
        const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
            callback(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }

    // Chat CRUD Methods
    async saveConversation(conv: CloudConversation) {
        const client = getSupabase();
        if (!client) return;
        const { error } = await client.from('conversations').upsert(conv);
        if (error) console.error('Error saving conversation:', error);
    }

    async fetchConversations(userId: string): Promise<CloudConversation[]> {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) {
            console.error('Error fetching conversations:', error);
            return [];
        }
        return data || [];
    }

    async deleteConversation(id: string) {
        const client = getSupabase();
        if (!client) return;
        const { error } = await client.from('conversations').delete().eq('id', id);
        if (error) console.error('Error deleting conversation:', error);
    }

    async saveChatMessage(msg: CloudChatMessage) {
        const client = getSupabase();
        if (!client) return;
        const { error } = await client.from('chat_messages').upsert({
            id: msg.id,
            conversation_id: msg.conversation_id,
            user_id: msg.user_id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp,
            issue_type: msg.issueType,
            suggested_patch: msg.suggestedPatch,
            citations: msg.citations
        });
        if (error) console.error('Error saving chat message:', error);
    }

    async loadChatMessages(conversationId: string): Promise<CloudChatMessage[]> {
        const client = getSupabase();
        if (!client) return [];
        const { data, error } = await client
            .from('chat_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('Error loading chat messages:', error);
            return [];
        }

        return (data || []).map(m => ({
            id: m.id,
            conversation_id: m.conversation_id,
            user_id: m.user_id,
            role: m.role,
            content: m.content,
            timestamp: m.timestamp,
            issueType: m.issue_type,
            suggestedPatch: m.suggested_patch,
            citations: m.citations
        }));
    }

    // Existing Data Methods
    async upsertDocuments(documents: Document[]) {
        const client = getSupabase();
        if (!client) return;

        const { error } = await client
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
        const client = getSupabase();
        if (!client) return;

        const { error } = await client
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
        const client = getSupabase();
        if (!client) return;

        const { error } = await client
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
        const client = getSupabase();
        if (!client) return { documents: [], embeddings: [], knowledge: [] };

        const [docsRes, embeddingsRes, knowledgeRes] = await Promise.all([
            client.from('documents').select('*'),
            client.from('embeddings').select('*'),
            client.from('knowledge_base').select('*')
        ]);

        return {
            documents: docsRes.data || [],
            embeddings: embeddingsRes.data || [],
            knowledge: knowledgeRes.data || []
        };
    }
}

export const supabaseService = new SupabaseService();
