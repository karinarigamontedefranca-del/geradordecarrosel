const state = {
  currentStage: 1,
  maxReached: 1,
  jobId: null,
  pattern: null,
  autoCaption: '',
  captionMode: 'auto', // 'auto' | 'manual'
  refFiles: [], // arquivos da referência ainda não enviados
  referencia: null, // análise devolvida por /api/referencia/analisar
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
  refArquivos: document.getElementById('refArquivos'),
  btnEscolherRef: document.getElementById('btnEscolherRef'),
  refLista: document.getElementById('refLista'),
  btnAnalisarRef: document.getElementById('btnAnalisarRef'),
  refLoading: document.getElementById('refLoading'),
  refResultado: document.getElementById('refResultado'),
  refDetalhes: document.getElementById('refDetalhes'),
  refIdeias: document.getElementById('refIdeias'),
  refCusto: document.getElementById('refCusto'),
  btnRemoverRef: document.getElementById('btnRemoverRef'),
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

// ---------- ETAPA 1: REFERÊNCIA DE INSPIRAÇÃO (opcional) ----------

const REF_MAX_ARQUIVOS = 10;
const REF_MAX_BYTES = 20 * 1024 * 1024;

function formatarTamanho(bytes) {
  return bytes >= 1024 * 1024
    ? (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    : Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

function renderRefArquivos() {
  els.refLista.innerHTML = '';
  state.refFiles.forEach((file, i) => {
    const li = document.createElement('li');
    const nome = document.createElement('span');
    nome.className = 'ref__file-name';
    nome.textContent = `${file.name} (${formatarTamanho(file.size)})`;
    const remover = document.createElement('button');
    remover.type = 'button';
    remover.setAttribute('aria-label', 'Remover ' + file.name);
    remover.textContent = '×';
    remover.addEventListener('click', () => {
      state.refFiles.splice(i, 1);
      state.referencia = null;
      renderRefArquivos();
      renderAnalise();
    });
    li.append(nome, remover);
    els.refLista.appendChild(li);
  });
  const temArquivos = state.refFiles.length > 0;
  els.refLista.classList.toggle('hidden', !temArquivos);
  els.btnAnalisarRef.classList.toggle('hidden', !temArquivos || Boolean(state.referencia));
  els.btnEscolherRef.textContent = temArquivos ? 'Trocar / adicionar arquivos' : 'Anexar PDF ou imagens';
}

function linhaDetalhe(titulo, texto) {
  if (!texto) return;
  const dt = document.createElement('dt');
  dt.textContent = titulo;
  const dd = document.createElement('dd');
  dd.textContent = texto;
  els.refDetalhes.append(dt, dd);
}

// Tudo que vem da IA entra na tela com textContent (nunca innerHTML).
function renderAnalise(custo) {
  const a = state.referencia;
  els.refResultado.classList.toggle('hidden', !a);
  els.refDetalhes.innerHTML = '';
  els.refIdeias.innerHTML = '';
  els.refCusto.textContent = '';
  if (!a) return;

  linhaDetalhe('Formato', a.numero_de_slides ? `${a.resumo_formato} (${a.numero_de_slides} slides)` : a.resumo_formato);
  linhaDetalhe('Abertura', a.abertura);
  linhaDetalhe('Ritmo e estrutura', a.ritmo_e_estrutura);
  linhaDetalhe('Visual', a.layout_visual);
  linhaDetalhe('Tom', a.tom_de_voz);
  linhaDetalhe('Fechamento', a.fechamento);
  linhaDetalhe('Assunto do original', a.assunto_do_original);
  linhaDetalhe('Ideia central', a.ideia_central_do_original);
  if (a.pontos_principais && a.pontos_principais.length) linhaDetalhe('Pontos que o post aborda', a.pontos_principais.join(' • '));

  a.ideias_de_assunto_diferentes.forEach((ideia) => {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.textContent = ideia.titulo;
    const gancho = document.createElement('span');
    gancho.className = 'gancho';
    gancho.textContent = ideia.gancho_branding;
    item.appendChild(gancho);
    item.addEventListener('click', () => {
      els.temaInput.value = ideia.titulo;
      els.temaInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    els.refIdeias.appendChild(item);
  });

  if (typeof custo === 'number') {
    els.refCusto.textContent = `Custo estimado desta leitura: ~US$ ${custo.toFixed(3).replace('.', ',')}`;
  }
}

els.btnEscolherRef.addEventListener('click', () => els.refArquivos.click());

els.refArquivos.addEventListener('change', () => {
  esconderErro();
  const novos = Array.from(els.refArquivos.files);
  els.refArquivos.value = ''; // permite escolher o mesmo arquivo de novo depois
  const todos = state.refFiles.concat(novos);

  if (todos.length > REF_MAX_ARQUIVOS) {
    mostrarErro(`Envie no máximo ${REF_MAX_ARQUIVOS} arquivos.`);
    return;
  }
  const grande = todos.find((f) => f.size > REF_MAX_BYTES);
  if (grande) {
    mostrarErro(`"${grande.name}" passa de 20 MB. Envie um arquivo menor.`);
    return;
  }
  state.refFiles = todos;
  state.referencia = null; // arquivos mudaram: a análise anterior não vale mais
  renderRefArquivos();
  renderAnalise();
});

async function analisarReferencia() {
  esconderErro();
  els.btnAnalisarRef.classList.add('hidden');
  els.refLoading.classList.remove('hidden');
  try {
    const form = new FormData();
    state.refFiles.forEach((f) => form.append('arquivos', f));
    const res = await fetch('/api/referencia/analisar', { method: 'POST', body: form });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    state.referencia = data.analise;
    renderAnalise(data.custo_estimado_usd);
    return true;
  } catch (err) {
    mostrarErro('Não consegui ler a referência: ' + err.message);
    return false;
  } finally {
    els.refLoading.classList.add('hidden');
    renderRefArquivos();
  }
}

els.btnAnalisarRef.addEventListener('click', analisarReferencia);

els.btnRemoverRef.addEventListener('click', () => {
  state.refFiles = [];
  state.referencia = null;
  renderRefArquivos();
  renderAnalise();
});

els.btnGerar.addEventListener('click', async () => {
  const tema = els.temaInput.value.trim();
  const modo = (document.querySelector('input[name="refModo"]:checked') || {}).value || 'mesmo';
  // No modo "mesmo assunto" o tema é opcional quando há referência (usamos o assunto do post lido).
  if (!tema && !(state.refFiles.length > 0 && modo === 'mesmo')) {
    mostrarErro('Digite ou escolha um tema antes de gerar.');
    return;
  }

  // Anexou arquivos mas não clicou em "Analisar"? Faz a leitura agora.
  if (state.refFiles.length > 0 && !state.referencia) {
    const ok = await analisarReferencia();
    if (!ok) return;
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
      body: JSON.stringify({ tema, referencia: state.referencia, modo }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    state.jobId = data.jobId;
    state.pattern = data.pattern;
    state.autoCaption = data.caption || '';

    els.padraoInfo.textContent =
      `Formato: Padrão ${data.pattern}` + (state.referencia ? ' · inspirado na sua referência' : '');
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

  state.refFiles = [];
  state.referencia = null;
  renderRefArquivos();
  renderAnalise();

  els.temaInput.value = '';
  els.listaSugestoes.innerHTML = '';
  els.slidesGrid.innerHTML = '';
  els.legendaBox.value = '';

  goToStage(1);
});

// Estado inicial da trilha
goToStage(1);
