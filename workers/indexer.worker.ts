import { Document } from '../types';
import { geminiService } from '../services/geminiService';
import { splitTextIntoChunks } from '../utils/textSplitter';
import { EmbeddedChunk } from '../utils/vectorStore';

// Worker context
const ctx: Worker = self as any;

ctx.onmessage = async (e: MessageEvent<Document>) => {
    const doc = e.data;

    try {
        // Notify start
        ctx.postMessage({ type: 'status', docId: doc.id, status: 'indexing' });

        // 1. Chunking (CPU Heavy)
        const chunks = splitTextIntoChunks(doc.content, doc.id);

        if (chunks.length > 0) {
            // 2. Embedding (Network)
            const texts = chunks.map(c => c.content);
            const embeddings = await geminiService.getEmbeddings(texts);

            const chunksToEmbed: EmbeddedChunk[] = [];
            chunks.forEach((chunk, i) => {
                if (embeddings[i]) {
                    chunksToEmbed.push({ ...chunk, embedding: embeddings[i] });
                }
            });

            // Notify success with data
            ctx.postMessage({
                type: 'status',
                docId: doc.id,
                status: 'completed',
                chunks: chunksToEmbed
            });
        } else {
            ctx.postMessage({ type: 'status', docId: doc.id, status: 'completed' });
        }

    } catch (error) {
        console.error(`Worker Indexing failed for ${doc.name}:`, error);
        // Notify failure
        ctx.postMessage({ type: 'status', docId: doc.id, status: 'failed' });
    }
};
