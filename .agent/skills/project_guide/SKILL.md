---
name: Project Guide
description: Essential context for Nimit Sevak - architecture, design system, and domain model.
---

# Nimit Sevak Project Guide

This guide provides the necessary context for coding agents to work effectively on the Nimit Sevak project.

## Tech Stack
- **Framework**: [TanStack Start](https://tanstack.com/start) (React + Vite + Nitro).
- **Routing**: [TanStack Router](https://tanstack.com/router) with file-based routing in `src/routes`.
- **Database/Auth**: [Supabase](https://supabase.com/).
- **Styling**: Tailwind CSS v4 with [shadcn/ui](https://ui.shadcn.com/) components.
- **State Management**: React Context (`src/contexts`) and TanStack Query/Loaders.

## Domain Model
- **Contacts**: Comprehensive CRM-style management with location, membership, and descriptive follow-up attributes.
- **Attendance**: Session-based attendance tracking with locational context (Mandal).
- **Smruties (Journal)**: Daily spiritual or personal journal entries.
- **Vicharan (Travel)**: Travel logs and itineraries.
- **Profiles**: User profiles linked to Supabase Auth.

## Design System (Warm Minimalist)
See `DESIGN.md` for the complete design system specification.
- **Visual Identity**: Professional, clean, and warm. Avoid "generic" Tailwind colors (no `blue-500`, `gray-900`). ALWAYS use semantic theme variables.
- **Colors (OKLCH)**:
    - Semantic tokens defined in `src/styles.css` (`bg-background`, `text-primary`, etc.).
    - Core theme is based on Warm Whites, Deep Warm Slates, and Terracotta/Amber accents.
- **Typography**:
    - **Serif**: `Fraunces` (`font-serif` for headings).
    - **Sans-Serif**: `Geist Variable` (`font-sans` for body text).
- **Interactions**: Mobile-first touch targets (`>=44px`), no native alerts, rich micro-animations via `framer-motion`.

## Core Patterns
1. **Loaders**: Use TanStack Router `loader` for data fetching before rendering.
2. **Server Functions**: Use `createServerFn` for server-side operations.
3. **Data Import**: Use `scripts/import_contacts.ts` for CSV-based data ingestion with deduplication (Name + Cellphone).
4. **Unique Identity**: Database enforces uniqueness on `(first_name, last_name, cellphone)`.
5. **Styling**: Preference for Vanilla CSS tokens and Tailwind utility classes.
6. **Authentication**: Use Supabase Auth via the `useAuth` pattern.

## Deployment
- Deployed as an SPA on **Netlify**.
