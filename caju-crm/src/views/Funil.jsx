import React, { useState } from 'react'
import { ESTAGIOS, PERDIDO, avaliarFollowups, fmtData, fmtMoeda, novoLead } from '../lib/store.js'
import { moverComRegras } from './mover.js'

function NovoLeadForm({ onCriar, fechar }) {
  const [nome, setNome] = useState('')
  const [handle, setHandle] = useState('')
  const [contato, setContato] = useState('')
  const [obs, setObs] = useState('')
  const [erro, setErro] = useState('')

  const criar = () => {
    if (!nome.trim() && !handle.trim()) {
      setErro('Preencha pelo menos o nome ou o @ do perfil para criar o card.')
      return
    }
    const l = novoLead({ nome: nome.trim(), handle: handle.trim() })
    l.contato = contato.trim()
    if (obs.trim()) l.notas = [{ data: new Date().toISOString(), texto: obs.trim() }]
    onCriar(l)
    fechar()
  }

  return (
    <div className="overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Adicionar lead manualmente</h2>
          <button className="x" onClick={fechar} aria-label="Fechar">✕</button>
        </div>
        <p className="muted">
          Para perfis que você já sabe que valem a abordagem — o card entra direto em "Engajamento", sem análise de
          print. Se quiser, dá para analisar o print depois ou gerar a abordagem com IA direto no card.
        </p>
        <div className="row">
          <label className="field grow">
            <span>Nome do lead</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Mariana Costa" autoFocus />
          </label>
          <label className="field grow">
            <span>@ do perfil</span>
            <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@perfil.arq" />
          </label>
        </div>
        <label className="field">
          <span>Contato (opcional)</span>
          <input type="text" value={contato} onChange={(e) => setContato(e.target.value)} placeholder="WhatsApp, e-mail…" />
        </label>
        <label className="field">
          <span>Anotação inicial (opcional)</span>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: indicação da Carol, escritório de alto padrão no Recife…"
            rows={3}
          />
        </label>
        {erro && <p className="muted" style={{ color: 'var(--vermelho)' }}>{erro}</p>}
        <div className="row">
          <button className="btn" onClick={criar}>Adicionar em "Engajamento"</button>
          <button className="btn sec" onClick={fechar}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

export default function Funil({ leads, updateLead, abrirLead, toast, onCriarLead }) {
  const [overCol, setOverCol] = useState(null)
  const [criando, setCriando] = useState(false)
  const { alerts } = avaliarFollowups(leads)
  const colunas = [...ESTAGIOS, PERDIDO]

  const onDrop = (e, colId) => {
    e.preventDefault()
    setOverCol(null)
    const leadId = e.dataTransfer.getData('text/lead')
    if (!leadId) return
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.estagio === colId) return
    moverComRegras({ lead, destino: colId, updateLead, toast })
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', margin: '4px 2px 10px' }}>
        <p className="muted" style={{ margin: 0 }}>
          Arraste os cards entre colunas ou toque num card para abrir os detalhes e mover pelo seletor.
        </p>
        <button className="btn mini" onClick={() => setCriando(true)}>+ Adicionar lead</button>
      </div>
      {criando && <NovoLeadForm onCriar={onCriarLead} fechar={() => setCriando(false)} />}

      <div className="board">
        {colunas.map((col) => {
          const cards = leads.filter((l) => l.estagio === col.id)
          return (
            <div
              key={col.id}
              className={
                'col' + (col.id === 'perdido' ? ' perdido-col' : '') + (overCol === col.id ? ' over' : '')
              }
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(col.id)
              }}
              onDragLeave={() => setOverCol(null)}
              onDrop={(e) => onDrop(e, col.id)}
            >
              <div className="col-head">
                <h3>{col.label}</h3>
                <span className="count">{cards.length}</span>
              </div>
              {cards.length === 0 && <div className="tiny" style={{ padding: '6px 4px' }}>Nenhum card aqui.</div>}
              {cards.map((lead) => {
                const alerta = alerts.find((a) => a.leadId === lead.id)
                return (
                  <div
                    key={lead.id}
                    className="lead-card"
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/lead', lead.id)}
                    onClick={() => abrirLead(lead.id)}
                  >
                    <div className="nm">{lead.nome || 'Sem nome'}</div>
                    {lead.handle && <div className="hd">{lead.handle}</div>}
                    <div className="meta">
                      {lead.analise && (
                        <span className={`pill ${lead.analise.veredito}`}>
                          {lead.analise.veredito} {lead.analise.score}/6
                        </span>
                      )}
                      <span className="tiny">desde {fmtData(lead.estagioDesde)}</span>
                      {lead.propostaValor && ['proposta', 'cliente'].includes(lead.estagio) && (
                        <span className="valor">{fmtMoeda(lead.propostaValor)}</span>
                      )}
                    </div>
                    {alerta && <div className="due">follow-up pendente</div>}
                    {lead.estagio === 'perdido' && lead.motivoPerda && (
                      <div className="tiny">motivo: {lead.motivoPerda}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
