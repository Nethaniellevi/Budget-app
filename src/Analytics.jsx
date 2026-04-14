import { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

const CATEGORIES = [
  { id: 'housing',       label: 'Housing / Rent',          icon: '🏠' },
  { id: 'groceries',     label: 'Groceries',               icon: '🛒' },
  { id: 'dining',        label: 'Entertainment / Dining',  icon: '🍽️' },
  { id: 'transport',     label: 'Transportation',          icon: '🚗' },
  { id: 'shopping',      label: 'Shopping / Gifts',        icon: '🛍️' },
  { id: 'appliances',    label: 'Appliances / House',      icon: '🔧' },
  { id: 'utilities',     label: 'Utilities',               icon: '💡' },
  { id: 'health',        label: 'Health / Medical',        icon: '❤️' },
  { id: 'personal',      label: 'Personal Care',           icon: '🪥' },
  { id: 'subscriptions', label: 'Subscriptions',           icon: '📱' },
  { id: 'travel',        label: 'Travel / Vacation',       icon: '✈️' },
  { id: 'savings',       label: 'Savings',                 icon: '💰' },
  { id: 'other',         label: 'Other',                   icon: '📦' },
]

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function monthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function parseMonthKey(mk) {
  const [y, m] = mk.split('-').map(Number)
  return { year: y, month: m - 1 }
}

function shortLabel(mk) {
  const { year, month } = parseMonthKey(mk)
  return `${MONTHS_SHORT[month]} '${String(year).slice(2)}`
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

// Sort month keys chronologically
function sortedMonthKeys(allTx, allBudgets) {
  const keys = new Set([...Object.keys(allTx), ...Object.keys(allBudgets)])
  return [...keys].sort()
}

// Build monthly aggregated data
function buildMonthlyData(allTx, allBudgets, plannedSavings) {
  const keys = sortedMonthKeys(allTx, allBudgets)
  return keys.map(mk => {
    const txList  = allTx[mk]  || []
    const budgets = allBudgets[mk] || {}
    const expenses = txList.filter(t => t.type === 'expense')
    const incomes  = txList.filter(t => t.type === 'income')
    const spent    = expenses.reduce((s, t) => s + t.amount, 0)
    const income   = incomes.reduce((s, t) => s + t.amount, 0)
    const budget   = Object.values(budgets).reduce((s, v) => s + (v || 0), 0)
    const savings  = income - spent
    return { mk, label: shortLabel(mk), spent, budget, income, savings, plannedSavings }
  })
}

// Build weekly data for a given month
function buildWeeklyData(txList, year, month) {
  const total = daysInMonth(year, month)
  const weeks = [
    { label: 'Week 1', days: [1, 7] },
    { label: 'Week 2', days: [8, 14] },
    { label: 'Week 3', days: [15, 21] },
    { label: 'Week 4', days: [22, total] },
  ]
  const expenses = txList.filter(t => t.type === 'expense')
  return weeks.map(w => {
    const spent = expenses
      .filter(t => {
        const d = parseInt(t.date.split('-')[2], 10)
        return d >= w.days[0] && d <= w.days[1]
      })
      .reduce((s, t) => s + t.amount, 0)
    return { label: w.label, spent }
  })
}

// Build monthly data per category
function buildCategoryMonthlyData(allTx, allBudgets, categoryId) {
  const keys = sortedMonthKeys(allTx, allBudgets)
  return keys.map(mk => {
    const expenses = (allTx[mk] || []).filter(t => t.type === 'expense' && t.category === categoryId)
    const spent    = expenses.reduce((s, t) => s + t.amount, 0)
    const budget   = (allBudgets[mk] || {})[categoryId] || 0
    return { mk, label: shortLabel(mk), spent, budget }
  })
}

// Custom tooltip
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'white', border: '1px solid #e2e6ea',
      borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: '#2d3748' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
          <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color, display: 'inline-block' }} />
          <span style={{ color: '#718096' }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: '#2d3748' }}>{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{
      background: 'white', borderRadius: 12,
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      overflow: 'hidden', marginBottom: 16,
    }}>
      <div style={{
        padding: '14px 20px', borderBottom: '1px solid #e2e6ea',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{title}</div>
        {subtitle && <div style={{ fontSize: '0.78rem', color: '#718096' }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '20px 16px 16px' }}>
        {children}
      </div>
    </div>
  )
}

function EmptyChart() {
  return (
    <div style={{ textAlign: 'center', padding: '32px 0', color: '#718096' }}>
      <div style={{ fontSize: '2rem', marginBottom: 8 }}>📭</div>
      <p style={{ fontSize: '0.85rem' }}>Not enough data yet. Add transactions to see charts.</p>
    </div>
  )
}

