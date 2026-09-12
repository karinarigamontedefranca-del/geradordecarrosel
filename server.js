require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const suggestionsRoute = require('./src/routes/suggestions');
const generateRoute = require('./src/routes/generate');

const app = express();
const PORT = process.env.PORT || 3000;
const OUTPUT_DIR = path.join(__dirname, 'output');

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/output', express.static(OUTPUT_DIR));

app.use('/api', suggestionsRoute);
app.use('/api', generateRoute);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
  });
});

app.listen(PORT, () => {
  console.log(`Gerador de carrosséis da Rachel rodando em http://localhost:${PORT}`);
});
