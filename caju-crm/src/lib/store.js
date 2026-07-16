import { loadLeadsFromFirebase, saveLead, saveAllLeads } from './firebase.js'

// ---------- Constantes ----------
export const ESTAGIOS = [
  { id: 'engajamento', label: 'Engajamento' },
  { id: 'abordagem_enviada', label: 'Abordagem enviada' },
  { id: 'respondeu', label: 'Respondeu' },
  { id: 'lq', label: 'Lead Qualificado' },
  { id: 'reuniao_agendada', label: 'Reunião Agendada' },
  { id: 'proposta', label: 'Proposta Apresentada' },
  { id: 'cliente', label: 'Cliente (Fechado)' },
]
export const PERDIDO = { id: 'perdido', label: 'Perdido' }

export const MOTIVOS_PERDA = [
  'não respondeu',
  'não qualificou',
  'sumiu',
  'disse não',
  'preço',
  'não respondeu proposta',
  'outro',
]

// evento registrado ao ENTRAR em cada estágio
export const EVENTO_POR_ESTAGIO = {
  abordagem_enviada: 'abordagem',
  respondeu: 'resposta',
  lq: 'lq',
  reuniao_agendada: 'agendamento',
  proposta: 'proposta',
  cliente: 'fechamento',
  perdido: 'perda',
}

export const QUALIF_CRITERIOS = [
  { id: 'fit', label: 'Fit do produto', desc: 'O serviço ajuda a resolver o problema dele' },
  { id: 'objetivo', label: 'Objetivo', desc: 'Expectativa alinhada com o que você entrega' },
  { id: 'urgencia', label: 'Urgência', desc: 'Tem urgência em resolver o problema' },
  { id: 'investimento', label: 'Investimento', desc: 'Tem capacidade financeira de investir' },
  { id: 'autoridade', label: 'Autoridade', desc: 'É quem toma a decisão' },
]

const KEY = 'caju-crm-v1'
const DIA = 24 * 60 * 60 * 1000

// ---------- Persistência ----------
export async function loadState() {
  try {
    // Tenta carregar do Firebase primeiro
    const leadsFirebase = await loadLeadsFromFirebase()
    if (leadsFirebase.length > 0) {
      return {
        leads: leadsFirebase,
        settings: { apiKey: '', model: 'claude-haiku-4-5-20251001', estiloPadrao: 'auto' }
      }
    }
  } catch (e) {
    console.error('Erro ao carregar do Firebase:', e)
  }

  // Fallback: localStorage
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch (e) {
    console.error('Falha ao ler localStorage', e)
  }

  const seeded = { leads: seedLeads(), settings: { apiKey: '', model: 'claude-haiku-4-5-20251001', estiloPadrao: 'auto' } }
  saveState(seeded)
  return seeded
}

export function saveState(state) {
  // Salva no localStorage como backup
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Falha ao salvar localStorage', e)
  }

  // Salva no Firebase
  saveAllLeads(state.leads).catch((e) => console.error('Erro ao salvar no Firebase:', e))
}

