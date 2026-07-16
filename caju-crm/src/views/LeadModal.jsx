import React, { useState } from 'react'
import {
  ESTAGIOS,
  PERDIDO,
  QUALIF_CRITERIOS,
  MOTIVOS_PERDA,
  addNota,
  concluirFollowup,
  fmtData,
  fmtDataHora,
  moverLead,
} from '../lib/store.js'
import { analisarResposta, gerarAbordagem, ApiError } from '../lib/api.js'
import { moverComRegras } from './mover.js'

export default function LeadModal({ lead, settings, updateLead, fechar, toast }) {
  const [nota, setNota] = useState('')
  const [analisandoResp, setAnalisandoResp] = useState(false)
  const [gerandoAbordagem, setGerandoAbordagem] = useState(false)
  const [motivoSel, setMotivoSel] = useState(MOTIVOS_PERDA[0])
  const set = (patch) => updateLead(lead.id, (l) => ({ ...l, ...patch }))

  const estagioLabel = [...ESTAGIOS, PERDIDO].find((e) => e.id === lead.estagio)?.label

  const mover = (destino) => {
    if (!destino) return
    const moveu = moverComRegras({
      lead,
      destino,
      updateLead,
      toast,
      motivo: destino === 'perdido' ? motivoSel : undefined,
    })
    if (moveu && destino !== 'perdido') toast(`Card movido para "${[...ESTAGIOS, PERDIDO].find((e) => e.id === destino)?.label}" ✔`)
  }

  const todosQualif = QUALIF_CRITERIOS.every((c) => lead.qualificacao?.[c.id])

  const analisarResp = async () => {
    if (!lead.respostaTexto?.trim()) {
      toast('Cole a resposta da pessoa no campo antes de analisar.', true)
      return
    }
    setAnalisandoResp(true)
    try {
      const r = await analisarResposta({
        settings,
        resposta: lead.respostaTexto,
        contexto: lead.analise?.resumo,
      })
      if (r.ok) {
        const q = { ...lead.qualificacao }
        const ev = {}
        for (const c of QUALIF_CRITERIOS) {
          if (r.data[c.id]) {
            q[c.id] = !!r.data[c.id].atende
            ev[c.id] = r.data[c.id].evidencia
          }
        }
        set({ qualificacao: q, qualificacaoEvidencias: ev })
        toast('Sugestões da IA aplicadas — revise e ajuste antes de mover ✔')
      } else {
        toast('A IA respondeu fora do formato esperado. Tente de novo.', true)
      }
    } catch (e) {
      toast(e instanceof ApiError ? e.friendly : 'Erro ao analisar a resposta.', true)
    } finally {
      setAnalisandoResp(false)
    }
  }

  const copiarAbordagem = async () => {
    try {
      await navigator.clipboard.writeText(lead.abordagem || '')
      toast('Abordagem copiada ✔')
    } catch {
      toast('Selecione o texto e copie manualmente.', true)
    }
  }

  const marcaTarefa = (key) => {
    const eng = { ...lead.engajamento, [key]: true, [key + 'Data']: new Date().toISOString() }
    set({ engajamento: eng })
    
    // Se marcou a abordagem, oferece mover
    if (key === 'abordagem' && lead.estagio === 'engajamento') {
      toast('Tarefa marcada ✔ Agora você pode enviar a abordagem!')
    }
  }

  return (
    <div className="overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h2>{lead.nome || 'Sem nome'}</h2>
            <div className="row" style={{ gap: 6 }}>
              {lead.handle && <span className="hd" style={{ color: 'var(--caju-deep)', fontSize: 13 }}>{lead.handle}</span>}
              {lead.analise && (
                <span className={`pill ${lead.analise.veredito}`}>
                  {lead.analise.veredito} {lead.analise.score}/6
                </span>
              )}
            </div>
          </div>
          <button className="x" onClick={fechar} aria-label="Fechar">
            ✕
          </button>
        </div>

        <p className="tiny">
          Estágio atual: <b>{estagioLabel}</b> desde {fmtData(lead.estagioDesde)} · follow-ups nesta etapa:{' '}
          {lead.followupsFeitos || 0}/3
        </p>

        {/* Mover (funciona bem no celular) */}
        <div className="row">
          <label className="field grow" style={{ marginBottom: 6 }}>
            <span>Mover para</span>
            <select value="" onChange={(e) => mover(e.target.value)}>
              <option value="">Escolher estágio…</option>
              {ESTAGIOS.filter((e) => e.id !== lead.estagio).map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
              <option value="perdido">Perdido</option>
            </select>
          </label>
          <label className="field" style={{ marginBottom: 6, width: 170 }}>
            <span>Motivo (se Perdido)</span>
            <select value={motivoSel} onChange={(e) => setMotivoSel(e.target.value)}>
              {MOTIVOS_PERDA.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
        </div>

        {/* Engajamento: checklist de tarefas */}
        {lead.estagio === 'engajamento' && (
          <div className="card" style={{ background: 'var(--folha-soft)' }}>
            <h3>Cadência de Engajamento (4 dias)</h3>
            <p className="tiny">Marque as tarefas conforme as fazer. Quando completar todas, envie a abordagem.</p>
            {[
              { dia: 0, nome: 'Seguir + curtir 2 fotos', key: 'seguir' },
              { dia: 1, nome: 'Responder um story', key: 'story' },
              { dia: 2, nome: 'Comentar em post', key: 'comentar' },
              { dia: 3, nome: 'Enviar abordagem', key: 'abordagem' },
            ].map((t) => (
              <label key={t.key} className={'qcrit' + (lead.engajamento?.[t.key] ? ' ok' : '')}>
                <input
                  type="checkbox"
                  checked={!!lead.engajamento?.[t.key]}
                  onChange={() => marcaTarefa(t.key)}
                />
                <div>
                  <b>Dia {t.dia + 1}: {t.nome}</b>
                  {lead.engajamento?.[t.key + 'Data'] && (
                    <div className="ev">Feito em {fmtDataHora(lead.engajamento[t.key + 'Data'])}</div>
                  )}
                </div>
              </label>
            ))}
            <div className="row" style={{ marginTop: 8, gap: 4 }}>
              <button className="btn" onClick={() => mover('abordagem_enviada')} style={{ flex: 1 }}>
                ✔ Enviar abordagem
              </button>
              <p className="tiny">Você pode enviar a qualquer momento, não precisa completar todas as tarefas.</p>
            </div>
          </div>
        )}

        {/* Abordagem em engajamento: gerar ou editar */}
        {lead.estagio === 'engajamento' && (
          <div className="card" style={{ background: 'var(--caju-soft)' }}>
            <h3>{lead.abordagem ? 'Abordagem pronta para envio' : 'Abordagem'}</h3>
            {!lead.abordagem && (
              <p className="tiny">
                Este lead ainda não tem abordagem. Escreva a sua ou gere uma com IA no seu tom
                {!lead.analise && ' (vou usar suas anotações do histórico como contexto)'}.
              </p>
            )}
            <textarea rows={6} value={lead.abordagem || ''} onChange={(e) => set({ abordagem: e.target.value })} />
            <div className="row" style={{ marginTop: 8 }}>
              <button
                className="btn sec"
                disabled={gerandoAbordagem}
                onClick={async () => {
                  setGerandoAbordagem(true)
                  try {
                    const texto = await gerarAbordagem({
                      settings,
                      analise: lead.analise,
                      nome: lead.nome,
                      handle: lead.handle,
                      estilo: lead.estiloAbordagem || settings.estiloPadrao || 'auto',
                      observacoes: (lead.notas || []).map((n) => n.texto).join(' · '),
                    })
                    set({ abordagem: texto.trim() })
                  } catch (e) {
                    toast(e instanceof ApiError ? e.friendly : 'Não consegui gerar a abordagem.', true)
                  } finally {
                    setGerandoAbordagem(false)
                  }
                }}
              >
                {gerandoAbordagem ? 'Escrevendo…' : lead.abordagem ? 'Gerar outra com IA' : 'Gerar com IA'}
              </button>
              <button className="btn sec" onClick={copiarAbordagem} disabled={!lead.abordagem}>
                Copiar
              </button>
            </div>
          </div>
        )}

        {/* Ações rápidas: follow-up */}
        {(lead.estagio === 'abordagem_enviada' || lead.estagio === 'respondeu' || lead.estagio === 'proposta') && (
          <button className="btn ghost" style={{ marginBottom: 10 }} onClick={() => updateLead(lead.id, concluirFollowup)}>
            Marcar follow-up feito ({(lead.followupsFeitos || 0) + 1}º de 3) — reinicia os 2 dias
          </button>
        )}

        {/* Qualificação em "Respondeu" */}
        {lead.estagio === 'respondeu' && (
          <div className="card">
            <h3>Qualificação (os 5 são obrigatórios)</h3>
            <label className="field">
              <span>Resposta que a pessoa mandou</span>
              <textarea
                value={lead.respostaTexto || ''}
                onChange={(e) => set({ respostaTexto: e.target.value })}
                placeholder="Cole aqui a resposta do Instagram…"
              />
            </label>
            <button className="btn sec" onClick={analisarResp} disabled={analisandoResp}>
              {analisandoResp ? 'Analisando…' : 'Analisar resposta com IA'}
            </button>
            <div className="spacer" />
            {QUALIF_CRITERIOS.map((c) => (
              <label key={c.id} className={'qcrit' + (lead.qualificacao?.[c.id] ? ' ok' : '')}>
                <input
                  type="checkbox"
                  checked={!!lead.qualificacao?.[c.id]}
                  onChange={(e) => set({ qualificacao: { ...lead.qualificacao, [c.id]: e.target.checked } })}
                />
                <div>
                  <b>{c.label}</b>
                  <div className="ev">{lead.qualificacaoEvidencias?.[c.id] || c.desc}</div>
                </div>
              </label>
            ))}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" disabled={!todosQualif} onClick={() => mover('lq')}>
                Mover para Lead Qualificado
              </button>
              <button className="btn mini sec" onClick={() => moverComRegras({ lead, destino: 'perdido', updateLead, toast, motivo: 'não qualificou' })}>
                Não qualificou → Perdido
              </button>
            </div>
            {!todosQualif && <p className="tiny">O botão libera quando os 5 critérios estiverem marcados.</p>}
          </div>
        )}

        {/* Reunião agendada */}
        {lead.estagio === 'reuniao_agendada' && (
          <label className="field">
            <span>Data e hora da reunião (lembrete automático 1 dia antes)</span>
            <input
              type="datetime-local"
              value={lead.reuniaoData || ''}
              onChange={(e) => set({ reuniaoData: e.target.value })}
            />
          </label>
        )}

        {/* Valor da proposta */}
        {['proposta', 'cliente'].includes(lead.estagio) && (
          <label className="field">
            <span>Valor da proposta (R$)</span>
            <input
              type="number"
              min="0"
              value={lead.propostaValor}
              onChange={(e) => set({ propostaValor: e.target.value })}
              placeholder="Ex.: 7500"
            />
          </label>
        )}

        {lead.estagio === 'perdido' && (
          <p className="muted">
            Perdido em {fmtData(lead.estagioDesde)} — motivo: <b>{lead.motivoPerda || 'não informado'}</b>
          </p>
        )}

        <hr className="soft" />

        {/* Contato */}
        <label className="field">
          <span>Dados de contato</span>
          <input
            type="text"
            value={lead.contato || ''}
            onChange={(e) => set({ contato: e.target.value })}
            placeholder="WhatsApp, e-mail…"
          />
        </label>

        {/* Análise resumida */}
        {lead.analise && (
          <details style={{ marginBottom: 12 }}>
            <summary className="muted" style={{ cursor: 'pointer' }}>
              Ver análise do perfil ({lead.analise.veredito} {lead.analise.score}/6)
            </summary>
            <p className="muted" style={{ marginTop: 6 }}>{lead.analise.resumo}</p>
            {Object.entries(lead.analise.criterios || {}).map(([k, v]) => (
              <div className="crit" key={k}>
                <div className={'mark ' + (v.atende ? 'ok' : 'no')}>{v.atende ? '✓' : '✗'}</div>
                <div>
                  <b>{k.replaceAll('_', ' ')}</b>
                  <div className="ev">{v.evidencia}</div>
                </div>
              </div>
            ))}
          </details>
        )}

        {/* Abordagem (fora do estágio engajamento) */}
        {lead.estagio !== 'engajamento' && lead.abordagem && (
          <details style={{ marginBottom: 12 }}>
            <summary className="muted" style={{ cursor: 'pointer' }}>
              Ver abordagem enviada
            </summary>
            <p className="muted" style={{ whiteSpace: 'pre-wrap', marginTop: 6 }}>{lead.abordagem}</p>
          </details>
        )}

        {/* Log de interações */}
        <h3 style={{ fontSize: 15, marginBottom: 6 }}>Histórico de interações</h3>
        <div className="row">
          <input
            type="text"
            className="grow"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Anotar interação… (ex.: mandei áudio, pediu portfólio)"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && nota.trim()) {
                updateLead(lead.id, (l) => addNota(l, nota.trim()))
                setNota('')
              }
            }}
          />
          <button
            className="btn mini"
            onClick={() => {
              if (!nota.trim()) return
              updateLead(lead.id, (l) => addNota(l, nota.trim()))
              setNota('')
            }}
          >
            Anotar
          </button>
        </div>
        <div className="spacer" />
        {[...(lead.notas || [])].reverse().map((n, i) => (
          <div className="log-item" key={i}>
            <span className="d">{fmtDataHora(n.data)}</span>
            <span>{n.texto}</span>
          </div>
        ))}
        {(!lead.notas || lead.notas.length === 0) && <p className="tiny">Nenhuma anotação ainda.</p>}
      </div>
    </div>
  )
}
