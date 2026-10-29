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

  // Até 2 tentativas (erros temporários 429/5xx/timeouts costumam passar na segunda),
  // com limite de 75 s por tentativa para nunca estourar o tempo do Render.
  let res;
  let ultimoErro;
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      res = await fetch('https://api.openai.com/v1/images/generations', {
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
        signal: AbortSignal.timeout(75000),
      });
      if (res.ok) break;
      const errText = await res.text();
      ultimoErro = new Error(`Erro na API da OpenAI (${res.status}): ${errText.slice(0, 400)}`);
      // Erros que não adianta repetir (chave, verificação, saldo, moderação).
      if (res.status !== 429 && res.status < 500) throw ultimoErro;
      if (/insufficient_quota/.test(errText)) throw ultimoErro;
    } catch (err) {
      ultimoErro = err;
      if (tentativa === 2 || /Erro na API da OpenAI \((400|401|403)/.test(err.message)) throw err;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (!res || !res.ok) throw ultimoErro || new Error('Falha desconhecida ao chamar a OpenAI.');

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error('A OpenAI não retornou nenhuma imagem para esse prompt.');
  }

  return Buffer.from(b64, 'base64');
}

module.exports = { generatePhoto };
