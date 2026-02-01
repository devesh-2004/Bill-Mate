'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const templateSchema = z.object({
  primary_color: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid color code"),
  font_family: z.string().min(1)
})

export async function getTemplate() {
    const supabase = await createClient()
    const { data } = await supabase.from('invoice_templates').select('*').single()
    return data
}

export async function saveTemplate(prevState: any, formData: FormData) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return { success: false, error: 'Unauthorized' }

    const rawData = {
        primary_color: formData.get('primary_color') as string,
        font_family: formData.get('font_family') as string,
    }

    const validated = templateSchema.safeParse(rawData)
    
    if (!validated.success) {
        return { success: false, error: 'Invalid inputs', errors: validated.error.flatten().fieldErrors }
    }

    // Check if exists
    const { data: existing } = await supabase.from('invoice_templates').select('id').single()

    let error;
    if (existing) {
        const result = await supabase.from('invoice_templates').update(rawData).eq('id', existing.id)
        error = result.error
    } else {
        const result = await supabase.from('invoice_templates').insert({
            user_id: user.id,
            ...rawData
        })
        error = result.error
    }

    if (error) {
        return { success: false, error: error.message }
    }

    revalidatePath('/settings/templates')
    return { success: true, error: '' }
}
