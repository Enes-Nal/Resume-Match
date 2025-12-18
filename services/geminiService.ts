
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { AnalysisResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeResume = async (resumeText: string, jobDescriptionText: string): Promise<AnalysisResult> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `
      RESUME:
      ${resumeText}

      JOB DESCRIPTION:
      ${jobDescriptionText}
    `,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          matchScore: { type: Type.NUMBER },
          identity: {
            type: Type.OBJECT,
            properties: {
              role: { type: Type.STRING },
              confidence: { type: Type.STRING }
            },
            required: ["role", "confidence"]
          },
          signals: {
            type: Type.OBJECT,
            properties: {
              strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
              concerns: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["strengths", "concerns"]
          },
          skillAlignment: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                skill: { type: Type.STRING },
                match: { type: Type.NUMBER }
              },
              required: ["skill", "match"]
            }
          },
          experienceRelevance: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                item: { type: Type.STRING },
                feedback: { type: Type.STRING }
              },
              required: ["item", "feedback"]
            }
          },
          missingSignals: { type: Type.ARRAY, items: { type: Type.STRING } },
          resumeInsights: {
            type: Type.OBJECT,
            properties: {
              coherence: { type: Type.STRING },
              seniority: { type: Type.STRING },
              focusScore: { type: Type.NUMBER },
              redFlags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["coherence", "seniority", "focusScore", "redFlags"]
          },
          todos: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING }
              },
              required: ["title"]
            }
          }
        },
        required: ["matchScore", "identity", "signals", "skillAlignment", "experienceRelevance", "missingSignals", "resumeInsights", "todos"]
      }
    }
  });

  const rawJson = JSON.parse(response.text || "{}");
  
  // Transform todos to include status and ID
  const transformedTodos = (rawJson.todos || []).map((t: any, idx: number) => ({
    id: `todo-${Date.now()}-${idx}`,
    title: t.title,
    status: 'to-fix'
  }));

  return {
    ...rawJson,
    id: `analysis-${Date.now()}`,
    timestamp: Date.now(),
    jobTitle: rawJson.identity?.role || "Untitled Role",
    todos: transformedTodos
  };
};
