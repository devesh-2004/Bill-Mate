require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || (!supabaseKey && !serviceRoleKey)) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function verifyTables() {
  const tables = [
    'profiles',
    'workspaces',
    'workspace_members',
    'clients',
    'invoices',
    'invoice_items',
    'payments',
    'invoice_templates'
  ];

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': ERROR:`, error.code, error.message);
    } else {
      console.log(`Table '${table}': SUCCESS (data count: ${data ? data.length : 0})`);
    }
  }
}

verifyTables();
