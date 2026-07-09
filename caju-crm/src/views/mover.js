import { moverLead, MOTIVOS_PERDA, QUALIF_CRITERIOS } from '../lib/store.js'

// Move um lead aplicando as regras do funil. Retorna true se moveu.
export function moverComRegras({ lead, destino, updateLead, toast, motivo }) {
  if (destino === lead.estagio) return false

  // Regra: só entra em LQ com os 5 critérios marcados
  if (destino === 'lq') {
    const faltando = QUALIF_CRITERIOS.filter((c) => !lead.qualificacao?.[c.id])
    if (faltando.length) {
      toast(`Para mover para Lead Qualificado, marque os 5 critérios. Faltam: ${faltando.map((c) => c.label).join(', ')}.`, true)
      return false
    }
  }

  // Regra: Perdido exige motivo
  if (destino === 'perdido') {
    let m = motivo
    if (!m) {
      const opcoes = MOTIVOS_PERDA.map((x, i) => `${i + 1}. ${x}`).join('\n')
      const resp = window.prompt(`Motivo da perda (digite o número):\n${opcoes}`)
      if (resp == null) return false
      const idx = parseInt(resp, 10) - 1
      m = MOTIVOS_PERDA[idx] || resp.trim() || 'outro'
    }
    updateLead(lead.id, (l) => moverLead(l, 'perdido', { motivoPerda: m }))
    return true
  }

  updateLead(lead.id, (l) => moverLead(l, destino))

  if (destino === 'proposta' && !lead.propostaValor) {
    toast('Não esqueça de preencher o valor da proposta no card 💰', true)
  }
  return true
}
