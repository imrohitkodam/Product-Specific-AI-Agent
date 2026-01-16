
import { Document } from '../types';

type StatusCallback = (docId: string, status: 'indexing' | 'completed' | 'failed') => void;

export class ShadowIndexer {
    private queue: Document[] = [];
    private activeWorkers = 0;
    private readonly MAX_CONCURRENT = 3;
    private onStatusUpdate: StatusCallback | null = null;
    private worker: Worker;

    constructor() {
        // Initialize Web Worker
        this.worker = new Worker(new URL('../workers/indexer.worker.ts', import.meta.url), { type: 'module' });

        this.worker.onmessage = (e) => {
            const { type, docId, status } = e.data;
            if (type === 'status') {
                if (this.onStatusUpdate) this.onStatusUpdate(docId, status);

                if (status === 'completed' || status === 'failed') {
                    this.activeWorkers--;
                    this.processNext();
                }
            }
        };
    }

    setStatusCallback(callback: StatusCallback) {
        this.onStatusUpdate = callback;
    }

    queueDocument(doc: Document) {
        // Only queue if it's a text file and not an image
        if (doc.type.startsWith('image/')) return;

        this.queue.push(doc);
        this.processNext();
    }

    private processNext() {
        if (this.activeWorkers >= this.MAX_CONCURRENT || this.queue.length === 0) {
            return;
        }

        const doc = this.queue.shift();
        if (!doc) return;

        this.activeWorkers++;

        // Send to Worker
        this.worker.postMessage(doc);
    }

    getQueueLength() {
        return this.queue.length;
    }

    getActiveCount() {
        return this.activeWorkers;
    }
}

export const shadowIndexer = new ShadowIndexer();
