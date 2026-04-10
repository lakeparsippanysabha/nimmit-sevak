---
description: How to run tests and write new ones
---

# Running Tests

This project uses [Vitest](https://vitest.dev/) for unit/integration tests and [Playwright](https://playwright.dev/) for end-to-end tests.

## Running All Tests
// turbo
```bash
npm run test
```

## Running Tests in Watch Mode
```bash
npx vitest
```

## Running a Single Test File
```bash
npx vitest src/lib/mappers.test.ts
```

## Writing New Tests

### File Naming Convention
- Place test files next to the module they test
- Use the `.test.ts` or `.test.tsx` extension
- Example: `src/lib/mappers.ts` → `src/lib/mappers.test.ts`

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule';

describe('myFunction', () => {
  it('should handle the happy path', () => {
    expect(myFunction(input)).toEqual(expectedOutput);
  });

  it('should handle edge cases', () => {
    expect(myFunction(null)).toEqual(fallback);
  });
});
```

### Environment
- Tests run in a `jsdom` environment (configured in `vite.config.ts`)
- React components can be tested with `@testing-library/react`
- No live Supabase connection required; mock the `supabase` client in tests
