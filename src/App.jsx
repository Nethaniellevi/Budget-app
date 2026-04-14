import { useState, useEffect } from 'react'
import './index.css'
import Analytics from './Analytics.jsx'
import { useSync } from './useSync.js'

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'housing',       label: 'Housing / Rent',          icon: '🏠', color: '#dbeafe', textColor: '#1e40af' },
  { id: 'groceries',     label: 'Groceries',               icon: '🛒', color: '#dcfce7', textColor: '#166534' },
  { id: 'dining',        label: 'Entertainment / Dining',  icon: '🍽️', color: '#fef9c3', textColor: '#854d0e' },
  { id: 'transport',     label: 'Transportation',          icon: '🚗', color: '#fce7f3', textColor: '#9d174d' },
  { id: 'shopping',      label: 'Shopping / Gifts',        icon: '🛍️', color: '#fce7f3', textColor: '#831843' },
  { id: 'appliances',    label: 'Appliances / House',      icon: '🔧', color: '#e0f2fe', textColor: '#0369a1' },
  { id: 'utilities',     label: 'Utilities',               icon: '💡', color: '#ede9fe', textColor: '#5b21b6' },
  { id: 'health',        label: 'Health / Medical',        icon: '❤️', color: '#fee2e2', textColor: '#991b1b' },
  { id: 'personal',      label: 'Personal Care',           icon: '🪥', color: '#f0fdf4', textColor: '#15803d' },
  { id: 'subscriptions', label: 'Subscriptions',           icon: '📱', color: '#fff7ed', textColor: '#c2410c' },
  { id: 'travel',        label: 'Travel / Vacation',       icon: '✈️', color: '#f0f9ff', textColor: '#0284c7' },
  { id: 'savings',       label: 'Savings',                 icon: '💰', color: '#dcfce7', textColor: '#14532d' },
  { id: 'other',         label: 'Other',                   icon: '📦', color: '#f1f5f9', textColor: '#475569' },
]

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

function monthKey(year, month) { return `${year}-${String(month + 1).padStart(2, '0')}` }

function useLocalStorage(key, initial) {
  const [value, setValue] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial }
    catch { return initial }
  })
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)) }, [key, value])
  return [value, setValue]
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}
function fmtD(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function catById(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1] }

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate() }

// ─── Smart Suggestions ───────────────────────────────────────────────────────

