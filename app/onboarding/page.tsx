import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OnboardingForm } from "./onboarding-form"

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Note: existing users are intentionally allowed here so they can create
  // ADDITIONAL workspaces from the workspace switcher.

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
       <div className="absolute inset-0 z-0 pointer-events-none flex justify-center opacity-30 dark:opacity-40">
        <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 blur-[120px]" />
        <div className="absolute bottom-[20%] right-[20%] w-[30%] h-[50%] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <Card className="w-full max-w-md relative z-10 border-border/40 bg-background/60 backdrop-blur-xl shadow-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Welcome to BillMate</CardTitle>
          <CardDescription>Let's set up your first organization workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  )
}
