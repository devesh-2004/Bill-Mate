"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2 } from "lucide-react"
import { generateFinancialInsights } from "@/app/dashboard/insights-actions"
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
    <div className="relative group rounded-xl">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-xl blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200 animate-gradient-xy"></div>
      <Card className="relative h-full border-0 bg-background/90 backdrop-blur-2xl rounded-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
             <Sparkles className="h-5 w-5 text-indigo-400" />
             AI Financial Analyst
          </CardTitle>
          <CardDescription className="text-muted-foreground">
             Get instant profit/loss analysis, revenue forecasts, and actionable tips.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!insight ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-6">
              <p className="text-sm text-muted-foreground text-center max-w-md">
                 Analyze your entire invoice history with Google Gemini to discover hidden revenue trends.
              </p>
              <Button 
                onClick={handleGenerate} 
                disabled={loading} 
                className="w-full sm:w-auto px-8 bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)] transition-all border-none relative overflow-hidden group/btn"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-500" />
                <span className="relative flex items-center">
                   {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                   {loading ? 'Analyzing Data...' : 'Generate Insights'}
                </span>
              </Button>
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative p-6 rounded-lg bg-indigo-500/5 border border-indigo-500/20"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 rounded-l-lg" />
              <div className="prose dark:prose-invert max-w-none text-sm text-foreground/90 leading-relaxed">
                <div className="whitespace-pre-line">{insight}</div>
              </div>
              <div className="mt-4 flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setInsight(null)} className="text-xs text-muted-foreground hover:text-foreground">
                      Reset
                  </Button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
