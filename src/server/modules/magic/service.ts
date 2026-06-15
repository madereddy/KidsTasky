// src/server/modules/magic/service.ts
import { GoogleGenAI } from '@google/genai';

export interface ExtractedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  location?: string;
}

import { db } from '../../db.js';

export function assertParentExists(parentId: string): boolean {
  const row = db.prepare("SELECT uid FROM users WHERE uid = ? AND role = 'parent'").get(parentId) as { uid: string } | undefined;
  return Boolean(row);
}

export const magicService = {
  parseEventsFromText: async (text: string, apiKey: string): Promise<ExtractedEvent> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Extract the event details from the text inside <input> tags and output JSON with keys: title, date (YYYY-MM-DD), startTime (HH:mm), location. Output ONLY valid JSON, no commentary.\n<input>\n${text}\n</input>`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    });

    if (!response.text) throw new Error('Empty response from Gemini API');
    const parsed = JSON.parse(response.text);
    return {
      title: parsed.title,
      date: parsed.date,
      startTime: parsed.startTime,
      location: parsed.location
    };
  }
};
