import { create } from 'zustand'
import { getClient } from './supabase'
import type { IncomeSource, IncomeEntry, Expense, DebtPocket, SavingsGoal, RecurringExpense } from './types'
import { weeklyEquivalent, weeklyExpenseEquivalent } from './types'
interface State {
  incomeSources:IncomeSource[]; incomeEntries:IncomeEntry[]; expenses:Expense[]
  recurringExpenses:RecurringExpense[]
  debtPockets:DebtPocket[]; savingsGoals:SavingsGoal[]; loading:boolean; exchangeRates:Record<string,number>
  fetchAll:()=>Promise<void>; fetchExchangeRates:()=>Promise<void>
  addIncomeSource:(d:Omit<IncomeSource,'id'|'user_id'|'created_at'>)=>Promise<void>
  deleteIncomeSource:(id:string)=>Promise<void>
  registerPayment:(sourceId:string|null,amount:number,date?:string,note?:string)=>Promise<void>
  addExpense:(d:Omit<Expense,'id'|'user_id'|'created_at'>)=>Promise<void>
  deleteExpense:(id:string)=>Promise<void>
  addRecurringExpense:(d:Omit<RecurringExpense,'id'|'user_id'|'created_at'>)=>Promise<void>
  deleteRecurringExpense:(id:string)=>Promise<void>
  addSavingsGoal:(d:Omit<SavingsGoal,'id'|'user_id'>)=>Promise<void>
  deleteSavingsGoal:(id:string)=>Promise<void>
  addToSavings:(id:string,amount:number)=>Promise<void>
  weeklyIncome:()=>number; weeklyFixedCosts:()=>number; todayExpenses:()=>Expense[]; weekExpenses:()=>Expense[]
}
function getWeekRange() {
  const now=new Date(); const day=now.getDay()
  const diff=(day===0?-6:1)-day
  const mon=new Date(now); mon.setDate(now.getDate()+diff); mon.setHours(0,0,0,0)
  const sun=new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999)
  return {mon,sun}
}
export const usePocketFlow = create<State>((set,get) => ({
  incomeSources:[], incomeEntries:[], expenses:[], recurringExpenses:[], debtPockets:[], savingsGoals:[], loading:false, exchangeRates:{},
  fetchAll: async () => {
    set({loading:true}); const db=getClient()
    const [s,e,ex,r,d,g] = await Promise.all([
      db.from('income_sources').select('*').order('created_at'),
      db.from('income_entries').select('*').order('received_at',{ascending:false}).limit(200),
      db.from('expenses').select('*').order('expense_date',{ascending:false}).limit(200),
      db.from('recurring_expenses').select('*').order('created_at'),
      db.from('debt_pockets').select('*').order('created_at'),
      db.from('savings_goals').select('*').order('created_at'),
    ])
    set({incomeSources:s.data||[],incomeEntries:e.data||[],expenses:ex.data||[],recurringExpenses:r.data||[],debtPockets:d.data||[],savingsGoals:g.data||[],loading:false})
  },
  fetchExchangeRates: async () => {
    try { const r=await fetch('https://api.frankfurter.app/latest?from=AUD&to=COP,USD,EUR'); const d=await r.json(); set({exchangeRates:d.rates||{}}) } catch {}
  },
  addIncomeSource: async (data) => {
    const db=getClient(); const {data:{user}}=await db.auth.getUser(); if(!user)return
    const {data:row}=await db.from('income_sources').insert({...data,user_id:user.id}).select().single()
    if(row) set(s=>({incomeSources:[...s.incomeSources,row]}))
  },
  deleteIncomeSource: async (id) => {
    await getClient().from('income_sources').delete().eq('id',id)
    set(s=>({incomeSources:s.incomeSources.filter(x=>x.id!==id)}))
  },
  registerPayment: async (sourceId,amount,date,note) => {
    const db=getClient(); const {data:{user}}=await db.auth.getUser(); if(!user)return
    const received_at=date||new Date().toISOString().split('T')[0]
    const {data:row}=await db.from('income_entries').insert({user_id:user.id,source_id:sourceId,amount,received_at,note:note||null}).select().single()
    if(row) set(s=>({incomeEntries:[row,...s.incomeEntries]}))
  },
  addExpense: async (data) => {
    const db=getClient(); const {data:{user}}=await db.auth.getUser(); if(!user)return
    const {data:row}=await db.from('expenses').insert({...data,user_id:user.id}).select().single()
    if(row) set(s=>({expenses:[row,...s.expenses]}))
  },
  deleteExpense: async (id) => {
    await getClient().from('expenses').delete().eq('id',id)
    set(s=>({expenses:s.expenses.filter(e=>e.id!==id)}))
  },
  addRecurringExpense: async (data) => {
    const db=getClient(); const {data:{user}}=await db.auth.getUser(); if(!user)return
    const {data:row}=await db.from('recurring_expenses').insert({...data,user_id:user.id}).select().single()
    if(row) set(s=>({recurringExpenses:[...s.recurringExpenses,row]}))
  },
  deleteRecurringExpense: async (id) => {
    await getClient().from('recurring_expenses').delete().eq('id',id)
    set(s=>({recurringExpenses:s.recurringExpenses.filter(e=>e.id!==id)}))
  },
  addSavingsGoal: async (data) => {
    const db=getClient(); const {data:{user}}=await db.auth.getUser(); if(!user)return
    const {data:row}=await db.from('savings_goals').insert({...data,user_id:user.id}).select().single()
    if(row) set(s=>({savingsGoals:[...s.savingsGoals,row]}))
  },
  deleteSavingsGoal: async (id) => {
    await getClient().from('savings_goals').delete().eq('id',id)
    set(s=>({savingsGoals:s.savingsGoals.filter(g=>g.id!==id)}))
  },
  addToSavings: async (id,amount) => {
    const db=getClient()
    const goal=get().savingsGoals.find(g=>g.id===id); if(!goal)return
    const newAmt=goal.current_amount+amount
    await db.from('savings_goals').update({current_amount:newAmt}).eq('id',id)
    set(s=>({savingsGoals:s.savingsGoals.map(g=>g.id===id?{...g,current_amount:newAmt}:g)}))
  },
  weeklyIncome: ()=>get().incomeSources.filter(s=>s.is_active).reduce((sum,s)=>sum+weeklyEquivalent(s),0),
  weeklyFixedCosts: ()=>get().recurringExpenses.filter(e=>e.is_active).reduce((sum,e)=>sum+weeklyExpenseEquivalent(e),0),
  todayExpenses: ()=>{ const t=new Date().toISOString().split('T')[0]; return get().expenses.filter(e=>e.expense_date===t) },
  weekExpenses: ()=>{ const {mon,sun}=getWeekRange(); return get().expenses.filter(e=>{const d=new Date(e.expense_date);return d>=mon&&d<=sun}) },
}))
