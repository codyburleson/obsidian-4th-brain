# Feature: Sync with Supabase

GIVEN the user is working with the Obsidian client
WHEN the user right-clicks a document
THEN a `Sync with Supabase` item appears in the context menu

## SCENARIO: Sync to insert new DB document

GIVEN the user selects `Sync with Server`
WHEN the markdown document has no `uuid` property
THEN a `uuid` property is added to the markdown document 
AND a `version` property, is added to the markdown document with value `1`
AND the document is inserted into the DB
AND the `is_latest` field on the DB document is set to true
AND the `created_at` field on the DB document is set to reflect the time of insert

## SCENARIO: Sync to update existing DB document

GIVEN the user selects `Sync with Server`
WHEN the markdown document has a `uuid` property
AND the markdown document has a `version` property 
THEN the `version` property value is incremented by `1` on the markdown document
AND the document is inserted in the database
AND the `is_latest` field of the DB document is set to `true`
AND the `is_latest` field on all previous versions (DB documentsmsharing the same uuid) are set to false
AND the `modified_at` field is changed to reflect the updated timestamp

## SCENARIO: Persist markdown document name

GIVEN a markdown document has been inserted into the database
WHEN the markdown document does not have a `title` property
THEN the `name` field of the DB document receives the markdown document’s file name without the file extension

## SCENARIO: Persist markdown document title, if title property is present

GIVEN a markdown document has been inserted into the database
WHEN the markdown document has a `title` property
THEN the `title` field receives the markdown document’s `title` property