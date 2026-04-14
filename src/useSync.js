import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const ROW_ID = 'shared'

function loadLocal() {
  try {
    return {
      transactions:   JSON.parse(localStorage.getItem('budget_tx')               || '{}'),
      budgets:        JSON.parse(localStorage.getItem('budget_limits')            || '{}'),
      plannedSavings: JSON.parse(localStorage.getItem('budget_planned_savings')   || '0'),
    }
  } catch {
    return { transactions: {}, budgets: {}, plannedSavings: 0 }
  }
}

function saveLocal(data) {
  localStorage.setItem('budget_tx',               JSON.stringify(data.transactions))
  localStorage.setItem('budget_limits',           JSON.stringify(data.budgets))
  localStorage.setItem('budget_planned_savings',  JSON.stringify(data.plannedSavings))
}

export function useSync() {
  const [data, setData]       = useState(loadLocal)
  const [synced, setSynced]   = useState(false)
  const [online, setOnline]   = useState(true)
  const debounceRef           = useRef(null)

  // On mount: fetch latest from Supabase then subscribe to real-time changes
  useEffect(() => {
    let channel

    async function init() {
      const { data: row, error } = await supabase
        .from('budget_data')
        .select('*')
        .eq('id', ROW_ID)
        .single()

      if (!error && row) {
        const remote = {
          transactions:   row.transactions   || {},
          budgets:        row.budgets        || {},
          plannedSavings: row.planned_savings || 0,
        }
        setData(remote)
        saveLocal(remote)
        setOnline(true)
      } else if (error?.code === 'PGRST116') {
        // Row doesn't exist yet — create it with local data
        const local = loadLocal()
        await supabase.from('budget_data').insert({
          id:              ROW_ID,
          transactions:    local.transactions,
          budgets:         local.budgets,
          planned_savings: local.plannedSavings,
        })
      } else {
        setOnline(false)
      }
      setSynced(true)
    }

    init()

    // Real-time subscription
    channel = supabase
      .channel('budget-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_data' }, payload => {
        if (payload.new) {
          const remote = {
            transactions:   payload.new.transactions   || {},
            budgets:        payload.new.budgets        || {},
            plannedSavings: payload.new.planned_savings || 0,
          }
          setData(remote)
          saveLocal(remote)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Debounced write to Supabase (300ms after last change)
  function update(newData) {
    setData(newData)
    saveLocal(newData)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const { error } = await supabase.from('budget_data').upsert({
        id:              ROW_ID,
        transactions:    newData.transactions,
        budgets:         newData.budgets,
        planned_savings: newData.plannedSavings,
        updated_at:      new Date().toISOString(),
      })
      if (error) console.error('Sync error:', error)
    }, 300)
  }

  return { data, update, synced, online }
}
