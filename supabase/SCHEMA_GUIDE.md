# Supabase Schema Guide

This document provides a consolidated view of the database schema for the Nimit Sevak project.

## Core Tables

### 1. `profiles`
Stores user profile information, linked to Supabase Auth.
- `id`: UUID (Primary Key, references `auth.users`)
- `full_name`: Text
- `avatar_url`: Text
- `role`: Text (e.g., 'admin', 'user')
- `created_at`: Timestamp

### 2. `contacts`
Stores specialized CRM information about individuals.
- `id`: UUID (Primary Key)
- `first_name`: Text (Required)
- `last_name`: Text (Required)
- `nickname`: Text
- `gender`: Text
- `age`: Integer
- `email`: Text
- `cellphone`: Text
- `member_type`: Text
- `address1`: Text
- `address2`: Text
- `city`: Text
- `county`: Text
- `state`: Text
- `zip`: Text
- `country`: Text
- `followup`: Text (Historical/descriptive followup notes)
- `mandal`: Text (Geographic grouping)
- `avatar_url`: Text (Default: Akshar Logo URL)
- `notes`: Text
- `created_at`: Timestamp

### 3. `attendance_records`
Tracks individual attendance for specific dates.
- `id`: UUID (Primary Key)
- `contact_id`: UUID (References `contacts`.cascade)
- `date`: Date (The session date)
- `status`: Text ('Present', 'Absent', 'Excused', 'Late')
- `notes`: Text
- `recorded_by`: UUID (References `auth.users`)
- `created_at`: Timestamp
- `UNIQUE(contact_id, date)`

## Vicharan (Travel) System

### 4. `travel_plans`
Overall travel itineraries.
- `id`: UUID (Primary Key)
- `title`: Text
- `description`: Text
- `start_date`: Date
- `end_date`: Date
- `created_at`: Timestamp

### 5. `travel_stops`
Specific stops or locations within a travel plan.
- `id`: UUID (Primary Key)
- `travel_id`: UUID (References `travel_plans`)
- `location_name`: Text
- `arrival`: Timestamp
- `departure`: Timestamp
- `notes`: Text

## Smruties (Journal) System

### 6. `journal_entries`
Daily journal or spiritual entries.
- `id`: UUID (Primary Key)
- `title`: Text
- `content`: Text (Markdown support)
- `date`: Date
- `tags`: Text[]
- `created_at`: Timestamp

### 7. `journal_media`
Media associated with journal entries.
- `id`: UUID (Primary Key)
- `journal_id`: UUID (References `journal_entries`)
- `type`: Text (e.g., 'image/png', 'video/mp4')
- `url`: Text (Supabase Storage URL)
- `caption`: Text

## Storage Buckets
- `journal-media`: Publicly readable bucket for journal attachments.
