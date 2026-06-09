'use client'

import { useState } from 'react'
import { updateBillingProfile } from '../../actions'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Check } from 'lucide-react'

export function ProfileForm({ initialData }: { initialData: any }) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)
    
    const formData = new FormData(e.currentTarget)
    const res = await updateBillingProfile(formData)
    
    setLoading(false)
    if (res.error) {
      setError(res.error)
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  return (
    <Card className="max-w-2xl border-border/40 bg-background/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle>Billing Profile</CardTitle>
        <CardDescription>Update your billing information for future invoices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="billing_name">Billing Name</Label>
            <Input 
              id="billing_name" 
              name="billing_name" 
              defaultValue={initialData.billing_name || initialData.name} 
              required 
            />
            <p className="text-xs text-muted-foreground">The official company or individual name to appear on invoices.</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="billing_email">Billing Email</Label>
            <Input 
              id="billing_email" 
              name="billing_email" 
              type="email" 
              defaultValue={initialData.billing_email || initialData.email} 
            />
            <p className="text-xs text-muted-foreground">Where invoice copies and receipts will be sent.</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="billing_address">Billing Address</Label>
            <Textarea 
              id="billing_address" 
              name="billing_address" 
              defaultValue={initialData.billing_address || initialData.address} 
              className="min-h-[100px]"
            />
          </div>

          {error && <div className="text-sm text-destructive font-medium">{error}</div>}
          
          <div className="pt-4 flex items-center gap-4">
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
            {success && <span className="text-sm text-green-500 flex items-center gap-1"><Check className="h-4 w-4" /> Saved successfully</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
