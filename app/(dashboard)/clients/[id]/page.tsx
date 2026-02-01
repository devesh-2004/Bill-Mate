import { createClient } from "@/lib/supabase/server"
import { getClientRiskStats } from "../actions"
import Link from "next/link"
import { ArrowLeft, Edit, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export default async function ClientPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: client } = await supabase
    .from("clients")
    .select("*")
    .eq("id", params.id)
    .single()

  if (!client) {
    return <div>Client not found</div>
  }

  const riskStats = await getClientRiskStats(params.id)

  const getRiskColor = (level: string) => {
    switch(level) {
        case 'High': return 'destructive'
        case 'Medium': return 'warning' // Assuming warning variant exists, or fallback
        case 'Low': return 'success' // Assuming success variant exists
        default: return 'secondary'
    }
  }
  
  const getRiskBadgeColor = (level: string) => {
      if (level === 'High') return 'bg-red-500 hover:bg-red-600'
      if (level === 'Medium') return 'bg-yellow-500 hover:bg-yellow-600'
      return 'bg-green-500 hover:bg-green-600'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
          {riskStats && riskStats.riskLevel !== 'Unknown' && (
             <Badge className={getRiskBadgeColor(riskStats.riskLevel)}>
                {riskStats.riskLevel} Risk
             </Badge>
          )}
        </div>
        <Button asChild>
          <Link href={`/clients/${client.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> Edit Client
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
                <span className="text-sm font-medium text-muted-foreground block">Email</span>
                <span>{client.email || "N/A"}</span>
            </div>
            <div>
                <span className="text-sm font-medium text-muted-foreground block">Phone</span>
                <span>{client.phone || "N/A"}</span>
            </div>
            <div>
                <span className="text-sm font-medium text-muted-foreground block">Address</span>
                <span className="whitespace-pre-wrap">{client.address || "N/A"}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
           <CardHeader>
             <CardTitle className="flex items-center gap-2">
                Payment Insights
             </CardTitle>
             <CardDescription>Based on historical invoice data</CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
              {!riskStats || riskStats.totalInvoices === 0 ? (
                 <div className="text-center py-6 text-muted-foreground">
                    No payment history available yet.
                 </div>
              ) : (
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" /> Avg Delay
                        </div>
                        <div className="text-2xl font-bold">
                            {riskStats.avgDelay} days
                        </div>
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                            <AlertTriangle className="h-4 w-4" /> Late Rate
                        </div>
                        <div className="text-2xl font-bold">
                            {riskStats.lateRate}%
                        </div>
                    </div>
                 </div>
              )}
              {riskStats?.riskLevel === 'High' && (
                  <div className="bg-red-50 p-3 rounded-md border border-red-200 text-sm text-red-800 flex gap-2">
                     <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                     <p>This client frequently pays late (&gt; 7 days avg). Consider requesting upfront deposits.</p>
                  </div>
              )}
           </CardContent>
        </Card>
      </div>
    </div>
  )
}
