# Gerador de carrosséis — Rachel Patrocínio

Sistema que gera carrosséis de Instagram completos (texto + design + legenda)
no estilo da Rachel, a partir de um tema — usando a API da Anthropic (Claude)
para decidir o padrão/redigir/desenhar cada slide em código, e a API da Gemini
para gerar fotos de fundo quando necessário.

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
GEMINI_API_KEY=sua_chave_aqui
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
fotos da Gemini), que só funciona com as chaves de API válidas.

## Estrutura do projeto
```
server.js                  → servidor principal
src/prompts/masterPrompt.js → todas as regras de DNA e marca (edite aqui para ajustar tom/regras)
src/lib/anthropic.js        → chamadas à API da Claude (sugestões + geração do carrossel)
src/lib/gemini.js           → chamada à API da Gemini (fotos de fundo)
src/lib/renderSlide.js      → motor que transforma o SVG gerado em imagem PNG
src/routes/                 → rotas do servidor (/api/suggestions, /api/generate, /api/download)
public/                     → interface visual (HTML/CSS/JS) que a Rachel usa
fonts/                      → onde colocar os arquivos de fonte da marca
output/                     → carrosséis gerados (cada um em uma subpasta com timestamp)
```

## Sobre pessoas famosas reais (importante)
Quando o tema envolve uma pessoa pública identificável (ex: um atleta, um
CEO, uma celebridade), o sistema NÃO gera a foto dela por IA — isso é
proibido pelas políticas da Anthropic e da Google, além de risco de direito
de imagem. Nesses casos, o slide aparece com um aviso na interface dizendo
qual foto a Rachel precisa inserir manualmente (uma foto de imprensa, por
exemplo), e o texto/layout ao redor já vem pronto.

## Próximos passos (depois deste primeiro teste)
1. Testar a geração de ponta a ponta com temas reais e comparar com os
   posts reais da Rachel.
2. Ajustar `masterPrompt.js` com base no que sair errado.
3. Colocar o app no ar de graça (Render ou Vercel) para a Rachel acessar
   por um link, sem precisar rodar nada no computador dela.
