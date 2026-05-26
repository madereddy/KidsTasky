// src/server/modules/magic/service.ts
import { GoogleGenAI } from '@google/genai';

export interface ExtractedEvent {
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  location?: string;
}

export const magicService = {
  parseEventsFromText: async (text: string, apiKey: string): Promise<ExtractedEvent> => {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Extract the event details from this text and output JSON with keys: title, date (YYYY-MM-DD), startTime (HH:mm), location. Text: \n${text}`;
    
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
