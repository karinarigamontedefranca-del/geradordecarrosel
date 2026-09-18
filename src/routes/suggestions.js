const express = require('express');
const { getTopicSuggestions } = require('../lib/anthropic');
const supabase = require('../lib/supabase');

const router = express.Router();

router.post('/suggestions', async (req, res) => {
  try {
    // Busca (melhor esforço) quais temas já foram sugeridos nos últimos 14
    // dias, pra pedir pra Claude não repetir. Se o Supabase não estiver
    // configurado ou falhar, segue sem essa lista — não trava a busca.
    let temasRecentes = [];
    if (supabase.isConfigured()) {
      try {
        temasRecentes = await supabase.listRecentTopicTitles(14);
      } catch (err) {
        console.warn('Não consegui buscar o histórico de temas:', err.message);
      }
    }

    const suggestions = await getTopicSuggestions(temasRecentes);
    res.json({ ok: true, suggestions });

    // Responde primeiro, salva na biblioteca depois — mesmo princípio usado
    // na geração de post: o Supabase nunca deve atrasar o que a Rachel vê na tela.
    if (supabase.isConfigured()) {
      supabase.saveTopics(suggestions).catch((err) => {
        console.warn('Não consegui salvar os temas na biblioteca:', err.message);
      });
    }
  } catch (err) {
    console.error('Erro em /api/suggestions:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