function buildSuggestions({ totalIncome, totalSpent, plannedSavings, budgets, spentByCategory, dayOfMonth, totalDays, isCurrentMonth }) {
  const suggestions = []
  const actualSavings = totalIncome - totalSpent
  const budgetTotal = Object.values(budgets).reduce((s, v) => s + (v || 0), 0)

  if (totalIncome === 0) {
    suggestions.push({ type: 'warning', icon: '⚠️', text: "You haven't logged any income yet. Add your income to get accurate savings and spending projections." })
    return suggestions
  }

  // Savings goal progress
  if (plannedSavings > 0) {
    const diff = actualSavings - plannedSavings
    if (diff >= 0) {
      suggestions.push({ type: 'success', icon: '🎉', text: `Great work! You're ${fmt(diff)} ahead of your ${fmt(plannedSavings)} savings goal this month.` })
    } else {
      suggestions.push({ type: 'warning', icon: '🎯', text: `You're ${fmt(Math.abs(diff))} short of your ${fmt(plannedSavings)} savings goal. Try to cut ${fmt(Math.abs(diff))} more this month.` })
    }
  }

  // Spending pace (only meaningful for current month with partial data)
  if (isCurrentMonth && dayOfMonth > 1 && totalSpent > 0) {
    const dailyRate = totalSpent / dayOfMonth
    const projected = Math.round(dailyRate * totalDays)
    const projectedSavings = totalIncome - projected
    if (budgetTotal > 0) {
      const pctMonthElapsed = (dayOfMonth / totalDays) * 100
      const pctBudgetUsed = (totalSpent / budgetTotal) * 100
      if (pctBudgetUsed > pctMonthElapsed + 15) {
        suggestions.push({ type: 'warning', icon: '🔥', text: `You're spending faster than planned. ${Math.round(pctMonthElapsed)}% of the month has passed but ${Math.round(pctBudgetUsed)}% of your budget is used. Projected end-of-month spend: ${fmt(projected)}.` })
      } else if (pctBudgetUsed < pctMonthElapsed - 10) {
        suggestions.push({ type: 'success', icon: '✅', text: `You're spending below pace. ${Math.round(pctMonthElapsed)}% of the month gone, only ${Math.round(pctBudgetUsed)}% of budget used. Projected end-of-month spend: ${fmt(projected)}.` })
      } else {
        suggestions.push({ type: 'tip', icon: '📈', text: `At your current pace, you'll spend about ${fmt(projected)} this month, leaving ${fmt(projectedSavings)} in savings.` })
      }
    } else {
      suggestions.push({ type: 'tip', icon: '📈', text: `At your current daily rate of ${fmtD(dailyRate)}/day, you're on track to spend ${fmt(projected)} by month end.` })
    }
  }

  // Over-budget categories
  const overBudget = CATEGORIES.filter(c => budgets[c.id] > 0 && (spentByCategory[c.id] || 0) > budgets[c.id])
  if (overBudget.length > 0) {
    overBudget.forEach(c => {
      const over = spentByCategory[c.id] - budgets[c.id]
      suggestions.push({ type: 'warning', icon: c.icon, text: `${c.label} is ${fmt(over)} over budget. Consider cutting back or adjusting your limit.` })
    })
  }

  // Near-limit categories (80–100% of budget)
  const nearLimit = CATEGORIES.filter(c => {
    if (!budgets[c.id] || overBudget.includes(c)) return false
    const pct = ((spentByCategory[c.id] || 0) / budgets[c.id]) * 100
    return pct >= 80
  })
  nearLimit.forEach(c => {
    const left = budgets[c.id] - (spentByCategory[c.id] || 0)
    suggestions.push({ type: 'caution', icon: c.icon, text: `${c.label} is almost maxed — only ${fmt(left)} left in budget.` })
  })

  // Top spending category
  const topCat = CATEGORIES.map(c => ({ c, spent: spentByCategory[c.id] || 0 })).sort((a, b) => b.spent - a.spent)[0]
  if (topCat && topCat.spent > 0 && totalSpent > 0) {
    const pct = Math.round((topCat.spent / totalSpent) * 100)
    if (pct > 35) {
      suggestions.push({ type: 'tip', icon: topCat.c.icon, text: `${topCat.c.label} is your biggest expense at ${fmt(topCat.spent)} (${pct}% of total spending). Is that within expectations?` })
    }
  }

  // Savings rate
  if (totalIncome > 0) {
    const rate = Math.round((actualSavings / totalIncome) * 100)
    if (rate < 0) {
      suggestions.push({ type: 'danger', icon: '🚨', text: `You've spent ${fmt(Math.abs(actualSavings))} more than your income this month. Review your expenses to get back on track.` })
    } else if (rate >= 20) {
      suggestions.push({ type: 'success', icon: '💪', text: `Solid savings rate — you're saving ${rate}% of your income this month. Financial experts recommend 20%+.` })
    } else if (rate > 0 && rate < 10) {
      suggestions.push({ type: 'tip', icon: '💡', text: `Your savings rate is ${rate}%. Try to work toward saving at least 20% of your income each month.` })
    }
  }

  // Unbudgeted categories with spending
  const unbudgeted = CATEGORIES.filter(c => !budgets[c.id] && (spentByCategory[c.id] || 0) > 0)
  if (unbudgeted.length > 0) {
    suggestions.push({ type: 'tip', icon: '📋', text: `You have spending in ${unbudgeted.map(c => c.label).join(', ')} but no budget set. Add limits to track these better.` })
  }

  if (suggestions.length === 0) {
    suggestions.push({ type: 'success', icon: '🌟', text: "Everything looks great! Keep tracking your spending to stay on top of your finances." })
  }

  return suggestions
}

// ─── Components ──────────────────────────────────────────────────────────────

function Modal({ title, onClose, children, actions }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h3>{title}</h3>
        {children}
        <div className="modal-actions">{actions}</div>
      </div>
    </div>
  )
}

