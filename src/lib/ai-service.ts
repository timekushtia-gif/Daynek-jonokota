import { GoogleGenAI, Type } from '@google/genai';

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface AiEditorialAssistResult {
  summary: string;
  titleSuggestions: string[];
  correctedBody: string;
  suggestedTags: string[];
  keywords: string;
  riskScore: number;
  moderationNote: string;
}

export async function analyzeNewsWithAi(input: {
  title: string;
  description: string;
  category: string;
  locationText?: string;
}): Promise<AiEditorialAssistResult> {
  const ai = getAiClient();
  if (!ai) {
    throw new Error('AI editorial assistant is not configured (GEMINI_API_KEY missing).');
  }

  const prompt = `You are a Bengali and English citizen journalism editorial assistant for a local news platform in Bangladesh.
Analyze the following draft news report and provide:
1. A concise 1-2 sentence Bengali summary.
2. 3 improved, accurate, non-sensationalist Bengali headline suggestions.
3. A lightly proofread/spelling-corrected version of the body text preserving facts.
4. 4-6 relevant hashtags (without # prefix) and comma-separated SEO keywords.
5. An advisory Fake News / Spam / Hate-speech risk score from 0 to 100 (0 = clean factual local reporting, 100 = severe spam/misinformation/hate) and a short moderation note for the human Admin/Editor to review. Never auto-censor; only advise.

Title: ${input.title}
Category: ${input.category}
Location: ${input.locationText || 'Bangladesh'}
Body:
${input.description}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          titleSuggestions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          correctedBody: { type: Type.STRING },
          suggestedTags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          keywords: { type: Type.STRING },
          riskScore: { type: Type.INTEGER },
          moderationNote: { type: Type.STRING },
        },
      },
    },
  });

  const text = (response.text ?? '{}').trim();
  const parsed = JSON.parse(text) as Partial<AiEditorialAssistResult>;
  return {
    summary: parsed.summary || '',
    titleSuggestions: Array.isArray(parsed.titleSuggestions) ? parsed.titleSuggestions : [],
    correctedBody: parsed.correctedBody || input.description,
    suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
    keywords: parsed.keywords || '',
    riskScore: typeof parsed.riskScore === 'number' ? Math.max(0, Math.min(100, parsed.riskScore)) : 0,
    moderationNote: parsed.moderationNote || 'AI review completed; ready for human editorial review.',
  };
}

export async function analyzeCommentToxicity(content: string): Promise<{ isFlagged: boolean; reason: string }> {
  const ai = getAiClient();
  if (!ai) {
    return { isFlagged: false, reason: '' };
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: `Evaluate if this Bengali/English user comment contains severe spam, hate speech, slurs, or harassment requiring moderator review. Comment: "${content}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isFlagged: { type: Type.BOOLEAN },
            reason: { type: Type.STRING },
          },
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim()) as { isFlagged?: boolean; reason?: string };
    return {
      isFlagged: Boolean(parsed.isFlagged),
      reason: parsed.reason || '',
    };
  } catch {
    return { isFlagged: false, reason: '' };
  }
}
