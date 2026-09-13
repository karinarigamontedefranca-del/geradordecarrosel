// Módulo responsável por guardar os posts gerados numa "biblioteca" permanente
// no Supabase — tanto os dados (tema, legenda, padrão) quanto as imagens dos
// slides. Isso existe porque o disco do Render (ou de qualquer hospedagem
// serverless/gratuita parecida) é TEMPORÁRIO: some quando o serviço reinicia.
// O Supabase é quem garante que um post gerado não se perde depois disso.
//
// Se as variáveis SUPABASE_URL / SUPABASE_SERVICE_KEY não estiverem
// configuradas, todas as funções aqui lançam um erro claro — e quem chama
// (em generate.js) trata isso com um simples aviso no log, sem quebrar a
// geração do post. Ou seja: configurar o Supabase é opcional; sem ele, o
// sistema volta a funcionar como antes (só sem guardar histórico).

const BUCKET = 'carrosseis';

function getClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_KEY não configuradas no .env');
  }
  // Import feito aqui dentro (e não no topo do arquivo) para que o projeto
  // continue funcionando mesmo que alguém remova a dependência sem usar o Supabase.
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

function isConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

/**
 * Envia o PNG de um slide para o Storage do Supabase e devolve a URL pública.
 */
async function uploadSlide(jobId, fileName, buffer) {
  const supabase = getClient();
  const path = `${jobId}/${fileName}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'image/png',
    upsert: true,
  });
  if (error) throw new Error(`Falha ao enviar imagem para o Supabase: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Baixa de volta o PNG de um slide (usado para montar ZIP/PDF de posts
 * antigos, cujos arquivos locais já podem ter sumido do disco do servidor).
 */
async function downloadSlideBuffer(jobId, fileName) {
  const supabase = getClient();
  const path = `${jobId}/${fileName}`;

  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Falha ao baixar imagem do Supabase: ${error.message}`);

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Salva os dados de um post (tema, padrão, legenda, lista de slides) na
 * tabela "posts" — isso é o registro da biblioteca.
 */
async function savePost(post) {
  const supabase = getClient();
  const { error } = await supabase.from('posts').insert(post);
  if (error) throw new Error(`Falha ao salvar o post no Supabase: ${error.message}`);
}

/**
 * Atualiza só a legenda de um post já salvo (usado quando a Rachel edita ou
 * substitui a legenda automática na Etapa 3).
 */
async function updateCaption(jobId, caption) {
  const supabase = getClient();
  const { error } = await supabase.from('posts').update({ caption }).eq('id', jobId);
  if (error) throw new Error(`Falha ao atualizar a legenda no Supabase: ${error.message}`);
}

/**
 * Lista todos os posts salvos, do mais recente para o mais antigo.
 */
async function listPosts() {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Falha ao listar os posts do Supabase: ${error.message}`);
  return data;
}

/**
 * Busca um post específico pelo id (jobId).
 */
async function getPost(jobId) {
  const supabase = getClient();
  const { data, error } = await supabase.from('posts').select('*').eq('id', jobId).single();
  if (error) throw new Error(`Post não encontrado no Supabase: ${error.message}`);
  return data;
}

module.exports = {
  isConfigured,
  uploadSlide,
  downloadSlideBuffer,
  savePost,
  updateCaption,
  listPosts,
  getPost,
};
