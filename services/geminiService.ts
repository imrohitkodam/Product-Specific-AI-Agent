
import { GoogleGenAI, Type } from "@google/genai";
import { Document, RAGResponse, IssueType } from "../types";

export class GeminiService {
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Process in batches of 100 to avoid limits
    const BATCH_SIZE = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      try {
        const promises = batch.map(text =>
          ai.models.embedContent({
            model: 'embedding-001',
            contents: { parts: [{ text }] }
          })
        );

        const responses = await Promise.all(promises);

        responses.forEach((response: any) => {
          if (response.embedding && response.embedding.values) {
            embeddings.push(response.embedding.values);
          } else if (response.embeddings && response.embeddings.length > 0) {
            embeddings.push(response.embeddings[0].values);
          }
        });
      } catch (error) {
        console.error('Embedding error:', error);
        throw error;
      }
    }

    return embeddings;
  }

  async queryDocuments(query: string, documents: Document[], relevantContext?: string): Promise<RAGResponse> {
    console.log("Using API Key:", process.env.API_KEY?.substring(0, 10) + "...");
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Separate text documents from image documents
    const textContext = relevantContext || documents
      .filter(doc => doc.status === 'ready' && !doc.type.startsWith('image/'))
      .map(doc => `--- FILE: ${doc.path} (Module: ${doc.moduleName}) ---\n${doc.content}\n`)
      .join('\n\n');

    const imageParts = documents
      .filter(doc => doc.status === 'ready' && doc.type.startsWith('image/'))
      .map(doc => ({
        inlineData: {
          mimeType: doc.type,
          data: doc.content // This is the base64 string
        }
      }));

    const systemPrompt = `
      You are a Senior Technical Support Engineer specializing in Joomla and modern web stacks.
      
      TASK:
      1. Examine the user query and ALL provided materials (source code AND screenshots).
      2. If screenshots are provided, SCAN them carefully for error messages, stack traces, or UI glitches.
      3. Classify the issue:
         - CODE_ISSUE: Syntax errors, logic bugs, deprecated methods found in code or revealed in screenshot stack traces.
         - CONFIGURATION_ISSUE: Missing files, permission errors, incorrect manifest settings, or database connectivity issues shown in UI screenshots.
      4. Provide a detailed answer explaining WHY this is happening.
      5. If CODE_ISSUE: provide a 'suggestedPatch' in Unified Diff format.
      6. If CONFIGURATION_ISSUE: provide clear resolution steps.

      USER QUERY: ${query}

      CODEBASE CONTEXT:
      ${textContext}
    `;

    try {
      const contents = {
        parts: [
          ...imageParts,
          { text: systemPrompt }
        ]
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              issueType: {
                type: Type.STRING,
                enum: ['CODE_ISSUE', 'CONFIGURATION_ISSUE', 'UNKNOWN']
              },
              answer: { type: Type.STRING },
              suggestedPatch: {
                type: Type.STRING,
                description: 'Unified Diff format patch if code fix is needed'
              },
              citations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    source: { type: Type.STRING },
                    text: { type: Type.STRING }
                  },
                  required: ["source", "text"]
                }
              }
            },
            required: ["issueType", "answer", "citations"],
          },
        },
      });

      const result = JSON.parse(response.text || '{}');
      return {
        issueType: result.issueType as IssueType,
        answer: result.answer,
        suggestedPatch: result.suggestedPatch,
        citations: result.citations || []
      };
    } catch (error: any) {
      console.error("Gemini Diagnosis Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
