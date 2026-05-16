# Testing Guide

This document explains how to run tests and what to expect.

---

## Quick Start

```bash
# Fast unit tests (no database required)
npm test

# Verify all checks pass (type checking, builds, tests)
bash scripts/verify-tests.sh

# Full integration tests with database
DATABASE_URL=postgresql://... bash scripts/test-integration.sh
```

---

## Test Types

### 1. Fast Unit Tests (No Database)

**Run:** `npm test`

These tests run in ~1-2 seconds and don't require external services:
- Session creation/validation (in-memory crypto)
- User profile fetching logic
- Banned user redirect logic
- Abuse check stubs
- Database schema validation

**When to run:** Every commit, before pushing.

---

### 2. Database Integration Tests

**Run:** `bash scripts/test-integration.sh`

These tests require:
- PostgreSQL running and accessible
- `DATABASE_URL` environment variable set
- Database migrations applied

**Tests included:**
- Permission resolution (`canRead`, `canPost`)
- User/forum/thread/post queries
- Session expiry and cleanup
- Transaction atomicity

**When to run:**
- Before submitting a PR
- After database schema changes
- After permission logic changes
- Phase 1 completion (E2E validation)

**Setup (first time):**

```bash
# Start a local Postgres dev database
docker compose -f docker/docker-compose.dev.yml up -d

# Apply migrations (one-time)
bash scripts/migrate.sh

# Seed test data
npx tsx scripts/seed.ts

# Set DATABASE_URL for your environment
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/forum
```

---

### 3. End-to-End Tests (Manual)

These require a real Bluesky account and running instance. See TODO.md for the Phase 1 manual testing checklist.

---

## Verification Checklist

Run this before committing significant changes:

```bash
bash scripts/verify-tests.sh
```

This verifies:
1. ✓ Type checking (`tsc --noEmit`)
2. ✓ SvelteKit sync (route generation)
3. ✓ Fast unit tests pass
4. ✓ Database integration tests pass (if DATABASE_URL set)
5. ✓ Production build succeeds
6. ✓ Route types generated

---

## Troubleshooting

### `DATABASE_URL environment variable is required`

You need to set DATABASE_URL and have Postgres running:

```bash
# Start database
docker compose -f docker/docker-compose.dev.yml up -d

# Set environment variable (bash/zsh)
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/forum

# Now run tests
npm test
```

### `Cannot connect to database`

Check that Postgres is running:

```bash
docker compose -f docker/docker-compose.dev.yml ps

# If not running, start it:
docker compose -f docker/docker-compose.dev.yml up -d

# Verify connection:
psql $DATABASE_URL -c "SELECT 1"
```

### `relation "users" does not exist`

Database schema hasn't been migrated. Run:

```bash
bash scripts/migrate.sh
npx tsx scripts/seed.ts
```

### Permission denied errors on Docker

Some tests need elevated privileges:

```bash
# Run with sudo, preserving environment
sudo -E bash scripts/test-integration.sh
```

---

## Test File Structure

```
src/
├── lib/
│   ├── auth/
│   │   ├── session.test.ts
│   │   ├── user.test.ts
│   │   ├── profile-sync.test.ts
│   │   └── banned-redirect.test.ts
│   ├── abuse/
│   │   └── index.test.ts
│   ├── db/
│   │   └── schema.test.ts
│   ├── permissions/
│   │   └── index.test.ts        ← DB required
│   └── smoke.test.ts
└── routes/
    └── (tests here can use fixtures)
```

---

## Adding New Tests

1. **Unit test** (no DB):
   ```typescript
   // src/lib/my-feature/index.test.ts
   import { describe, it, expect } from 'vitest';
   import { myFunction } from './index';

   describe('myFunction', () => {
     it('does the thing', () => {
       expect(myFunction()).toBe('result');
     });
   });
   ```

2. **Database test** (requires DATABASE_URL):
   ```typescript
   // src/lib/my-feature/index.test.ts
   import { describe, it, expect, beforeEach } from 'vitest';
   import { db } from '$lib/db';
   import { myTable } from '$lib/db/schema';

   describe('myFeature with DB', () => {
     beforeEach(async () => {
       // Clean up test data
       await db.delete(myTable).where(...);
     });

     it('queries the database', async () => {
       const result = await db.query.myTable.findFirst(...);
       expect(result).toBeDefined();
     });
   });
   ```

---

## CI/CD Integration

For GitHub Actions or similar CI systems:

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm install
      - run: npm run build
      - run: bash scripts/migrate.sh
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/forum
      - run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/forum
```

---

## Test Coverage

Currently tracking:
- Core auth flows (session, OAuth, user)
- Permission resolution (read, post)
- Database schema integrity
- Abuse check interface

Not yet tracked:
- Route handlers (manual E2E testing)
- UI/component rendering
- Real Bluesky OAuth flow
- Notification worker
- Search queries

---

## Performance Targets

- **Fast unit tests**: < 2 seconds total
- **DB integration tests**: < 30 seconds (with overhead)
- **Full verification**: < 60 seconds (including build)

If tests are slower, investigate:
- Database connection pooling
- Test parallelization
- Unnecessary data fixtures

---

## Reporting Test Results

When you've completed all tests:

1. Run `bash scripts/verify-tests.sh`
2. All checks should show ✓ (or ⊘ for skipped)
3. Share the output with the team:
   ```
   Results: 6/6 checks passed
   ✓ All checks passed!
   ```

If any checks fail, investigate using `npm test` for details.
