---
name: KidTasky
description: Family mission control that keeps chores engaging for kids and controllable for parents.
colors:
  primary-sky: "#0ea5e9"
  accent-blue: "#3b82f6"
  success-mint: "#10b981"
  warning-amber: "#f59e0b"
  danger-rose: "#f43f5e"
  bg-night: "#05070a"
  bg-night-elevated: "#1e293b"
  surface-dark-glass: "#0f172a99"
  surface-light: "#ffffff"
  text-on-dark: "#e2e8f0"
  text-on-light: "#0f172a"
  text-muted-dark: "#94a3b8"
  text-muted-light: "#475569"
  border-dark: "#33415580"
  border-light: "#e2e8f0"
typography:
  display:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.875rem, 3vw, 2.5rem)"
    fontWeight: 900
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "12px"
  md: "16px"
  lg: "24px"
  xl: "32px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent-blue}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-sky}"
    textColor: "{colors.surface-light}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  input-immersive:
    backgroundColor: "{colors.surface-dark-glass}"
    textColor: "{colors.text-on-dark}"
    rounded: "{rounded.sm}"
    padding: "12px 16px"
  panel-dark:
    backgroundColor: "{colors.surface-dark-glass}"
    textColor: "{colors.text-on-dark}"
    rounded: "{rounded.lg}"
    padding: "24px"
  panel-light:
    backgroundColor: "{colors.surface-light}"
    textColor: "{colors.text-on-light}"
    rounded: "{rounded.lg}"
    padding: "24px"
---

# Design System: KidTasky

## 1. Overview

**Creative North Star: "Skylight Mission Board"**

KidTasky is a shared family control surface, not a generic productivity dashboard. Parents need fast command clarity, kids need momentum and positive feedback. The system uses high-contrast mission-style framing, bright sky accents, and clear status language that always answers: what is next, what is complete, and what needs attention now.

The visual voice stays playful but disciplined. Surfaces can be dark or light depending on theme, but readability is never negotiable. Every panel must carry an explicit foreground/background pairing instead of inheriting color from parent containers.

This system explicitly rejects generic B2B SaaS chrome, sterile enterprise UI tone, and dense admin-first layouts that suppress kid engagement.

**Key Characteristics:**
- Family-first clarity across parent and kid roles
- High-contrast text and controls in every theme
- Motivational accents used intentionally, not everywhere
- Soft rounded geometry with strong state cues
- Fast-scan hierarchy for busy routines

## 2. Colors

The palette is anchored in sky blue motivation with clear dark/light surface rules for legibility.

### Primary
- **Mission Sky** (`#0ea5e9`): Primary action emphasis, active states, progress accents.
- **Command Blue** (`#3b82f6`): Primary button fill and high-attention interactive elements.

### Secondary
- **Mint Success** (`#10b981`): Positive confirmation, completed flows, reward success.
- **Amber Alert** (`#f59e0b`): Warning, urgency, streak and attention markers.
- **Rose Alert** (`#f43f5e`): Overdue, destructive actions, critical negative states.

### Neutral
- **Night Core** (`#05070a`): Dark theme canvas.
- **Night Lift** (`#1e293b`): Elevated dark gradients and background transitions.
- **Dark Glass Surface** (`#0f172a99`): Frosted panel container over dark backgrounds.
- **Light Surface** (`#ffffff`): Primary light cards and controls.
- **Text On Dark** (`#e2e8f0`): Default readable text on dark surfaces.
- **Text On Light** (`#0f172a`): Default readable text on light surfaces.
- **Muted On Dark** (`#94a3b8`): Secondary supporting text on dark surfaces.
- **Muted On Light** (`#475569`): Secondary supporting text on light surfaces.

**The Explicit Pairing Rule.** Every surface token must specify its matching text token (`text-on-dark` or `text-on-light`) in the component. Inherited text color is prohibited.

## 3. Typography

**Display Font:** Inter (fallback: `ui-sans-serif, system-ui, sans-serif`)  
**Body Font:** Inter (fallback: `ui-sans-serif, system-ui, sans-serif`)  
**Label Font:** Inter, uppercase tracking for compact status language

**Character:** Bold, clean, and mission-oriented. Typography should feel energetic for kids and operational for parents.

### Hierarchy
- **Display** (900, `clamp(1.875rem, 3vw, 2.5rem)`, 1.1): Major section and completion moments.
- **Title** (700, `1.25rem`, 1.3): Card and module headings.
- **Body** (400, `1rem`, 1.6): Explanatory and general content; keep line length under 72ch.
- **Label** (700, `0.75rem`, 1.2, `0.08em` letter spacing): Chips, metadata, status tags, nav utility labels.

**The Fast Scan Rule.** Status-critical text must use title or label styles with strong contrast, never muted body styling.

## 4. Elevation

KidTasky uses a hybrid of frosted dark panels and clean light cards. Depth is communicated through soft blur and restrained glow, not heavy drop shadows.

### Shadow Vocabulary
- **Blue Glow** (`0 0 20px rgba(59, 130, 246, 0.4)`): Mission-primary emphasis.
- **Green Glow** (`0 0 20px rgba(16, 185, 129, 0.4)`): Positive reward or completion emphasis.
- **Orange Glow** (`0 0 30px rgba(245, 158, 11, 0.5)`): Warning-level emphasis.

**The Contrast Before Glow Rule.** Glows are decorative reinforcement only. If text contrast fails, glow must not be used to compensate.

