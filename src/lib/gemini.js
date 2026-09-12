// Módulo responsável por gerar as fotos de fundo (quando o slide não envolve
// uma pessoa real/famosa) usando a API da Gemini (modelo de geração de imagem).

const GEMINI_MODEL = 'gemini-2.5-flash-image';

/**
 * Gera uma imagem a partir de um prompt em texto e devolve um Buffer PNG.
 */
async function generatePhoto(prompt) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada no .env');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  // Reforça sempre, no próprio prompt, as restrições de estilo/marca e a
  // proibição de gerar rostos reconhecíveis de pessoas reais.
  const fullPrompt = `${prompt}. Fotorrealista, iluminação cinematográfica, paleta
dessaturada com tons dourados/neutros, sem rostos de pessoas reais ou identificáveis,
alta resolução, composição com espaço negativo para sobrepor texto.`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Erro na API da Gemini (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);

  if (!imagePart) {
    throw new Error('A Gemini não retornou nenhuma imagem para esse prompt.');
  }

  return Buffer.from(imagePart.inlineData.data, 'base64');
}

module.exports = { generatePhoto };
