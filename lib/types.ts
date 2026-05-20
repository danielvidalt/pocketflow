export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'annual' | 'once'
export const FREQ_DIVISORS: Record<Frequency, number> = { weekly:1, fortnightly:2, monthly:4.33, annual:52, once:1 }
export const FREQ_LABELS: Record<Frequency, string> = { weekly:'Semanal', fortnightly:'Quincenal', monthly:'Mensual', annual:'Anual', once:'Puntual' }
export const DOW_LABELS: Record<number, string> = { 0:'Lunes', 1:'Martes', 2:'Miércoles', 3:'Jueves', 4:'Viernes', 5:'Sábado', 6:'Domingo' }
export type IncomeSource = { id:string; user_id:string; name:string; amount:number; frequency:Frequency; day_of_week:number|null; color:string; icon:string; is_active:boolean; created_at:string }
export type IncomeEntry = { id:string; user_id:string; source_id:string|null; amount:number; received_at:string; note:string|null; created_at:string }
export type ExpenseCategory = 'food'|'transport'|'leisure'|'shopping'|'health'|'housing'|'subscriptions'|'other'
export const CAT_LABELS: Record<ExpenseCategory, string> = { food:'Comida', transport:'Transporte', leisure:'Ocio', shopping:'Compras', health:'Salud', housing:'Vivienda', subscriptions:'Suscripciones', other:'Otro' }
export const CAT_COLORS: Record<ExpenseCategory, string> = { food:'#1D9E75', transport:'#534AB7', leisure:'#BA7517', shopping:'#993556', health:'#3B6D11', housing:'#185FA5', subscriptions:'#D85A30', other:'#5F5E5A' }
export type Expense = { id:string; user_id:string; name:string; amount:number; category:ExpenseCategory; expense_date:string; is_recurring:boolean; note:string|null; created_at:string }
export type RecurringExpense = { id:string; user_id:string; name:string; amount:number; category:ExpenseCategory; frequency:'weekly'|'fortnightly'|'monthly'; is_active:boolean; created_at:string }
export function weeklyExpenseEquivalent(exp: Pick<RecurringExpense,'amount'|'frequency'>): number { return exp.amount / FREQ_DIVISORS[exp.frequency] }
export type DebtPocket = { id:string; user_id:string; name:string; target_amount:number; target_currency:string; current_amount_aud:number; weekly_goal_aud:number; deadline:string|null; emoji:string; created_at:string }
export type SavingsGoal = { id:string; user_id:string; name:string; target_amount:number; current_amount:number; deadline:string|null; color:string }
export function weeklyEquivalent(source: Pick<IncomeSource,'amount'|'frequency'>): number { return source.amount / FREQ_DIVISORS[source.frequency] }
export function formatAUD(amount: number): string { return new Intl.NumberFormat('en-AU',{style:'currency',currency:'AUD',minimumFractionDigits:2}).format(amount) }
