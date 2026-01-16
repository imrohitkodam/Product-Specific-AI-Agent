
export interface Chunk {
    id: string;
    documentId: string;
    content: string;
    startIndex: number;
    endIndex: number;
}

export const splitTextIntoChunks = (
    text: string,
    documentId: string,
    chunkSize: number = 1000,
    overlap: number = 200
): Chunk[] => {
    const chunks: Chunk[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
        let endIndex = startIndex + chunkSize;

        // If we are not at the end of the text, try to find a natural break point
        if (endIndex < text.length) {
            // Look for the last newline within the chunk to avoid breaking lines
            const lastNewLine = text.lastIndexOf('\n', endIndex);
            if (lastNewLine > startIndex + chunkSize * 0.5) { // Ensure chunk isn't too small
                endIndex = lastNewLine + 1; // Include the newline
            } else {
                // If no newline found, try space
                const lastSpace = text.lastIndexOf(' ', endIndex);
                if (lastSpace > startIndex + chunkSize * 0.5) {
                    endIndex = lastSpace + 1;
                }
            }
        } else {
            endIndex = text.length;
        }

        const content = text.slice(startIndex, endIndex);

        chunks.push({
            id: `${documentId}_${chunks.length}`,
            documentId,
            content,
            startIndex,
            endIndex
        });

        // Move start index for next chunk, accounting for overlap
        // If we reached the end, break
        if (endIndex === text.length) break;

        startIndex = Math.max(startIndex + 1, endIndex - overlap);
    }

    return chunks;
};
