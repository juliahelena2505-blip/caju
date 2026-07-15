const API_URL = 'https://api.anthropic.com/v1/messages'

export class ApiError extends Error {
  constructor(msg, friendly) {
    super(msg)
    this.friendly = friendly
  }
}

async function chamarClaude({ settings, system, content }) {
  if (!settings.apiKey) {
    throw new ApiError('missing key', 'Configure sua chave de API nos Ajustes para usar a análise com IA.')
  }
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: settings.model || 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content }],
      }),
    })
  } catch (e) {
    throw new ApiError(e.message, 'Não consegui conectar à API. Verifique sua internet e tente de novo.')
  }

  if (res.status === 401 || res.status === 403) {
    throw new ApiError('auth', 'Chave inválida — verifique nos Ajustes.')
  }
  if (res.status === 429) {
    throw new ApiError('rate', 'Muitas chamadas em sequência. Espere alguns segundos e tente de novo.')
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new ApiError(`HTTP ${res.status}: ${body}`, `A API retornou um erro (${res.status}). Tente de novo em instantes.`)
  }

  const data = await res.json()
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
}

export function parseJSONSeguro(texto) {
  let t = (texto || '').trim()
  
  // Remove TODAS as variações de cercas markdown (backticks, quebras, espaços)
  t = t.replace(/^```[\s\S]*?json\s*/i, '')     // ```json seguido de qualquer coisa
  t = t.replace(/^```[\s\S]*?\s*/i, '')          // ``` seguido de qualquer coisa
  t = t.replace(/[\s]*```[\s]*$/i, '')           // ``` no final com espaços
  t = t.replace(/^`+[\s]*/g, '')                 // backticks no início
  t = t.replace(/[\s]*`+$/g, '')                 // backticks no final
  t = t.trim()
  
  // Força a extração: pega TUDO entre { e }, mesmo com lixo em volta
  const ini = t.indexOf('{')
  const fim = t.lastIndexOf('}')
  if (ini >= 0 && fim > ini) {
    t = t.slice(ini, fim + 1)
  }
  
  try {
    return { ok: true, data: JSON.parse(t) }
  } catch (e) {
    // Se o JSON tiver quebra mesmo assim, tenta remover caracteres de controle
    try {
      t = t.replace(/[\x00-\x1F]/g, ' ') // Remove caracteres de controle
      return { ok: true, data: JSON.parse(t) }
    } catch {
      return { ok: false, raw: texto }
    }
  }
}

// ---------- 1) Análise do print ----------
const SYSTEM_ANALISE = `Você é a analista de prospecção da Caju, consultoria de branding e conteúdo para arquitetos. Você recebe um print (screenshot) de um perfil de arquiteto no Instagram e, opcionalmente, observações da consultora.

Avalie o perfil segundo EXATAMENTE estes 6 critérios. Cada critério vale 1 ponto quando atendido (escala final de 0 a 6):

1. alto_padrao — O escritório atende projetos de alto padrão: residenciais de ticket alto, imóveis grandes ou clientes de maior poder aquisitivo.
2. frequencia_conteudo — Publica no Instagram com consistência (pelo menos ~1x por semana). Use datas dos posts, quantidade de posts e sinais visíveis no print.
3. investe_marca — Investe na própria marca: site profissional, boas fotos, identidade visual, anúncios ou outros sinais de investimento em marketing.
4. operacao_estruturada — Possui equipe ou parceiros recorrentes; sinais de que o escritório passou da fase inicial.
5. presenca_sem_posicionamento — Perfil ATIVO, PORÉM sem mensagem clara sobre por que contratar aquele escritório. ATENÇÃO: quando isso é VERDADEIRO, conta 1 ponto A FAVOR de abordar (é a dor que a Caju resolve).
6. mostra_projeto_nao_expertise — Feed focado em fotos finais de projetos, com pouca explicação sobre processo, estratégia, método ou visão. Quando VERDADEIRO, conta 1 ponto A FAVOR de abordar (é a dor que a Caju resolve).

Os critérios 5 e 6 medem a DOR presente, não a força do lead. A pontuação soma na direção de "vale a pena abordar".

Veredito por score total:
- 5–6 → "BALEIA"
- 3–4 → "VALE"
- 0–2 → "PASSA"

Baseie cada evidência apenas no que está VISÍVEL no print ou nas observações. Se algo não dá para avaliar pelo print, marque false e diga na evidência que não havia sinal visível.

Responda APENAS com JSON puro, sem markdown, sem cercas de código, sem preâmbulo, neste formato exato:
{"criterios":{"alto_padrao":{"atende":true,"evidencia":"..."},"frequencia_conteudo":{"atende":true,"evidencia":"..."},"investe_marca":{"atende":true,"evidencia":"..."},"operacao_estruturada":{"atende":true,"evidencia":"..."},"presenca_sem_posicionamento":{"atende":true,"evidencia":"..."},"mostra_projeto_nao_expertise":{"atende":true,"evidencia":"..."}},"score":0,"veredito":"BALEIA","resumo":"1-2 frases"}`

export async function analisarPerfil({ settings, imagemBase64, mediaType, observacoes }) {
  const content = []
  if (imagemBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: mediaType || 'image/png', data: imagemBase64 } })
  }
  content.push({
    type: 'text',
    text: observacoes
      ? `Analise o print do perfil. Observações da consultora: ${observacoes}`
      : 'Analise o print do perfil segundo os 6 critérios.',
  })
  const texto = await chamarClaude({ settings, system: SYSTEM_ANALISE, content })
  return parseJSONSeguro(texto)
}