## 5. Components

### Buttons
- **Shape:** Rounded rectangle (`12px`).
- **Primary:** `Command Blue` background (`#3b82f6`) with white text (`#ffffff`), bold uppercase labels.
- **Hover / Focus:** Shift to `Mission Sky` (`#0ea5e9`) and keep text white; visible focus ring required.
- **Disabled:** Reduce opacity only after ensuring text still passes WCAG AA against button background.

### Panels and Cards
- **Dark Panel:** `Dark Glass Surface` (`#0f172a99`) with `Text On Dark` (`#e2e8f0`), border (`#33415580`), blur allowed.
- **Light Panel:** `Light Surface` (`#ffffff`) with `Text On Light` (`#0f172a`), subtle neutral border (`#e2e8f0`).
- **Corner Style:** Large rounded containers (`24px` to `32px`) for family-friendly softness.
- **Prohibition:** Mixing light panel background with dark-theme inherited muted text is prohibited.

### Inputs
- **Style:** Dark input default uses translucent dark fill with explicit light foreground text.
- **Focus:** Ring with sky/blue accent, not only border shift.
- **Placeholder:** Must remain readable against input fill and never be the same value as background-adjacent body text.

### Navigation
- **Segmented Tabs:** Active tab uses primary accent with explicit white text.
- **Inactive Tabs:** Neutral muted text with sufficient contrast on tab background.
- **Role Context:** Parent and kid navigation should share shape language while changing tone and vocabulary.

## 6. Do's and Don'ts

### Do:
- **Do** assign explicit text color tokens for every surface token pair in components and utilities.
- **Do** target WCAG AA minimum for body text and controls in both dark and light themes.
- **Do** keep action emphasis concentrated in sky/blue accents so progress and CTAs remain obvious.
- **Do** preserve playful language and visual momentum for kid-facing experiences without reducing clarity.

### Don't:
- **Don't** ship generic B2B SaaS visual patterns or sterile enterprise styling.
- **Don't** use inherited text color inside mixed dark/light boxes, this is the root cause of unreadable panels.
- **Don't** rely on low-opacity slate text on tinted or translucent surfaces.
- **Don't** bury kid motivation under dense admin-heavy card stacks and tiny metadata-first UI.

## 7. Dark Theme Contrast Rules

These rules were established after identifying six critical readability failures in the `space_commander` (dark) theme. They are enforced via CSS bridge rules in `src/index.css`.

### Problem 1: White containers on dark body
**Root cause:** Components used hardcoded `bg-white` which rendered opaque white boxes on the dark radial gradient body.
**Fix:** `.theme-dark .bg-white` remaps to `rgba(15, 23, 42, 0.92)` — an elevated dark surface with enough opacity to separate from body while staying in the dark palette.

### Problem 2: Panels indistinguishable from background
**Root cause:** `bg-ui-soft` was `rgba(15, 23, 42, 0.72)` — nearly identical to the body gradient center color `#1e293b`.
**Fix:** Increased `bg-ui-soft` to `rgba(30, 41, 59, 0.85)` and `bg-ui-soft-2` to `rgba(51, 65, 85, 0.85)`. Also increased border opacity from 0.45 to 0.55 for `border-ui-soft` and 0.5 to 0.6 for `border-ui`.

### Problem 3: Light accent tints invisible on dark
**Root cause:** `bg-blue-50`, `bg-amber-50`, `bg-emerald-50`, `bg-rose-50` are near-white tints that look correct on light backgrounds but create jarring white patches on dark.
**Fix:** CSS bridge remaps these to 10% opacity accent colors (e.g., `bg-blue-50` becomes `rgba(59, 130, 246, 0.1)`).

### Problem 4: Input fields invisible
**Root cause:** `input-immersive` used `bg-slate-900/50` with `placeholder:text-slate-600` — placeholder was darker than the background.
**Fix:** Dark-mode override sets input background to `rgba(30, 41, 59, 0.7)`, border to `rgba(100, 116, 139, 0.5)`, text to `#f1f5f9`, placeholder to `#94a3b8`. Non-immersive inputs also get a generic dark-mode rule.

### Problem 5: Section headers too small
**Root cause:** Headers like "MISSION REWARDS" used `text-xl` which was adequate but not prominent against busy dark layouts.
**Fix:** Bumped to `text-2xl` for primary section headers in manager components.

### Problem 6: Gray utility classes not theme-aware
**Root cause:** `ListSidebar` used raw `text-gray-*` and `bg-gray-*` classes that are not covered by the slate-to-token bridge.
**Fix:** Replaced all `gray-*` utilities with semantic `text-ui-*`, `bg-ui-*`, and `border-ui` tokens that respond to `.theme-dark` overrides.

### CSS Bridge Architecture
The dark-mode bridge in `index.css` works in three layers:
1. **CSS custom properties** (`.theme-dark { --ui-bg-soft: ... }`) — define token values per theme.
2. **Semantic utility overrides** (`.theme-dark .bg-ui-soft`) — apply tokens to design-system classes.
3. **Slate/white bridge** (`.theme-dark .bg-white`, `.theme-dark .bg-slate-50`) — catch hardcoded Tailwind classes from components that haven't migrated to semantic tokens.

New components should use semantic tokens (`bg-ui-soft`, `text-ui-primary`, `border-ui`) instead of raw Tailwind colors. The bridge exists for backward compatibility only.
