# Normalize Express Route Handlers Returns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure all code paths in Express handlers and middleware explicitly return a value (e.g., `return res.json(...)`) to satisfy the `noImplicitReturns` TypeScript rule.

**Architecture:** We will systematically apply text replacements file by file, targeting all instances of terminal `res.json`, `res.status().json`, and `next()` calls that lack a preceding `return`.

**Tech Stack:** TypeScript, Express

---

### Task 1: Normalize `tasks` module routes

**Files:**
- Modify: `src/server/modules/tasks/routes.ts`

- [ ] **Step 1: Update validation middleware**
Add `return` to `next()` in the `validate` middleware.

- [ ] **Step 2: Update all task route handlers**
Add `return` to all instances of `res.json(...)` and `res.status(...).json(...)` at the end of `try` blocks and in all `catch` blocks.

### Task 2: Normalize `users` module routes

**Files:**
- Modify: `src/server/modules/users/routes.ts`

- [ ] **Step 1: Update validation middleware**
Add `return` to `next()` in the `validate` middleware.

- [ ] **Step 2: Update all user route handlers**
Add `return` to all instances of `res.json(...)` and `res.status(...).json(...)` at the end of `try` blocks and in all `catch` blocks. (e.g. `res.json({ success: true })` becomes `return res.json({ success: true })`)

### Task 3: Normalize `weather` module routes

**Files:**
- Modify: `src/server/modules/weather/routes.ts`

- [ ] **Step 1: Update all weather route handlers**
Add `return` to `res.json(...)` in the `try` block and the `catch` block.
