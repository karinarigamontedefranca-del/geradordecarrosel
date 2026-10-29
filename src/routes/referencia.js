const express = require('express');
const multer = require('multer');
const { PDFDocument } = require('pdf-lib');

const { analyzeReference } = require('../lib/anthropic');

const router = express.Router();

// Limites que seguram o custo e o uso de memória (o Render gratuito tem pouca RAM).
const MAX_ARQUIVOS = 10;
const MAX_TAMANHO_ARQUIVO = 20 * 1024 * 1024; // 20 MB cada
const MAX_PAGINAS_PDF = 20;
const TIPOS_ACEITOS = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TAMANHO_ARQUIVO, files: MAX_ARQUIVOS },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_ACEITOS.includes(file.mimetype)) {
      return cb(new Error('Envie um PDF ou imagens (PNG, JPG, WEBP).'));
    }
    cb(null, true);
  },
});

// Roda o multer e transforma qualquer erro dele (arquivo grande, tipo errado,
// arquivos demais) em uma resposta JSON legível, em vez de uma página de erro.
function receberArquivos(req, res, next) {
  upload.array('arquivos', MAX_ARQUIVOS)(req, res, (err) => {
    if (!err) return next();
    let mensagem = err.message;
    if (err.code === 'LIMIT_FILE_SIZE') mensagem = 'Um dos arquivos passa de 20 MB. Envie um arquivo menor.';
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      mensagem = `Envie no máximo ${MAX_ARQUIVOS} arquivos.`;
    }
    res.status(400).json({ ok: false, error: mensagem });
  });
}

router.post('/referencia/analisar', receberArquivos, async (req, res) => {
  try {
    const arquivos = req.files || [];
    if (arquivos.length === 0) {
      return res.status(400).json({ ok: false, error: 'Anexe o PDF ou as imagens do post de referência.' });
    }

    // Confere cada PDF: tem que abrir e não pode ter páginas demais (cada página
    // vira uma imagem lida pela IA, então o custo cresce com o nº de páginas).
    for (const arquivo of arquivos) {
      if (arquivo.mimetype !== 'application/pdf') continue;
      let paginas;
      try {
        const pdf = await PDFDocument.load(arquivo.buffer);
        paginas = pdf.getPageCount();
      } catch (err) {
        return res.status(400).json({
          ok: false,
          error: `Não consegui abrir o PDF "${arquivo.originalname}". Ele pode estar protegido por senha ou corrompido.`,
        });
      }
      if (paginas > MAX_PAGINAS_PDF) {
        return res.status(400).json({
          ok: false,
          error: `O PDF "${arquivo.originalname}" tem ${paginas} páginas. O máximo é ${MAX_PAGINAS_PDF} (um carrossel costuma ter até 12).`,
        });
      }
    }

    const resultado = await analyzeReference(arquivos);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    console.error('Erro em /api/referencia/analisar:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
