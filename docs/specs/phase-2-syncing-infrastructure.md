# Phase 2: Syncing & API Integrations

## Objective
Seamlessly bridge the application with external calendars and data sources to make it a true "smart display" for the family. 

## Core Features to Implement

### 1. External Calendar Syncing
- **OAuth Providers:** Google Calendar, Apple iCloud Calendar, Outlook/Microsoft Graph.
- **Sync Engine (`/src/server/worker.ts`):** 
  - Background polling or webhook listener for third-party calendar updates.
  - De-duplication logic (matching remote event IDs to local shadow records).
  - Bi-directional sync capability (optional initially, but reading is mandatory).
- **UI Management:** A "Connected Accounts" settings page for parents to authenticate and choose which external calendars to import.

### 2. Weather Integration
- **Geolocation/Zip Code Setting:** Allow parents to set a primary location.
- **Weather API Integration:** (e.g., OpenWeatherMap or WeatherAPI).
- **UI Display:** 
  - Overarching weekly forecast embedded into the top of the Calendar View.
  - Event-specific weather previews (e.g., if a soccer game is scheduled at 4 PM on Saturday, fetch the localized forecast for that time block).

## Success Criteria
- Users can authenticate with Google Calendar and see their external events appear in the family calendar alongside local events.
- Weather icons and temperature predictions are correctly mapped to days in the week view.
