import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for Vite projects
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Log this to your browser console to see what Netlify is actually seeing
console.log("Supabase URL Check:", supabaseUrl); 

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Environment variables are missing!");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', // Prevents the crash
  supabaseAnonKey || 'placeholder'
);