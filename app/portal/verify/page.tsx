import { verifyPortalToken } from '../actions'
import { redirect } from 'next/navigation'
import { Loader2 } from 'lucide-react'

export default async function VerifyPortalPage({ searchParams }: { searchParams: Promise<{ token: string, client_id: string }> }) {
  const { token, client_id } = await searchParams

  if (!token || !client_id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div className="max-w-md p-6 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
          <h1 className="text-xl font-bold mb-2">Invalid Link</h1>
          <p>This portal link is missing required parameters. Please request a new link from your provider.</p>
        </div>
      </div>
    )
  }

  const result = await verifyPortalToken(token, client_id)

  if (result.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 text-center">
        <div className="max-w-md p-6 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg">
          <h1 className="text-xl font-bold mb-2">Access Denied</h1>
          <p>{result.error}</p>
        </div>
      </div>
    )
  }

  // If successful, the cookie is set. Redirect to dashboard.
  redirect('/portal/dashboard')

  // Technically unreachable, but useful while redirecting
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-muted-foreground">
      <Loader2 className="h-8 w-8 animate-spin mb-4" />
      <p>Verifying access and securely logging you in...</p>
    </div>
  )
}
