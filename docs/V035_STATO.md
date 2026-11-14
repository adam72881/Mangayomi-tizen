# v0.3.5: stato al 14/11/2026, ramo `cursor/v035-tizen-5ab3`

`main` è la v0.3.4. Questo ramo contiene la v0.3.5: è passata nei test headless, ma **non è stata installata né provata sulla TV**.

## Fatto e provato headless (97 PASS, 0 FAIL: v032test 40, uninstalltest 23, playertest 34)

1. **Conferma prima di disinstallare** un'estensione: "Disinstalla – Vuoi disinstallare <nome>? …", con i pulsanti Annulla e Disinstalla. Il focus parte su Annulla; Indietro chiude.
2. **Estensioni navigabili con il telecomando**: ogni riga ha pulsanti veri (Installa / Aggiorna / Disinstalla). Destra va sul pulsante, Sinistra torna alla riga, Su/Giù cambiano riga nella stessa colonna (`data-rownav` in nav.js). Dopo un ridisegno il focus resta sullo stesso pulsante (`paint()` in ui.js).
3. **Ingresso in una sorgente**: il focus va su Popolari/Ultimi durante il caricamento, poi sulla prima copertina. Non più su Cerca.
4. **Copertine come la griglia compatta di Mangayomi** (`lib/modules/widgets/cover_view_widget.dart`, `bottom_text_widget.dart`, `gridview_widget.dart`, con 1 dp = 2 px): larghezza massima 150 dp, proporzione 0,69, spazio di 10 dp, raggio di 6 dp, anello di 3 dp, ingrandimento 1,06 sul focus, titolo bianco su 2 righe sopra una sfumatura alta 70 dp verso #00000099.
   - Corretto anche il riquadro sfalsato con gli spigoli che sporgevano: lo span era in linea.
   - Il titolo ora si vede in Sfoglia, nella ricerca e in Libreria.
5. **`[hidden]` vince su display:flex**: la lista delle qualità non compare più da sola all'avvio (era il caso di Stripchat, "Originale - 480p / 240p").
6. **Lettore stile Mangayomi**:
   - Titolo ed episodio in alto. In basso la barra con i tempi e i comandi: ep. precedente, -10 s, Play/Pausa, +10 s, ep. successivo, "+85 s Salta intro", Qualità, Sottotitoli.
   - Niente più cartellino "AnimeWorld": il pulsante mostra solo la risoluzione.
   - La qualità si sceglie da un pannello in basso, con testo grande e la spunta sulla qualità attuale.
   - I comandi si nascondono dopo 3 s durante la riproduzione e restano visibili in pausa o con un menu aperto.
   - Tasti invariati: Sinistra/Destra ±10 s, OK pausa, Giù ep. successivo, Indietro chiude. Su entra nella fila dei comandi; lì Sinistra/Destra si spostano, OK preme, Su/Giù/Indietro escono. Funzionano anche i tasti multimediali.
7. **Icona**: l'icona ufficiale di Aniyomi, cioè il vettoriale del launcher `app/src/main/res/drawable/ic_launcher_foreground.xml` di aniyomiorg/aniyomi.
   - Convertita in `icon-source.svg` e poi in `icon.png` 512x512 con sfondo trasparente.
   - Licenza Apache-2.0: `THIRD_PARTY_NOTICES.md` e `LICENSE-ANIYOMI-APACHE-2.0.txt`.

## Da fare o verificare

- **Provare tutto sulla TV** (Adam deve dare l'ok prima di installare).
- **Prestazioni sulla TV**: le copertine più grandi caricano immagini più grandi, e l'ingrandimento sul focus va verificato a occhio. Gli spigoli sporgenti delle foto di Adam erano dovuti allo span in linea: va confermato sulla TV che sono spariti.
- **Sottotitoli**: si usano solo tracce WebVTT fornite dall'estensione in `video.subtitles`. SRT e le tracce di sottotitoli HLS non sono gestiti.
- **Stripchat, segnaposto da 12 s** («Find the real thing on STRIPCHAT.COM», stanza privata o offline): il lettore non lo avvia e mostra «Stanza privata o offline». Una diretta vera (playlist senza fine) resta com'è. L'HD protetto dal sito non si aggira.
- **HypnoTube Popolari = Ultimi**: la causa è nell'estensione, non nell'app. Vedi `docs/HYPNOTUBE_POPOLARI.md` e la patch `docs/patches/hypnotube-1.4.3.patch` per adam72881/mangayomi-anime-extensions.
- **JAV Guru**: sui Recenti, senza gli header che la TV non può inviare, l'estensione prendeva il clip di prova da 10 s (Big Buck Bunny) al posto del master su premilkyway. La correzione è nell'estensione: si scarta quel clip e si tiene il master premilkyway/javclan, che parte con lo User-Agent di Chrome e senza header particolari.
- Il pacchetto da installare sulla TV va rifirmato da questa versione: quello preparato prima non contiene le modifiche 2-6 né il messaggio di Stripchat.

## Test

`tools/run-tests.sh` dalla radice del repository. Servono node, google-chrome e Internet. Lancia `tools/servefull.mjs` (porta 8770, stessa CSP di config.xml), Chrome headless con CDP su 9444 e poi, in ordine, `v032test`, `uninstalltest` e `playertest`.

`javtest` e `hypnotest` sono facoltativi: da un server JAV Guru risponde con un controllo del browser e HypnoTube con l'age-gate.
