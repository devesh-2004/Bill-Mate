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

  const { data: signUpData, error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: {
        full_name: data.full_name,
      }
    }
  })

  if (error) {
    return { error: error.message }
  }

  // Fallback: manually insert profile in case DB trigger is missing/disabled
  if (signUpData?.user) {
    try {
      await supabase.from('profiles').insert({
        id: signUpData.user.id,
        full_name: data.full_name,
        email: data.email,
      })
    } catch (e) {
      console.warn("Silent ignore: Profile creation trigger handled this or RLS blocked direct insert:", e)
    }
  }
  
  revalidatePath('/dashboard', 'layout')
  redirect('/dashboard')
}

