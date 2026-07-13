import { db } from '../firebase.js'
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore'

// ---------- Constantes ----------
export const ESTAGIOS = [
  { id: 'a_abordar', label: 'A abordar' },
  { id: 'abordagem_enviada', label: 'Abordagem enviada' },
  { id: 'respondeu', label: 'Respondeu' },
  { id: 'lq', label: 'Lead Qualificado' },
  { id: 'reuniao_agendada', label: 'Reunião Agendada' },
  { id: 'reuniao_realizada', label: 'Reunião Realizada' },
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

export const EVENTO_POR_ESTAGIO = {
  abordagem_enviada: 'abordagem',
  respondeu: 'resposta',
  lq: 'lq',
  reuniao_agendada: 'agendamento',
  reuniao_realizada: 'realizacao',
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

const KEY = 'appState'
const DIA = 24 * 60 * 60 * 1000

export async function loadState() {
  try {
    const docRef = doc(db, 'state', KEY)
    const docSnap = await getDoc(docRef)
    
    if (docSnap.exists()) {
      return docSnap.data()
    }
  } catch (e) {
    console.error('Falha ao ler Firestore', e)
  }
  
  const seeded = { leads: seedLeads(), settings: { apiKey: '', model: 'claude-haiku-4-5-20251001', estiloPadrao: 'auto' } }
  await saveState(seeded)
  return seeded
}

export async function saveState(state) {
  try {
    const docRef = doc(db, 'state', KEY)
    await setDoc(docRef, state)
  } catch (e) {
    console.error('Falha ao salvar Firestore', e)
  }
}

export function onStateChange(callback) {
  const docRef = doc(db, 'state', KEY)
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback(docSnap.data())
    }
  })
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

export function novoLead({ nome, handle, analise, abordagem, estilo }) {
  const now = new Date().toISOString()
  return {
    id: 'l' + Date.now() + Math.random().toString(36).slice(2, 6),
    nome: nome || '',
    handle: handle || '',
    criadoEm: now,
    estagio: 'a_abordar',
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

export function avaliarFollowups(leads, agora = new Date()) {
  const alerts = []
  const autoMoves = []
  const t = agora.getTime()

  for (const lead of leads) {
    const nome = lead.nome || lead.handle || 'lead sem nome'

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

    if (lead.estagio === 'reuniao_agendada' && lead.reuniaoData) {
      const dataR = new Date(lead.reuniaoData).getTime()
      const diff = dataR - t
      if (diff <= DIA && diff > 0) {
        alerts.push({ leadId: lead.id, tipo: 'reuniao', atrasado: false, texto: `Reunião amanhã com ${nome} (${fmtDataHora(lead.reuniaoData)})` })
      } else if (diff <= 0) {
        alerts.push({
