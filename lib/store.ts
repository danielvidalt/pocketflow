import { create } from 'zustand'
import { format } from 'date-fns'
import { getClient } from './supabase'
import type { IncomeSource, IncomeEntry, Expense, DebtPocket, SavingsGoal, RecurringExpense, FixedExpenseAllocation } from './types'
import { weeklyEquivalent, FREQ_DIVISORS } from './types'

// Categorías que el CHECK constraint de la DB acepta actualmente.
// Si agregas una nueva categoría en types.ts también debes correr la migración en Supabase.
const DB_VALID_CATEGORIES = new Set([
  'food','transport','leisure','shopping','health','housing','subscriptions','other',
  'supermarket', // incluido después de correr migration_add_supermarket_category.sql
])

interface State {
  incomeSources:IncomeSource[]; incomeEntries:IncomeEntry[]; expenses:Expense[]
  recurringExpenses:RecurringExpense[]; fixedExpenseAllocations:FixedExpenseAllocation[]
  debtPockets:DebtPocket[]; savingsGoals:SavingsGoal[]; loading:boolean; exchangeRates:Record<string,number>
  fetchAll:()=>Promise<void>; fetchExchangeRates:()=>Promise<void>
  addIncomeSource:(d:Omit<IncomeSource,'id'|'user_id'|'created_at'>)=>Promise<void>
  deleteIncomeSource:(id:string)=>Promise<void>
  registerPayment:(sourceId:string|null,amount:number,date?:string,note?:string)=>Promise<void>
  addExpense:(d:Omit<Expense,'id'|'user_id'|'created_at'>)=>Promise<void>
  deleteExpense:(id:string)=>Promise<void>
  deleteExpensesByDate:(date:string)=>Promise<void>
  deleteAllData:()=>Promise<void>
  deleteIncomeEntry:(id:string)=>Promise<void>
  deleteAllIncomeEntries:()=>Promise<void>
  deleteSavingsEntry:(expenseId:string,goalId:string,amount:number)=>Promise<void>
  addRecurringExpense:(d:Omit<RecurringExpense,'id'|'user_id'|'created_at'>)=>Promise<void>
  deleteRecurringExpense:(id:string)=>Promise<void>
  addSavingsGoal:(d:Omit<SavingsGoal,'id'|'user_id'>)=>Promise<void>
  deleteSavingsGoal:(id:string)=>Promise<void>
  addToSavings:(id:string,amount:number,date?:string)=>Promise<void>
  addFixedAllocation:(recurringExpenseId:string,amount:number,date?:string)=>Promise<void>
  deleteFixedAllocation:(id:string)=>Promise<void>
  weeklyIncome:()=>number; weeklyFixedCosts:()=>number; todayExpenses:()=>Expense[]; weekExpenses:()=>Expense[]
}

function getWeekRange() {
  const now=new Date(); const day=now.getDay()
  const diff=(day===0?-6:1)-day
  const mon=new Date(now); mon.setDate(now.getDate()+diff); mon.setHours(0,0,0,0)
  const sun=new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999)
  return {mon,sun}
}

async function getUser() {
  const db = getClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (error || !user) throw new Error('Sesión expirada. Por favor recargá la app.')
  return user
}

