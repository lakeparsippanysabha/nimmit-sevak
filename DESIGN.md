# Nimit Sevak - Engineering Design Document

## 1. Project Vision
Nimit Sevak is a high-performance, warm-minimalist CRM and spiritual management application built for high agency and reliability. The design priority is **visual excellence** combined with **robust data integrity**.

---

## 2. Technology Stack
- **Framework**: [TanStack Start](https://tanstack.com/start) (Full-stack React with Nitro engine).
- **Client State**: TanStack Router + React Context.
- **Database & Auth**: Supabase (PostgreSQL + RLS).
- **Styling**: Tailwind CSS v4 + Framer Motion.
- **Typography**: 
  - **Headings**: `Fraunces` (Serif - evokes warmth and tradition).
  - **Body**: `Geist Variable` (Sans-serif - evokes precision and clarity).

---

## 3. Core Architectural Patterns

### 3.1 Data Acquisition (Loaders)
All route data must be fetched using TanStack Router **Loaders** in `src/routes/*.tsx`. 
- **Wait for Auth**: Loaders must call `await supabase.auth.getSession()` before issued queries to ensure LocalStorage tokens are resolved.
- **Invalidation**: On any Auth state change (Login/Logout), call `router.invalidate()` to refresh stale loader caches (see `src/contexts/AuthContext.tsx`).

### 3.2 State Persistence Hierarchy
1. **Supabase**: Permanent source of truth for all modules.
2. **SessionStorage**: Used for "Drafting" states (e.g., in `/lists`) where user edits shouldn't hit the DB until an explicit "Save" action is performed.
3. **LocalStorage**: Used for UI preferences like Theme (Light/Dark/Auto).

### 3.3 UI Interception (Custom Modals/Toasts)
**NATIVE ALERTS ARE FORBIDDEN.**
- **Toasts**: Use `useToast()` from `src/contexts/ToastContext.tsx`.
- **Confirmations**: Use `await confirm()` from `src/contexts/ConfirmContext.tsx`. This returns a `Promise<boolean>` and should be used for all destructive actions.

---

## 4. Module Specifications

### 4.1 Follow-up Lists (`/lists`)
- **Draft Pattern**: Changes to contact assignments are tracked in a `Set` in `sessionStorage`. 
- **Bulk Save**: A diff-based logic clears and re-inserts assignments on commit.
- **Visibility**: Toggleable `is_public` flag. RLS allows owners to edit; others read-only if public.

### 4.2 Smruties (Journal)
- **Media Ingestion**: Supports multi-media uploads to Supabase Storage.
- **Chronological Engine**: Uses a calendar-based filtering system with `router.navigate({ search: { date: '...' } })`.

---

## 5. Deployment & Configuration
- **Host**: Netlify (via `@netlify/vite-plugin-tanstack-start`).
- **Migrations**: Supabase migrations are located in `supabase/migrations/`.
- **Environment**: Required keys in `.env`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

---

## 6. Design System (Warm Minimalist)
Nimit Sevak employs a "Warm Minimalist" design system. AI Agents MUST adhere strictly to these principles and avoid generic Tailwind colors (e.g., `blue-500`, `gray-900`). All styling should rely on semantic CSS variables defined in `src/styles.css`.

### 6.1 Color Palette (OKLCH)
The application uses a meticulously curated OKLCH color palette that supports both Light and Dark modes:
- **Background** (`bg-background`): Warm White in light mode, Deep Warm Slate in dark mode.
- **Foreground** (`text-foreground`): Warm Slate for high contrast readability.
- **Primary** (`bg-primary`, `text-primary`): Terracotta/Amber accent color, used for primary actions and active states.
- **Secondary / Muted / Accent**: Soft warm neutrals used for cards, secondary buttons, and hover states.
- **Destructive** (`bg-destructive`): Used sparingly for delete/remove actions.
- **Borders** (`border-border`): Subtle, low-contrast borders.

**Rule**: Never hardcode colors (e.g., `text-[#333]` or `bg-red-500`). Always use Tailwind semantic classes: `bg-primary`, `text-muted-foreground`, `border-border`, etc.

### 6.2 Typography
- **Headings (Serif)**: `Fraunces` (`font-serif`). Used for page titles, modal headers, and section headings to evoke warmth and tradition.
- **Body (Sans-serif)**: `Geist Variable` (`font-sans`). Used for body text, form labels, and data tables for precision and clarity.

### 6.3 UI Components & Interactions
- **Mobile-First Touch**: All interactive elements (buttons, inputs) must have a minimum touch target of `44x44px`. Hover effects are secondary; the primary interaction must be intuitive on mobile devices.
- **Borders & Radii**: Use generous border radii (`rounded-2xl`, `rounded-xl`) and subtle borders to soften the interface.
- **Micro-Animations**: Use `framer-motion` for fluid state transitions. 
  - Wrap conditionally rendered elements in `<AnimatePresence>`.
  - Use `layout` props for smooth list reordering.
  - Implement subtle scaling (`whileTap={{ scale: 0.98 }}`) for button presses.
- **Native UI Ban**: Never use `window.alert`, `window.confirm`, or native `prompt`. Always use the custom `useToast()` and `useConfirm()` hooks.
