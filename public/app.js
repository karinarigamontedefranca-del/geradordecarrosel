const btnSugestoes = document.getElementById('btnSugestoes');
const listaSugestoes = document.getElementById('listaSugestoes');
const temaInput = document.getElementById('tema');
const btnGerar = document.getElementById('btnGerar');
const loading = document.getElementById('loading');
const resultado = document.getElementById('resultado');
const erroBox = document.getElementById('erro');
const mensagemErro = document.getElementById('mensagemErro');
const padraoInfo = document.getElementById('padraoInfo');
const slidesGrid = document.getElementById('slides');
const legendaBox = document.getElementById('legenda');
const btnCopiarLegenda = document.getElementById('btnCopiarLegenda');
const btnBaixarZip = document.getElementById('btnBaixarZip');

function mostrarErro(msg) {
  mensagemErro.textContent = msg;
  erroBox.classList.remove('hidden');
}

function esconderTudo() {
  erroBox.classList.add('hidden');
  resultado.classList.add('hidden');
}

btnSugestoes.addEventListener('click', async () => {
  esconderTudo();
  listaSugestoes.innerHTML = '<p>Buscando temas em alta...</p>';
  try {
    const res = await fetch('/api/suggestions', { method: 'POST' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    listaSugestoes.innerHTML = '';
    data.suggestions.forEach((s) => {
      const item = document.createElement('div');
      item.className = 'sugestao-item';
      item.innerHTML = `${s.titulo}<span class="gancho">${s.gancho_branding}</span>`;
      item.addEventListener('click', () => {
        temaInput.value = s.titulo;
        temaInput.scrollIntoView({ behavior: 'smooth' });
      });
      listaSugestoes.appendChild(item);
    });
  } catch (err) {
    listaSugestoes.innerHTML = '';
    mostrarErro('Não consegui buscar sugestões: ' + err.message);
  }
});

btnGerar.addEventListener('click', async () => {
  const tema = temaInput.value.trim();
  if (!tema) {
    mostrarErro('Digite ou escolha um tema antes de gerar.');
    return;
  }
  esconderTudo();
  loading.classList.remove('hidden');

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tema }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);

    padraoInfo.textContent = `Formato escolhido: Padrão ${data.pattern}`;
    slidesGrid.innerHTML = '';
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
      slidesGrid.appendChild(wrapper);
    });

    legendaBox.value = data.caption;
    btnBaixarZip.href = `/api/download/${data.jobId}`;

    resultado.classList.remove('hidden');
  } catch (err) {
    mostrarErro('Erro ao gerar o carrossel: ' + err.message);
  } finally {
    loading.classList.add('hidden');
  }
});

btnCopiarLegenda.addEventListener('click', async () => {
  await navigator.clipboard.writeText(legendaBox.value);
  btnCopiarLegenda.textContent = 'Copiado!';
  setTimeout(() => (btnCopiarLegenda.textContent = 'Copiar legenda'), 2000);
});
