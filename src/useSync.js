import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

const ROW_ID = 'shared'

function loadLocal() {
  try {
    return {
      transactions:   JSON.parse(localStorage.getItem('budget_tx')             || '{}'),
      budgets:        JSON.parse(localStorage.getItem('budget_limits')         || '{}'),
      plannedSavings: JSON.parse(localStorage.getItem('budget_planned_savings')|| '0'),
    }
  } catch {
    return { transactions: {}, budgets: {}, plannedSavings: 0 }
  }
}

function saveLocal(data) {
  localStorage.setItem('budget_tx',              JSON.stringify(data.transactions))
  localStorage.setItem('budget_limits',          JSON.stringify(data.budgets))
  localStorage.setItem('budget_planned_savings', JSON.stringify(data.plannedSavings))
}

export function useSync() {
  const [data, setData]     = useState(loadLocal)
  const [synced, setSynced] = useState(false)
  const [online, setOnline] = useState(true)

  // Always-current ref so update() never closes over stale state
  const dataRef    = useRef(data)
  const debounceRef = useRef(null)

  useEffect(() => { dataRef.current = data }, [data])

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
        dataRef.current = remote
        setData(remote)
        saveLocal(remote)
        setOnline(true)
      } else if (error?.code === 'PGRST116') {
        // Row doesn't exist yet — seed with local data
        const local = loadLocal()
        await supabase.from('budget_data').insert({
          id:              ROW_ID,
          transactions:    local.transactions,
          budgets:         local.budgets,
          planned_savings: local.plannedSavings,
        })
        setOnline(true)
      } else {
        console.warn('Supabase init error:', error)
        setOnline(false)
      }
      setSynced(true)
    }

    init()

    channel = supabase
      .channel('budget-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_data' }, payload => {
        if (payload.new) {
          const remote = {
            transactions:   payload.new.transactions   || {},
            budgets:        payload.new.budgets        || {},
            plannedSavings: payload.new.planned_savings || 0,
          }
          dataRef.current = remote
          setData(remote)
          saveLocal(remote)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  // Accepts a new value OR an updater function — always reads latest via ref
  function update(newDataOrFn) {
    const newData = typeof newDataOrFn === 'function'
      ? newDataOrFn(dataRef.current)
      : newDataOrFn

    dataRef.current = newData
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
      else setOnline(true)
    }, 300)
  }

  return { data, update, synced, online }
}
