
import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";
import { AnalysisResult } from "../types";

// Get API key from environment (injected by Vite)
const apiKey = (process.env.API_KEY || process.env.GEMINI_API_KEY || '').trim();
console.log('API Key check:', {
  hasApiKey: !!apiKey,
  length: apiKey.length,
  apiKeyValue: apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'empty',
  processEnvApiKey: process.env.API_KEY ? 'present' : 'missing',
  processEnvGeminiApiKey: process.env.GEMINI_API_KEY ? 'present' : 'missing'
});

if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
  console.error('WARNING: No API key found!');
  console.error('Please create a .env file in the project root with: GEMINI_API_KEY=your_api_key_here');
  console.error('Then restart the dev server.');
}

const ai = new GoogleGenAI({ apiKey });

export const analyzeResume = async (resumeText: string, jobDescriptionText: string): Promise<AnalysisResult> => {
  if (!apiKey || apiKey === 'undefined' || apiKey === 'null' || apiKey === 'your_api_key_here') {
    const errorMsg = !apiKey || apiKey === 'undefined' || apiKey === 'null'
      ? 'API key is missing. Please set GEMINI_API_KEY in your .env file and restart the dev server.'
      : 'API key is not configured. Please replace "your_api_key_here" in your .env file with your actual Gemini API key from https://aistudio.google.com/apikey';
    throw new Error(errorMsg);
  }

  // Try multiple model names in order of preference
  const modelsToTry = ['gemini-2.0-flash-exp', 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  let lastError: Error | null = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`Attempting to call Gemini API with model: ${modelName}`);
      console.log('Resume text length:', resumeText.length);
      console.log('JD text length:', jobDescriptionText.length);

      const response = await ai.models.generateContent({
        model: modelName,
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

      console.log('API Response received');
      console.log('Response text length:', response.text?.length || 0);

      if (!response.text) {
        throw new Error('No response text from API');
      }

      let rawJson;
      try {
        rawJson = JSON.parse(response.text);
        console.log('Parsed JSON successfully');
      } catch (parseError) {
        console.error('Failed to parse JSON response:', response.text);
        throw new Error(`Failed to parse API response: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
      }

      // Transform todos to include status and ID
      const transformedTodos = (rawJson.todos || []).map((t: any, idx: number) => ({
        id: `todo-${Date.now()}-${idx}`,
        title: t.title,
        status: 'to-fix' as const
      }));

      return {
        ...rawJson,
        id: `analysis-${Date.now()}`,
        timestamp: Date.now(),
        jobTitle: rawJson.identity?.role || "Untitled Role",
        todos: transformedTodos
      };
    } catch (error) {
      console.error(`Error with model ${modelName}:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
      // If it's not a model-related error, throw immediately
      if (error instanceof Error && !error.message.includes('model') && !error.message.includes('404')) {
        throw error;
      }
      // Otherwise, try the next model
      continue;
    }
  }

  // If we get here, all models failed
  throw new Error(`All model attempts failed. Last error: ${lastError?.message || 'Unknown error'}`);
};
