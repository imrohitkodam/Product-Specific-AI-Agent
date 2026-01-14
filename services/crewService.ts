
import { GoogleGenAI, Type } from "@google/genai";
import { RAGResponse, IssueType } from "../types";

export class CrewService {
    private ai: GoogleGenAI;

    constructor() {
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }

    async runCrewWorkflow(query: string, context: string, onStatusUpdate?: (status: string) => void): Promise<RAGResponse> {

        // --- AGENT 1: THE ANALYST ---
        if (onStatusUpdate) onStatusUpdate("Processing...");
        console.log("--- CrewAI: Analyst Started ---");

        const analystPrompt = `
      You are an Expert System Analyst.
      
      CONTEXT:
      ${context}

      USER QUERY:
      ${query}

      TASK:
      Analyze the provided code context and user query. 
      Identify the ROOT CAUSE of the issue. 
      Do NOT write the final code fix yet. 
      Create a detailed STEP-BY-STEP PLAN for a developer to fix it.
      
      OUTPUT FORMAT:
      - Root Cause: <explanation>
      - Plan: <step 1, step 2...>
    `;

        const analystResponse = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: analystPrompt }] }
        });
        const analysis = analystResponse.text || "No analysis generated.";
        console.log("--- CrewAI: Analyst Complete ---", analysis.substring(0, 100) + "...");


        // --- AGENT 2: THE DEVELOPER ---
        if (onStatusUpdate) onStatusUpdate("Processing...");
        console.log("--- CrewAI: Developer Started ---");

        const developerPrompt = `
      You are a Senior Software Engineer.

      CONTEXT:
      ${context}

      ANALYST'S PLAN:
      ${analysis}

      TASK:
      Implement the fix strictly following the Analyst's plan.
      Generate the code changes required.
      
      OUTPUT FORMAT:
      Provide the code changes in a clear, readable format (or Unified Diff if applicable).
      Focus ONLY on the code.
    `;

        const developerResponse = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: developerPrompt }] }
        });
        const codeSolution = developerResponse.text || "No code generated.";
        console.log("--- CrewAI: Developer Complete ---", codeSolution.substring(0, 100) + "...");


        // --- AGENT 3: THE REVIEWER ---
        if (onStatusUpdate) onStatusUpdate("Processing...");
        console.log("--- CrewAI: Reviewer Started ---");

        const reviewerPrompt = `
      You are a QA Lead and Code Reviewer.

      ORIGINAL QUERY: ${query}
      ANALYST'S DIAGNOSIS: ${analysis}
      DEVELOPER'S SOLUTION: ${codeSolution}

      TASK:
      1. Review the Developer's solution against the User's Query.
      2. Ensure it actually solves the problem and introduces no new bugs.
      3. Format the final response for the user.

      OUTPUT JSON SCHEMA:
      {
        "issueType": "CODE_ISSUE" | "CONFIGURATION_ISSUE" | "UNKNOWN",
        "answer": "Detailed explanation for the user, incorporating the analysis and the solution.",
        "suggestedPatch": "The final, verified code patch (Unified Diff format preferred if possible, or just the code block)",
        "citations": []
      }
    `;

        const reviewerResponse = await this.ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: reviewerPrompt }] },
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
                        suggestedPatch: { type: Type.STRING },
                        citations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    source: { type: Type.STRING },
                                    text: { type: Type.STRING }
                                }
                            }
                        }
                    },
                    required: ["issueType", "answer", "citations"]
                }
            }
        });

        const finalResult = JSON.parse(reviewerResponse.text || '{}');
        console.log("--- CrewAI: Workflow Complete ---");

        return {
            issueType: finalResult.issueType as IssueType,
            answer: finalResult.answer,
            suggestedPatch: finalResult.suggestedPatch,
            citations: finalResult.citations || []
        };
    }
}

export const crewService = new CrewService();
