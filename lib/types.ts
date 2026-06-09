// Shared types for the Financial Operations extension.
// These mirror the tables created in migration_financial_ops.sql.

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type RecurringStatus = 'active' | 'paused' | 'cancelled'

export interface LineItem {
  description: string
  quantity: number
  price: number
}

export interface RecurringInvoice {
  id: string
  workspace_id: string
  client_id: string
  title: string | null
  frequency: Frequency
  interval_count: number
  status: RecurringStatus
  line_items: LineItem[]
  currency: string
  tax_rate: number
  discount: number
  notes: string | null
  terms: string | null
  due_days: number
  auto_send: boolean
  start_date: string
  end_date: string | null
  next_run_at: string
  last_run_at: string | null
  occurrences_generated: number
  max_occurrences: number | null
  created_at: string
}

export interface ExpenseCategory {
  id: string
  workspace_id: string
  name: string
  color: string
}

export interface Expense {
  id: string
  workspace_id: string
  category_id: string | null
  vendor: string | null
  description: string
  amount: number
  currency: string
  expense_date: string
  receipt_url: string | null
  status: 'recorded' | 'reimbursed' | 'pending'
  created_at: string
}

export type NotificationType =
  | 'info' | 'invoice' | 'payment' | 'expense' | 'dispute' | 'system'

export interface Notification {
  id: string
  workspace_id: string
  user_id: string | null
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  entity_type: string | null
  entity_id: string | null
  read: boolean
  read_at: string | null
  created_at: string
}

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected'

export interface Dispute {
  id: string
  workspace_id: string
  invoice_id: string
  client_id: string
  reason: string
  details: string | null
  status: DisputeStatus
  resolution_note: string | null
  created_at: string
  resolved_at: string | null
}

export interface Message {
  id: string
  workspace_id: string
  client_id: string
  invoice_id: string | null
  dispute_id: string | null
  sender_type: 'client' | 'workspace'
  sender_user_id: string | null
  body: string
  read_at: string | null
  created_at: string
}

export interface ApiKey {
  id: string
  workspace_id: string
  name: string
  key_prefix: string
  scopes: string[]
  rate_limit_per_min: number
  last_used_at: string | null
  expires_at: string | null
  revoked: boolean
  created_at: string
}

export interface ForecastContent {
  cashFlowPrediction: string
  riskScore: number          // 0-100
  riskLevel: 'low' | 'medium' | 'high'
  recommendations: string[]
  generatedFor: string       // ISO date the forecast was generated for
}

export interface SearchResult {
  entity_type: 'client' | 'invoice' | 'member' | 'notification' | 'activity'
  entity_id: string
  title: string
  subtitle: string
  rank: number
}
