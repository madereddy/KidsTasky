# Design: Architecture & Async Data Refactor

Update documentation to reflect recent security changes and standardize frontend data fetching to reduce boilerplate and improve reliability.

## 1. Documentation Updates (Project A)

### A. Security Standards
Formalize the transition to Argon2id and the persistent lockout mechanism in `ARCHITECTURE.md`.
- **Hashing:** Mandatory Argon2id for all new credentials.
  - Memory: 64MB
  - Time Cost: 3
  - Parallelism: 4
- **Lockout Policy:** Exponential backoff persisted in `auth_lockouts`.
  - Attempts 1-5: No delay.
  - Attempt 6: 1 minute.
  - Attempt 7: 5 minutes.
  - Attempt 8: 15 minutes.
  - Attempt 9: 1 hour.
  - Attempt 10+: 24 hours.

### B. The "Metadata Delimiter" Strategy
Document the current approach for extending SQLite schemas without migrations for list items.
- Format: `[clean_text] |META:[json_payload]|`
- Purpose: Stores `storeName`, `locationName`, and `completedAt` inside the `text` field.
- Governance: This is considered a "Strangler-Fig" transitional state; new features with high data volume should still use proper columns.

## 2. Standardizing Data Fetching (Project B)

### A. The `useAsyncData` Hook
Create a robust, reusable hook in `src/hooks/useAsyncData.ts`.

**Signature:**
```typescript
interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

function useAsyncData<T>(
  fetchFn: () => Promise<T>,
  deps: any[] = [],
  options?: { 
    onSuccess?: (data: T) => void;
    onError?: (err: Error) => void;
    initialData?: T;
  }
): AsyncDataState<T>;
```

**Features:**
- **Race Condition Guard:** Uses a local `active` flag to ignore results if the component unmounts or dependencies change during an in-flight request.
- **Error Normalization:** Ensures all errors are caught and surfaced consistently.
- **Client Logging:** Automatically logs fetch failures to `clientLogger`.

## 3. Implementation Stages

1. **Stage 1 (Docs):** Update `ARCHITECTURE.md` and `CLAUDE.md` (if applicable) with the new standards.
2. **Stage 2 (Logic):** Implement `useAsyncData` and add a comprehensive test suite (`useAsyncData.test.ts`).
3. **Stage 3 (Pilot Refactor):** Migrate `useParentDashboardController.ts` to use `useAsyncData`.
4. **Stage 4 (Expansion):** Incrementally migrate other controllers (`useWallHomeController`, `useMissionTodayController`).

## 4. Verification Plan

### Automated Tests
- **Unit Test:** `useAsyncData` tests covering:
  - Initial loading state.
  - Successful data resolution.
  - Error handling and logging.
  - Race condition prevention (changing deps mid-fetch).
- **Integration Test:** Ensure `useParentDashboardController` still passes its existing test suite after refactoring.

### Manual Verification
- Verify loading spinners still appear correctly.
- Verify that "Session Expired" (401) errors still trigger the login redirect via the underlying `fetchAPI` utility.
