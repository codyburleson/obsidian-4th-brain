# Sync with Server

As an Obsidian user, 
I want to be able to sync my documents with the 4thBrain server
So that my documents are available on the web

```
Scenario: Sync with Server
  Given the user is working with the Obsidian client
  When the user right-clicks a document
  Then a `Sync with Server` item appears in the context menu
```

```
Scenario: Require configuration of default site slug
  Given the user has not set a default site slug
  When the user selects `Sync with Server`
  Then the user is prompted to set a default site slug
  And the sync operation is aborted
```

```
Scenario: Prohibit used site slugs
  Given the user has set a default site slug
  And the site slug is already in use by another user
  Then the user is prompted to set a different default site slug
```

```
Scenario: Sync to insert new document
  Given the user selects `Sync with Server`
  When the markdown document has no `uuid` property
  Then a `uuid` is created and added as a property on the markdown document 
  And a `version` property, is added to the markdown document with value `1`
  And the document is inserted into the documents table
  And the document is inserted into the document_site_publications table
  And the `is_latest` field on the DB document is set to true
  And the `created_at` field on the DB document is set to reflect the time of insert
```

```
Scenario: Sync to update existing document
  Given the user selects `Sync with Server`
  When the markdown document has a `uuid` property
  And the markdown document has a `version` property 
  Then the `version` property value is incremented by `1` on the markdown document
  And the document is inserted in the database
  And the `is_latest` field of the DB document is set to `true`
  And the `is_latest` field on all previous versions (DB documentsmsharing the same uuid) are set to false
  And the `modified_at` field is changed to reflect the updated timestamp
```

```
Scenario: Persist document name
  Given a markdown document has been inserted into the database
  When the markdown document does not have a `title` property
  Then the `name` field of the DB document receives the markdown document’s file name without the file extension
```

```
Scenario: Persist document title when title property is present
  Given a markdown document has been inserted into the database
  When the markdown document has a `title` property
  Then the `title` field receives the markdown document’s `title` property
```


