const Anthropic = require('@anthropic-ai/sdk');
const { MASTER_SYSTEM_PROMPT } = require('../prompts/masterPrompt');

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada no .env');
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Extrai o primeiro bloco de texto de uma resposta da API (ignora blocos de tool use/search)
function extractText(message) {
  return message.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// Tenta limpar e parsear JSON mesmo se vier com ```json ... ``` em volta
function parseJsonSafe(text) {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
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
