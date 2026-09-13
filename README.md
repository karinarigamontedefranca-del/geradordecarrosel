# Gerador de carrosséis — Rachel Patrocínio

Sistema que gera carrosséis de Instagram completos (texto + design + legenda)
no estilo da Rachel, a partir de um tema — usando a API da Anthropic (Claude)
para decidir o padrão/redigir/desenhar cada slide em código, e a API de imagens
da OpenAI (GPT Image) para gerar fotos de fundo quando necessário.

## Ativar a biblioteca de posts (Supabase) — opcional, mas recomendado

Sem isso, o sistema funciona normalmente, só não guarda histórico — se o
Render reiniciar, os posts gerados desde o último reinício somem (é o
problema que resolvemos com isso).

### 1. Criar o projeto no Supabase
Vá em [supabase.com](https://supabase.com), crie uma conta grátis e um novo
projeto. Anote a senha do banco que você definir.

### 2. Criar a tabela de posts
No painel do Supabase, vá em **SQL Editor** → **New query**, cole e rode:
```sql
create table posts (
  id text primary key,
  tema text not null,
  pattern text,
  caption text,
  created_at timestamptz default now(),
  slides jsonb
);
```

### 3. Criar o espaço de armazenamento das imagens
No painel, vá em **Storage** → **New bucket**. Nome: `carrosseis`. Marque
como **Public bucket** (assim as imagens abrem direto nos links, sem senha).

### 4. Pegar as chaves
Vá em **Project Settings** → **API**. Copie:
- **Project URL** → vai na variável `SUPABASE_URL`
- **service_role key** (não a `anon` key — essa fica só no servidor, nunca no navegador) → vai na variável `SUPABASE_SERVICE_KEY`

### 5. Configurar no projeto
No `.env` (local) ou nas variáveis de ambiente do Render, adicione as duas:
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
```

Pronto — a partir do próximo post gerado, tudo fica salvo permanentemente e
aparece na página **Biblioteca** (link no topo do gerador).

## Como rodar (primeiro teste, no seu computador)

### 1. Pré-requisitos
- Instalar o [Node.js](https://nodejs.org) (versão 18 ou mais recente).

### 2. Instalar as dependências
Abra um terminal dentro desta pasta e rode:
```
npm install
```

### 3. Configurar as chaves de API
Copie o arquivo `.env.example` e renomeie a cópia para `.env`. Abra o `.env`
e cole suas chaves:
```
ANTHROPIC_API_KEY=sua_chave_aqui
OPENAI_API_KEY=sua_chave_aqui
```

### 4. Adicionar as fontes da marca
Veja as instruções em `fonts/README.md`. Sem os arquivos de fonte, o sistema
ainda funciona (usa uma fonte substituta), mas o visual não fica 100% fiel
até você adicionar `Gallient` e `Montserrat`.

### 5. Rodar o servidor
```
npm start
```
Depois abra `http://localhost:3000` no navegador. É essa página que a Rachel
vai usar.

## O que já foi testado
O motor de renderização (que transforma o código gerado pela IA em imagem
PNG) já foi testado e funciona corretamente — veja `output/teste.png` de
exemplo. O que falta testar é a geração real com sua chave (texto da Claude +
fotos da OpenAI), que só funciona com as chaves de API válidas.

## Estrutura do projeto
```
server.js                  → servidor principal
src/prompts/masterPrompt.js → todas as regras de DNA e marca (edite aqui para ajustar tom/regras)
src/lib/anthropic.js        → chamadas à API da Claude (sugestões + geração do carrossel)
src/lib/openai.js           → chamada à API de imagens da OpenAI (fotos de fundo)
src/lib/supabase.js         → salva/busca os posts na biblioteca permanente (opcional)
src/lib/renderSlide.js      → motor que transforma o SVG gerado em imagem PNG
src/routes/                 → rotas do servidor (/api/suggestions, /api/generate, /api/biblioteca, /api/download...)
public/index.html           → gerador (as 4 etapas)
public/biblioteca.html      → histórico de posts salvos
fonts/                      → onde colocar os arquivos de fonte da marca
output/                     → carrosséis gerados (cache local; a cópia permanente fica no Supabase)
```

## Sobre pessoas famosas reais (importante)
Quando o tema envolve uma pessoa pública identificável (ex: um atleta, um
CEO, uma celebridade), o sistema NÃO gera a foto dela por IA — isso é
proibido pelas políticas da Anthropic e da OpenAI, além de risco de direito
de imagem. Nesses casos, o slide aparece com um aviso na interface dizendo
qual foto a Rachel precisa inserir manualmente (uma foto de imprensa, por
exemplo), e o texto/layout ao redor já vem pronto.

## Próximos passos (depois deste primeiro teste)
1. Testar a geração de ponta a ponta com temas reais e comparar com os
   posts reais da Rachel.
2. Ajustar `masterPrompt.js` com base no que sair errado.
3. Colocar o app no ar de graça (Render ou Vercel) para a Rachel acessar
   por um link, sem precisar rodar nada no computador dela.
