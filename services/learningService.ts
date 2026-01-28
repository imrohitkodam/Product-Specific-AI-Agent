
import { geminiService } from './geminiService';
import { cosineSimilarity } from '../utils/vectorStore';
import { RAGResponse, KnowledgeItem } from '../types';
import { supabaseService } from './supabaseService';

export class LearningService {

    // Threshold for similarity (0.95 is very strict, ensuring near-identical queries)
    private readonly SIMILARITY_THRESHOLD = 0.95;

    async findSimilarSolution(query: string): Promise<KnowledgeItem | null> {
        try {
            // 1. Generate embedding for the new query
            const embeddings = await geminiService.getEmbeddings([query]);
            if (embeddings.length === 0) return null;

            const queryEmbedding = embeddings[0];

            // 2. Load all past knowledge from Supabase
            const { knowledge: knowledgeBase } = await supabaseService.fetchAllSharedData();
            if (knowledgeBase.length === 0) return null;

            // 3. Find the best match
            let bestMatch: KnowledgeItem | null = null;
            let highestScore = -1;

            for (const item of knowledgeBase) {
                if (!item.embedding || item.embedding.length !== queryEmbedding.length) continue;
                const score = cosineSimilarity(queryEmbedding, item.embedding);
                if (score > highestScore) {
                    highestScore = score;
                    bestMatch = item as KnowledgeItem;
                }
            }

            // 4. Return if it meets the threshold
            if (highestScore >= this.SIMILARITY_THRESHOLD && bestMatch) {
                console.log(`💡 Found similar solution (Score: ${highestScore.toFixed(2)})`);
                return bestMatch;
            }

            return null;

        } catch (error) {
            console.error("Error finding similar solution:", error);
            return null;
        }
    }

    async learnSolution(query: string, response: RAGResponse): Promise<void> {
        try {
            // 1. Generate embedding for the query
            const embeddings = await geminiService.getEmbeddings([query]);
            if (embeddings.length === 0) return;

            // 2. Create Knowledge Item
            const newItem: KnowledgeItem = {
                id: Math.random().toString(36).substring(7),
                query,
                response,
                embedding: embeddings[0],
                timestamp: Date.now()
            };

            // 3. Save to Supabase (Cloud-only)
            await supabaseService.upsertKnowledge(newItem);
            console.log("🧠 Learned new solution!");

        } catch (error) {
            console.error("Error learning solution:", error);
        }
    }
}

export const learningService = new LearningService();
