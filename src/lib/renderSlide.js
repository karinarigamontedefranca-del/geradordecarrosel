const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const FONTS_DIR = path.join(__dirname, '..', '..', 'fonts');

// Carrega todos os arquivos .ttf/.otf da pasta /fonts automaticamente.
// Coloque ali os arquivos da Gallient e da Montserrat (veja fonts/README.md).
function loadFontFiles() {
  if (!fs.existsSync(FONTS_DIR)) return [];
  return fs
    .readdirSync(FONTS_DIR)
    .filter((f) => f.toLowerCase().endsWith('.ttf') || f.toLowerCase().endsWith('.otf'))
    .map((f) => path.join(FONTS_DIR, f));
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
