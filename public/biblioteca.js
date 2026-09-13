const els = {
  carregando: document.getElementById('carregando'),
  semConfiguracao: document.getElementById('semConfiguracao'),
  vazio: document.getElementById('vazio'),
  lista: document.getElementById('lista'),
};

function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function carregar() {
  try {
    const res = await fetch('/api/biblioteca');
    const data = await res.json();

    els.carregando.classList.add('hidden');

    if (!data.ok) {
      els.semConfiguracao.classList.remove('hidden');
      return;
    }

    if (data.posts.length === 0) {
      els.vazio.classList.remove('hidden');
      return;
    }

    data.posts.forEach((post) => {
      const primeiraImagem = post.slides?.[0]?.imageUrl || '';

      const card = document.createElement('div');
      card.className = 'library-card';
      card.innerHTML = `
        <img src="${primeiraImagem}" alt="${post.tema}" />
        <div class="library-card__body">
          <p class="library-card__tema">${post.tema}</p>
          <p class="library-card__meta">Padrão ${post.pattern} · ${formatarData(post.created_at)}</p>
          <div class="library-card__actions">
            <a href="/api/download/${post.id}/pdf" class="btn--text" download>PDF</a>
            <a href="/api/download/${post.id}" class="btn--text" download>ZIP</a>
          </div>
        </div>
      `;
      els.lista.appendChild(card);
    });
  } catch (err) {
    els.carregando.classList.add('hidden');
    els.semConfiguracao.classList.remove('hidden');
  }
}

carregar();
