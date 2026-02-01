"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2 } from "lucide-react"
import { generateFinancialInsights } from "@/app/(dashboard)/insights-actions"
import { motion } from "framer-motion"

export function AIInsights({ revenueData, stats }: { revenueData: any[], stats: any }) {
  const [insight, setInsight] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    const result = await generateFinancialInsights(revenueData, stats)
    setInsight(result)
    setLoading(false)
  }

  return (
    <Card className="h-full border-indigo-500/20 bg-indigo-50/10 dark:bg-indigo-950/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
           <Sparkles className="h-4 w-4 text-indigo-500" />
           AI Financial Analyst
        </CardTitle>
        <CardDescription>
           Get instant profit/loss analysis and tips.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!insight ? (
          <div className="flex flex-col items-center justify-center p-4 space-y-4">
            <p className="text-sm text-muted-foreground text-center">
               Generate a report based on your invoice history.
            </p>
            <Button onClick={handleGenerate} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate Insights
            </Button>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }}
            className="prose dark:prose-invert text-sm"
          >
            <div className="whitespace-pre-line">{insight}</div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
