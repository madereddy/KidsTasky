# Architecture & Async Data Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize frontend data fetching and update system documentation to reflect current security and data strategies.

**Architecture:** We will introduce a `useAsyncData` hook to centralize loading, error, and race-condition handling. This hook will then be used to refactor existing controller hooks, starting with the Parent Dashboard.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library.

---

### Task 1: Update Architecture Documentation

**Files:**
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Update Security and Data Strategy sections**
- [ ] **Step 2: Commit documentation changes**

---

### Task 2: Implement `useAsyncData` Hook (TDD)

**Files:**
- Create: `src/hooks/useAsyncData.ts`
- Create: `src/hooks/useAsyncData.test.ts`

- [ ] **Step 1: Write failing tests for `useAsyncData`**
- [ ] **Step 2: Run tests to verify failure**
- [ ] **Step 3: Implement `useAsyncData` hook**
- [ ] **Step 4: Run tests to verify they pass**
- [ ] **Step 5: Commit the new hook**

---

### Task 3: Pilot Refactor - `useParentDashboardController`

**Files:**
- Modify: `src/hooks/useParentDashboardController.ts`

- [ ] **Step 1: Migrate `useParentDashboardController` to `useAsyncData`**
- [ ] **Step 2: Run existing controller tests**
- [ ] **Step 3: Commit refactor**
