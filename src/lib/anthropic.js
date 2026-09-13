const Anthropic = require('@anthropic-ai/sdk');
const { MASTER_SYSTEM_PROMPT } = require('../prompts/masterPrompt');

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada no .env');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Pega o ÚLTIMO bloco de texto da resposta (não junta todos). Isso é importante
// porque, ao usar a ferramenta de busca, a Claude às vezes escreve uma frase
// de narração ANTES de buscar (ex: "Vou pesquisar sobre...") — essa frase vem
// num bloco de texto separado do bloco final com a resposta de verdade.
// Juntar tudo quebraria o JSON; pegar só o último bloco evita isso.
function extractText(message) {
  const textBlocks = message.content.filter((block) => block.type === 'text');
  if (textBlocks.length === 0) return '';
  return textBlocks[textBlocks.length - 1].text;
}

// Tenta limpar e parsear JSON mesmo se vier com ```json ... ``` em volta ou
// com alguma frase antes/depois do JSON (rede de segurança extra, além da
// instrução no prompt para não narrar nada).
function parseJsonSafe(text) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (firstError) {
    // Plano B: extrai só o trecho entre o primeiro '{' ou '[' e o último
    // '}' ou ']' correspondente, ignorando qualquer texto solto ao redor.
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const starts = [firstBrace, firstBracket].filter((i) => i !== -1);

    if (starts.length === 0) throw firstError;

    const start = Math.min(...starts);
    const isArray = cleaned[start] === '[';
    const end = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}');

    if (end === -1 || end < start) throw firstError;

    const extracted = cleaned.slice(start, end + 1);
    return JSON.parse(extracted); // se ainda falhar aqui, o erro sobe pra quem chamou
  }
}

/**
 * Busca sugestões de pauta em alta, filtradas para potencial de branding.
 * Usa a ferramenta de busca web nativa da API da Anthropic.
 */
async function getTopicSuggestions() {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: `Você ajuda a Rachel Patrocínio (estrategista de branding e marketing) a encontrar
pautas para os carrosséis dela. Pesquise na web o que está em alta AGORA em: séries e filmes,
marcas famosas fazendo algo notável, moda, e inovações/notícias de marketing. Filtre e devolva
SOMENTE os 5 temas mais interessantes para ensinar um conceito de branding/marketing/
posicionamento — descarte tudo que seja fofoca vazia, polêmica sem relação com marca, ou
raso demais para virar um post estratégico.
IMPORTANTE: não escreva nenhuma frase de narração antes de pesquisar (ex: "vou
buscar...") nem nenhum comentário depois. Sua resposta final deve conter
SOMENTE o JSON abaixo, nada de texto antes ou depois dele.
Responda SOMENTE em JSON válido, sem markdown, neste formato:
[
  { "titulo": "resumo curto do tema", "gancho_branding": "qual conceito de branding esse tema evidencia, em 1 frase", "fonte": "de onde veio a info" }
]`,
    messages: [
      { role: 'user', content: 'Quais são os 5 melhores temas em alta agora para um post de branding?' },
    ],
  });

  const text = extractText(message);
  return parseJsonSafe(text);
}

/**
 * Gera o carrossel completo (textos + código visual de cada slide) a partir de um tema.
 */
async function generateCarousel(tema) {
  const client = getClient();

  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 8000,
    system: MASTER_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Tema escolhido para o post: "${tema}"\n\nGere o carrossel completo seguindo exatamente o schema JSON e as regras do sistema.`,
      },
    ],
  });

  const text = extractText(message);
  return parseJsonSafe(text);
}

module.exports = { getTopicSuggestions, generateCarousel };
