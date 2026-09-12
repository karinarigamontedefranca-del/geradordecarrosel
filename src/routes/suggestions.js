const express = require('express');
const { getTopicSuggestions } = require('../lib/anthropic');

const router = express.Router();

router.post('/suggestions', async (req, res) => {
  try {
    const suggestions = await getTopicSuggestions();
    res.json({ ok: true, suggestions });
  } catch (err) {
    console.error('Erro em /api/suggestions:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
