import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Database } from "./types/supabase";

export class SupabaseService {
	private supabase: SupabaseClient;

	constructor(supabaseUrl: string, supabaseAnonKey: string) {
		// https://www.restack.io/docs/supabase-knowledge-supabase-generate-types
		// The <Database> type ensures that the Supabase client is aware of the database schema,
		// providing autocompletion and type checking for database operations.
		this.supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
	}

	async signInWithPassword(email: string, password: string) {
		let { data, error } = await this.supabase.auth.signInWithPassword({
			email: email,
			password: password,
		});
		console.debug(">> SupabaseService.signInWithPassword: ", data, error);
	}

	async getCurrentUser() {
		const {
			data: { user },
			error,
		} = await this.supabase.auth.getUser();
		if (error) throw new Error(`Failed to get user: ${error.message}`);
		return user;
	}

    // TODO: replace with document type or interface...
	async insertDocument(document: any) {

		const user = await this.getCurrentUser();
        console.debug('-- SupabaseService.insertDocument: user: ', user);
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

		if (error)
			throw new Error(`Error inserting document: ${error.message}`);
		return data;
	}
}