export const usePocketFlow = create<State>((set,get) => ({
  incomeSources:[], incomeEntries:[], expenses:[], recurringExpenses:[], fixedExpenseAllocations:[], debtPockets:[], savingsGoals:[], loading:false, exchangeRates:{},

  fetchAll: async () => {
    set({loading:true}); const db=getClient()
    const [s,e,ex,r,d,g,fa] = await Promise.all([
      db.from('income_sources').select('*').order('created_at'),
      db.from('income_entries').select('*').order('received_at',{ascending:false}).limit(500),
      db.from('expenses').select('*').order('expense_date',{ascending:false}).limit(500),
      db.from('recurring_expenses').select('*').order('created_at'),
      db.from('debt_pockets').select('*').order('created_at'),
      db.from('savings_goals').select('*').order('created_at'),
      db.from('fixed_expense_allocations').select('*').order('allocated_at',{ascending:false}).limit(500),
    ])
    set({
      incomeSources:s.data||[], incomeEntries:e.data||[], expenses:ex.data||[],
      recurringExpenses:r.data||[], fixedExpenseAllocations:fa.data||[], debtPockets:d.data||[], savingsGoals:g.data||[],
      loading:false,
    })
  },

  fetchExchangeRates: async () => {
    try {
      const r=await fetch('https://api.frankfurter.app/latest?from=AUD&to=COP,USD,EUR')
      const d=await r.json(); set({exchangeRates:d.rates||{}})
    } catch {}
  },

  addIncomeSource: async (data) => {
    const user = await getUser(); const db = getClient()
    const { data:row, error } = await db.from('income_sources').insert({...data,user_id:user.id}).select().single()
    if (error) throw new Error(error.message)
    if (row) set(s=>({incomeSources:[...s.incomeSources,row]}))
  },

  deleteIncomeSource: async (id) => {
    const { error } = await getClient().from('income_sources').delete().eq('id',id)
    if (error) throw new Error(error.message)
    set(s=>({incomeSources:s.incomeSources.filter(x=>x.id!==id)}))
  },

  registerPayment: async (sourceId,amount,date,note) => {
    const user = await getUser(); const db = getClient()
    const d=new Date()
    const received_at=date||`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const { data:row, error } = await db.from('income_entries')
      .insert({user_id:user.id,source_id:sourceId,amount,received_at,note:note||null})
      .select().single()
    if (error) throw new Error(error.message)
    if (row) set(s=>({incomeEntries:[row,...s.incomeEntries]}))
  },

  addExpense: async (data) => {
    const user = await getUser(); const db = getClient()
    // Usa 'other' si la categoría no está en el constraint actual de la DB
    const category = DB_VALID_CATEGORIES.has(data.category) ? data.category : 'other'
    const { data:row, error } = await db.from('expenses')
      .insert({...data, category, user_id:user.id})
      .select().single()
    if (error) throw new Error(error.message)
    if (row) set(s=>({expenses:[row,...s.expenses]}))
  },

  deleteExpense: async (id) => {
    const { error } = await getClient().from('expenses').delete().eq('id',id)
    if (error) throw new Error(error.message)
    set(s=>({expenses:s.expenses.filter(e=>e.id!==id)}))
  },

  deleteExpensesByDate: async (date) => {
    const { error } = await getClient().from('expenses').delete().eq('expense_date', date)
    if (error) throw new Error(error.message)
    set(s=>({expenses:s.expenses.filter(e=>e.expense_date!==date)}))
  },

  deleteAllData: async () => {
    const user = await getUser(); const db = getClient()
    // income_entries references income_sources — delete entries first
    await db.from('income_entries').delete().eq('user_id', user.id)
    await db.from('income_sources').delete().eq('user_id', user.id)
    await Promise.all([
      db.from('expenses').delete().eq('user_id', user.id),
      db.from('fixed_expense_allocations').delete().eq('user_id', user.id),
      db.from('recurring_expenses').delete().eq('user_id', user.id),
      db.from('savings_goals').delete().eq('user_id', user.id),
    ])
    set({expenses:[],incomeEntries:[],incomeSources:[],recurringExpenses:[],savingsGoals:[],fixedExpenseAllocations:[]})
  },

  deleteIncomeEntry: async (id) => {
    const { error } = await getClient().from('income_entries').delete().eq('id', id)
    if (error) throw new Error(error.message)
    set(s=>({incomeEntries:s.incomeEntries.filter(e=>e.id!==id)}))
  },

  deleteAllIncomeEntries: async () => {
    const user = await getUser()
    const { error } = await getClient().from('income_entries').delete().eq('user_id', user.id)
    if (error) throw new Error(error.message)
    set({incomeEntries:[]})
  },

  deleteSavingsEntry: async (expenseId, goalId, amount) => {
    const db = getClient()
    const goal = get().savingsGoals.find(g=>g.id===goalId)
    if (!goal) return
    const newAmt = Math.max(0, goal.current_amount - amount)
    await db.from('expenses').delete().eq('id', expenseId)
    await db.from('savings_goals').update({current_amount: newAmt}).eq('id', goalId)
    set(s=>({
      expenses: s.expenses.filter(e=>e.id!==expenseId),
      savingsGoals: s.savingsGoals.map(g=>g.id===goalId?{...g,current_amount:newAmt}:g),
    }))
  },

  addRecurringExpense: async (data) => {
    const user = await getUser(); const db = getClient()
    const { data:row, error } = await db.from('recurring_expenses').insert({...data,user_id:user.id}).select().single()
    if (error) throw new Error(error.message)
    if (row) set(s=>({recurringExpenses:[...s.recurringExpenses,row]}))
  },

  deleteRecurringExpense: async (id) => {
    const { error } = await getClient().from('recurring_expenses').delete().eq('id',id)
    if (error) throw new Error(error.message)
    set(s=>({recurringExpenses:s.recurringExpenses.filter(e=>e.id!==id), fixedExpenseAllocations:s.fixedExpenseAllocations.filter(a=>a.recurring_expense_id!==id)}))
  },

  addSavingsGoal: async (data) => {
    const user = await getUser(); const db = getClient()
    const { data:row, error } = await db.from('savings_goals').insert({...data,user_id:user.id}).select().single()
    if (error) throw new Error(error.message)
    if (row) set(s=>({savingsGoals:[...s.savingsGoals,row]}))
  },

  deleteSavingsGoal: async (id) => {
    const { error } = await getClient().from('savings_goals').delete().eq('id',id)
    if (error) throw new Error(error.message)
    set(s=>({savingsGoals:s.savingsGoals.filter(g=>g.id!==id)}))
  },

  addToSavings: async (id, amount, date?) => {
    const user = await getUser()
    const db = getClient()
    const goal = get().savingsGoals.find(g => g.id === id)
    if (!goal) return
    const newAmt = goal.current_amount + amount
    const { error } = await db.from('savings_goals').update({current_amount: newAmt}).eq('id', id)
    if (error) throw new Error(error.message)
    // Record as expense so it deducts from the available balance
    const goalName = goal.name.split('\x1F')[0]
    const expDate = date || format(new Date(), 'yyyy-MM-dd')
    const { data: expRow } = await db.from('expenses').insert({
      user_id: user.id, name: `Ahorro: ${goalName}`, amount,
      category: 'other', expense_date: expDate, is_recurring: false, note: null,
    }).select().single()
    set(s => ({
      savingsGoals: s.savingsGoals.map(g => g.id === id ? {...g, current_amount: newAmt} : g),
      expenses: expRow ? [expRow, ...s.expenses] : s.expenses,
    }))
  },

  addFixedAllocation: async (recurringExpenseId, amount, date?) => {
    const user = await getUser(); const db = getClient()
    const allocated_at = date || format(new Date(), 'yyyy-MM-dd')
    const { data:row, error } = await db.from('fixed_expense_allocations')
      .insert({user_id:user.id, recurring_expense_id:recurringExpenseId, amount, allocated_at})
      .select().single()
    if (error) throw new Error(error.message)
    if (row) set(s=>({fixedExpenseAllocations:[row,...s.fixedExpenseAllocations]}))
  },

  deleteFixedAllocation: async (id) => {
    const {error} = await getClient().from('fixed_expense_allocations').delete().eq('id',id)
    if (error) throw new Error(error.message)
    set(s=>({fixedExpenseAllocations:s.fixedExpenseAllocations.filter(a=>a.id!==id)}))
  },

  weeklyIncome: ()=>get().incomeSources.filter(s=>s.is_active).reduce((sum,s)=>sum+weeklyEquivalent(s),0),
  weeklyFixedCosts: () => {
    const { recurringExpenses, fixedExpenseAllocations } = get()
    const now = new Date()
    const todayStr = format(now, 'yyyy-MM-dd')
    return recurringExpenses.filter(e => e.is_active).reduce((sum, e) => {
      let start: string, end: string
      if (e.frequency === 'weekly') {
        const day = now.getDay(); const diff = (day === 0 ? -6 : 1) - day
        const mon = new Date(now); mon.setDate(now.getDate() + diff)
        const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
        start = format(mon, 'yyyy-MM-dd'); end = format(sun, 'yyyy-MM-dd')
      } else if (e.frequency === 'fortnightly') {
        const s = new Date(now); s.setDate(now.getDate() - 13)
        start = format(s, 'yyyy-MM-dd'); end = todayStr
      } else {
        start = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
        end = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), 'yyyy-MM-dd')
      }
      const allocated = fixedExpenseAllocations
        .filter(a => a.recurring_expense_id === e.id && a.allocated_at >= start && a.allocated_at <= end)
        .reduce((s, a) => s + a.amount, 0)
      return sum + allocated / FREQ_DIVISORS[e.frequency]
    }, 0)
  },
  todayExpenses: ()=>{ const t=new Date().toISOString().split('T')[0]; return get().expenses.filter(e=>e.expense_date===t) },
  weekExpenses: ()=>{ const {mon,sun}=getWeekRange(); return get().expenses.filter(e=>{const d=new Date(e.expense_date);return d>=mon&&d<=sun}) },
}))
