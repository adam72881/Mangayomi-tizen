# Installare Mangayomi sulla TV Samsung (Tizen)

L'app non è nello store Samsung: si installa in modalità sviluppatore (sideload). Il pacchetto firmato da qualcun altro non si installa sulla tua TV, quindi devi firmarlo con un tuo certificato.

## Una volta sola

1. **PC** (Windows, macOS o Linux) collegato alla stessa rete della TV.
2. **Developer mode sulla TV:**
   - App → digita `12345` con il telecomando;
   - attiva **Developer mode** e inserisci l'**IP del PC**;
   - riavvia la TV.
3. **Tizen Studio** con il **TV Extension** (Samsung), oppure solo la CLI (`tizen`, `sdb`).
4. **Certificato Samsung:**
   - In Tizen Studio apri *Certificate Manager* e crea un profilo **Samsung**: autore + distributore.
   - Serve un account gratuito Samsung Developers.
   - Nel certificato distributore aggiungi il **DUID** della tua TV, che leggi con `sdb devices` / `sdb capability`.
   - Il certificato e il profilo restano sul tuo PC: **non metterli mai nel repository**.

## Ogni versione

```bash
git clone https://github.com/adam72881/Mangayomi-tizen.git
cd Mangayomi-tizen
sdb connect <IP-della-TV>
tizen build-web -e ".*" -e "*.md" -e "docs/*" -e "tools/*" -- .
tizen package -t wgt -s <nome-profilo-di-firma> -- .buildResult
tizen install -n "<nome-pacchetto>.wgt" -s <IP-della-TV>:26101 -- .buildResult
```

- L'app id `MgyLite01A.MangayomiLite` (in `config.xml`) deve restare uguale: così la TV aggiorna l'app invece di installarne una seconda.
- Per installare una versione **più vecchia** di quella presente, prima disinstalla quella sulla TV.
- **Alternativa senza riga di comando:** [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung) installa un `.wgt` firmato sulla TV in Developer mode.
- Dopo un aggiornamento del firmware della TV, l'app installata così potrebbe dover essere reinstallata.

## Privilegi usati (config.xml)

| Privilegio | A cosa serve |
|---|---|
| `internet` | estensioni e video |
| `tv.inputdevice` | tasti numerici del telecomando (0×5 per i contenuti per adulti) |
| `unlimitedstorage` | libreria e codice delle estensioni |
| `download` | playlist di AnimeSaturn, con il Referer che `fetch` non può inviare |
| `mediastorage` | file scaricato da quel download |
| `filesystem.read` | lettura di quel file, che poi viene cancellato |
| `application.launch` | il pulsante «Web» apre la pagina nel browser della TV |
| `avplay` (Samsung) | lettore Samsung AVPlay per MP4, se attivato nelle impostazioni |

Se un certificato pubblico rifiuta AVPlay, togli quella riga: la riproduzione usa comunque `<video>` e hls.js.

## Primo avvio

- **Lingua:** quella della TV (italiano o inglese). Si cambia in Altro › Lingua.
- **Estensioni:** arrivano dai repository in Altro › Sfoglia. Di serie c'è `adam72881/mangayomi-anime-extensions`; se ne possono aggiungere altri (indirizzo di un `anime_index.json`).
- **Contenuti per adulti:** sono nascosti. Si mostrano e nascondono premendo 0 cinque volte in 3 secondi.
- **Limiti:**
  - Tizen non ha WebView: le estensioni che richiedono login, controlli Cloudflare o header personalizzati non funzionano. Fa eccezione solo `GET https://play.saturncdn.net/embed/<id>/playlist`: il Download API invia `Referer: https://play.saturncdn.net/`. Il token in quell'indirizzo non viene scritto nei log.
  - L'app non aggira protezioni, paywall o verifiche dell'età.
