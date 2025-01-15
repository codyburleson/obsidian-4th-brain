import {
  createClient,
  SupabaseClient,
  User,
} from "@supabase/supabase-js";
import { Database } from "./types/supabase";

export class SupabaseService {
  private readonly supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    // https://www.restack.io/docs/supabase-knowledge-supabase-generate-types
    // The <Database> type ensures that the Supabase client is aware of the database schema,
    // providing autocompletion and type checking for database operations.
    this.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
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
  async insertDocument(document: any) {
    console.debug(">> SupabaseService.insertDocument: document: ", document);
    const user = await this.getUser();
    console.debug("-- SupabaseService.insertDocument: user: ", user);
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await this.supabase
      .from("documents")
      .insert([
        {
          ...document,
          created_by: user.id, // Associate document with authenticated user
        },
      ])
      .select();

    if (error) throw new Error(`Error inserting document: ${error.message}`);
    return data;
  }
}
