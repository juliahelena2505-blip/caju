import React, { useRef, useState } from 'react'
import { exportJSON } from '../lib/store.js'

export default function Ajustes({ state, setState, setSettings, toast }) {
  const [mostrarChave, setMostrarChave] = useState(false)
  const fileRef = useRef(null)
  const s = state.settings

  const importar = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (!Array.isArray(data.leads)) throw new Error('formato inválido')
        setState({
          leads: data.leads,
          settings: { ...s, ...(data.settings || {}) },
        })
        toast(`Backup importado: ${data.leads.length} leads ✔`)
      } catch {
        toast('Esse arquivo não parece um backup do Caju CRM. Nada foi alterado.', true)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div>
      <div className="card">
        <h2>Chave de API da Anthropic</h2>
        <p className="muted">
          A chave fica salva <b>somente no seu navegador</b> (localStorage) e é usada direto do seu aparelho para a
          API. Ela não é enviada para nenhum outro servidor.
        </p>
        <label className="field">
          <span>Chave (sk-ant-…)</span>
          <div className="row">
            <input
              className="grow"
              type={mostrarChave ? 'text' : 'password'}
              value={s.apiKey}
              onChange={(e) => setSettings({ ...s, apiKey: e.target.value.trim() })}
              placeholder="Cole sua chave aqui"
              autoComplete="off"
            />
            <button className="btn mini sec" onClick={() => setMostrarChave((v) => !v)}>
              {mostrarChave ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>

        <label className="field">
          <span>Modelo</span>
          <select value={s.model} onChange={(e) => setSettings({ ...s, model: e.target.value })}>
            <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 — mais barato (padrão)</option>
            <option value="claude-sonnet-4-6">Claude Sonnet 4.6 — escrita mais refinada</option>
          </select>
        </label>

        <label className="field">
          <span>Estilo padrão de abordagem</span>
          <select value={s.estiloPadrao || 'auto'} onChange={(e) => setSettings({ ...s, estiloPadrao: e.target.value })}>
            <option value="auto">Deixar a IA escolher</option>
            <option value="longa">Escrita longa</option>
            <option value="audio">Curta (intro de áudio)</option>
            <option value="direto">Direto ao ponto</option>
          </select>
        </label>
      </div>

      <div className="card">
        <h2>Backup dos dados</h2>
        <p className="muted">
          Como tudo fica no navegador, exporte um backup de vez em quando — se você limpar o histórico do navegador,
          os dados vão junto.
        </p>
        <div className="row">
          <button className="btn" onClick={() => exportJSON(state)}>
            Exportar dados (JSON)
          </button>
          <button className="btn sec" onClick={() => fileRef.current?.click()}>
            Importar dados
          </button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => importar(e.target.files?.[0])} />
        </div>
      </div>

      <div className="card">
        <h2>Zona de perigo</h2>
        <button
          className="btn danger"
          onClick={() => {
            if (window.confirm('Apagar TODOS os leads? Essa ação não tem volta (exporte um backup antes).')) {
              setState({ ...state, leads: [] })
              toast('Todos os leads foram apagados.')
            }
          }}
        >
          Apagar todos os leads
        </button>
      </div>
    </div>
  )
}
