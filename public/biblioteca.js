const els = {
  carregando: document.getElementById('carregando'),
  semConfiguracao: document.getElementById('semConfiguracao'),
  vazio: document.getElementById('vazio'),
  lista: document.getElementById('lista'),
  listaTemas: document.getElementById('listaTemas'),
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
        <a href="/post.html?job=${post.id}">
          <img src="${primeiraImagem}" alt="${post.tema}" />
        </a>
        <div class="library-card__body">
          <p class="library-card__tema">${post.tema}</p>
          <p class="library-card__meta">Padrão ${post.pattern} · ${formatarData(post.created_at)}</p>
          <div class="library-card__actions">
            <a href="/post.html?job=${post.id}" class="btn--text">Editar</a>
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

async function carregarTemas() {
  try {
    const res = await fetch('/api/temas');
    const data = await res.json();
    if (!data.ok) return; // já mostramos o aviso de configuração acima, não repete

    if (data.temas.length === 0) {
      els.listaTemas.innerHTML = '<p class="lead">Nenhum tema buscado ainda.</p>';
      return;
    }

    data.temas.forEach((tema) => {
      const item = document.createElement('div');
      item.className = 'topic-item';
      const status = tema.used_at
        ? '<span class="topic-badge topic-badge--used">já virou post</span>'
        : '<span class="topic-badge">ainda não usado</span>';
      item.innerHTML = `
        <div>
          <p class="topic-item__titulo">${tema.titulo}</p>
          <p class="topic-item__gancho">${tema.gancho_branding || ''}</p>
        </div>
        ${status}
      `;
      els.listaTemas.appendChild(item);
    });
  } catch (err) {
    // silencioso — a seção de posts já cobre o aviso de erro geral
  }
}

carregar();
carregarTemas();
