#!/bin/bash
# Headless tests (Chromium + CDP). Uso: tools/run-tests.sh   (dalla radice del repository)
# Servono: node >= 20, google-chrome (o chromium) e accesso a Internet: i test usano il
# repository delle estensioni e i siti veri (AnimeWorld, PMVHaven).
set -u
cd "$(dirname "$0")/.."
PORT=${CDP_PORT:-9444}
node tools/servefull.mjs > /tmp/mly-serve.log 2>&1 & SERVE=$!
rm -rf /tmp/mly-chrome
${CHROME:-google-chrome} --headless=new --autoplay-policy=no-user-gesture-required --disable-web-security \
  --user-data-dir=/tmp/mly-chrome --remote-debugging-port=$PORT --window-size=1920,1080 \
  http://127.0.0.1:8770/index.html > /dev/null 2>&1 & CHR=$!
sleep 4
# L'ordine conta: v032test parte da un'app appena aperta e installa AnimeWorld; gli altri la usano.
for t in v032test uninstalltest playertest navtest; do
  echo "=== $t"; timeout 300 node tools/$t.mjs $PORT | tee /tmp/mly-$t.out | grep -E "^(PASS|FAIL)" | cut -c1-200
done
echo "Totale: $(cat /tmp/mly-*test.out | grep -c '^PASS') PASS, $(cat /tmp/mly-*test.out | grep -c '^FAIL') FAIL"
kill $CHR $SERVE 2>/dev/null
# Facoltativi: tools/javtest.mjs e tools/hypnotest.mjs dipendono dal sito (da un server il sito
# risponde con un controllo del browser o con l'age-gate, e allora falliscono senza colpa dell'app).
