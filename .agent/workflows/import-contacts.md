---
description: How to import contacts from a CSV file
---

# Importing Contacts

This project provides a script to import contacts from a CSV file into the Supabase database.

## 1. Prepare your CSV
Save your contact data as `data/contacts.csv`. The file should have the following headers:

```csv
first_name,last_name,nickname,gender,age,email,cellphone,member_type,address1,address2,city,county,state,zip,country,followup,mandal,notes
```

- **Required**: `first_name`, `last_name`.
- **Follow-up**: `followup` is a `TEXT` field (e.g., "PIYUSH PANCHAL").
- **Integers**: `age` should be a number.
- **Avatar**: `avatar_url` is automatically set to the default Akshar Logo.

## 2. Prerequisites
Ensure you have a `.env` file with the following variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The script will use `superadmin@example.com` (Password: `Password123!`) to bypass RLS during the import.

## 3. Run the Import Script
The script uses **Upsert** logic. It will update existing records if the `first_name`, `last_name`, and `cellphone` match precisely. Pass the path to your CSV file as an argument.

// turbo
```bash
npx tsx scripts/import_contacts.ts data/lake_parsippany.csv
```

Example for another file:
```bash
npx tsx scripts/import_contacts.ts data/lake_hiawatha.csv
```

## 4. Troubleshooting
- **Duplicates**: The script deduplicates based on Name + Cellphone. If a contact has a new cellphone number, a new record will be created.
- **Constraint Errors**: Ensure your database has the `contacts_unique_identity` constraint applied.
- **Login fails**: Check the `superadmin` credentials in your Supabase instance.
- **Parsing errors**: Ensure your CSV values don't contain unquoted commas.
- **Data missing**: Verify the header names match the requirement exactly.
