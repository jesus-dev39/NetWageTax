#!/usr/bin/env bash
# Comprobaciones de producción de netwagetax.com (docs/MAINTENANCE.md, sección 2.3), solo con curl.
#
#   npm run check:prod                          # comprueba https://netwagetax.com
#   bash scripts/check-production.sh URL        # otra dirección (por ejemplo, un despliegue de vista previa)
#
# Termina con "TODO OK" (código de salida 0) o con la lista de lo que ha fallado (código 1).

ORIGIN="${1:-https://netwagetax.com}"
ORIGIN="${ORIGIN%/}"
UA='Mozilla/5.0 (NetWageTax check-production)'
ADS_TXT='google.com, pub-2086612186107816, DIRECT, f08c47fec0942fa0'
HOME_REFERENCE='$2,092.60'

FAILURES=()
fail() { FAILURES+=("$1"); echo "  FALLO: $1"; }
ok() { echo "  ok: $1"; }

# Código HTTP de una URL, sin seguir redirecciones.
status() { curl -s -o /dev/null -A "$UA" --max-time 30 -w '%{http_code}' "$1"; }

echo "Comprobando $ORIGIN"

echo
echo "1. Páginas principales y archivos clave"
for path in / /tools/paycheck-calculator/ /tools/obbba-tax-calculator/ /tools/senior-deduction-calculator/ \
  /tools/car-loan-interest-deduction-calculator/ /state-taxes/ /state-taxes/texas/ \
  /guides/which-states-tax-tips-and-overtime/ /ads.txt /robots.txt /sitemap-index.xml; do
  code=$(status "$ORIGIN$path")
  if [ "$code" = "200" ]; then ok "$code $path"; else fail "$path devuelve $code (se esperaba 200)"; fi
done
code=$(status "$ORIGIN/no-existe-esta-pagina/")
if [ "$code" = "404" ]; then ok "404 en una página que no existe"; else fail "una página que no existe devuelve $code (se esperaba 404)"; fi

echo
echo "2. Todas las URL del sitemap"
sitemaps=$(curl -s -A "$UA" --max-time 30 "$ORIGIN/sitemap-index.xml" | grep -o '<loc>[^<]*' | sed 's/<loc>//')
if [ -z "$sitemaps" ]; then
  fail "sitemap-index.xml no enumera ningún sitemap"
fi
total=0
bad=0
for sitemap in $sitemaps; do
  # El sitemap usa siempre https://netwagetax.com; si se comprueba otra dirección, se cambia el dominio.
  sitemap="${sitemap/https:\/\/netwagetax.com/$ORIGIN}"
  urls=$(curl -s -A "$UA" --max-time 30 "$sitemap" | grep -o '<loc>[^<]*' | sed 's/<loc>//')
  for url in $urls; do
    url="${url/https:\/\/netwagetax.com/$ORIGIN}"
    total=$((total + 1))
    code=$(status "$url")
    if [ "$code" != "200" ]; then
      bad=$((bad + 1))
      fail "$url devuelve $code (sitemap)"
    fi
  done
done
if [ "$total" -eq 0 ]; then
  fail "el sitemap no tiene ninguna URL"
elif [ "$bad" -eq 0 ]; then
  ok "las $total URL del sitemap devuelven 200"
fi

echo
echo "3. Redirección antigua /states"
final=$(curl -s -L -o /dev/null -A "$UA" --max-time 30 -w '%{http_code} %{url_effective}' "$ORIGIN/states")
if [ "$final" = "200 $ORIGIN/state-taxes/" ]; then ok "/states acaba en /state-taxes/"; else fail "/states acaba en \"$final\" (se esperaba 200 $ORIGIN/state-taxes/)"; fi

echo
echo "4. ads.txt"
ads=$(curl -s -A "$UA" --max-time 30 "$ORIGIN/ads.txt" | tr -d '\r' | sed -e '/^$/d')
if [ "$ads" = "$ADS_TXT" ]; then ok "ads.txt sin cambios"; else fail "ads.txt ha cambiado: \"$ads\""; fi

echo
echo "5. robots.txt"
if curl -s -A "$UA" --max-time 30 "$ORIGIN/robots.txt" | grep -q '^Sitemap: https://netwagetax.com/sitemap-index.xml'; then
  ok "robots.txt enlaza el sitemap"
else
  fail "robots.txt no contiene la línea Sitemap"
fi

echo
echo "6. Caso de referencia 1: portada"
if curl -s -A "$UA" --max-time 30 "$ORIGIN/" | grep -qF "$HOME_REFERENCE"; then
  ok "la portada muestra $HOME_REFERENCE por nómina"
else
  fail "la portada no muestra $HOME_REFERENCE (salario de \$65,000, biweekly, single, sin estado)"
fi

echo
if [ ${#FAILURES[@]} -eq 0 ]; then
  echo "TODO OK"
  exit 0
fi
echo "HA FALLADO (${#FAILURES[@]}):"
for f in "${FAILURES[@]}"; do echo "  - $f"; done
exit 1
