const express = require('express');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const multer = require('multer');

const { generateCarousel } = require('../lib/anthropic');
const { generatePhoto } = require('../lib/openai');
const { renderSlideToPng, embedPhoto } = require('../lib/renderSlide');
const supabase = require('../lib/supabase');

const router = express.Router();
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

// Upload de imagem guardado só na memória (não precisa gravar em disco) —
// limite de 8MB, só imagens.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('O arquivo precisa ser uma imagem.'));
    }
    cb(null, true);
  },
});

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

    // Gera a foto de cada slide (quando precisar) em PARALELO, não em sequência.
    // IMPORTANTE: aqui só usamos Claude + OpenAI + disco local — nada de
    // Supabase nesse caminho. Assim, mesmo que o Supabase esteja lento, com
    // chave errada, ou fora do ar, o post ainda aparece pra Rachel normalmente.
    const slidesOut = await Promise.all(
      carousel.slides.map(async (slide) => {
        const photoBuffer = await resolvePhotoBuffer(slide);
        const finalSvg = embedPhoto(slide.svg, photoBuffer);
        const pngBuffer = renderSlideToPng(finalSvg);

        const fileName = `slide-${String(slide.index).padStart(2, '0')}.png`;
        fs.writeFileSync(path.join(jobDir, fileName), pngBuffer);

        return {
          index: slide.index,
          imageUrl: `/output/${jobId}/${fileName}`,
          photo_description: slide.photo_description || null,
          // Guardamos o "molde" (SVG original, ainda com {{PHOTO}}) e o prompt
          // usado na foto — sem isso, não dá pra editar a imagem de fundo depois.
          svg: slide.svg,
          photo_prompt: slide.photo_prompt || null,
        };
      })
    );

    // Promise.all não garante a ordem de finalização, então reordena pelo índice
    // do slide antes de devolver pro front-end.
    slidesOut.sort((a, b) => a.index - b.index);

    fs.writeFileSync(path.join(jobDir, 'legenda.txt'), carousel.caption || '', 'utf-8');

    // Envia a resposta AGORA — o resto (salvar na biblioteca) acontece depois,
    // sem o navegador da Rachel esperar por isso.
    res.json({
      ok: true,
      jobId,
      pattern: carousel.pattern,
      caption: carousel.caption,
      slides: slidesOut,
    });

    // A partir daqui, nada mais é "await"-ado pela requisição: é só um
    // processo em segundo plano. Se falhar, só fica de fora da biblioteca —
    // não afeta o post que a Rachel já está vendo na tela.
    salvarNaBiblioteca({ jobId, jobDir, tema, carousel, slidesOut }).catch((err) => {
      console.warn('Não consegui salvar este post na biblioteca:', err.message);
    });

    if (supabase.isConfigured()) {
      supabase.markTopicUsed(tema).catch((err) => {
        console.warn('Não consegui marcar o tema como usado:', err.message);
      });
    }
  } catch (err) {
    console.error('Erro em /api/generate:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function salvarNaBiblioteca({ jobId, jobDir, tema, carousel, slidesOut }) {
  if (!supabase.isConfigured()) return;

  const slidesComUrlPermanente = await Promise.all(
    slidesOut.map(async (slide) => {
      const fileName = `slide-${String(slide.index).padStart(2, '0')}.png`;
      const buffer = fs.readFileSync(path.join(jobDir, fileName));
      const urlPermanente = await supabase.uploadSlide(jobId, fileName, buffer);
      return { ...slide, imageUrl: urlPermanente };
    })
  );

  await supabase.savePost({
    id: jobId,
    tema,
    pattern: carousel.pattern,
    caption: carousel.caption || '',
    created_at: new Date().toISOString(),
    slides: slidesComUrlPermanente,
  });
}

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

router.get('/temas', async (req, res) => {
  if (!supabase.isConfigured()) {
    return res.status(400).json({
      ok: false,
      error: 'A biblioteca de temas não está configurada ainda (faltam SUPABASE_URL e SUPABASE_SERVICE_KEY).',
    });
  }
  try {
    const temas = await supabase.listTopics();
    res.json({ ok: true, temas });
  } catch (err) {
    console.error('Erro em /api/temas:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------- Editar a imagem de fundo de um slide já salvo ----------

function precisaEstarConfigurado(res) {
  if (!supabase.isConfigured()) {
    res.status(400).json({ ok: false, error: 'A biblioteca não está configurada ainda.' });
    return false;
  }
  return true;
}

async function renderizarESalvarSlide({ jobId, slide, photoBuffer }) {
  if (!slide.svg || !slide.svg.includes('{{PHOTO}}')) {
    throw new Error('Este slide não tem uma foto de fundo pra editar (é um slide só de texto).');
  }

  const finalSvg = embedPhoto(slide.svg, photoBuffer);
  const pngBuffer = renderSlideToPng(finalSvg);

  // Nome de arquivo novo a cada edição (com timestamp), pra garantir que o
  // link da imagem mude e não fique preso num cache antigo do navegador/CDN.
  const fileName = `slide-${String(slide.index).padStart(2, '0')}-${Date.now()}.png`;
  const novaUrl = await supabase.uploadSlide(jobId, fileName, pngBuffer);

  const slideAtualizado = await supabase.updatePostSlide(jobId, slide.index, { imageUrl: novaUrl });
  return slideAtualizado;
}

router.post('/biblioteca/:jobId/slide/:index/upload', upload.single('imagem'), async (req, res) => {
  if (!precisaEstarConfigurado(res)) return;

  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'Nenhuma imagem foi enviada.' });
    }

    const post = await supabase.getPost(req.params.jobId);
    const slideIndex = Number(req.params.index);
    const slide = post.slides.find((s) => s.index === slideIndex);
    if (!slide) {
      return res.status(404).json({ ok: false, error: 'Slide não encontrado.' });
    }

    const slideAtualizado = await renderizarESalvarSlide({
      jobId: req.params.jobId,
      slide,
      photoBuffer: req.file.buffer,
    });

    res.json({ ok: true, slide: slideAtualizado });
  } catch (err) {
    console.error('Erro ao trocar a imagem do slide:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/biblioteca/:jobId/slide/:index/regenerate', async (req, res) => {
  if (!precisaEstarConfigurado(res)) return;

  try {
    const post = await supabase.getPost(req.params.jobId);
    const slideIndex = Number(req.params.index);
    const slide = post.slides.find((s) => s.index === slideIndex);
    if (!slide) {
      return res.status(404).json({ ok: false, error: 'Slide não encontrado.' });
    }
    if (!slide.photo_prompt) {
      return res.status(400).json({
        ok: false,
        error: 'Este slide não tem uma descrição de foto gerada por IA pra regenerar (provavelmente é um slide com foto real, que só pode ser trocado por upload).',
      });
    }

    const photoBuffer = await generatePhoto(slide.photo_prompt);
    const slideAtualizado = await renderizarESalvarSlide({
      jobId: req.params.jobId,
      slide,
      photoBuffer,
    });

    res.json({ ok: true, slide: slideAtualizado });
  } catch (err) {
    console.error('Erro ao regenerar a imagem do slide:', err);
    res.status(500).json({ ok: false, error: err.message });
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
