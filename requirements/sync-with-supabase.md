Feature: Sync with Supabase

GIVEN the user is working with the Obsidian client
WHEN the user right-clicks a document
THEN a ‘Sync with Supabase’ item appears in the context menu

GIVEN the Obsidian user selects ‘Sync with Supabase’
WHEN the right-clicked document has no uuid property
THEN a uuid property is added to the markdown document 
AND a version property, is added to the markdown document with value 0
AND the document is inserted into the DB
AND the is_latest field is set to true
AND the created_at field is set to reflect the moment of insert

GIVEN the Obsidian user selects ‘Sync with Supabase’
WHEN the right-clicked document has a uuid property
AND the right-clicked document has a version property 
THEN the version property value is incremented by 1 on the markdown document
AND the document is updated in the database
AND the is_latest field is set to true
AND the is_latest field of all previous versions are set to false
AND the modified_at field is changed to reflect the update timestamp

GIVEN a markdown document has been inserted into the database
WHEN the markdown document has no title property
THEN the title field contains the file name without the file extension

GIVEN a markdown document has been inserted into the database
WHEN the markdown document has a title property
THEN the title field contains the title from the markdown document’s title property