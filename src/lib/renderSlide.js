const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const FONTS_DIR = path.join(__dirname, '..', '..', 'fonts');

// Carrega todos os arquivos .ttf/.otf da pasta /fonts automaticamente.
// Coloque ali os arquivos da Gallient e da Montserrat (veja fonts/README.md).
let _loggedFonts = false;

function loadFontFiles() {
  if (!fs.existsSync(FONTS_DIR)) {
    if (!_loggedFonts) {
      console.warn(`[fonts] Pasta de fontes não encontrada em ${FONTS_DIR} — usando só fontes do sistema (Gallient/Montserrat vão sair erradas).`);
      _loggedFonts = true;
    }
    return [];
  }
  const files = fs
    .readdirSync(FONTS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.ttf') || f.toLowerCase().endsWith('.otf'));

  if (!_loggedFonts) {
    console.log(`[fonts] Arquivos de fonte encontrados em ${FONTS_DIR}:`, files.length ? files : '(nenhum)');
    const temGallient = files.some((f) => f.toLowerCase().includes('gallient'));
    const temMontserrat = files.some((f) => f.toLowerCase().includes('montserrat'));
    if (!temGallient) console.warn('[fonts] ATENÇÃO: nenhum arquivo da Gallient encontrado na pasta fonts/ — os títulos vão renderizar com fonte do sistema, não a serifada da Rachel.');
    if (!temMontserrat) console.warn('[fonts] ATENÇÃO: nenhum arquivo da Montserrat encontrado na pasta fonts/ — o corpo do texto vai renderizar com fonte do sistema.');
    _loggedFonts = true;
  }

  return files.map((f) => path.join(FONTS_DIR, f));
}

/**
 * Converte um data URI base64 de uma foto em um <image> embutido dentro do SVG,
 * substituindo o placeholder {{PHOTO}} gerado pela Claude.
 */
function embedPhoto(svgString, photoBuffer) {
  if (!photoBuffer) return svgString;
  const base64 = photoBuffer.toString('base64');
  const dataUri = `data:image/png;base64,${base64}`;
  return svgString.replace('{{PHOTO}}', dataUri);
}

/**
 * Renderiza uma string SVG em um Buffer PNG pronto para salvar/baixar.
 */
function renderSlideToPng(svgString) {
  const fontFiles = loadFontFiles();

  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'width', value: 1080 },
    font: {
      fontFiles,
      loadSystemFonts: true, // usa fontes do sistema como fallback se a customizada faltar
      defaultFontFamily: 'Montserrat',
    },
  });

  const pngData = resvg.render();
  return pngData.asPng();
}

module.exports = { renderSlideToPng, embedPhoto, loadFontFiles };
