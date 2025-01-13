DO $$
BEGIN
    -- Create enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_state') THEN
        CREATE TYPE document_state AS ENUM ('draft', 'published', 'expired', 'removed');
    END IF;
END
$$;

-- Create documents table if it doesn't exist
CREATE TABLE IF NOT EXISTS documents (
    id uuid not null,
    version integer not null,
    path text not null,
    name text not null,
    content text not null,
    is_latest boolean not null default true,
    created_at timestamptz default now(),
    created_by uuid references auth.users(id),
    state document_state not null default 'draft',
    primary key (id, version)
);

-- Create index on documents table if the index does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'documents'
        AND indexdef LIKE '%btree (id, is_latest)%'
    ) THEN
        CREATE INDEX ON documents USING btree (id, is_latest) WHERE is_latest = true;
    END IF;
END
$$;

-- Create or replace the function that ensures a document gets the is_latest=true flag
-- when it is the document with the latest version number
-- (CREATE OR REPLACE already handles the conditional creation for functions)
CREATE OR REPLACE FUNCTION update_latest_version()
RETURNS trigger AS $$
BEGIN
    -- Set is_latest to false for all other versions of this document
    UPDATE documents 
    SET is_latest = false 
    WHERE id = NEW.id 
    AND version != NEW.version;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'set_latest_version'
        AND tgrelid = 'documents'::regclass
    ) THEN
        CREATE TRIGGER set_latest_version
            AFTER INSERT ON documents
            FOR EACH ROW
            EXECUTE FUNCTION update_latest_version();
    END IF;
END
$$;

-- Enable Row Level Security (RLS) on the documents table if it is not already enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- The `DROP POLICY IF EXISTS` statement will remove the policy if it exists, 
-- and do nothing if it doesn't. This makes the script idempotent - you can run it multiple times safely. 
-- The entire operation is wrapped in a DO block to ensure it executes as a single transaction.
-- This one ALWAYS drops and recreates the policy so that, when the policy is modified, we are sure
-- to always get the new one.
DO $$ 
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "documents - Enable insert for authenticated users" ON public.documents;
    DROP POLICY IF EXISTS "documents - Enable select for authenticated users" ON public.documents;
    DROP POLICY IF EXISTS "documents - Enable update for authenticated users" ON public.documents;
    
    -- Create new policies
    CREATE POLICY "documents - Enable insert for authenticated users"
    ON public.documents
    FOR INSERT
    TO authenticated
    WITH CHECK (true);
    
    CREATE POLICY "documents - Enable select for authenticated users"
    ON public.documents
    FOR SELECT
    TO authenticated
    USING (true);
    
    CREATE POLICY "documents - Enable update for authenticated users"
    ON public.documents
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);
END
$$;