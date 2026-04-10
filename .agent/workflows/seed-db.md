---
description: How to seed the database with mock data
---

# Seeding the Database

This project contains scripts to seed the Supabase database with mock data for contacts and users.

## Prerequisites
- A local `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- A running Supabase instance (local or hosted).

## Available Seeding Scripts

### 1. Seed Contacts (DEPRECATED)
> [!NOTE]
> This script is deprecated in favor of CSV-based imports. See [Importing Contacts](import-contacts.md).
> 
Generates and inserts ~50 mock contacts into the `contacts` table for development testing.
// turbo
```bash
npx tsx scripts/seed_contacts.ts
```

### 2. Seed Users
Seeds initial user accounts (Admin, User, Guest).
// turbo
```bash
node scripts/seed-users.js
```

## Seeding Logic Note
- The scripts login as `superadmin@example.com` to bypass RLS policies if necessary.
- Contacts are inserted in batches of 50 to avoid overloading the Supabase API.
- Ensure the `superadmin@example.com` user exists in your Supabase Auth before running contact seeding.
