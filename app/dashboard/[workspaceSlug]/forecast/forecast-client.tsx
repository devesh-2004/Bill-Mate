"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, AlertTriangle, TrendingUp, Lightbulb } from "lucide-react"
import { generateForecastAction } from "./actions"
import type { ForecastContent } from "@/lib/types"

const RISK_STYLE: Record<string, string> = {
  low: "text-emerald-500 bg-emerald-500/10",
  medium: "text-amber-500 bg-amber-500/10",
  high: "text-red-500 bg-red-500/10",
}

export function ForecastClient({ workspaceSlug, initial }: { workspaceSlug: string; initial: ForecastContent | null }) {
  const [forecast, setForecast] = useState<ForecastContent | null>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function generate() {
    setPending(true); setError("")
    const res = await generateForecastAction(workspaceSlug)
    setPending(false)
    if (res?.error) { setError(res.error); return }
    if (res?.content) setForecast(res.content)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-indigo-500" /> Financial Forecast
          </h1>
          <p className="text-muted-foreground text-sm mt-1">AI cash-flow prediction, risk score & recommendations.</p>
        </div>
        <Button onClick={generate} disabled={pending}>
          <Sparkles className="mr-2 h-4 w-4" /> {pending ? "Analysing…" : "Generate Forecast"}
        </Button>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {!forecast && !pending && (
        <Card className="bg-background/60 backdrop-blur-xl border-border/40">
          <CardContent className="py-12 text-center text-muted-foreground">
            No forecast yet. Click <span className="font-medium text-foreground">Generate Forecast</span> to analyse your invoices.
          </CardContent>
        </Card>
      )}

      {forecast && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2 bg-background/60 backdrop-blur-xl border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Cash Flow Prediction
              </CardTitle>
            </CardHeader>
            <CardContent><p className="text-sm leading-relaxed">{forecast.cashFlowPrediction}</p></CardContent>
          </Card>

          <Card className="bg-background/60 backdrop-blur-xl border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{forecast.riskScore}<span className="text-lg text-muted-foreground">/100</span></div>
              <span className={`mt-2 inline-block px-2 py-0.5 rounded text-xs font-medium uppercase ${RISK_STYLE[forecast.riskLevel] || ""}`}>
                {forecast.riskLevel} risk
              </span>
            </CardContent>
          </Card>

          <Card className="md:col-span-3 bg-background/60 backdrop-blur-xl border-border/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4" /> Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {forecast.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm">
                    <span className="text-indigo-500 font-bold">{i + 1}.</span> {r}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted-foreground mt-4">
                Generated {new Date(forecast.generatedFor).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
