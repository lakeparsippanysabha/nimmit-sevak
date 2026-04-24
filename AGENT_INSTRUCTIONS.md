# AI Coding Agent Instructions - Nimit Sevak

Greetings, Agent. You are working on **Nimit Sevak**, a premium, warm-minimalist administrative suite. Follow these protocols strictly to maintain the codebase's integrity and aesthetic quality.

## 1. Interaction Protocol
- **No Native Alerts**: Never use `window.alert`, `window.confirm`, or `window.prompt`.
  - Use `useToast()` for feedback.
  - Use `useConfirm()` for confirmations (always `await` the result).
- **Mobile First**: All touch targets must be at least `44x44px`. Hover effects should strictly be secondary; interactions must be visible or accessible via tap.
- **Micro-animations**: Use `framer-motion` (AnimatePresence, Layout transitions) for all modal openings, list removals, or state changes.

## 2. Coding Standards
- **TanStack Router**:
  - Always use File-Based Routing.
  - Fetch data in `loader` functions.
  - If a page is blank on hard-refresh, ensure `router.invalidate()` is called after auth resolution.
- **Database (Supabase)**:
  - All schema changes MUST go into a migration in `supabase/migrations/`.
  - Use `camelCase` for TypeScript variables and `snake_case` for database columns.
  - Use the mapping logic in `src/lib/mappers.ts` to transform DB rows to UI types.
- **Tailwind CSS v4**:
  - Favor CSS variables (`--primary`, `--background`) from `src/styles.css`.
  - Keep styling clean and avoid ad-hoc utility "spaghetti". Use container classes where appropriate.

## 3. The "Follow-up Lists" Pattern
If you are modifying the Lists module:
1. **Drafting**: Use `sessionStorage` for the active editing state.
2. **Persistence**: Use a diff-check (Compare `Set` of IDs vs original IDs) to minimize DB writes.
3. **Mappers**: Ensure `mapFollowupListRows` is used in the loader to bridge types.

## 4. UI / Visual Excellence
Nimit Sevak uses a **Warm Minimalist** design system. You must strictly adhere to the detailed design specifications in `DESIGN.md`.
- **Colors**: NEVER use generic Tailwind colors (e.g., `bg-blue-500`, `text-gray-700`). You MUST use the semantic CSS variables (`bg-primary`, `text-muted-foreground`, `border-border`) defined in `src/styles.css`.
- **Typography**: 
  - Headings: `Fraunces` (`font-serif`)
  - Body: `Geist` (`font-sans`)
- **Shapes & Depth**: Use generous border-radius (`rounded-2xl`, `rounded-[2rem]`), subtle borders (`border-border/60`), and minimal shadows.
- **Interactions**: Ensure mobile touch targets (`44x44px`) and use `framer-motion` for all micro-animations.

## 5. Deployment
When asked to deploy, follow the `/deploy-netlify` workflow.
Always ensure `npm run build` passes locally before committing major UI changes.
