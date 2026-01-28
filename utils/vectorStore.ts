
import { Chunk } from './textSplitter';

export interface EmbeddedChunk extends Chunk {
    embedding: number[];
}

// Calculate cosine similarity between two vectors
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (vecA.length !== vecB.length) {
        // Gracefully handle dimension mismatch (likely due to model switch)
        // console.warn(`Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`);
        return -1;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

export interface SearchResult extends EmbeddedChunk {
    score: number;
}

// Find top K most relevant chunks
export const findMostRelevantChunks = (
    queryEmbedding: number[],
    chunks: EmbeddedChunk[],
    topK: number = 10
): SearchResult[] => {
    const scoredChunks = chunks.map(chunk => ({
        ...chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }));

    // Sort by score descending
    scoredChunks.sort((a, b) => b.score - a.score);

    return scoredChunks.slice(0, topK);
};
