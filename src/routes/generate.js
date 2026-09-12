const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const { generateCarousel } = require('../lib/anthropic');
const { generatePhoto } = require('../lib/gemini');
const { renderSlideToPng, embedPhoto } = require('../lib/renderSlide');

const router = express.Router();
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

// Fundo neutro usado quando o slide precisa de uma foto REAL (pessoa famosa)
// que a Rachel vai inserir manualmente depois, ou quando a geração de foto falha.
function placeholderSvgRect() {
  return `<svg width="1080" height="1350" xmlns="http://www.w3.org/2000/svg">
    <rect width="1080" height="1350" fill="#CFB9A1"/>
  </svg>`;
}

async function resolvePhotoBuffer(slide) {
  if (slide.needs_generated_photo && slide.photo_prompt) {
    try {
      return await generatePhoto(slide.photo_prompt);
    } catch (err) {
      console.warn(`Falha ao gerar foto do slide ${slide.index}, usando fundo neutro:`, err.message);
      return renderSlideToPng(placeholderSvgRect());
    }
  }
  if (slide.needs_real_photo_placeholder) {
    return renderSlideToPng(placeholderSvgRect());
  }
  return null;
}

router.post('/generate', async (req, res) => {
  try {
    const { tema } = req.body;
    if (!tema || !tema.trim()) {
      return res.status(400).json({ ok: false, error: 'Informe um tema para gerar o carrossel.' });
    }

    const carousel = await generateCarousel(tema);

    const jobId = `carrossel-${Date.now()}`;
    const jobDir = path.join(OUTPUT_DIR, jobId);
    fs.mkdirSync(jobDir, { recursive: true });

    const slidesOut = [];

    for (const slide of carousel.slides) {
      const photoBuffer = await resolvePhotoBuffer(slide);
      const finalSvg = embedPhoto(slide.svg, photoBuffer);
      const pngBuffer = renderSlideToPng(finalSvg);

      const fileName = `slide-${String(slide.index).padStart(2, '0')}.png`;
      fs.writeFileSync(path.join(jobDir, fileName), pngBuffer);

      slidesOut.push({
        index: slide.index,
        imageUrl: `/output/${jobId}/${fileName}`,
        photo_description: slide.photo_description || null,
      });
    }

    fs.writeFileSync(
      path.join(jobDir, 'legenda.txt'),
      carousel.caption || '',
      'utf-8'
    );

    res.json({
      ok: true,
      jobId,
      pattern: carousel.pattern,
      caption: carousel.caption,
      slides: slidesOut,
    });
  } catch (err) {
    console.error('Erro em /api/generate:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/download/:jobId', (req, res) => {
  const jobDir = path.join(OUTPUT_DIR, req.params.jobId);
  if (!fs.existsSync(jobDir)) {
    return res.status(404).json({ ok: false, error: 'Carrossel não encontrado.' });
  }

  res.attachment(`${req.params.jobId}.zip`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);
  archive.directory(jobDir, false);
  archive.finalize();
});

module.exports = router;
