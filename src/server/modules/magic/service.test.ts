// src/server/modules/magic/service.test.ts
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { magicService } from './service.js';

// Mock the Gemini SDK
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ 
            title: 'School Bake Sale', 
            date: '2026-05-15', 
            startTime: '09:00',
            location: 'Main Hall'
          })
        })
      };
    }
  };
});

describe('Magic Import Service', () => {
  it('should parse text into structured event data using Gemini', async () => {
    const result = await magicService.parseEventsFromText('Bake sale on May 15 at 9am in Main Hall', 'dummy-key');
    
    expect(result.title).toBe('School Bake Sale');
    expect(result.date).toBe('2026-05-15');
    expect(result.startTime).toBe('09:00');
    expect(result.location).toBe('Main Hall');
  });
});
