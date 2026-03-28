import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// A quick safety check to make sure the keys are loaded
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env.local file!');
}

// Export the connected client so we can use it across the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);