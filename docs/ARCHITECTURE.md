# Project Architecture

This document outlines the directory structure and architectural patterns used in the Nimit Sevak project.

## Directory Structure

```text
├── .agent/              # AI Agent skills and workflows
├── docs/                # Project documentation
├── public/              # Static assets
├── scripts/             # Seeding and maintenance scripts
├── src/
│   ├── components/      # Reusable UI components (shadcn/ui, etc.)
│   ├── contexts/        # React Contexts (Auth, Theme)
│   ├── data/            # Mock data and static content
│   ├── lib/             # Shared utilities (Supabase client, helpers)
│   ├── routes/          # TanStack Router routes (File-based)
│   │   ├── __root.tsx   # Root layout and shell
│   │   └── api/         # TanStack Start API routes
│   ├── styles.css       # Global styles and design system tokens
│   ├── router.tsx       # Router configuration
│   └── routeTree.gen.ts # Generated route tree
└── supabase/
    ├── migrations/      # DB version control
    └── SCHEMA_GUIDE.md  # Schema quick-reference
```

## Core Patterns

### 1. File-Based Routing
We use **TanStack Router**. Routes are defined by the files in `src/routes`. 
- `index.tsx` is the home page.
- Layouts are managed via `__root.tsx` or nested directories with `_layout.tsx` (if used).

### 2. Full-Stack TanStack Start
This is a **TanStack Start** application, meaning it handles both client and server code.
- **Server Functions**: Use `createServerFn` to perform database operations securely without exposing secrets to the client.
- **Loaders**: Used within routes to fetch data on the server (or client) before the component renders.

### 3. Database & Auth
- **Supabase** handles authentication, database (PostgreSQL), and storage.
- Real-time features and Row Level Security (RLS) are configured in the migrations.

### 4. Design System
- **Warm Minimalist**: A custom design system built on Tailwind CSS v4 and CSS Variables (OKLCH).
- **Typography**: Focused on a serif/sans-serif pairing for a professional, premium feel.
