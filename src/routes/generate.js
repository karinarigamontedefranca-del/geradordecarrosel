const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const { generateCarousel } = require('../lib/anthropic');
const { generatePhoto } = require('../lib/openai');
const { renderSlideToPng, embedPhoto } = require('../lib/renderSlide');
const supabase = require('../lib/supabase');

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

/**
 * Devolve a lista de arquivos PNG (nome + bytes) de um post, na ordem certa.
 * Primeiro tenta o disco local (mais rápido, é o caminho normal logo após
 * gerar); se o post não estiver mais no disco (ex: servidor reiniciou desde
 * então), busca no Supabase — é exatamente pra isso que a biblioteca existe.
 */
async function getSlideFiles(jobId) {
  const jobDir = path.join(OUTPUT_DIR, jobId);

  if (fs.existsSync(jobDir)) {
    const files = fs.readdirSync(jobDir).filter((f) => f.endsWith('.png')).sort();
    return files.map((fileName) => ({
      fileName,
      buffer: fs.readFileSync(path.join(jobDir, fileName)),
    }));
  }

  if (!supabase.isConfigured()) return null;

  const post = await supabase.getPost(jobId);
  const sortedSlides = [...post.slides].sort((a, b) => a.index - b.index);
  const files = await Promise.all(
    sortedSlides.map(async (slide) => {
      const fileName = `slide-${String(slide.index).padStart(2, '0')}.png`;
      const buffer = await supabase.downloadSlideBuffer(jobId, fileName);
      return { fileName, buffer };
    })
  );
  return files;
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

    // Gera a foto de cada slide (quando precisar) em PARALELO, não em sequência,
    // e já aproveita para enviar cada PNG pro Supabase (biblioteca permanente)
    // ao mesmo tempo que salva no disco local.
    const slidesOut = await Promise.all(
      carousel.slides.map(async (slide) => {
        const photoBuffer = await resolvePhotoBuffer(slide);
        const finalSvg = embedPhoto(slide.svg, photoBuffer);
        const pngBuffer = renderSlideToPng(finalSvg);

        const fileName = `slide-${String(slide.index).padStart(2, '0')}.png`;
        fs.writeFileSync(path.join(jobDir, fileName), pngBuffer);

        let imageUrl = `/output/${jobId}/${fileName}`;
        if (supabase.isConfigured()) {
          try {
            imageUrl = await supabase.uploadSlide(jobId, fileName, pngBuffer);
          } catch (err) {
            console.warn(`Não consegui salvar o slide ${slide.index} na biblioteca:`, err.message);
          }
        }

        return {
          index: slide.index,
          imageUrl,
          photo_description: slide.photo_description || null,
        };
      })
    );

    // Promise.all não garante a ordem de finalização, então reordena pelo índice
    // do slide antes de devolver pro front-end.
    slidesOut.sort((a, b) => a.index - b.index);

    fs.writeFileSync(path.join(jobDir, 'legenda.txt'), carousel.caption || '', 'utf-8');

    if (supabase.isConfigured()) {
      try {
        await supabase.savePost({
          id: jobId,
          tema,
          pattern: carousel.pattern,
          caption: carousel.caption || '',
          created_at: new Date().toISOString(),
          slides: slidesOut,
        });
      } catch (err) {
        console.warn('Não consegui salvar o post na biblioteca:', err.message);
      }
    }

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

router.post('/legenda/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const { caption } = req.body;
  const jobDir = path.join(OUTPUT_DIR, jobId);

  if (fs.existsSync(jobDir)) {
    fs.writeFileSync(path.join(jobDir, 'legenda.txt'), caption || '', 'utf-8');
  }

  if (supabase.isConfigured()) {
    try {
      await supabase.updateCaption(jobId, caption || '');
    } catch (err) {
      console.warn('Não consegui atualizar a legenda na biblioteca:', err.message);
    }
  }

  res.json({ ok: true });
});

// ---------- Biblioteca (histórico de posts salvos no Supabase) ----------

router.get('/biblioteca', async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(400).json({
      ok: false,
      error: 'A biblioteca não está configurada ainda (faltam SUPABASE_URL e SUPABASE_SERVICE_KEY).',
    });
  }
  try {
    const posts = await supabase.listPosts();
    res.json({ ok: true, posts });
  } catch (err) {
    console.error('Erro em /api/biblioteca:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/biblioteca/:jobId', async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(400).json({ ok: false, error: 'A biblioteca não está configurada ainda.' });
  }
  try {
    const post = await supabase.getPost(req.params.jobId);
    res.json({ ok: true, post });
  } catch (err) {
    res.status(404).json({ ok: false, error: err.message });
  }
});

// ---------- Downloads (funcionam para posts locais OU só na biblioteca) ----------

router.get('/download/:jobId', async (req, res) => {
  try {
    const files = await getSlideFiles(req.params.jobId);
    if (!files) {
      return res.status(404).json({ ok: false, error: 'Carrossel não encontrado.' });
    }

    res.attachment(`${req.params.jobId}.zip`);
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    files.forEach(({ fileName, buffer }) => archive.append(buffer, { name: fileName }));
    archive.finalize();
  } catch (err) {
    console.error('Erro ao montar ZIP:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.get('/download/:jobId/pdf', async (req, res) => {
  try {
    const files = await getSlideFiles(req.params.jobId);
    if (!files) {
      return res.status(404).json({ ok: false, error: 'Carrossel não encontrado.' });
    }

    const { PDFDocument } = require('pdf-lib');
    const pdfDoc = await PDFDocument.create();

    for (const { buffer } of files) {
      const image = await pdfDoc.embedPng(buffer);
      const page = pdfDoc.addPage([image.width, image.height]);
      page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
    }

    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.jobId}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Erro ao montar PDF:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
