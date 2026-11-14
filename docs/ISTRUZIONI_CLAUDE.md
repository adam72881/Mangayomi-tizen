# Mangayomi "Lite" per Samsung TV (Tizen) - istruzioni per Claude Code

## Preparazione (una volta sola, sul PC di casa)
1. Installa Node.js 22+ e Git.
2. Installa Claude Code e aggiungi le skill ufficiali Samsung:
   git clone https://github.com/Samsung/tizen-agent-skills.git
   cd tizen-agent-skills/tizen-sdk-skills
   bash claude/setup/setup.sh        (Windows: .\claude\setup\setup.ps1)
   Poi riavvia Claude Code.
3. Sulla TV: App -> digita 12345 -> Developer mode ON -> inserisci l'IP del PC -> riavvia la TV.
4. Serve un account gratuito Samsung Developers (per il certificato: il login lo fai tu nel browser).

## Prompt da incollare a Claude Code
Ciao. Voglio una web app Tizen (.wgt) per la mia Samsung TV, una versione ridotta di Mangayomi solo per guardare.
Rispondimi sempre in italiano e spiegami ogni passo.

Obiettivo:
- App Tizen Web (HTML/JS), comandabile tutta con il telecomando (frecce, OK, Indietro).
- Carica le mie estensioni Mangayomi dal mio repository GitHub "mangayomi-anime-extensions"
  (sono file JavaScript con le funzioni getPopular, getLatestUpdates, search, getDetail, getVideoList).
- Scrivi un piccolo "adattatore" che simula le API usate dalle estensioni (Client http, MProvider, parser HTML)
  così le estensioni girano nella web app senza riscriverle.
- Schermate: lista sorgenti -> Popolari/Ultimi/Cerca -> dettaglio -> lista episodi -> player.
- Player con il tag <video> / AVPlay di Tizen (HLS m3u8 e mp4), scegliendo la qualità più alta disponibile.
- Preferiti e cronologia salvati in localStorage.

Passi:
1. Usa le skill tizen-sdk-skills per installare Tizen SDK + TV SDK e controllare l'ambiente.
2. Crea il progetto TV Web, provalo prima nel simulatore/emulatore.
3. Crea il certificato Samsung (autore + distributore con il DUID della mia TV, letto con sdb).
4. Collegati alla TV con sdb (IP della TV), compila, firma, installa e avvia.
5. Parti da UNA sola estensione semplice; aggiungi le altre solo quando la prima funziona.

Regole:
- Non mettere password, cookie o token nel codice o nel repository.
- Niente aggiramento di verifiche dell'età, paywall o protezioni anti-bot dei siti.
- Se una estensione richiede WebView/login e su Tizen non si può fare, dimmelo invece di inventare soluzioni.
- Se un passo fallisce, mostrami l'errore reale e la causa, non tirare a indovinare.

## Cosa aspettarsi
- Se un sito blocca le richieste (CORS) dalla TV, quella estensione potrebbe non funzionare.
- Le estensioni che servono login/WebView probabilmente non funzioneranno.
- Il certificato distributore vale solo per la TV registrata (DUID).