// ---------- 2) Geração de abordagem ----------
const MODELOS = `MODELO 1 (mensagem escrita, longa):
"Oii, [nome]! Tudo bem? Sei que você não faz ideia de quem eu sou hahahaha mas cheguei até você enquanto estava rolando o feed e acabei caindo [conteúdo]. Confesso que fui dar aquela stalkeada básica e gostei bastante dos seus projetos. Eu também sou arquiteta e achei muito legal o cuidado que você tem com o seu trabalho. Parabénss! Por isso me senti à vontade para te mandar essa mensagem e entender um pouco dos bastidores: como tem sido criar conteúdo para você? E, principalmente, como esse conteúdo tem se transformado em novos clientes. Pode ser que esse nem seja o seu caso. Se você já sente que seu posicionamento está claro, atrai os clientes que deseja e sua estratégia de marca está funcionando bem, pode apenas me ignorar, tá tranquilo. Mas, como vi que você está investindo em produzir conteúdo e tem projetos muito bons, achei que fazia sentido abrir essa conversa. Sem pressão nenhuma, taa? Você estaria aberta a trocar uma ideia sobre como usar o posicionamento para aumentar o valor percebido do seu trabalho e atrair clientes mais alinhados?"

MODELO 2 (curto, estilo intro de áudio):
"Oii, [Nome]! Aqui é Julia, to te enviando áudio só para você ter certeza que não é uma IA, sou eu mesma, ta? hahah [Nome], to te mandando mensagem porque todo dia eu caaaço gente boa nesse Instagram e eu encontrei seu perfil… Quero deixar esse canal de comunicação disponível para conversarmos sobre posicionamento de marca e como trabalhar para aumentar a percepção de valor dos seus projetos (que são maravilhosoos, inclusive! hahahha). Você está aberta a isso?"

MODELO 3 (direto ao ponto):
"Oii, [NOME]! Seguinte... vou direto ao ponto porque sei que você provavelmente não faz ideia de quem eu sou e essa mensagem pode parecer bem aleatória. 😂 Eu sou arquiteta como você, mas hoje trabalho ajudando arquitetos a se posicionarem nas redes sociais para atrair clientes que valorizam mais o trabalho deles. Não sei se esse é o seu caso. Se você já sente que seu posicionamento está claro, atrai os clientes que quer e está satisfeita com os resultados, pode desconsiderar essa mensagem sem problema. Mas eu percebi que você tem investido em produzir conteúdo e aparecer nas redes, então achei que fazia sentido abrir esse canal. Se você tiver interesse, adoraria trocar uma ideia e entender como tem sido essa experiência para você. Quem sabe eu consiga te mostrar alguns pontos que podem aumentar o valor percebido do seu trabalho e fazer o conteúdo gerar mais oportunidades. Você estaria aberta a conversar?"`

