#!/usr/bin/env bash
# Monta o ZIP da entrega da Fase 7 em dist-entrega/Nurai_Fase7.zip.
#
# Uso: bash docs/entrega/montar-zip.sh caminho/do/video.mp4
#
# Antes, confira os PDFs em docs/entrega (para regerar: node ~/Projects/nurai-entrega-fontes/gerar-pdfs.mjs) e faça o commit do que
# deve entrar no código-fonte: o código vem do último commit (git archive HEAD),
# sem node_modules, .env.local nem arquivos fora do Git.
set -euo pipefail

raiz="$(git rev-parse --show-toplevel)"
cd "$raiz"
video="${1:-}"
saida="dist-entrega/Nurai_Fase7"

for f in docs/entrega/documento-consolidado.pdf docs/entrega/pitch-nurai.pdf; do
  [ -f "$f" ] || { echo "Falta $f. Rode: node ~/Projects/nurai-entrega-fontes/gerar-pdfs.mjs" >&2; exit 1; }
done
if [ -z "$video" ] || [ ! -f "$video" ]; then
  echo "Informe o vídeo: bash docs/entrega/montar-zip.sh caminho/do/video.mp4" >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "Aviso: há mudanças sem commit; elas NÃO entram no código-fonte." >&2
fi

rm -rf "$saida" dist-entrega/Nurai_Fase7.zip
mkdir -p "$saida"
cp docs/entrega/documento-consolidado.pdf "$saida/01-documento-consolidado.pdf"
cp docs/entrega/pitch-nurai.pdf "$saida/02-pitch-nurai.pdf"
cp "$video" "$saida/03-video-apresentacao.${video##*.}"
git archive --format=zip --prefix=nurai/ -o "$saida/04-codigo-fonte.zip" HEAD
cp docs/entrega/LEIA-ME.md "$saida/LEIA-ME.md"

(cd dist-entrega && zip -qr Nurai_Fase7.zip Nurai_Fase7)
echo "Pronto: dist-entrega/Nurai_Fase7.zip"
ls -la "$saida"
du -h dist-entrega/Nurai_Fase7.zip
