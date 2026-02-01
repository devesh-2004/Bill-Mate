'use client'

import { useActionState } from 'react'
import { saveTemplate, getTemplate } from '../actions'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from 'react'
import { Loader2, Palette } from 'lucide-react'

const fonts = [
    { name: 'Inter', value: 'Inter' },
    { name: 'Roboto', value: 'Roboto' },
    { name: 'Open Sans', value: 'Open Sans' },
    { name: 'Lato', value: 'Lato' },
]

export default function TemplateSettingsPage() {
    const [state, formAction, isPending] = useActionState(saveTemplate, { error: '', success: false })
    const [loading, setLoading] = useState(true)
    const [template, setTemplate] = useState<any>(null)
    const [primaryColor, setPrimaryColor] = useState('#000000')

    useEffect(() => {
        getTemplate().then(data => {
            if (data) {
                setTemplate(data)
                setPrimaryColor(data.primary_color)
            }
            setLoading(false)
        })
    }, [])

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Invoice Branding</h1>
                <p className="text-muted-foreground">Customize how your invoices look to your clients.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Appearance Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form action={formAction} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="primary_color">Primary Brand Color</Label>
                                <div className="flex gap-2">
                                    <Input 
                                        type="color" 
                                        name="primary_color" 
                                        id="primary_color" 
                                        className="w-12 h-12 p-1"
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                    />
                                    <Input 
                                        type="text" 
                                        value={primaryColor}
                                        onChange={(e) => setPrimaryColor(e.target.value)}
                                        className="uppercase"
                                        maxLength={7}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="font_family">Font Family</Label>
                                <Select name="font_family" defaultValue={template?.font_family || 'Inter'}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Font" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {fonts.map(font => (
                                            <SelectItem key={font.value} value={font.value}>{font.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {state.error && <p className="text-red-500 text-sm">{state.error}</p>}
                            {state.success && <p className="text-green-500 text-sm">Settings saved successfully!</p>}

                            <Button type="submit" disabled={isPending}>
                                {isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="bg-muted/50 border-dashed">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-muted-foreground">Preview</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-md bg-white p-6 shadow-sm space-y-4 max-w-sm mx-auto text-sm">
                            <div className="flex justify-between items-center mb-6">
                                <div className="font-bold text-xl">INVOICE</div>
                                <div className="text-xs text-muted-foreground">#INV-001</div>
                            </div>
                            
                            <div className="space-y-1">
                                <div className="text-xs font-semibold" style={{ color: primaryColor }}>Bill To:</div>
                                <div>Acme Corp</div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <div className="flex justify-between font-bold">
                                    <span>Total</span>
                                    <span style={{ color: primaryColor }}>₹1,250.00</span>
                                </div>
                            </div>
                            <div className="text-center text-xs text-muted-foreground mt-8">
                                Thank you for your business!
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
