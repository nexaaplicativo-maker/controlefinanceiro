/**
 * Redução de imagem antes do envio para a leitura por IA.
 *
 * O arquivo da câmera ia cru para `/api/extract`. Um celular atual produz
 * foto de 4 a 12 MB, e a Vercel corta o corpo da requisição por volta de
 * 4,5 MB — antes de chegar na nossa rota. O usuário recebia um erro cru da
 * plataforma, repassado na tela como "Erro da IA: ...", sem nada que
 * indicasse que o problema era o tamanho da foto.
 *
 * Reduzir no navegador resolve os dois lados: o envio passa a caber, e a
 * conta da API de IA cai junto, porque imagem menor é menos token.
 *
 * 1600px no maior lado é o ponto de equilíbrio: cupom fiscal continua
 * legível para OCR, e o arquivo típico cai para algumas centenas de KB.
 */

const LADO_MAXIMO = 1600;
const QUALIDADE = 0.85;

/** Abaixo disto não vale a pena reprocessar: já cabe e já é barato. */
const TAMANHO_ACEITAVEL = 900 * 1024;

/**
 * Devolve uma versão reduzida da imagem, ou o arquivo original.
 *
 * Nunca lança. Se qualquer passo falhar — formato que o navegador não
 * decodifica (HEIC em alguns casos), canvas bloqueado, memória — devolve o
 * original e deixa o servidor decidir. Travar o envio por causa do
 * otimizador seria pior que enviar a foto grande.
 */
export async function reduzirImagem(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;
  if (file.size <= TAMANHO_ACEITAVEL) return file;

  try {
    // `imageOrientation: 'from-image'` aplica o EXIF. Sem isso, foto tirada
    // na vertical chega deitada e a IA lê pior.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const maior = Math.max(bitmap.width, bitmap.height);
    const escala = maior > LADO_MAXIMO ? LADO_MAXIMO / maior : 1;
    const largura = Math.round(bitmap.width * escala);
    const altura = Math.round(bitmap.height * escala);

    const canvas = document.createElement('canvas');
    canvas.width = largura;
    canvas.height = altura;

    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close(); return file; }

    ctx.drawImage(bitmap, 0, 0, largura, altura);
    bitmap.close();

    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', QUALIDADE),
    );
    if (!blob) return file;

    // Pode acontecer de a reencodificação crescer (PNG pequeno de tela, por
    // exemplo). Nesse caso o original é melhor.
    if (blob.size >= file.size) return file;

    const nome = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], nome, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
