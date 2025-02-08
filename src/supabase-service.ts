import {
  createClient,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";

// import { Database } from "./types/supabase";


// Interface for file metadata from list operation
// interface StorageFileMetadata {
//   name: string;
//   id: string;
//   updated_at: string;
//   created_at: string;
//   last_accessed_at?: string;
//   metadata?: {
//     size?: number;
//     mimetype?: string;
//     cacheControl?: string;
//   };
// }

// Interface for upload response
// interface UploadResponse {
//   id: string;
//   path: string;
//   fullPath: string;
// }

interface UploadResponse {
  path: string;
}

interface UploadOptions {
  bucketName: string;
  filePath: string;
  data: Uint8Array;
  contentType?: string;
  //lastModified?: Date;
}

interface UploadResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
}


export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    // https://www.restack.io/docs/supabase-knowledge-supabase-generate-types
    // The <Database> type ensures that the Supabase client is aware of the database schema,
    // providing autocompletion and type checking for database operations.
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  /**
   * Checks if there is an active session
   * @returns Promise<boolean> indicating if there's an active session
   */
  async hasActiveSession(): Promise<boolean> {
    try {
      const {
        data: { session },
        error,
      } = await this.supabase.auth.getSession();
      if (error) throw error;
      return session !== null;
    } catch (error) {
      console.error("Error checking session:", error);
      return false;
    }
  }

  async signInWithPassword(
    email: string,
    password: string
  ): Promise<User | null> {
    console.debug(">> SupabaseService.signInWithPassword() > email: ", email);
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (error) throw error;
      console.debug(">> SupabaseService.signInWithPassword: ", user);
      return user;
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  async signOut() {
    console.debug(">> SupabaseService.signOut()");
    const { error } = await this.supabase.auth.signOut();
    if (error) throw new Error(`Failed to sign out: ${error.message}`);
  }

  async getUser() {
    console.debug(">> SupabaseService.getUser()");
    const {
      data: { user },
      error,
    } = await this.supabase.auth.getUser();
    if (error) {
      console.error(">> SupabaseService.getUser: error: ", error);
      throw new Error(`Failed to get user: ${error.message}`);
    }
    return user;
  }

  /**
   * Ensures there is an active session, signing in if necessary
   * @param email user's email for sign in if needed
   * @param password user's password for sign in if needed
   * @returns Promise<User> the current user
   */
  async ensureSession(email: string, password: string): Promise<User> {
    try {
      const hasSession = await this.hasActiveSession();
      if (!hasSession) {
        const user = await this.signInWithPassword(email, password);
        if (!user) throw new Error("Failed to establish session");
        return user;
      }

      const user = await this.getUser();
      if (!user) throw new Error("No user found despite active session");
      return user;
    } catch (error) {
      console.error("Error ensuring session:", error);
      throw error;
    }
  }

  // TODO: replace with document type or interface...
  // async insertDocument(document: any) {
  //   console.debug(">> SupabaseService.insertDocument: document: ", document);
  //   const user = await this.getUser();
  //   console.debug("-- SupabaseService.insertDocument: user: ", user);
  //   if (!user) throw new Error("User not authenticated");

  //   const { data, error } = await this.supabase
  //     .from("documents")
  //     .insert([
  //       {
  //         ...document,
  //         created_by: user.id, // Associate document with authenticated user
  //       },
  //     ])
  //     .select();

  //   if (error) throw new Error(`Error inserting document: ${error.message}`);
  //   return data;
  // }

  async insertDocument(document: any, siteSlug: string) {
    console.debug(">> SupabaseService.insertDocument: document: ", document);
    const user = await this.getUser();
    console.debug("-- SupabaseService.insertDocument: user: ", user);
    if (!user) throw new Error("User not authenticated");

    // Call the stored procedure which handles the transaction
    const { data, error } = await this.supabase
        .rpc('insert_document_with_site', {
            p_document: document,
            p_site_slug: siteSlug,
            p_user_id: user.id
        });

    if (error) {
        console.error("Transaction error:", error);
        throw new Error(`Error in document insertion transaction: ${error.message}`);
    }

    return data;
}

  async updateDocument(document: any) { 
    console.debug(">> SupabaseService.updateDocument: document: ", document);
    const user = await this.getUser();
    console.debug("-- SupabaseService.updateDocument: user: ", user);
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await this.supabase
      .from("documents")
      .update(document)
      .eq("id", document.id)
      .select();

    if (error) throw new Error(`Error updating document: ${error.message}`);
    return data;
  }

  async siteSlugExists(slug: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('sites')
      .select('id')
      .eq('slug', slug)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is the "not found" error code
      throw error;
    }

    return !!data;
  }

  async createSite(slug: string): Promise<any> {
    const user = await this.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await this.supabase
      .from('sites')
      .insert([
        {
          slug: slug,
          name: slug, // Using slug as name for now, could be parameterized later
          created_by: user.id
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // async deleteDocument(uuid: string): Promise<void> {
  //   const { error } = await this.supabase
  //     .rpc('delete_document_cascade', { document_uuid: uuid });

  //   if (error) {
  //     throw new Error(`Error deleting document: ${error.message}`);
  //   }
  // }

  async setDocumentStateToRemoved(uuid: string): Promise<void> {
    const { error } = await this.supabase
      .from('documents')
      .update({ state: 'removed' })
      .eq('id', uuid);

    if (error) {
      throw new Error(`Error updating document state: ${error.message}`);
    }
  }

  private async generatePathHash(path: string): Promise<string> {
    return await crypto.subtle.digest('SHA-256', new TextEncoder().encode(path))
      .then(hash => Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(''));
  }

  /**
   * Checks if a resource exists and needs updating
   * @param path the original file path
   * @param lastModified the last modified date of the resource
   * @returns object indicating if resource exists and needs update
   */
  async checkResourceExists(
    path: string,
    lastModified: Date
  ): Promise<{ exists: boolean; needsUpdate: boolean }> {

    console.debug(`>> SupabaseService.checkResourceExists() > originalPath: ${path}`);

    const pathHash = await this.generatePathHash(path);
    
    // .single() throws an error if no rows or multiple rows are found
    // .maybeSingle() returns null for the data when no rows are found, which is more appropriate for your use case where checking for existence is part of the normal flow
    const { data, error } = await this.supabase
      .from('resources')
      .select('path_hash, last_modified')
      .eq('path_hash', pathHash)
      .maybeSingle();

      if (error) {
        console.error('Error checking resource:', error);
        throw error;
      }
  
      if (!data) {
        return { exists: false, needsUpdate: false };
      }
  
      const serverLastModified = new Date(data.last_modified);
      const needsUpdate = serverLastModified < lastModified;
  
      return { exists: true, needsUpdate };
  }

  /**
   * Uploads a resource to Supabase storage and creates/updates the resource record
   * @param originalPath the original file path
   * @param fileData the file contents as Blob
   * @param lastModified the last modified date of the resource
   */
  // async uploadResource(
  //   originalPath: string,
  //   fileData: Blob,
  //   lastModified: Date
  // ): Promise<void> {
  //   const pathHash = await this.generatePathHash(originalPath);
  //   const fileName = originalPath.split('/').pop() || 'unnamed';
  //   const storagePath = `resources/${pathHash}/${fileName}`;

  //   // Upload to Storage
  //   const { error: uploadError } = await this.supabase.storage
  //     .from('resources')
  //     .upload(storagePath, fileData, {
  //       upsert: true,
  //       contentType: fileData.type || 'application/octet-stream'
  //     });

  //   if (uploadError) {
  //     throw new Error(`Error uploading resource: ${uploadError.message}`);
  //   }

  //   // Create/Update resource record
  //   const { error: dbError } = await this.supabase
  //     .from('resources')
  //     .upsert({
  //       path_hash: pathHash,
  //       path: originalPath,
  //       name: fileName,
  //       last_modified: lastModified.toISOString()
  //     });

  //   if (dbError) {
  //     throw new Error(`Error updating resource record: ${dbError.message}`);
  //   }
  // }

  async checkFileExists (bucketName: string, filePath: string) {
    const { data, error } = await this.supabase.storage
      .from(bucketName)
      .list(filePath)

    console.debug(`-- SupabaseService.checkFileExists() > data: ${data}`);
  
    if (error) {
      console.error(error)
      return false
    }
  
    const files = data.filter(item => item.name === filePath)
    return files.length > 0
  };
  

  // Upload file using standard upload
  // filePath is the path of the file to upload, relative to the root of the vault, including the file name
  async uploadFile(file: Blob, filePath: string) {
    // bucket name here is 'resources', hard-coded because it's also hard-coded in the init-supabase.sql script
    // but we may want to make it a param in the future...
    const { data, error } = await this.supabase
      .storage.from('resources')
      .upload(filePath, file)
    if (error) {
      throw new Error(`-- SupabaseService.uploadFile() > Error uploading file: ${error.message}`);
    } else {
      console.debug(`-- SupabaseService.uploadFile() > File uploaded successfully: ${data}`);
    }
  }


  async uploadFileToSupabase(
    options: UploadOptions
  ): Promise<UploadResult> {
    const { bucketName, filePath, data, contentType } = options;
  
    try {
      // Check if user is authenticated
      const user = await this.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: uploadedData, error: uploadError } = await this.supabase
        .storage
        .from(bucketName)
        .upload(filePath, data, {
          contentType,
          upsert: true
        });
  
      if (uploadError) {
        throw new Error(`Error uploading file: ${uploadError.message}`);
      }
  
      return {
        success: true,
        message: 'File uploaded successfully',
        data: uploadedData as UploadResponse
      };
  
    } catch (error) {
      return {
        success: false,
        message: 'Upload failed',
        error: error instanceof Error ? error : new Error('Unknown error occurred')
      };
    }
  }

  

}

