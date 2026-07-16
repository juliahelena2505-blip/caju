import React, { useState } from 'react'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { calcularMetricas, janelaSemana, janelaMes, pipelineAberto, seriesMensais, fmtPct } from '../lib/metrics.js'
import { concluirFollowup, fmtMoeda } from '../lib/store.js'

const CORES = { caju: '#e4572e', folha: '#2f6b40', polpa: '#d9a421', castanha: '#6f6055' }

export default function Dashboard({ leads, alerts, abrirLead, updateLead, toast }) {
  const [periodo, setPeriodo] = useState('semanal')
  const janela = periodo === 'semanal' ? janelaSemana() : janelaMes()
  const m = calcularMetricas(leads, janela)
  const pipeline = pipelineAberto(leads)
  const series = seriesMensais(leads)

  const linhasFunil = [
    { label: 'Abordagens', abs: m.abordagens, taxa: null },
    { label: 'Respostas', abs: m.respostas, taxa: m.taxaResposta, taxaLabel: 'taxa de resposta' },
    { label: 'Leads Qualificados', abs: m.lqs, taxa: m.taxaQualificacao, taxaLabel: 'taxa de qualificação' },
    { label: 'Reuniões Agendadas', abs: m.agendadas, taxa: m.taxaAgendamento, taxaLabel: 'taxa de agendamento' },
    { label: 'Propostas Apresentadas', abs: m.propostas, taxa: m.conversaoReuniao, taxaLabel: 'conversão da proposta' },
    { label: 'Compras (fechados)', abs: m.compras, taxa: m.taxaFechamento, taxaLabel: 'taxa de fechamento' },
  ]

  const fazerFollowup = (leadId) => {
    updateLead(leadId, concluirFollowup)
    toast('Follow-up marcado como feito ✔ Contagem de 2 dias reiniciada.')
  }

  return (
    <div>
      {/* Painel de follow-ups */}
      <div className="card alerts">
        <h2>Follow-ups de hoje / atrasados {alerts.length > 0 && <span className="pill VALE">{alerts.length}</span>}</h2>
        {alerts.length === 0 && <p className="muted">Tudo em dia — nenhum follow-up pendente. 🌿</p>}
        {alerts.map((a, i) => (
          <div key={i} className={'alert-item' + (a.atrasado ? ' late' : '')}>
            <span className="t">
              <b onClick={() => abrirLead(a.leadId)}>{a.texto}</b>
            </span>
            {a.tipo === 'followup' && (
              <button className="btn mini" onClick={() => fazerFollowup(a.leadId)}>
                Feito ✔
              </button>
            )}
            {a.tipo === 'reuniao' && (
              <button className="btn mini sec" onClick={() => abrirLead(a.leadId)}>
                Abrir
              </button>
            )}
            {a.tipo === 'engajamento' && (
              <button className="btn mini sec" onClick={() => abrirLead(a.leadId)}>
                Ver
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Período */}
      <div className="row" style={{ justifyContent: 'space-between', margin: '4px 2px 12px' }}>
        <div className="seg" role="tablist">
          <button className={periodo === 'semanal' ? 'on' : ''} onClick={() => setPeriodo('semanal')}>
            Semanal
          </button>
          <button className={periodo === 'mensal' ? 'on' : ''} onClick={() => setPeriodo('mensal')}>
            Mensal
          </button>
        </div>
        <span className="tiny">
          {periodo === 'semanal'
            ? 'Semana em curso (segunda até hoje)'
            : new Date().toLocaleDateString('pt-BR', { month: 'long' }) + ' até hoje'}
        </span>
      </div>

      {/* Dinheiro */}
      <div className="metric-grid" style={{ marginBottom: 14 }}>
        <div className="metric money">
          <div className="v">{fmtMoeda(m.faturamento)}</div>
          <div className="l">Faturamento no período</div>
        </div>
        <div className="metric money-open">
          <div className="v">{fmtMoeda(pipeline)}</div>
          <div className="l">Pipeline em aberto (propostas)</div>
        </div>
        <div className="metric">
          <div className="v">{fmtPct(m.conversaoTotal)}</div>
          <div className="l">Abordagem → Cliente</div>
        </div>
      </div>

      {/* Funil de cima a baixo */}
      <div className="card">
        <h2>Funil do período</h2>
        {linhasFunil.map((l) => (
          <div className="funil-linha" key={l.label}>
            <span>{l.label}</span>
            <span className="abs">{l.abs}</span>
            <span className="taxa" title={l.taxaLabel || ''}>
              {l.taxa == null ? (l.taxaLabel ? '—' : '') : fmtPct(l.taxa)}
            </span>
          </div>
        ))}
        <p className="tiny" style={{ marginTop: 8 }}>
          A taxa de cada linha é calculada sobre a etapa anterior — dá para ver onde o funil vaza.
        </p>
      </div>

      {/* Gráficos: últimos 6 meses */}
      <div className="card chart-card">
        <h3>Faturamento por mês</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece0d0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} width={54} tickFormatter={(v) => `R$${v / 1000}k`} />
            <Tooltip formatter={(v) => fmtMoeda(v)} />
            <Bar dataKey="faturamento" name="Faturamento" fill={CORES.folha} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card chart-card">
        <h3>Taxas de conversão por mês (%)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece0d0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} width={36} unit="%" />
            <Tooltip formatter={(v) => (v == null ? '—' : `${v}%`)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="taxaResposta" name="Resposta" stroke={CORES.caju} strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="taxaQualificacao" name="Qualificação" stroke={CORES.polpa} strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="taxaFechamento" name="Fechamento" stroke={CORES.folha} strokeWidth={2} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="card chart-card">
        <h3>Volume de atividade por mês</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ece0d0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="abordagens" name="Abordagens" fill={CORES.caju} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