export function exportJSON(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `caju-crm-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ---------- Leads ----------
export function novoLead({ nome, handle, analise, abordagem, estilo }) {
  const now = new Date().toISOString()
  return {
    id: 'l' + Date.now() + Math.random().toString(36).slice(2, 6),
    nome: nome || '',
    handle: handle || '',
    criadoEm: now,
    estagio: 'engajamento',
    estagioDesde: now,
    ultimaInteracao: now,
    followupsFeitos: 0,
    analise: analise || null,
    abordagem: abordagem || '',
    estiloAbordagem: estilo || '',
    contato: '',
    respostaTexto: '',
    qualificacao: { fit: false, objetivo: false, urgencia: false, investimento: false, autoridade: false },
    qualificacaoEvidencias: {},
    reuniaoData: '',
    proximoFollowup: '',
    propostaValor: '',
    motivoPerda: '',
    eventos: [],
    notas: [],
    engajamento: {
      criadoEm: now,
      seguir: false,
      seguirData: null,
      story: false,
      storyData: null,
      comentar: false,
      comentarData: null,
      abordagem: false,
      abordagemData: null,
    },
  }
}

export function moverLead(lead, novoEstagio, extra = {}) {
  const now = new Date().toISOString()
  const evTipo = EVENTO_POR_ESTAGIO[novoEstagio]
  const eventos = evTipo ? [...lead.eventos, { tipo: evTipo, data: now, valor: novoEstagio === 'cliente' ? Number(lead.propostaValor) || 0 : undefined }] : lead.eventos
  return {
    ...lead,
    ...extra,
    estagio: novoEstagio,
    estagioDesde: now,
    ultimaInteracao: now,
    followupsFeitos: 0,
    eventos,
  }
}

export function addNota(lead, texto) {
  return { ...lead, notas: [...lead.notas, { data: new Date().toISOString(), texto }] }
}

export function concluirFollowup(lead) {
  return {
    ...lead,
    ultimaInteracao: new Date().toISOString(),
    followupsFeitos: (lead.followupsFeitos || 0) + 1,
    notas: [...lead.notas, { data: new Date().toISOString(), texto: `Follow-up ${(lead.followupsFeitos || 0) + 1} feito ✔` }],
  }
}

// ---------- Motor de follow-up ----------
export function avaliarFollowups(leads, agora = new Date()) {
  const alerts = []
  const autoMoves = []
  const t = agora.getTime()

  for (const lead of leads) {
    const nome = lead.nome || lead.handle || 'lead sem nome'

    // Engajamento: alertas pra cada dia
    if (lead.estagio === 'engajamento') {
      const criadoEm = new Date(lead.engajamento?.criadoEm || lead.estagioDesde).getTime()
      const diasDesdeInicio = Math.floor((t - criadoEm) / DIA)
      
      const tarefas = [
        { dia: 0, nome: 'Seguir + curtir 2 fotos', key: 'seguir' },
        { dia: 1, nome: 'Responder um story', key: 'story' },
        { dia: 2, nome: 'Comentar em post', key: 'comentar' },
        { dia: 3, nome: 'Enviar abordagem', key: 'abordagem' },
      ]

      for (const tarefa of tarefas) {
        const feito = lead.engajamento?.[tarefa.key]
        if (!feito && diasDesdeInicio >= tarefa.dia) {
          const atrasado = diasDesdeInicio > tarefa.dia
          alerts.push({
            leadId: lead.id,
            tipo: 'engajamento',
            atrasado,
            texto: `[${nome}] ${tarefa.nome} — dia ${tarefa.dia + 1}${atrasado ? ` (ATRASADO ${diasDesdeInicio - tarefa.dia}d)` : ''}`,
          })
        }
      }
    }

    // Abordagem enviada / Respondeu → follow-up a cada 2 dias, máx 3, depois Perdido
    if (lead.estagio === 'abordagem_enviada' || lead.estagio === 'respondeu') {
      const desde = new Date(lead.ultimaInteracao || lead.estagioDesde).getTime()
      const vencido = t - desde >= 2 * DIA
      if (vencido) {
        if ((lead.followupsFeitos || 0) >= 3) {
          autoMoves.push({ leadId: lead.id, motivo: 'não respondeu', nome })
        } else {
          alerts.push({
            leadId: lead.id,
            tipo: 'followup',
            atrasado: t - desde >= 3 * DIA,
            texto: `Follow-up com ${nome} (${(lead.followupsFeitos || 0) + 1}º de 3) — sem avanço há ${Math.floor((t - desde) / DIA)} dias`,
          })
        }
      }
    }

    // Reunião agendada → lembrete 1 dia antes
    if (lead.estagio === 'reuniao_agendada' && lead.reuniaoData) {
      const dataR = new Date(lead.reuniaoData).getTime()
      const diff = dataR - t
      if (diff <= DIA && diff > 0) {
        alerts.push({ leadId: lead.id, tipo: 'reuniao', atrasado: false, texto: `Reunião amanhã com ${nome} (${fmtDataHora(lead.reuniaoData)})` })
      } else if (diff <= 0) {
        alerts.push({ leadId: lead.id, tipo: 'reuniao', atrasado: true, texto: `A reunião com ${nome} já passou — mova pra Proposta ou Perdido` })
      }
    }

    // Proposta apresentada → a cada 2 dias, máx 3, depois Perdido
    if (lead.estagio === 'proposta') {
      const desde = new Date(lead.ultimaInteracao || lead.estagioDesde).getTime()
      const vencido = t - desde >= 2 * DIA
      if (vencido) {
        if ((lead.followupsFeitos || 0) >= 3) {
          autoMoves.push({ leadId: lead.id, motivo: 'não respondeu proposta', nome })
        } else {
          alerts.push({
            leadId: lead.id,
            tipo: 'followup',
            atrasado: t - desde >= 3 * DIA,
            texto: `Follow-up de proposta com ${nome} (${(lead.followupsFeitos || 0) + 1}º de 3)${lead.propostaValor ? ` — R$ ${Number(lead.propostaValor).toLocaleString('pt-BR')}` : ''}`,
          })
        }
      }
    }
  }

  return { alerts, autoMoves }
}

// ---------- Formatação ----------
export function fmtData(iso) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
export function fmtDataHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
export function fmtMoeda(v) {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

// ---------- Dados de exemplo ----------
function diasAtras(n, hora = 10) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hora, 0, 0, 0)
  return d.toISOString()
}

function seedLead(base, timeline) {
  const lead = novoLead(base)
  lead.criadoEm = diasAtras(timeline[0][1] + 1)
  lead.estagioDesde = lead.criadoEm
  lead.ultimaInteracao = lead.criadoEm
  for (const [est, dias] of timeline) {
    const data = diasAtras(dias)
    const evTipo = EVENTO_POR_ESTAGIO[est]
    if (evTipo) lead.eventos.push({ tipo: evTipo, data, valor: est === 'cliente' ? Number(lead.propostaValor) || 0 : undefined })
    lead.estagio = est
    lead.estagioDesde = data
    lead.ultimaInteracao = data
  }
  return lead
}

function seedLeads() {
  const a = (score, veredito, resumo) => ({
    score,
    veredito,
    resumo,
    criterios: {
      alto_padrao: { atende: score >= 4, evidencia: 'Projetos residenciais de alto padrão no feed' },
      frequencia_conteudo: { atende: score >= 3, evidencia: 'Posta cerca de 2x por semana' },
      investe_marca: { atende: score >= 4, evidencia: 'Site no link da bio, fotos profissionais' },
      operacao_estruturada: { atende: score >= 5, evidencia: 'Menciona equipe nos stories' },
      presenca_sem_posicionamento: { atende: score >= 3, evidencia: 'Bio genérica, sem mensagem clara de diferencial' },
      mostra_projeto_nao_expertise: { atende: score >= 2, evidencia: 'Feed só com fotos finais, sem falar de processo' },
    },
  })

  const l1 = seedLead(
    { nome: 'Mariana Costa', handle: '@marianacosta.arq', analise: a(6, 'BALEIA', 'Escritório de alto padrão com presença ativa mas sem posicionamento claro. Perfil ideal.'), abordagem: 'Oii, Mariana! Tudo bem? Sei que você não faz ideia de quem eu sou hahaha...' },
    [['abordagem_enviada', 68], ['respondeu', 66], ['lq', 64], ['reuniao_agendada', 62], ['proposta', 55], ['cliente', 50]]
  )
  l1.propostaValor = 7500
  l1.eventos = l1.eventos.map((e) => (e.tipo === 'fechamento' ? { ...e, valor: 7500 } : e))
  l1.qualificacao = { fit: true, objetivo: true, urgencia: true, investimento: true, autoridade: true }
  l1.contato = 'WhatsApp (81) 9 9999-0001'
  l1.notas = [{ data: diasAtras(50), texto: 'Fechou Consultoria Trimestral! 🎉' }]

  const l2 = seedLead(
    { nome: 'Studio Vetor', handle: '@studiovetor', analise: a(5, 'BALEIA', 'Studio estruturado, conteúdo frequente, feed bonito mas sem mensagem de valor.'), abordagem: 'Oii! Seguinte... vou direto ao ponto...' },
    [['abordagem_enviada', 34], ['respondeu', 31], ['lq', 28], ['reuniao_agendada', 26], ['proposta', 20], ['cliente', 15]]
  )
  l2.propostaValor = 4800
  l2.eventos = l2.eventos.map((e) => (e.tipo === 'fechamento' ? { ...e, valor: 4800 } : e))
  l2.qualificacao = { fit: true, objetivo: true, urgencia: true, investimento: true, autoridade: true }

  const l3 = seedLead(
    { nome: 'Rafael Lins', handle: '@rafaellins.arquitetura', analise: a(5, 'BALEIA', 'Alto padrão, posta bastante, mas feed 100% foto final. Dor clara de posicionamento.'), abordagem: 'Oii, Rafael! Aqui é Julia...' },
    [['abordagem_enviada', 9], ['respondeu', 7], ['lq', 6], ['reuniao_agendada', 5], ['proposta', 2]]
  )
  l3.propostaValor = 9000
  l3.qualificacao = { fit: true, objetivo: true, urgencia: true, investimento: true, autoridade: true }
  l3.followupsFeitos = 0

  const l4 = seedLead(
    { nome: 'Ana Beatriz', handle: '@anabeatriz.arq', analise: a(4, 'VALE', 'Escritório em crescimento, conteúdo razoável, sem posicionamento definido.'), abordagem: 'Oii, Ana! Tudo bem?...' },
    [['abordagem_enviada', 4], ['respondeu', 1]]
  )
  l4.respostaTexto = 'Oi Julia! Que legal, adorei a mensagem. Realmente sinto que meu Instagram não traz cliente nenhum haha. Como funciona seu trabalho?'

  const l5 = seedLead(
    { nome: 'Coletivo Traço', handle: '@coletivotraco', analise: a(3, 'VALE', 'Perfil ativo, projetos médios, vale abordar.'), abordagem: 'Oii! Tudo bem?...' },
    [['abordagem_enviada', 2]]
  )

  const l6 = seedLead(
    { nome: 'Pedro Amaral', handle: '@pedroamaral.arq', analise: a(6, 'BALEIA', 'Perfil excelente, alto padrão consolidado.'), abordagem: 'Oii, Pedro!...' },
    [['abordagem_enviada', 40], ['respondeu', 38], ['lq', 36], ['reuniao_agendada', 34]]
  )
  l6.reuniaoData = new Date(Date.now() + DIA * 0.8).toISOString().slice(0, 16)
  l6.qualificacao = { fit: true, objetivo: true, urgencia: true, investimento: true, autoridade: true }

  const l7 = seedLead(
    { nome: 'Arq. Duarte', handle: '@arqduarte', analise: a(2, 'PASSA', 'Perfil parado, projetos pequenos. Não prioritário.'), abordagem: '' },
    [['abordagem_enviada', 75], ['perdido', 68]]
  )
  l7.motivoPerda = 'não respondeu'

  const l8 = seedLead(
    { nome: 'Camila Rocha', handle: '@camilarocha.interiores', analise: a(4, 'VALE', 'Bom volume de conteúdo, sem clareza de nicho.'), abordagem: 'Oii, Camila!...' },
    [['abordagem_enviada', 45], ['respondeu', 43], ['perdido', 37]]
  )
  l8.motivoPerda = 'não qualificou'

  const l9 = novoLead({ nome: 'Escritório Alameda', handle: '@escritorioalameda', analise: a(5, 'BALEIA', 'Operação estruturada, feed bonito sem posicionamento — perfil ideal.'), abordagem: 'Oii! Sei que você não me conhece hahaha...' })

  return [l3, l4, l5, l6, l9, l1, l2, l7, l8]
}
