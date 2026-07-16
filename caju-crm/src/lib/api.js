export class ApiError extends Error {
  constructor(msg, friendly = msg) {
    super(msg)
    this.friendly = friendly
  }
}

export function parseJSONSeguro(texto) {
  if (!texto || typeof texto !== 'string') return { ok: false, raw: texto }
  
  let t = texto.trim()
  
  // Remove markdown code blocks
  t = t.replace(/^```[\s\S]*?```/gm, '')
  t = t.trim()
  
  // Remove backticks soltos
  t = t.replace(/^`+\s*/g, '').replace(/\s*`+$/g, '').trim()
  
  // Remove "json" se tiver no início
  t = t.replace(/^json\s*/i, '').trim()
  
  // Extrai TUDO entre { e }
  const chaves = t.split('')
  let inicio = -1, fim = -1, nivel = 0
  
  for (let i = 0; i < chaves.length; i++) {
    if (chaves[i] === '{') {
      if (inicio === -1) inicio = i
      nivel++
    } else if (chaves[i] === '}') {
      nivel--
      if (nivel === 0 && inicio !== -1) {
        fim = i + 1
        break
      }
    }
  }
  
  if (inicio >= 0 && fim > inicio) {
    t = t.substring(inicio, fim)
  }
  
  try {
    const dados = JSON.parse(t)
    return { ok: true, data: dados }
  } catch (e) {
    try {
      t = t.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/\n/g, ' ')
      const dados = JSON.parse(t)
      return { ok: true, data: dados }
    } catch {
      return { ok: false, raw: texto }
    }
  }
}

export async function analisarPerfil({ settings, imagemBase64, mediaType, observacoes }) {
  if (!settings.apiKey) throw new ApiError('API key não configurada', 'Configure a chave do Claude nos Ajustes')

  const systemPrompt = `Você é um especialista em análise de perfis de Instagram de arquitetos.
Analise o perfil e retorne APENAS um JSON (sem preamble) com essa estrutura exata:
{
  "score": número de 1 a 6,
  "veredito": "BALEIA" | "VALE" | "PASSA",
  "resumo": "resumo de 1-2 frases",
  "criterios": {
    "alto_padrao": { "atende": bool, "evidencia": "..." },
    "frequencia_conteudo": { "atende": bool, "evidencia": "..." },
    "investe_marca": { "atende": bool, "evidencia": "..." },
    "operacao_estruturada": { "atende": bool, "evidencia": "..." },
    "presenca_sem_posicionamento": { "atende": bool, "evidencia": "..." },
    "mostra_projeto_nao_expertise": { "atende": bool, "evidencia": "..." }
  }
}

BALEIA: score 5-6 (alto padrão, estruturado, investimento claro)
VALE: score 3-4 (potencial, mas sem posicionamento ou operação clara)
PASSA: score 1-2 (não prioritário)

Analise friamente, sem romantizar. Foque em evidências visuais.`

  const userMsg = observacoes 
    ? `Observações: ${observacoes}`
    : 'Analise este perfil de arquiteto no Instagram:'

  const messages = []
  
  if (imagemBase64) {
    messages.push({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imagemBase64 } },
        { type: 'text', text: userMsg }
      ]
    })
  } else {
    messages.push({ role: 'user', content: userMsg })
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    })

    if (!resp.ok) {
      const err = await resp.json()
      throw new ApiError(err.error?.message || 'Erro da API', 'Algo deu errado na análise. Tente de novo.')
    }

    const data = await resp.json()
    const texto = data.content?.[0]?.text || ''
    const parsed = parseJSONSeguro(texto)

    if (!parsed.ok) {
      return { ok: false, raw: parsed.raw }
    }

    return { ok: true, data: parsed.data }
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(e.message, 'Erro ao chamar a API. Verifique sua chave.')
  }
}

export async function gerarAbordagem({ settings, analise, nome, handle, estilo, observacoes }) {
  if (!settings.apiKey) throw new ApiError('API key não configurada', 'Configure a chave do Claude nos Ajustes')

  let instrucoes = ''
  if (estilo === 'longa') {
    instrucoes = `Escreva uma abordagem LONGA (3-4 parágrafos). Conte uma história. Crie conexão emocional antes de mencionar o serviço.`
  } else if (estilo === 'audio') {
    instrucoes = `Escreva uma abordagem CURTA (máx 2 frases) como intro de um áudio. Tipo: "Oi [Nome]! Algo me chamou atenção no seu feed..."`
  } else if (estilo === 'direto') {
    instrucoes = `Escreva uma abordagem DIRETA, sem enrolação. Vá direto ao ponto em 2-3 frases curtas.`
  } else {
    instrucoes = `Escolha o estilo que melhor se adequa ao perfil (longa, áudio ou direto) e escreva a abordagem.`
  }

  const contexto = analise ? `Score: ${analise.score}/6, Veredito: ${analise.veredito}\n${analise.resumo}` : observacoes || 'Sem análise'

  const systemPrompt = `Você escreve mensagens de prospecção para arquitetos no Instagram.

REGRAS:
- Português brasileiro coloquial, direto, sem jargão de coach
- Linha quebrada a cada frase — lê melhor em DM
- Hook: comece com curiosidade ou reconhecimento (não plamê)
- Use o padrão: gancho → reconhecimento → problema → solução → CTA

${instrucoes}

O destinatário: ${nome || handle || 'arquiteto'}

Contexto do perfil:
${contexto}

Retorne APENAS a mensagem, nenhum prefixo ou markdown.`

  const messages = [
    { role: 'user', content: `Escreva uma abordagem pra ${nome || handle || 'este arquiteto'}.` }
  ]

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    })

    if (!resp.ok) {
      const err = await resp.json()
      throw new ApiError(err.error?.message || 'Erro da API', 'Não consegui gerar a abordagem.')
    }

    const data = await resp.json()
    const texto = data.content?.[0]?.text || ''
    return texto.trim()
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(e.message, 'Erro ao chamar a API.')
  }
}

export async function analisarResposta({ settings, resposta, contexto }) {
  if (!settings.apiKey) throw new ApiError('API key não configurada', 'Configure a chave do Claude nos Ajustes')

  const systemPrompt = `Você analisa respostas de leads para qualificação BANT.
Retorne APENAS um JSON (sem preamble):
{
  "fit": { "atende": bool, "evidencia": "..." },
  "objetivo": { "atende": bool, "evidencia": "..." },
  "urgencia": { "atende": bool, "evidencia": "..." },
  "investimento": { "atende": bool, "evidencia": "..." },
  "autoridade": { "atende": bool, "evidencia": "..." }
}

Seja conservador: só marque "atende: true" se houver evidência clara na resposta.

Contexto do lead: ${contexto || '(sem contexto)'}`

  const messages = [
    { role: 'user', content: `Analise esta resposta:\n\n"${resposta}"` }
  ]

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: settings.model || 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: systemPrompt,
        messages,
      }),
    })

    if (!resp.ok) {
      const err = await resp.json()
      throw new ApiError(err.error?.message || 'Erro da API', 'Não consegui analisar a resposta.')
    }

    const data = await resp.json()
    const texto = data.content?.[0]?.text || ''
    const parsed = parseJSONSeguro(texto)

    if (!parsed.ok) {
      return { ok: false, raw: parsed.raw }
    }

    return { ok: true, data: parsed.data }
  } catch (e) {
    if (e instanceof ApiError) throw e
    throw new ApiError(e.message, 'Erro ao chamar a API.')
  }
}
