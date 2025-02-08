-- All policies for the storage schema
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects';