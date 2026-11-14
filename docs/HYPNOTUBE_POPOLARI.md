# HypnoTube: Popolari e Ultimi mostrano la stessa lista

**Diagnosi.** L'app non c'entra. In `js/ui.js` (`loadSource`) l'app chiama `getLatestUpdates(page)` per Ultimi e `getPopular(page)` per Popolari, su un'istanza dell'estensione che non tiene in memoria i risultati.

Il problema è nell'estensione HypnoTube 1.4.2 (`src/hypnotube.js` in adam72881/mangayomi-anime-extensions):

- `getLatestUpdates` legge sempre `/most-recent/`.
- `getPopular`, con "Popular a sorpresa" attivo (`hypnotube_surprise_popular`, che è attivo di default), estrae un ordine a caso da `popularPool()`. In quell'elenco c'è anche `o:most-recent`, cioè la stessa lista di Ultimi.
- Lo stesso vale per `o:random:N` quando N = 1: è la pagina 1 di `/most-recent/`.
- La scelta viene salvata e riusata per le pagine successive, quindi resta uguale finché non esce un'altra estrazione.

Dal box, con un cookie di age-gate valido, `/most-viewed/` e `/most-recent/` restituiscono liste diverse (verificato con curl). Il sito quindi distingue correttamente le due pagine.

**Correzione proposta** (HypnoTube 1.4.3, in `docs/patches/hypnotube-1.4.3.patch` e nel ramo locale `fix/hypnotube-popolari-diversi-da-recenti`):

- Toglie `most-recent` dagli ordini estraibili per Popolari.
- "Casuale" parte almeno dalla pagina 2 dei recenti.
- Scarta una scelta `o:most-recent` salvata da una versione precedente.
- Aggiorna la versione a 1.4.3 in `anime_index.json`.

**La patch non è stata unita**: serve l'ok di Adam.

**Nota.** Nell'app headless (fetch del browser con `credentials: "omit"`) l'age-gate di HypnoTube non si supera, perché i cookie non passano. Per questo `tools/hypnotest.mjs` dal box restituisce liste vuote e non serve a confermare la correzione: va provata sulla TV.
