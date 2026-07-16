import React, { useEffect, useMemo, useRef, useState } from 'react'
import { loadState, saveState, avaliarFollowups, moverLead } from './lib/store.js'
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
  const [state, setState] = useState(loadState)
  const [tab, setTab] = useState('dashboard')
  const [toasts, setToasts] = useState([])
  const [leadAberto, setLeadAberto] = useState(null)
  const autoRodou = useRef(false)

  // persistência
  useEffect(() => saveState(state), [state])

  const toast = (texto, warn = false) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, texto, warn }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000)
  }

  const updateLeads = (fn) => setState((s) => ({ ...s, leads: fn(s.leads) }))
  const updateLead = (id, fn) => updateLeads((leads) => leads.map((l) => (l.id === id ? fn(l) : l)))
  const setSettings = (settings) => setState((s) => ({ ...s, settings }))

  // motor de follow-up: roda ao abrir e a cada minuto
  const { alerts } = useMemo(() => avaliarFollowups(state.leads), [state.leads])

  useEffect(() => {
    const rodar = () => {
      setState((s) => {
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
  }, [])

  const lead = state.leads.find((l) => l.id === leadAberto) || null

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
            toast(`${l.nome || l.handle} adicionado ao funil em "Engajamento" ✔`)
            setTab('funil')
          }}
          toast={toast}
        />
      )}
      {tab === 'funil' && (
        <Funil
          leads={state.leads}
          updateLead={updateLead}
          abrirLead={setLeadAberto}
          toast={toast}
          onCriarLead={(l) => {
            updateLeads((leads) => [l, ...leads])
            toast(`${l.nome || l.handle} adicionado em "Engajamento" ✔`)
          }}
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
          fechar={() => setLeadAberto(null)}
          toast={toast}
        />
      )}
    </div>
  )
}
