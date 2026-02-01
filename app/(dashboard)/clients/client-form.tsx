"use client"

import { useActionState } from "react"
import { createClientAction, updateClientAction } from "./actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Client = {
  id?: string
  name?: string
  email?: string
  phone?: string
  address?: string
}

const initialState = {
  error: "",
  errors: {}
}

export default function ClientForm({ client }: { client?: Client }) {
  // If editing, bind the ID to the update action
  const action = client?.id 
    ? updateClientAction.bind(null, client.id) 
    : createClientAction

  const [state, formAction, isPending] = useActionState(action, initialState)

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{client?.id ? "Edit Client" : "Add New Client"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={client?.name} required />
            {state?.errors?.name && <p className="text-red-500 text-sm">{state.errors.name}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={client?.email || ''} />
              {state?.errors?.email && <p className="text-red-500 text-sm">{state.errors.email}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={client?.phone || ''} />
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="address">Address</Label>
            <Textarea id="address" name="address" defaultValue={client?.address || ''} />
          </div>

          {state?.error && <p className="text-red-500 text-sm">{state.error}</p>}
          
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : "Save Client"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