function AddTransactionModal({ onSave, onClose, defaultType }) {
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category: 'groceries',
    type: defaultType || 'expense',
    date: new Date().toISOString().slice(0, 10),
    person: 'both',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.description.trim() || !form.amount || isNaN(Number(form.amount))) return
    onSave({ ...form, amount: Math.abs(Number(form.amount)), id: Date.now() })
    onClose()
  }

  return (
    <Modal title="Add Transaction" onClose={onClose} actions={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save</button>
      </>
    }>
      <div className="form-row" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Description</label>
        <input type="text" placeholder="e.g. Whole Foods, Netflix…" value={form.description}
          onChange={e => set('description', e.target.value)} autoFocus />
      </div>
      <div className="form-row" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Amount ($)</label>
          <input type="number" min="0" step="0.01" placeholder="0.00"
            value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>
        {form.type === 'expense' && (
          <div className="form-group">
            <label>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)}>
              {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
            </select>
          </div>
        )}
      </div>
      <div className="form-group">
        <label>Who paid?</label>
        <select value={form.person} onChange={e => set('person', e.target.value)}>
          <option value="both">Both</option>
          <option value="me">Me</option>
          <option value="spouse">My Spouse</option>
        </select>
      </div>
    </Modal>
  )
}

function BudgetSetupModal({ budgets, plannedSavings, onSave, onSavePlanned, onClose }) {
  const [local, setLocal] = useState({ ...budgets })
  const [savingsGoal, setSavingsGoal] = useState(plannedSavings)
  const set = (id, v) => setLocal(b => ({ ...b, [id]: v }))

  return (
    <Modal title="Budget Settings" onClose={onClose} actions={
      <>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={() => { onSave(local); onSavePlanned(Number(savingsGoal) || 0); onClose() }}>Save</button>
      </>
    }>
      <div style={{ marginBottom: 18, padding: '12px 14px', background: 'var(--primary-light)', borderRadius: 10 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
          Monthly Savings Goal
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 700, color: 'var(--primary)' }}>$</span>
          <input
            type="number" min="0" placeholder="e.g. 500"
            value={savingsGoal || ''}
            onChange={e => setSavingsGoal(e.target.value)}
            style={{ flex: 1, padding: '7px 10px', border: '1.5px solid var(--primary)', borderRadius: 8, fontSize: '1rem', fontWeight: 700, outline: 'none', background: 'white' }}
          />
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>
          How much you want to save each month as a couple
        </div>
      </div>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Set a spending limit per category.
      </p>
      <div className="budget-setup-list">
        {CATEGORIES.map(c => (
          <div key={c.id} className="budget-setup-item">
            <div className="cat-icon" style={{ background: c.color, color: c.textColor }}>{c.icon}</div>
            <span className="cat-label">{c.label}</span>
            <input type="number" min="0" placeholder="0"
              value={local[c.id] || ''}
              onChange={e => set(c.id, e.target.value ? Number(e.target.value) : 0)} />
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Insights Components ──────────────────────────────────────────────────────

function SavingsTracker({ planned, actual, totalIncome }) {
  const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0
  const status = actual >= planned ? 'ok' : actual >= planned * 0.7 ? 'warn' : 'over'
  const savingsRate = totalIncome > 0 ? Math.round((actual / totalIncome) * 100) : 0

  return (
    <div className="card">
      <div className="card-header"><h2>💰 Savings This Month</h2></div>
      <div className="card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Actual Savings</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: actual >= 0 ? 'var(--success)' : 'var(--danger)', lineHeight: 1.1, marginTop: 2 }}>
              {fmt(actual)}
            </div>
            {totalIncome > 0 && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
                {savingsRate}% of income saved
              </div>
            )}
          </div>
          {planned > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Goal</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary)' }}>{fmt(planned)}</div>
            </div>
          )}
        </div>
        {planned > 0 && (
          <>
            <div className="progress-bar" style={{ height: 10, marginBottom: 6 }}>
              <div className={`progress-fill ${status}`} style={{ width: `${pct}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{Math.round(pct)}% of goal reached</span>
              <span>{actual >= planned ? `${fmt(actual - planned)} over goal` : `${fmt(planned - actual)} to go`}</span>
            </div>
          </>
        )}
        {!planned && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
            Set a savings goal in Budget Settings to track your progress.
          </div>
        )}
      </div>
    </div>
  )
}

function PaceTracker({ totalSpent, budgetTotal, dayOfMonth, totalDays, totalIncome, isCurrentMonth }) {
  if (!isCurrentMonth) return null
  const monthPct = Math.round((dayOfMonth / totalDays) * 100)
  const spendPct = budgetTotal > 0 ? Math.round((totalSpent / budgetTotal) * 100) : null
  const dailyRate = dayOfMonth > 0 ? totalSpent / dayOfMonth : 0
  const projected = Math.round(dailyRate * totalDays)
  const daysLeft = totalDays - dayOfMonth

  let paceStatus = 'ok'
  let paceLabel = 'On Track'
  if (spendPct !== null) {
    if (spendPct > monthPct + 15) { paceStatus = 'over'; paceLabel = 'Spending Fast' }
    else if (spendPct > monthPct + 5) { paceStatus = 'warn'; paceLabel = 'Slightly Ahead' }
    else if (spendPct < monthPct - 10) { paceStatus = 'ok'; paceLabel = 'Under Budget' }
  }

  const paceColors = { ok: 'var(--success)', warn: 'var(--warning)', over: 'var(--danger)' }

  return (
    <div className="card">
      <div className="card-header">
        <h2>📅 Month Progress</h2>
        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: paceColors[paceStatus], background: paceStatus === 'ok' ? 'var(--success-light)' : paceStatus === 'warn' ? 'var(--warning-light)' : 'var(--danger-light)', padding: '3px 10px', borderRadius: 99 }}>
          {paceLabel}
        </span>
      </div>
      <div className="card-body">
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 5 }}>
            <span>Day {dayOfMonth} of {totalDays}</span>
            <span>{monthPct}% of month elapsed</span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div className="progress-fill ok" style={{ width: `${monthPct}%`, background: '#cbd5e1' }} />
          </div>
        </div>

        {spendPct !== null && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 5 }}>
              <span>Budget used: {fmt(totalSpent)} of {fmt(budgetTotal)}</span>
              <span>{spendPct}%</span>
            </div>
            <div className="progress-bar" style={{ height: 8 }}>
              <div className={`progress-fill ${paceStatus}`} style={{ width: `${Math.min(spendPct, 100)}%` }} />
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
          {[
            { label: 'Daily Avg', value: fmt(dailyRate) },
            { label: 'Projected Total', value: fmt(projected) },
            { label: 'Days Left', value: daysLeft },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, marginTop: 3 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SpendingBreakdown({ spentByCategory, totalSpent }) {
  if (totalSpent === 0) return null
  const top = CATEGORIES
    .map(c => ({ c, spent: spentByCategory[c.id] || 0 }))
    .filter(x => x.spent > 0)
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 6)

  return (
    <div className="card">
      <div className="card-header"><h2>📊 Spending Breakdown</h2></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {top.map(({ c, spent }) => {
            const pct = Math.round((spent / totalSpent) * 100)
            return (
              <div key={c.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.85rem', fontWeight: 600 }}>
                    <div className="cat-icon" style={{ background: c.color, color: c.textColor, width: 24, height: 24, fontSize: '0.75rem' }}>{c.icon}</div>
                    {c.label}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{fmt(spent)}</span> · {pct}%
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill ok" style={{ width: `${pct}%`, background: c.textColor, opacity: 0.7 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Suggestions({ suggestions }) {
  const colors = {
    success: { bg: 'var(--success-light)', border: 'var(--success)', text: '#14532d' },
    warning: { bg: 'var(--warning-light)', border: 'var(--warning)', text: '#78350f' },
    caution: { bg: '#fffbeb', border: '#fbbf24', text: '#92400e' },
    danger:  { bg: 'var(--danger-light)',  border: 'var(--danger)',  text: '#7f1d1d' },
    tip:     { bg: 'var(--primary-light)', border: 'var(--primary)', text: '#3730a3' },
  }

  return (
    <div className="card">
      <div className="card-header"><h2>💡 Smart Suggestions</h2></div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {suggestions.map((s, i) => {
            const c = colors[s.type] || colors.tip
            return (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                background: c.bg, borderLeft: `3px solid ${c.border}`,
                borderRadius: 8, padding: '10px 12px',
              }}>
                <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                <span style={{ fontSize: '0.85rem', color: c.text, lineHeight: 1.5 }}>{s.text}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [tab, setTab] = useState('overview')

  const { data, update, synced, online } = useSync()
  const allTx          = data.transactions
  const allBudgets     = data.budgets
  const plannedSavings = data.plannedSavings

  const setAllTx = (fn) => {
    const next = typeof fn === 'function' ? fn(data.transactions) : fn
    update({ ...data, transactions: next })
  }
  const setAllBudgets = (fn) => {
    const next = typeof fn === 'function' ? fn(data.budgets) : fn
    update({ ...data, budgets: next })
  }
  const setPlannedSavings = (val) => {
    update({ ...data, plannedSavings: val })
  }

  const [showAddTx, setShowAddTx]           = useState(false)
  const [showBudgetSetup, setShowBudgetSetup] = useState(false)
  const [defaultTxType, setDefaultTxType]   = useState('expense')

  const mk      = monthKey(year, month)
  const txList  = allTx[mk] || []
  const budgets = allBudgets[mk] || {}

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth()
  const dayOfMonth = isCurrentMonth ? today.getDate() : daysInMonth(year, month)
  const totalDays  = daysInMonth(year, month)

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0) }  else setMonth(m => m + 1) }

  const addTx      = tx  => setAllTx(prev => ({ ...prev, [mk]: [tx, ...(prev[mk] || [])] }))
  const deleteTx   = id  => setAllTx(prev => ({ ...prev, [mk]: (prev[mk] || []).filter(t => t.id !== id) }))
  const saveBudgets = b  => setAllBudgets(prev => ({ ...prev, [mk]: b }))

  const expenses     = txList.filter(t => t.type === 'expense')
  const incomes      = txList.filter(t => t.type === 'income')
  const totalIncome  = incomes.reduce((s, t) => s + t.amount, 0)
  const totalSpent   = expenses.reduce((s, t) => s + t.amount, 0)
  const actualSavings = totalIncome - totalSpent
  const budgetTotal  = Object.values(budgets).reduce((s, v) => s + (v || 0), 0)

  const spentByCategory = {}
  expenses.forEach(t => { spentByCategory[t.category] = (spentByCategory[t.category] || 0) + t.amount })

  const suggestions = buildSuggestions({
    totalIncome, totalSpent, plannedSavings, budgets, spentByCategory,
    dayOfMonth, totalDays, isCurrentMonth,
  })

  const NAV_ITEMS = [
    { id: 'overview',      icon: '🏠', label: 'Budget' },
    { id: 'insights',      icon: '💡', label: 'Insights' },
    { id: 'analytics',     icon: '📊', label: 'Charts' },
    { id: 'transactions',  icon: '🧾', label: 'Expenses' },
    { id: 'income',        icon: '💵', label: 'Income' },
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>💑 Our Budget</h1>
          <p>Track your finances together</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 5, opacity: 0.85 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: !synced ? '#fbbf24' : online ? '#4ade80' : '#f87171', display: 'inline-block' }} />
            <span style={{ display: 'none' }} className="sync-label">{!synced ? 'Connecting…' : online ? 'Synced' : 'Offline'}</span>
          </div>
          <div className="month-nav">
            <button onClick={prevMonth}>‹</button>
            <span>{MONTHS[month]} {year}</span>
            <button onClick={nextMonth}>›</button>
          </div>
        </div>
      </header>

      <main className="main">
        {/* Summary bar */}
        <div className="summary-grid">
          <div className="summary-card income">
            <div className="label">Income</div>
            <div className="amount">{fmt(totalIncome)}</div>
          </div>
          <div className="summary-card spent">
            <div className="label">Spent</div>
            <div className="amount">{fmt(totalSpent)}</div>
          </div>
          <div className="summary-card remaining">
            <div className="label">Actual Savings</div>
            <div className="amount" style={{ color: actualSavings >= 0 ? 'var(--primary)' : 'var(--danger)' }}>
              {fmt(actualSavings)}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {['overview', 'insights', 'analytics', 'transactions', 'income'].map(t => (
            <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {tab === 'overview' && (
          <div className="card">
            <div className="card-header">
              <h2>Category Budgets</h2>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowBudgetSetup(true)}>✏️ Edit Budgets</button>
                <button className="btn btn-primary btn-sm" onClick={() => { setDefaultTxType('expense'); setShowAddTx(true) }}>+ Add Expense</button>
              </div>
            </div>
            <div className="card-body">
              {CATEGORIES.filter(c => (budgets[c.id] || 0) > 0 || (spentByCategory[c.id] || 0) > 0).length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">📊</div>
                  <p>No budget set yet.</p>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowBudgetSetup(true)}>Set Up Budgets</button>
                </div>
              ) : (
                <div className="category-list">
                  {CATEGORIES.map(c => {
                    const budget = budgets[c.id] || 0
                    const spent  = spentByCategory[c.id] || 0
                    if (!budget && !spent) return null
                    const pct    = budget > 0 ? Math.min((spent / budget) * 100, 100) : 100
                    const status = budget === 0 ? 'over' : pct < 70 ? 'ok' : pct < 95 ? 'warn' : 'over'
                    return (
                      <div key={c.id} className="category-item">
                        <div className="category-top">
                          <div className="category-name">
                            <div className="cat-icon" style={{ background: c.color, color: c.textColor }}>{c.icon}</div>
                            {c.label}
                          </div>
                          <div className="category-amounts">
                            <span><span className="spent-amt">{fmt(spent)}</span>{budget > 0 ? ` / ${fmt(budget)}` : ''}</span>
                            {budget > 0 && spent > budget && (
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>+{fmt(spent - budget)} over</span>
                            )}
                          </div>
                        </div>
                        {budget > 0 && (
                          <div className="progress-bar">
                            <div className={`progress-fill ${status}`} style={{ width: `${pct}%` }} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Insights ── */}
        {tab === 'insights' && (
          <>
            <SavingsTracker planned={plannedSavings} actual={actualSavings} totalIncome={totalIncome} />
            <PaceTracker
              totalSpent={totalSpent} budgetTotal={budgetTotal}
              dayOfMonth={dayOfMonth} totalDays={totalDays}
              totalIncome={totalIncome} isCurrentMonth={isCurrentMonth}
            />
            <SpendingBreakdown spentByCategory={spentByCategory} totalSpent={totalSpent} />
            <Suggestions suggestions={suggestions} />
          </>
        )}

        {/* ── Analytics ── */}
        {tab === 'analytics' && (
          <Analytics
            allTx={allTx}
            allBudgets={allBudgets}
            plannedSavings={plannedSavings}
            year={year}
            month={month}
          />
        )}

        {/* ── Transactions ── */}
        {tab === 'transactions' && (
          <div className="card">
            <div className="card-header">
              <h2>Transactions</h2>
              <button className="btn btn-primary btn-sm" onClick={() => { setDefaultTxType('expense'); setShowAddTx(true) }}>+ Add</button>
            </div>
            <div className="card-body">
              {expenses.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">🧾</div>
                  <p>No expenses this month yet.</p>
                </div>
              ) : (
                <div className="tx-list">
                  {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).map(tx => {
                    const cat = catById(tx.category)
                    return (
                      <div key={tx.id} className="tx-item">
                        <div className="tx-icon" style={{ background: cat.color, color: cat.textColor }}>{cat.icon}</div>
                        <div className="tx-info">
                          <div className="tx-desc">{tx.description}</div>
                          <div className="tx-meta">{cat.label} · {tx.date}{tx.person !== 'both' ? ` · ${tx.person === 'me' ? 'Me' : 'Spouse'}` : ''}</div>
                        </div>
                        <div className="tx-right">
                          <span className="tx-amount expense">-{fmt(tx.amount)}</span>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteTx(tx.id)}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Income ── */}
        {tab === 'income' && (
          <div className="card">
            <div className="card-header">
              <h2>Income</h2>
              <button className="btn btn-primary btn-sm" onClick={() => { setDefaultTxType('income'); setShowAddTx(true) }}>+ Add Income</button>
            </div>
            <div className="card-body">
              {incomes.length === 0 ? (
                <div className="empty">
                  <div className="empty-icon">💵</div>
                  <p>No income logged this month.</p>
                </div>
              ) : (
                <>
                  <div className="tx-list">
                    {[...incomes].sort((a, b) => b.date.localeCompare(a.date)).map(tx => (
                      <div key={tx.id} className="tx-item">
                        <div className="tx-icon" style={{ background: '#dcfce7', color: '#166534' }}>💵</div>
                        <div className="tx-info">
                          <div className="tx-desc">{tx.description}</div>
                          <div className="tx-meta">{tx.date}{tx.person !== 'both' ? ` · ${tx.person === 'me' ? 'Me' : 'Spouse'}` : ''}</div>
                        </div>
                        <div className="tx-right">
                          <span className="tx-amount income">+{fmt(tx.amount)}</span>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteTx(tx.id)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ color: 'var(--success)' }}>{fmt(totalIncome)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* FAB — mobile only, adds expense */}
      <button className="fab" onClick={() => { setDefaultTxType('expense'); setShowAddTx(true) }}>+</button>

      {/* Bottom nav — mobile only */}
      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`bottom-nav-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>

      {showAddTx && (
        <AddTransactionModal defaultType={defaultTxType} onSave={addTx} onClose={() => setShowAddTx(false)} />
      )}
      {showBudgetSetup && (
        <BudgetSetupModal
          budgets={budgets}
          plannedSavings={plannedSavings}
          onSave={saveBudgets}
          onSavePlanned={setPlannedSavings}
          onClose={() => setShowBudgetSetup(false)}
        />
      )}
    </div>
  )
}
