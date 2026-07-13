import React, { useState } from 'react'
import { novoLead } from '../lib/store.js'

export default function NovoLeadModal({ fechar, onCriar }) {
  const [nome, setNome] = useState('')
  const [handle, setHandle] = useState('')
  const [abordagem, setAbordagem] = useState('')

  const criar = () => {
    if (!nome.trim() && !handle.trim()) {
      alert('Preenchca pelo menos o nome ou o Instagram.')
      return
    }
    const lead = novoLead({ nome: nome.trim(), handle: handle.trim(), abordagem: abordagem.trim() })
    onCriar(lead)
    fechar()
  }

  return (
    <div className="overlay" onClick={fechar}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Novo Lead</h2>
          <button className="x" onClick={fechar} aria-label="Fechar">
            ✕
          </button>
        </div>

        <label className="field">
          <span>Nome ou negócio</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Mariana Costa"
            autoFocus
          />
        </label>

        <label className="field">
          <span>Instagram (opcional)</span>
          <input
            type="text"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="Ex.: @marianacosta.arq"
          />
        </label>

        <label className="field">
          <span>Abordagem (opcional)</span>
          <textarea
            rows={6}
            value={abordagem}
            onChange={(e) => setAbordagem(e.target.value)}
            placeholder="Mensagem já preparada para enviar… (deixe em branco se quiser gerar depois)"
          />
        </label>

        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn sec" onClick={fechar}>
            Cancelar
          </button>
          <button className="btn" onClick={criar}>
            Criar Lead
          </button>
        </div>
      </div>
    </div>
  )
}