const SYSTEM_ABORDAGEM = `Você escreve mensagens de primeira abordagem no Instagram em nome de Julia, arquiteta que hoje trabalha com posicionamento de marca e conteúdo para arquitetos (consultoria Caju).

TOM E ESTILO (obrigatório): caloroso, informal brasileiro, humor leve, autodepreciativo no começo ("sei que você não me conhece"), sempre oferece saída sem pressão ("pode me ignorar, tá tranquilo"), puxa a dor de posicionamento e valor percebido, termina com pergunta aberta de baixa pressão. NUNCA soar como robô de vendas ou vendedor agressivo. Nada de "oferta imperdível", urgência falsa ou parágrafos corporativos.

Estude os 3 modelos de referência abaixo e escreva UMA mensagem NOVA no mesmo tom — não copie os modelos, varie naturalmente e personalize com os detalhes reais do perfil analisado (use as evidências e o resumo fornecidos para citar algo específico que "ela viu" no perfil).

${MODELOS}

Regras:
- Se o nome do lead não for informado, use o placeholder [nome].
- Adapte o gênero da linguagem se souber pelo contexto; na dúvida, mantenha neutro.
- Responda APENAS com o texto da mensagem, sem título, sem aspas, sem explicações.`

export async function gerarAbordagem({ settings, analise, nome, handle, estilo, observacoes }) {
  const estiloTxt =
    estilo === 'longa'
      ? 'Use o MODELO 1 (mensagem escrita longa) como base de estrutura.'
      : estilo === 'audio'
        ? 'Use o MODELO 2 (curto, estilo intro de áudio) como base de estrutura.'
        : estilo === 'direto'
          ? 'Use o MODELO 3 (direto ao ponto) como base de estrutura.'
          : 'Escolha você o modelo mais adequado ao perfil analisado.'

  const evid = Object.entries(analise?.criterios || {})
    .map(([k, v]) => `- ${k}: ${v.atende ? 'sim' : 'não'} (${v.evidencia})`)
    .join('\n')

  const blocoAnalise = analise
    ? `Veredito: ${analise.veredito} (score ${analise.score}/6)
Resumo: ${analise.resumo}
Critérios:
${evid}`
    : `Este lead foi adicionado manualmente, sem análise de print. Escreva uma abordagem mais genérica dentro do tom, apoiada nas observações abaixo (se houver). Não invente detalhes específicos do perfil que não foram informados.`

  const content = [
    {
      type: 'text',
      text: `Perfil analisado:
Nome: ${nome || '[nome desconhecido]'}
Instagram: ${handle || 'não informado'}
${blocoAnalise}
${observacoes ? `Observações extras da Julia: ${observacoes}` : ''}

${estiloTxt}
Escreva a mensagem de abordagem agora.`,
    },
  ]
  return chamarClaude({ settings, system: SYSTEM_ABORDAGEM, content })
}

// ---------- 3) Análise da resposta (qualificação) ----------
const SYSTEM_QUALIFICACAO = `Você analisa a resposta que um lead (arquiteto) mandou no Instagram para Julia, consultora de posicionamento de marca para arquitetos, e sugere quais critérios de qualificação já dá para marcar com base APENAS no que a pessoa escreveu.

Critérios:
1. fit — o serviço (posicionamento de marca + estratégia de conteúdo) ajuda a resolver o problema que a pessoa descreve.
2. objetivo — a expectativa da pessoa está alinhada com o que Julia entrega (posicionamento, valor percebido, atração de clientes alinhados; não é tráfego pago milagroso nem "viralizar").
3. urgencia — a pessoa demonstra urgência ou incômodo atual com o problema.
4. investimento — há sinais de capacidade financeira de investir (porte do escritório, tipo de cliente, menção a orçamento).
5. autoridade — a pessoa que respondeu é quem decide (dona/sócia do escritório).

Seja conservador: marque true só quando há sinal razoável no texto. Na dúvida, false com evidência explicando o que falta perguntar.

Responda APENAS com JSON puro, sem markdown, neste formato:
{"fit":{"atende":true,"evidencia":"..."},"objetivo":{"atende":false,"evidencia":"..."},"urgencia":{"atende":false,"evidencia":"..."},"investimento":{"atende":false,"evidencia":"..."},"autoridade":{"atende":false,"evidencia":"..."}}`

export async function analisarResposta({ settings, resposta, contexto }) {
  const content = [
    {
      type: 'text',
      text: `Contexto do lead: ${contexto || 'sem contexto extra'}\n\nResposta recebida:\n"""${resposta}"""\n\nAvalie os 5 critérios.`,
    },
  ]
  const texto = await chamarClaude({ settings, system: SYSTEM_QUALIFICACAO, content })
  return parseJSONSeguro(texto)
}
