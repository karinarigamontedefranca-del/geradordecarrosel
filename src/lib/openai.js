// Módulo responsável por gerar as fotos de fundo (quando o slide não envolve
// uma pessoa real/famosa) usando a API de imagens da OpenAI (GPT Image).

const OPENAI_IMAGE_MODEL = 'gpt-image-1';

/**
 * Gera uma imagem a partir de um prompt em texto e devolve um Buffer PNG.
 */
async function generatePhoto(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada no .env');
  }

  // Reforça sempre, no próprio prompt, as restrições de estilo/marca e a
  // proibição de gerar rostos reconhecíveis de pessoas reais.
  const fullPrompt = `${prompt}. Fotorrealista, iluminação cinematográfica, paleta
dessaturada com tons dourados/neutros, sem rostos de pessoas reais ou identificáveis,
alta resolução, composição com espaço negativo para sobrepor texto.`;

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt: fullPrompt,
      size: '1024x1536', // retrato, mais perto do formato 1080x1350 do carrossel
      quality: 'medium', // 'low' | 'medium' | 'high' — medium equilibra custo e qualidade
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API da OpenAI (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error('A OpenAI não retornou nenhuma imagem para esse prompt.');
  }

  return Buffer.from(b64, 'base64');
}

module.exports = { generatePhoto };
