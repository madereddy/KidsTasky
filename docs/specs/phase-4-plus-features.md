# Phase 4: Plus Features & AI Automation

## Objective
Implement premium, high-value features that elevate the calendar from a digital planner to a smart household manager. 

## Core Features to Implement

### 1. Meal Planning
- **Meal Database:** Allow parents to input/upload recipes.
- **Calendar Allocation:** Specialized event types for Breakfast, Lunch, Dinner, and Snacks.
- **Grocery Integration:** "Add Recipe to Grocery List" functionality.

### 2. Photo Screensaver
- **Asset Storage:** Upload mechanism for family photos (cloud storage bucket/blob).
- **Idle Detection:** If the screen has no inputs for X minutes (and is not in Sleep Mode), trigger a slideshow component.
- **Transitions:** Smooth fade-ins between photos. Tapping the screen instantly returns to the calendar.

### 3. Magic Import (AI Powered)
- **Ingestion Pipeline:** 
  - Standardized specific email address (e.g., `family-xyz123@yourdomain.com`).
  - Webhook to receive incoming emails (via SendGrid/Mailgun).
- **Processing (GenAI):** Use Google Gemini API (`@google/genai`) to parse forwarded emails (e.g., a newsletter from the school or a PDF soccer schedule) or uploaded photos of physical flyers.
- **Structured Output:** Extract dates, times, titles, and locations, automatically outputting JSON to create shadow events awaiting parental approval.

### 4. Advanced Rewards & Chores
- **Deep Integration:** Tie the existing task and rewards engine deeply into the daily view. Connect task completion streaks to automated high-value rewards.

## Success Criteria
- The idle screen functions as a digital picture frame.
- Families can forward a school newsletter and the system extracts exactly when the "Bake Sale" is, plotting it on the calendar for approval.
- Weekly meal plans are visible natively on the calendar UI.
