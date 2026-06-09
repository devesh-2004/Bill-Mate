import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWorkspace } from '@/lib/workspace'
export async function GET() {
  try {
    const supabase = await createClient()
    const workspace_id = await getCurrentWorkspace(supabase)
    if (!workspace_id) {
      return NextResponse.json(null)
    }
    const { data } = await supabase
      .from('invoice_templates')
      .select('*')
      .eq('workspace_id', workspace_id)
      .single()
    return NextResponse.json(data || null)
  } catch {
    return NextResponse.json(null)
  }
}