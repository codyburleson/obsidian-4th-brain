import {
  createClient,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";

interface UploadResponse {
  path: string;
}

interface UploadOptions {
  filePath: string;
  siteSlug: string;
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
      .maybeSingle();

    if (error) {
      console.error('Error checking site:', error);
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

  async uploadFileToSupabase(
    options: UploadOptions
  ): Promise<UploadResult> {
    const { filePath, siteSlug, data, contentType } = options;
  
    try {
      // Check if user is authenticated
      const user = await this.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Ensure the path starts with sites/{site-slug}
      const safePath = `sites/${siteSlug}/${filePath.replace(/^\/+/, '')}`;

      const { data: uploadedData, error: uploadError } = await this.supabase
        .storage
        .from('resources')  // Always use the 'resources' bucket
        .upload(safePath, data, {
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

