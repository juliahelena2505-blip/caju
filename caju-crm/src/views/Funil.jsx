import React, { useState } from 'react'
import { ESTAGIOS, PERDIDO, avaliarFollowups, fmtData, fmtMoeda } from '../lib/store.js'
import { moverComRegras } from './mover.js'
import NovoLeadModal from './NovoLeadModal.jsx'

export default function Funil({ leads, updateLead, updateLeads, abrirLead, toast }) {
  const [overCol, setOverCol] = useState(null)
  const [novoLeadAberto, setNovoLeadAberto] = useState(false)
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
      <div className="row" style={{ marginBottom: 12, alignItems: 'center' }}>
        <p className="muted" style={{ flex: 1, margin: 0 }}>
          Arraste os cards entre colunas ou toque num card para abrir os detalhes e mover pelo seletor.
        </p>
        <button className="btn mini" onClick={() => setNovoLeadAberto(true)}>
          + Novo Lead
        </button>
      </div>

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

      {novoLeadAberto && (
        <NovoLeadModal
          fechar={() => setNovoLeadAberto(false)}
          onCriar={(lead) => {
            updateLeads((leads) => [lead, ...leads])
            toast(`${lead.nome || lead.handle} criado em "A abordar" ✔`)
          }}
        />
      )}
    </div>
  )
}
