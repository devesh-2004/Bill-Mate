require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Using service role key if available to bypass RLS, otherwise use anon
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !serviceRoleKey)) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function verifyTable() {
  console.log("Checking for 'invoice_templates'...");
  
  // Try to insert a dummy record or just select. 
  // If we don't have service role, RLS might block us, but "table not found" is distinct.
  const { data, error } = await supabase
    .from('invoice_templates')
    .select('count')
    .limit(1);

  if (error) {
    if (error.code === '42P01') { // undefined_table
      console.error("FAIL: Table 'invoice_templates' does NOT exist (Code 42P01).");
      console.log("Please run schema_update.sql in your Supabase SQL Editor.");
    } else {
      console.error("Error accessing table:", error);
      if (error.message.includes("schema cache")) {
          console.error("FAIL: Schema cache issue detected.");
          console.log("Fix: Go to Supabase Dashboard -> Settings -> API -> Reload Schema Cache");
      }
    }
  } else {
    console.log("SUCCESS: Table 'invoice_templates' exists and is accessible.");
  }
}

verifyTable();
