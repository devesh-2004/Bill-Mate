export default function InvalidPortalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 text-center bg-muted/30">
      <div className="max-w-md p-8 bg-background border rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-4 text-destructive">Portal Access Required</h1>
        <p className="text-muted-foreground mb-6">
          You need a valid magic link to access this portal. Please request a new link from your provider.
        </p>
      </div>
    </div>
  )
}
