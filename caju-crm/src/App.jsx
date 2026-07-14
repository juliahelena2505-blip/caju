import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, onStateChange, avaliarFollowups, moverLead } from './lib/store.js'
import Analisar from './views/Analisar.jsx'
import Funil from './views/Funil.jsx'
import Dashboard from './views/Dashboard.jsx'
import Ajustes from './views/Ajustes.jsx'
import LeadModal from './views/LeadModal.jsx'

const TABS = [
  { id: 'analisar', label: 'Analisar', ico: '🔍' },
  { id: 'funil', label: 'Funil', ico: '🗂' },
  { id: 'dashboard', label: 'Dashboard', ico: '📈' },
  { id: 'ajustes', label: 'Ajustes', ico: '⚙️' },
]

export default function App() {
  const [state, setState] = useState(() => {
    try {
      const cached = localStorage.getItem('caju-cache')
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  const [tab, setTab] = useState('dashboard')
  const [toasts, setToasts] = useState([])
  const [leadAberto, setLeadAberto] = useState(null)
  const [isLoading, setIsLoading] = useState(!state)
  const autoRodou = useRef(false)

  useEffect(() => {
    if (state) {
      try {
        localStorage.setItem('caju-cache', JSON.stringify(state))
      } catch (e) {
        console.error('Erro ao salvar cache', e)
      }
    }
  }, [state])

  useEffect(() => {
    if (!isLoading) return
    loadState().then((initialState) => {
      setState(initialState)
      setIsLoading(false)
    })
  }, [isLoading])

  useEffect(() => {
    if (!state) return
    const unsubscribe = onStateChange((newState) => {
      setState(newState)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!state) return
    saveState(state)
  }, [state])

  const toast = (texto, warn = false) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, texto, warn }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }

  const updateLeads = (fn) => setState((s) => s ? { ...s, leads: fn(s.leads) } : s)
  const updateLead = (id, fn) => updateLeads((leads) => leads.map((l) => (l.id === id ? fn(l) : l)))
  const setSettings = (settings) => setState((s) => s ? { ...s, settings } : s)

  const { alerts } = useMemo(() => {
    if (!state) return { alerts: [], autoMoves: [] }
    return avaliarFollowups(state.leads)
  }, [state?.leads])

  useEffect(() => {
    if (!state) return
    const rodar = () => {
      setState((s) => {
        if (!s) return s
        const { autoMoves } = avaliarFollowups(s.leads)
        if (!autoMoves.length) return s
        const leads = s.leads.map((l) => {
          const mv = autoMoves.find((m) => m.leadId === l.id)
          return mv ? moverLead(l, 'perdido', { motivoPerda: mv.motivo }) : l
        })
        autoMoves.forEach((m) =>
          toast(`${m.nome} foi movido automaticamente para Perdido (${m.motivo}) após 3 follow-ups sem avanço.`, true)
        )
        return { ...s, leads }
      })
    }
    if (!autoRodou.current) {
      autoRodou.current = true
      rodar()
    }
    const iv = setInterval(rodar, 60_000)
    return () => clearInterval(iv)
  }, [state])

  const lead = state?.leads.find((l) => l.id === leadAberto) || null

  if (!state) {
    return (
      <div className="app" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px' }}>
        {isLoading ? 'Carregando dados do Firebase...' : 'Inicializando...'}
      </div>
    )
  }

  return (
    <div className="app">
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={'toast' + (t.warn ? ' warn' : '')}>
            {t.texto}
          </div>
        ))}
      </div>

      <header className="topbar">
        <div className="brand">
          caju<em>.</em>
          <small>CRM de prospecção</small>
        </div>
      </header>

      <nav className="nav" aria-label="Navegação principal">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="ico" aria-hidden>
              {t.ico}
            </span>
            {t.label}
            {t.id === 'dashboard' && alerts.length > 0 && <span className="badge">{alerts.length}</span>}
          </button>
        ))}
      </nav>

      {tab === 'analisar' && (
        <Analisar
          settings={state.settings}
          onCriarLead={(l) => {
            updateLeads((leads) => [l, ...leads])
            toast(`${l.nome || l.handle} adicionado ao funil em "A abordar" ✔`)
            setTab('funil')
          }}
          toast={toast}
        />
      )}
      {tab === 'funil' && (
        <Funil 
          leads={state.leads} 
          updateLead={updateLead}
          updateLeads={updateLeads}
          abrirLead={setLeadAberto} 
          toast={toast} 
        />
      )}
      {tab === 'dashboard' && (
        <Dashboard leads={state.leads} alerts={alerts} abrirLead={setLeadAberto} updateLead={updateLead} toast={toast} />
      )}
      {tab === 'ajustes' && (
        <Ajustes state={state} setState={setState} setSettings={setSettings} toast={toast} />
      )}

      {lead && (
        <LeadModal
          lead={lead}
          settings={state.settings}
          updateLead={updateLead}
          updateLeads={updateLeads}
          fechar={() => setLeadAberto(null)}
          toast={toast}
        />
      )}
    </div>
  )
}