// ─── Chart 1: Total Spend vs Total Budget (Monthly) ──────────────────────────

function SpendVsBudgetChart({ allTx, allBudgets }) {
  const data = buildMonthlyData(allTx, allBudgets, 0)
  const hasData = data.some(d => d.spent > 0 || d.budget > 0)
  if (!hasData) return <EmptyChart />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barGap={4}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#718096' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} width={50} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
        <Bar dataKey="budget" name="Budget" fill="#c7d2fe" radius={[4,4,0,0]} maxBarSize={40} />
        <Bar dataKey="spent"  name="Spent"  fill="#6c63ff" radius={[4,4,0,0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Chart 2: Weekly Spend ────────────────────────────────────────────────────

function WeeklySpendChart({ allTx, year, month }) {
  const mk = monthKey(year, month)
  const txList = allTx[mk] || []
  const data = buildWeeklyData(txList, year, month)
  const hasData = data.some(d => d.spent > 0)
  if (!hasData) return <EmptyChart />

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barSize={40}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#718096' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} width={50} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="spent" name="Spent" fill="#6c63ff" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Chart 3: Category Spend vs Budget ───────────────────────────────────────

function CategoryChart({ allTx, allBudgets }) {
  const [selectedCat, setSelectedCat] = useState(CATEGORIES[0].id)
  const cat = CATEGORIES.find(c => c.id === selectedCat)
  const data = buildCategoryMonthlyData(allTx, allBudgets, selectedCat)
  const hasData = data.some(d => d.spent > 0 || d.budget > 0)

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <select
          value={selectedCat}
          onChange={e => setSelectedCat(e.target.value)}
          style={{
            padding: '8px 12px', border: '1.5px solid #e2e6ea',
            borderRadius: 8, fontSize: '0.88rem', fontWeight: 600,
            background: 'white', outline: 'none', cursor: 'pointer',
            color: '#2d3748', width: '100%', maxWidth: 280,
          }}
        >
          {CATEGORIES.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
          ))}
        </select>
      </div>

      {!hasData ? <EmptyChart /> : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#718096' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} width={50} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
            <Bar dataKey="budget" name="Budget" fill="#c7d2fe" radius={[4,4,0,0]} maxBarSize={40} />
            <Bar dataKey="spent"  name="Spent"  fill="#6c63ff" radius={[4,4,0,0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </>
  )
}

// ─── Chart 4: Savings — Planned vs Actual ────────────────────────────────────

function SavingsChart({ allTx, allBudgets, plannedSavings }) {
  const data = buildMonthlyData(allTx, allBudgets, plannedSavings)
  const hasData = data.some(d => d.income > 0)
  if (!hasData) return <EmptyChart />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#718096' }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} tick={{ fontSize: 11, fill: '#718096' }} axisLine={false} tickLine={false} width={50} />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ fontSize: '0.8rem', paddingTop: 8 }} />
        {plannedSavings > 0 && (
          <ReferenceLine y={plannedSavings} stroke="#6c63ff" strokeDasharray="6 3" strokeWidth={2}
            label={{ value: `Goal ${fmt(plannedSavings)}`, position: 'insideTopRight', fontSize: 11, fill: '#6c63ff', fontWeight: 700 }} />
        )}
        <Bar dataKey="savings" name="Actual Savings" radius={[4,4,0,0]} maxBarSize={40}
          fill="#38a169"
          // Negative savings shown in red
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Main Analytics Component ─────────────────────────────────────────────────

export default function Analytics({ allTx, allBudgets, plannedSavings, year, month }) {
  return (
    <div>
      <ChartCard
        title="📊 Total Spend vs Total Budget"
        subtitle="Monthly comparison of what you budgeted vs what you actually spent"
      >
        <SpendVsBudgetChart allTx={allTx} allBudgets={allBudgets} />
      </ChartCard>

      <ChartCard
        title="📅 Weekly Spending"
        subtitle="How your spending is distributed week by week this month"
      >
        <WeeklySpendChart allTx={allTx} year={year} month={month} />
      </ChartCard>

      <ChartCard
        title="🏷️ Category: Spend vs Budget"
        subtitle="Select a category to see month-by-month spend vs budget"
      >
        <CategoryChart allTx={allTx} allBudgets={allBudgets} />
      </ChartCard>

      <ChartCard
        title="💰 Savings: Planned vs Actual"
        subtitle={plannedSavings > 0 ? `Dashed line = your ${fmt(plannedSavings)}/mo savings goal` : 'Set a savings goal in Budget Settings to see it here'}
      >
        <SavingsChart allTx={allTx} allBudgets={allBudgets} plannedSavings={plannedSavings} />
      </ChartCard>
    </div>
  )
}
