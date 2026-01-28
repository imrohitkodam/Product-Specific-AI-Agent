
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { Document, RAGResponse, IssueType } from "../types";

export class GeminiService {
  async getEmbeddings(texts: string[]): Promise<number[][]> {
    const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');
    const model = genAI.getGenerativeModel({ model: "models/gemini-embedding-001" });

    // Process in batches of 100 to avoid limits
    const BATCH_SIZE = 100;
    const embeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      try {
        const promises = batch.map(text =>
          model.embedContent(text)
        );

        const responses = await Promise.all(promises);

        responses.forEach((response: any) => {
          if (response.embedding && response.embedding.values) {
            embeddings.push(response.embedding.values);
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
    const genAI = new GoogleGenerativeAI(process.env.API_KEY || '');
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            issueType: {
              type: SchemaType.STRING,
              format: 'enum',
              enum: ['CODE_ISSUE', 'CONFIGURATION_ISSUE', 'UNKNOWN']
            },
            answer: { type: SchemaType.STRING },
            suggestedPatch: {
              type: SchemaType.STRING,
              description: 'Unified Diff format patch if code fix is needed'
            },
            citations: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  source: { type: SchemaType.STRING },
                  text: { type: SchemaType.STRING }
                },
                required: ["source", "text"]
              }
            }
          },
          required: ["issueType", "answer", "citations"],
        },
      }
    });

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
      const result = await model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            ...imageParts, // Correct mapping for inlineData
            { text: systemPrompt }
          ]
        }]
      });
      const responseText = result.response.text();

      const resultData = JSON.parse(responseText || '{}');
      return {
        issueType: resultData.issueType as IssueType,
        answer: resultData.answer,
        suggestedPatch: resultData.suggestedPatch,
        citations: resultData.citations || []
      };
    } catch (error: any) {
      console.error("Gemini Diagnosis Error:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();
