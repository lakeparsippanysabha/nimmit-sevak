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
- **Visual Identity**: Professional, clean, and warm. Avoid "generic" colors.
- **Colors (OKLCH)**:
    - Background: Warm White (`oklch(0.99 0.01 75)`)
    - Foreground: Warm Slate (`oklch(0.2 0.02 50)`)
    - Primary: Terracotta/Amber (`oklch(0.65 0.15 45)`)
- **Typography**:
    - **Serif**: `Fraunces` (for headings).
    - **Sans-Serif**: `Geist Variable` (for body text).

## Core Patterns
1. **Loaders**: Use TanStack Router `loader` for data fetching before rendering.
2. **Server Functions**: Use `createServerFn` for server-side operations.
3. **Data Import**: Use `scripts/import_contacts.ts` for CSV-based data ingestion with deduplication (Name + Cellphone).
4. **Unique Identity**: Database enforces uniqueness on `(first_name, last_name, cellphone)`.
5. **Styling**: Preference for Vanilla CSS tokens and Tailwind utility classes.
6. **Authentication**: Use Supabase Auth via the `useAuth` pattern.

## Deployment
- Deployed as an SPA on **Netlify**.
