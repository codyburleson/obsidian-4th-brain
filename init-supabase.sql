-- *****************************************************
-- CREATE ENUM TYPES
-- *****************************************************

DO $$
BEGIN
    -- Create enum type if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_state') THEN
        CREATE TYPE document_state AS ENUM ('draft', 'published', 'expired', 'removed');
    END IF;
END
$$;

-- *****************************************************
-- CREATE TABLES
-- *****************************************************

CREATE TABLE IF NOT EXISTS documents (
    id uuid not null,
    site_id uuid not null,
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

CREATE TABLE IF NOT EXISTS sites (
    id uuid primary key default uuid_generate_v4(),
    slug text unique not null,
    name text not null,
    domain text,
    created_at timestamptz default now(),
    created_by uuid references auth.users(id)
);

CREATE TABLE IF NOT EXISTS document_site_publications (
    document_id uuid not null,
    document_version integer not null,
    site_id uuid not null,
    PRIMARY KEY (document_id, document_version, site_id),
    FOREIGN KEY (document_id, document_version) REFERENCES documents(id, version),
    FOREIGN KEY (site_id) REFERENCES sites(id)
);

-- *****************************************************
-- CREATE INDEXES
-- *****************************************************

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

   IF NOT EXISTS (
       SELECT 1 FROM pg_indexes 
       WHERE schemaname = 'public' 
       AND tablename = 'sites'
       AND indexname = 'idx_sites_slug'
   ) THEN
       CREATE INDEX idx_sites_slug ON sites(slug);
   END IF;

   IF NOT EXISTS (
       SELECT 1 FROM pg_indexes 
       WHERE schemaname = 'public' 
       AND tablename = 'sites'
       AND indexname = 'idx_sites_domain'
   ) THEN
       CREATE INDEX idx_sites_domain ON sites(domain);
   END IF;

   IF NOT EXISTS (
       SELECT 1 FROM pg_indexes 
       WHERE schemaname = 'public' 
       AND tablename = 'document_site_publications'
       AND indexname = 'idx_document_site_publications_site_id'
   ) THEN
       CREATE INDEX idx_document_site_publications_site_id 
       ON document_site_publications(site_id);
   END IF;

END
$$;

-- *****************************************************
-- CREATE FUNCTIONS
-- *****************************************************

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

-- *****************************************************
-- CREATE POLICIES
-- *****************************************************

-- Enable Row Level Security (RLS) on the documents table if it is not already enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- The `DROP POLICY IF EXISTS` statement will remove the policy if it exists. 
-- This makes the script idempotent - you can run it multiple times safely. 
-- The entire operation is wrapped in a DO block to ensure it executes as a single transaction.
-- This ALWAYS drops and recreates the policies so that, when the policies is modified, we are sure
-- to always get the new ones.

DO $$ 
DECLARE
    table_name text;
BEGIN
    FOR table_name IN SELECT tablename 
                      FROM pg_tables 
                      WHERE schemaname = 'public' 
                      AND tablename IN ('documents', 'sites', 'document_site_publications')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%1$s - Enable insert for authenticated users" ON public.%1$s', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "%1$s - Enable select for authenticated users" ON public.%1$s', table_name);
        EXECUTE format('DROP POLICY IF EXISTS "%1$s - Enable update for authenticated users" ON public.%1$s', table_name);
        
        EXECUTE format('CREATE POLICY "%1$s - Enable insert for authenticated users" ON public.%1$s FOR INSERT TO authenticated WITH CHECK (true)', table_name);
        EXECUTE format('CREATE POLICY "%1$s - Enable select for authenticated users" ON public.%1$s FOR SELECT TO authenticated USING (true)', table_name);
        EXECUTE format('CREATE POLICY "%1$s - Enable update for authenticated users" ON public.%1$s FOR UPDATE TO authenticated USING (true) WITH CHECK (true)', table_name);
    END LOOP;
END
$$;