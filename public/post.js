const params = new URLSearchParams(window.location.search);
const jobId = params.get('job');

const els = {
  carregando: document.getElementById('carregando'),
  erro: document.getElementById('erro'),
  mensagemErro: document.getElementById('mensagemErro'),
  conteudo: document.getElementById('conteudo'),
  tituloPost: document.getElementById('tituloPost'),
  metaPost: document.getElementById('metaPost'),
  slides: document.getElementById('slides'),
  btnBaixarPdf: document.getElementById('btnBaixarPdf'),
  btnBaixarZip: document.getElementById('btnBaixarZip'),
};

function mostrarErro(msg) {
  els.carregando.classList.add('hidden');
  els.mensagemErro.textContent = msg;
  els.erro.classList.remove('hidden');
}

function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function renderizarSlide(slide) {
  const temFoto = slide.svg && slide.svg.includes('{{PHOTO}}');
  const podeGerarDeNovo = Boolean(slide.photo_prompt);

  const card = document.createElement('div');
  card.className = 'edit-slide-card';
  card.dataset.index = slide.index;

  card.innerHTML = `
    <img src="${slide.imageUrl}" alt="Slide ${slide.index}" class="edit-slide-card__img" />
    ${temFoto ? `
      <button class="btn--text edit-slide-card__toggle" type="button">Editar imagem de fundo</button>
      <div class="edit-slide-card__options hidden">
        <button class="chip edit-slide-card__upload-btn" type="button">Fazer upload</button>
        ${podeGerarDeNovo ? '<button class="chip edit-slide-card__regen-btn" type="button">Gerar novamente</button>' : ''}
        <input type="file" accept="image/*" class="edit-slide-card__file-input hidden" />
      </div>
      <p class="edit-slide-card__status"></p>
    ` : ''}
  `;

  if (temFoto) {
    const img = card.querySelector('.edit-slide-card__img');
    const toggleBtn = card.querySelector('.edit-slide-card__toggle');
    const optionsBox = card.querySelector('.edit-slide-card__options');
    const uploadBtn = card.querySelector('.edit-slide-card__upload-btn');
    const fileInput = card.querySelector('.edit-slide-card__file-input');
    const status = card.querySelector('.edit-slide-card__status');
    const regenBtn = card.querySelector('.edit-slide-card__regen-btn');

    toggleBtn.addEventListener('click', () => {
      optionsBox.classList.toggle('hidden');
    });

    uploadBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;

      status.textContent = 'Enviando imagem...';
      try {
        const formData = new FormData();
        formData.append('imagem', file);

        const res = await fetch(`/api/biblioteca/${jobId}/slide/${slide.index}/upload`, {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);

        img.src = data.slide.imageUrl;
        status.textContent = 'Imagem atualizada.';
        optionsBox.classList.add('hidden');
      } catch (err) {
        status.textContent = 'Erro: ' + err.message;
      }
      fileInput.value = '';
    });

    if (regenBtn) {
      regenBtn.addEventListener('click', async () => {
        status.textContent = 'Gerando nova imagem...';
        try {
          const res = await fetch(`/api/biblioteca/${jobId}/slide/${slide.index}/regenerate`, {
            method: 'POST',
          });
          const data = await res.json();
          if (!data.ok) throw new Error(data.error);

          img.src = data.slide.imageUrl;
          status.textContent = 'Imagem atualizada.';
          optionsBox.classList.add('hidden');
        } catch (err) {
          status.textContent = 'Erro: ' + err.message;
        }
      });
    }
  }

  return card;
}

async function carregar() {
  if (!jobId) {
    mostrarErro('Nenhum post especificado na URL.');
    return;
  }

  try {
    const res = await fetch(`/api/biblioteca/${jobId}`);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    const post = data.post;
    els.tituloPost.textContent = post.tema;
    els.metaPost.textContent = `Padrão ${post.pattern} · ${formatarData(post.created_at)}`;

    const slidesOrdenados = [...post.slides].sort((a, b) => a.index - b.index);
    els.slides.innerHTML = '';
    slidesOrdenados.forEach((slide) => {
      els.slides.appendChild(renderizarSlide(slide));
    });

    els.btnBaixarPdf.href = `/api/download/${post.id}/pdf`;
    els.btnBaixarZip.href = `/api/download/${post.id}`;

    els.carregando.classList.add('hidden');
    els.conteudo.classList.remove('hidden');
  } catch (err) {
    mostrarErro('Não consegui carregar este post: ' + err.message);
  }
}

carregar();
