'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export async function login(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const validated = authSchema.safeParse(data)

  if (!validated.success) {
    return { error: 'Invalid inputs' }
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}

export async function signup(prevState: any, formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    full_name: formData.get('full_name') as string,
  }

  const validated = authSchema.safeParse({ email: data.email, password: data.password })

  if (!validated.success) {
    return { error: 'Invalid inputs' }
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    return { error: error.message }
  }
  
  // Also create a profile entry? 
  // Trigger on database side is better, but consistent with instructions.
  // Schema instructions say "profiles" links to auth.users.
  // Usually this is done via trigger.
  // But if we want to add full_name, we can do it here or via trigger.
  // Supabase Auth sends metadata. Let's assume we use metadata or trigger.
  // But the instructions "Create the following tables: profiles" suggests we might need to handle it.
  // Best practice: Postgres Trigger. I won't do it in code unless user asked.
  // The schema has "profiles.id references auth.users".
  
  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}
