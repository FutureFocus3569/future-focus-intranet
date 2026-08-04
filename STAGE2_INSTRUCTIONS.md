# Stage 2: Database Schema & RLS Setup Instructions

## Overview

Two SQL migration files have been created for the Knowledge Centre document system:

1. **20260729_create_documents_system.sql** - Documents table, audit log, RLS policies
2. **20260729_create_storage_policies.sql** - Storage bucket access policies

---

## How to Apply the Migrations

### Option A: Using Supabase CLI (Recommended)

If you have the Supabase CLI installed and configured:

```bash
cd /Users/courtneyeverest/Downloads/future-focus-intranet

# Run migrations
supabase migration up
```

### Option B: Supabase Dashboard (SQL Editor)

1. Go to **Supabase Dashboard** → Your Project → **SQL Editor**
2. Create a new query
3. Copy the entire contents of `20260729_create_documents_system.sql`
4. Paste into the SQL editor
5. Click **Run**
6. Wait for success message ✅

Repeat for `20260729_create_storage_policies.sql`

### Option C: Manual File Upload

1. In Supabase Dashboard → **Migrations**
2. Click **New migration**
3. Upload the two SQL files
4. Click **Deploy**

---

## What These Migrations Create

### Documents Table

```
documents (id, title, description, category, document_type, owner_id, storage_path, version, status, approved_by, next_review_date, extracted_text, ai_processing_status, created_at, updated_at, archived_at, ...)
```

**Key Fields:**
- `status`: draft | pending_approval | published | archived
- `version`: Tracks document versions (1.0, 2.0, etc.)
- `is_current_version`: Only one version is current
- `parent_document_id`: Links versions together
- `storage_path`: Path in policy-documents bucket (e.g., `{doc-id}/{version}/{filename}`)

### Audit Log Table

```
document_audit_log (id, document_id, user_id, action, details, created_at)
```

Automatically logs:
- Document created
- File uploaded
- Status changed (submitted, approved, published, archived)
- Metadata updated

### Row Level Security (RLS)

**Super Admin:**
- ✅ See all documents (all statuses)
- ✅ Create, edit, delete, publish
- ✅ View audit log

**Policy Admin:**
- ✅ See all documents
- ✅ Create and edit drafts/pending approval
- ❌ Cannot publish (super_admin only)
- ✅ View audit log

**Centre Leader & Staff:**
- ✅ See only published current versions
- ❌ Cannot edit or delete
- ❌ Cannot see drafts, pending, or archived

### Storage Policies

**Upload/Replace/Delete:**
- Only super_admin and policy_admin

**Download/View:**
- Super admin and policy admin: all files
- Centre leader & staff: only if associated document is published

---

## Testing After Deployment

### Test 1: Verify tables exist

Run in SQL Editor:

```sql
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```

Expected: `documents` and `document_audit_log` should appear

### Test 2: Verify RLS is enabled

```sql
SELECT schemaname, tablename, rowsecurity FROM pg_tables 
WHERE tablename IN ('documents', 'document_audit_log');
```

Expected: Both should have `rowsecurity = true`

### Test 3: Verify triggers exist

```sql
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_schema = 'public' 
AND event_object_table = 'documents';
```

Expected: Triggers for `updated_at`, `log_document_created`, `log_document_updated`

---

## Next Steps (Stage 3)

After confirming these migrations are applied:

1. ✅ Update `supabase.js` to add `policy_admin` role to PERMISSIONS
2. Create TypeScript types (`documentTypes.ts`)
3. Create document service functions (`documentService.ts`)
4. Refactor Policies page → Knowledge Centre page
5. Build upload workflow

---

## Troubleshooting

**Error: "permission field already exists"**
- The ALTER TABLE IF NOT EXISTS handles this, should skip safely

**Error: "policy already exists"**
- The DROP POLICY IF EXISTS statements handle this, policies are recreated

**Error: "storage table not found"**
- Ensure the `policy-documents` bucket is created in Storage
- It should be private (not public)

**RLS blocking my queries**
- Check that your user profile has the correct `permission` value in the profiles table
- Run: `SELECT permission FROM public.profiles WHERE id = '{your-user-id}'`

---

## Files Created

```
supabase/migrations/
├── 20260729_create_documents_system.sql
└── 20260729_create_storage_policies.sql
```

---

## When Ready

Let me know once you've run these migrations and confirmed they succeeded.
Then we'll move to **Stage 3: TypeScript Types & Service Functions**.
