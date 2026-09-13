const state = {
  currentStage: 1,
  maxReached: 1,
  jobId: null,
  pattern: null,
  autoCaption: '',
  captionMode: 'auto', // 'auto' | 'manual'
};

const els = {
  tracker: document.querySelectorAll('.tracker__step'),
  stages: {
    1: document.getElementById('stage-1'),
    2: document.getElementById('stage-2'),
    3: document.getElementById('stage-3'),
    4: document.getElementById('stage-4'),
  },
  btnSugestoes: document.getElementById('btnSugestoes'),
  listaSugestoes: document.getElementById('listaSugestoes'),
  temaInput: document.getElementById('tema'),
  btnGerar: document.getElementById('btnGerar'),
  loadingPost: document.getElementById('loadingPost'),
  padraoInfo: document.getElementById('padraoInfo'),
  slidesGrid: document.getElementById('slides'),
  btnParaLegenda: document.getElementById('btnParaLegenda'),
  btnLegendaAuto: document.getElementById('btnLegendaAuto'),
  btnLegendaManual: document.getElementById('btnLegendaManual'),
  legendaBox: document.getElementById('legenda'),
  btnParaBaixar: document.getElementById('btnParaBaixar'),
  btnBaixarPdf: document.getElementById('btnBaixarPdf'),
  btnBaixarZip: document.getElementById('btnBaixarZip'),
  btnCopiarLegenda: document.getElementById('btnCopiarLegenda'),
  btnNovoPost: document.getElementById('btnNovoPost'),
  erro: document.getElementById('erro'),
  mensagemErro: document.getElementById('mensagemErro'),
};

function mostrarErro(msg) {
  els.mensagemErro.textContent = msg;
  els.erro.classList.remove('hidden');
  els.erro.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function esconderErro() {
  els.erro.classList.add('hidden');
}

function goToStage(n) {
  if (n > state.maxReached) return;
  state.currentStage = n;

  Object.entries(els.stages).forEach(([key, el]) => {
    el.dataset.active = String(Number(key) === n);
  });

  els.tracker.forEach((btn) => {
    const step = Number(btn.dataset.step);
    if (step === n) btn.dataset.state = 'active';
    else if (step < state.maxReached) btn.dataset.state = 'done';
    else btn.dataset.state = 'upcoming';
  });

  esconderErro();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function unlockStage(n) {
  if (n > state.maxReached) state.maxReached = n;
}

els.tracker.forEach((btn) => {
  btn.addEventListener('click', () => goToStage(Number(btn.dataset.step)));
});

// ---------- ETAPA 1: TEMA ----------

els.btnSugestoes.addEventListener('click', async () => {
  esconderErro();
  els.listaSugestoes.innerHTML = '<p>Buscando temas em alta...</p>';
  try {
    const res = await fetch('/api/suggestions', { method: 'POST' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    els.listaSugestoes.innerHTML = '';
    data.suggestions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `${s.titulo}<span class="gancho">${s.gancho_branding}</span>`;
      item.addEventListener('click', () => {
        els.temaInput.value = s.titulo;
        els.temaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      els.listaSugestoes.appendChild(item);
    });
  } catch (err) {
    els.listaSugestoes.innerHTML = '';
    mostrarErro('Não consegui buscar sugestões: ' + err.message);
  }
});

els.btnGerar.addEventListener('click', async () => {
  const tema = els.temaInput.value.trim();
  if (!tema) {
    mostrarErro('Digite ou escolha um tema antes de gerar.');
    return;
  }

  unlockStage(2);
  goToStage(2);
  els.loadingPost.classList.remove('hidden');
  els.slidesGrid.innerHTML = '';
  els.btnParaLegenda.classList.add('hidden');
  els.padraoInfo.textContent = '';

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tema }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    state.jobId = data.jobId;
    state.pattern = data.pattern;
    state.autoCaption = data.caption || '';

    els.padraoInfo.textContent = `Formato: Padrão ${data.pattern}`;
    els.slidesGrid.innerHTML = '';
    data.slides.forEach((slide) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'slide-wrapper';
      wrapper.innerHTML = `<img src="${slide.imageUrl}" alt="Slide ${slide.index}" />`;
      if (slide.photo_description) {
        const alerta = document.createElement('div');
        alerta.className = 'slide-alerta';
        alerta.textContent = 'Trocar foto: ' + slide.photo_description;
        wrapper.appendChild(alerta);
      }
      els.slidesGrid.appendChild(wrapper);
    });

    els.btnParaLegenda.classList.remove('hidden');
  } catch (err) {
    mostrarErro('Erro ao gerar o post: ' + err.message);
    goToStage(1);
  } finally {
    els.loadingPost.classList.add('hidden');
  }
});

// ---------- ETAPA 2 → 3 ----------

els.btnParaLegenda.addEventListener('click', () => {
  state.captionMode = 'auto';
  els.legendaBox.value = state.autoCaption;
  els.btnLegendaAuto.classList.add('chip--active');
  els.btnLegendaManual.classList.remove('chip--active');
  unlockStage(3);
  goToStage(3);
});

// ---------- ETAPA 3: LEGENDA ----------

els.btnLegendaAuto.addEventListener('click', () => {
  state.captionMode = 'auto';
  els.legendaBox.value = state.autoCaption;
  els.btnLegendaAuto.classList.add('chip--active');
  els.btnLegendaManual.classList.remove('chip--active');
});

els.btnLegendaManual.addEventListener('click', () => {
  state.captionMode = 'manual';
  els.legendaBox.value = '';
  els.legendaBox.placeholder = 'Escreva sua legenda aqui...';
  els.btnLegendaManual.classList.add('chip--active');
  els.btnLegendaAuto.classList.remove('chip--active');
  els.legendaBox.focus();
});

els.btnParaBaixar.addEventListener('click', async () => {
  try {
    await fetch(`/api/legenda/${state.jobId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: els.legendaBox.value }),
    });
  } catch (err) {
    // Se salvar a legenda falhar, ainda deixamos seguir — o download em ZIP/PDF
    // só perde a legenda.txt atualizada, não trava o fluxo.
    console.warn('Não consegui salvar a legenda:', err.message);
  }

  els.btnBaixarPdf.href = `/api/download/${state.jobId}/pdf`;
  els.btnBaixarZip.href = `/api/download/${state.jobId}`;

  unlockStage(4);
  goToStage(4);
});

// ---------- ETAPA 4: BAIXAR ----------

els.btnCopiarLegenda.addEventListener('click', async () => {
  await navigator.clipboard.writeText(els.legendaBox.value);
  els.btnCopiarLegenda.textContent = 'Legenda copiada';
  setTimeout(() => (els.btnCopiarLegenda.textContent = 'Copiar legenda'), 2000);
});

els.btnNovoPost.addEventListener('click', () => {
  state.currentStage = 1;
  state.maxReached = 1;
  state.jobId = null;
  state.pattern = null;
  state.autoCaption = '';
  state.captionMode = 'auto';

  els.temaInput.value = '';
  els.listaSugestoes.innerHTML = '';
  els.slidesGrid.innerHTML = '';
  els.legendaBox.value = '';

  goToStage(1);
});

// Estado inicial da trilha
goToStage(1);
