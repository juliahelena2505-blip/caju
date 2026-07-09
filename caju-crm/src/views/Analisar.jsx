import React, { useEffect, useRef, useState } from 'react'
import { analisarPerfil, gerarAbordagem, ApiError } from '../lib/api.js'
import { novoLead } from '../lib/store.js'

const CRITERIOS_LABELS = {
  alto_padrao: 'Alto padrão',
  frequencia_conteudo: 'Produz conteúdo com frequência',
  investe_marca: 'Investe na própria marca',
  operacao_estruturada: 'Operação estruturada',
  presenca_sem_posicionamento: 'Presença sem posicionamento (dor ✔)',
  mostra_projeto_nao_expertise: 'Mostra projetos, não expertise (dor ✔)',
}

const ESTILOS = [
  { id: 'auto', label: 'Deixar a IA escolher' },
  { id: 'longa', label: 'Escrita longa' },
  { id: 'audio', label: 'Curta (intro de áudio)' },
  { id: 'direto', label: 'Direto ao ponto' },
]

export default function Analisar({ settings, onCriarLead, toast }) {
  const [img, setImg] = useState(null) // { base64, mediaType, preview }
  const [obs, setObs] = useState('')
  const [nome, setNome] = useState('')
  const [handle, setHandle] = useState('')
  const [analisando, setAnalisando] = useState(false)
  const [analise, setAnalise] = useState(null)
  const [rawFalha, setRawFalha] = useState(null)
  const [erro, setErro] = useState('')
  const [estilo, setEstilo] = useState(settings.estiloPadrao || 'auto')
  const [gerando, setGerando] = useState(false)
  const [abordagem, setAbordagem] = useState('')
  const fileRef = useRef(null)

  // colar imagem (Ctrl+V)
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'))
      if (item) lerArquivo(item.getAsFile())
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  const lerArquivo = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const [meta, base64] = reader.result.split(',')
      const mediaType = meta.match(/data:(.*?);/)?.[1] || 'image/png'
      setImg({ base64, mediaType, preview: reader.result })
      setAnalise(null)
      setAbordagem('')
      setRawFalha(null)
    }
    reader.readAsDataURL(file)
  }

  const analisar = async () => {
    if (!img && !obs.trim()) {
      setErro('Suba um print do perfil ou escreva observações antes de analisar.')
      return
    }
    setErro('')
    setRawFalha(null)
    setAnalisando(true)
    try {
      const r = await analisarPerfil({
        settings,
        imagemBase64: img?.base64,
        mediaType: img?.mediaType,
        observacoes: obs.trim(),
      })
      if (r.ok) {
        setAnalise(r.data)
      } else {
        setRawFalha(r.raw)
      }
    } catch (e) {
      setErro(e instanceof ApiError ? e.friendly : 'Algo deu errado na análise. Tente de novo.')
    } finally {
      setAnalisando(false)
    }
  }

  const gerar = async () => {
    setErro('')
    setGerando(true)
    try {
      const texto = await gerarAbordagem({
        settings,
        analise,
        nome: nome.trim(),
        handle: handle.trim(),
        estilo,
        observacoes: obs.trim(),
      })
      setAbordagem(texto.trim())
    } catch (e) {
      setErro(e instanceof ApiError ? e.friendly : 'Não consegui gerar a abordagem. Tente de novo.')
    } finally {
      setGerando(false)
    }
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(abordagem)
      toast('Abordagem copiada ✔')
    } catch {
      toast('Não consegui copiar automaticamente — selecione o texto e copie manualmente.', true)
    }
  }

  const adicionarAoFunil = () => {
    if (!nome.trim() && !handle.trim()) {
      setErro('Preencha pelo menos o nome ou o @ do perfil para criar o card.')
      return
    }
    const l = novoLead({ nome: nome.trim(), handle: handle.trim(), analise, abordagem, estilo })
    onCriarLead(l)
    // limpa para o próximo garimpo
    setImg(null)
    setObs('')
    setNome('')
    setHandle('')
    setAnalise(null)
    setAbordagem('')
  }

  const podeGerar = analise && (analise.veredito === 'BALEIA' || analise.veredito === 'VALE')

  return (
    <div>
      <div className="card">
        <h2>Analisar perfil</h2>
        <p className="muted">Suba (ou cole com Ctrl+V) um print do perfil do arquiteto no Instagram.</p>

        <div
          className="drop"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            e.currentTarget.classList.add('hover')
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove('hover')}
          onDrop={(e) => {
            e.preventDefault()
            e.currentTarget.classList.remove('hover')
            lerArquivo(e.dataTransfer.files?.[0])
          }}
        >
          {img ? (
            <img src={img.preview} alt="Print do perfil" />
          ) : (
            <>
              <div style={{ fontSize: 30 }}>📸</div>
              Toque para escolher o print
              <div className="tiny">ou arraste aqui / cole com Ctrl+V</div>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => lerArquivo(e.target.files?.[0])}
        />
        {img && (
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn mini sec" onClick={() => setImg(null)}>
              Remover print
            </button>
          </div>
        )}

        <div className="spacer" />
        <label className="field">
          <span>Observações (opcional)</span>
          <textarea
            value={obs}
            onChange={(e) => setObs(e.target.value)}
            placeholder="Ex.: vi que ele posta 3x por semana, tem site, atende litoral..."
          />
        </label>

        <div className="row">
          <label className="field grow">
            <span>Nome do lead</span>
            <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Mariana Costa" />
          </label>
          <label className="field grow">
            <span>@ do perfil</span>
            <input type="text" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@perfil.arq" />
          </label>
        </div>

        <button className="btn" onClick={analisar} disabled={analisando}>
          {analisando ? 'Analisando…' : 'Analisar'}
        </button>
        {erro && (
          <p className="muted" style={{ color: 'var(--vermelho)', marginTop: 8 }}>
            {erro}
          </p>
        )}
      </div>

      {rawFalha && (
        <div className="card">
          <h3>Hmm, a resposta da IA não veio no formato esperado</h3>
          <p className="muted">Aqui está o texto bruto — tente analisar de novo:</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12.5 }}>{rawFalha}</pre>
        </div>
      )}

      {analise && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span className={`stamp ${analise.veredito}`}>{analise.veredito}</span>
            <div style={{ textAlign: 'right' }}>
              <div className="display" style={{ fontSize: 28 }}>
                {analise.score}/6
              </div>
              <div className="tiny">pontuação</div>
            </div>
          </div>
          <p style={{ marginTop: 10 }}>{analise.resumo}</p>
          <hr className="soft" />
          {Object.entries(analise.criterios || {}).map(([k, v]) => (
            <div className="crit" key={k}>
              <div className={'mark ' + (v.atende ? 'ok' : 'no')}>{v.atende ? '✓' : '✗'}</div>
              <div>
                <b>{CRITERIOS_LABELS[k] || k}</b>
                <div className="ev">{v.evidencia}</div>
              </div>
            </div>
          ))}
          <hr className="soft" />

          {!podeGerar && (
            <p className="muted">
              Veredito PASSA: não é prioritário. Você ainda pode gerar uma abordagem se quiser abrir exceção.
            </p>
          )}
          <div className="row">
            <label className="field grow" style={{ marginBottom: 0 }}>
              <span>Estilo da abordagem</span>
              <select value={estilo} onChange={(e) => setEstilo(e.target.value)}>
                {ESTILOS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <button className={'btn' + (podeGerar ? '' : ' sec')} onClick={gerar} disabled={gerando} style={{ alignSelf: 'flex-end' }}>
              {gerando ? 'Escrevendo…' : 'Gerar abordagem'}
            </button>
          </div>
        </div>
      )}

      {abordagem && (
        <div className="card">
          <h3>Abordagem gerada</h3>
          <p className="tiny">Revise, edite à vontade e envie manualmente pelo Instagram.</p>
          <textarea rows={10} value={abordagem} onChange={(e) => setAbordagem(e.target.value)} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn sec" onClick={copiar}>
              Copiar
            </button>
            <button className="btn" onClick={adicionarAoFunil}>
              Adicionar ao funil
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
