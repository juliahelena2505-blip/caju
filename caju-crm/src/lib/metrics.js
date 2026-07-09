// Janelas de período
export function janelaSemana(agora = new Date()) {
  const d = new Date(agora)
  const dow = (d.getDay() + 6) % 7 // segunda = 0
  d.setDate(d.getDate() - dow)
  d.setHours(0, 0, 0, 0)
  return { ini: d, fim: agora }
}

export function janelaMes(agora = new Date()) {
  const d = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0)
  return { ini: d, fim: agora }
}

function eventosNoPeriodo(leads, tipo, { ini, fim }) {
  const out = []
  for (const lead of leads) {
    for (const ev of lead.eventos || []) {
      const t = new Date(ev.data)
      if (ev.tipo === tipo && t >= ini && t <= fim) out.push({ lead, ev })
    }
  }
  return out
}

const pct = (num, den) => (den > 0 ? num / den : null)

export function calcularMetricas(leads, janela) {
  const abordagens = eventosNoPeriodo(leads, 'abordagem', janela).length
  const respostas = eventosNoPeriodo(leads, 'resposta', janela).length
  const lqs = eventosNoPeriodo(leads, 'lq', janela).length
  const agendadas = eventosNoPeriodo(leads, 'agendamento', janela).length
  const realizadas = eventosNoPeriodo(leads, 'realizacao', janela).length
  const propostas = eventosNoPeriodo(leads, 'proposta', janela).length
  const fechamentos = eventosNoPeriodo(leads, 'fechamento', janela)
  const compras = fechamentos.length
  const faturamento = fechamentos.reduce((s, { lead, ev }) => s + (Number(ev.valor) || Number(lead.propostaValor) || 0), 0)

  return {
    abordagens,
    respostas,
    lqs,
    agendadas,
    realizadas,
    propostas,
    compras,
    faturamento,
    taxaResposta: pct(respostas, abordagens),
    taxaQualificacao: pct(lqs, respostas),
    taxaAgendamento: pct(agendadas, lqs),
    taxaComparecimento: pct(realizadas, agendadas),
    conversaoReuniao: pct(propostas, realizadas),
    taxaFechamento: pct(compras, propostas),
    conversaoTotal: pct(compras, abordagens),
  }
}

// Pipeline em aberto: propostas apresentadas que ainda não fecharam nem perderam
export function pipelineAberto(leads) {
  return leads
    .filter((l) => l.estagio === 'proposta')
    .reduce((s, l) => s + (Number(l.propostaValor) || 0), 0)
}

// Séries mensais para gráficos (últimos 6 meses)
export function seriesMensais(leads, agora = new Date(), meses = 6) {
  const out = []
  for (let i = meses - 1; i >= 0; i--) {
    const ini = new Date(agora.getFullYear(), agora.getMonth() - i, 1)
    const fim = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 0, 23, 59, 59, 999)
    const m = calcularMetricas(leads, { ini, fim })
    out.push({
      mes: ini.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
      faturamento: m.faturamento,
      abordagens: m.abordagens,
      reunioes: m.realizadas,
      taxaResposta: m.taxaResposta != null ? +(m.taxaResposta * 100).toFixed(1) : null,
      taxaQualificacao: m.taxaQualificacao != null ? +(m.taxaQualificacao * 100).toFixed(1) : null,
      taxaFechamento: m.taxaFechamento != null ? +(m.taxaFechamento * 100).toFixed(1) : null,
    })
  }
  return out
}

export const fmtPct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`)
