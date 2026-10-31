/*
 * Video - l'app di Home TV per i film delle chiavette e dei dischi USB attaccati al TV.
 *
 * Il file lo legge il servizio del TV e lo da' al <video> del TV (decoder del TV: 4K, HDR, HEVC). Il servizio fa sparire
 * le tracce audio che il TV non legge (DTS, TrueHD) e tiene solo quella scelta; i sottotitoli li disegna questa pagina
 * (testo e PGS). Per parlare col servizio serve il permesso "video", che la home da' solo alle app ufficiali dello Store.
 *
 * Le schede (titolo, anno, voto, trama, cast, poster, fanart, logo) vengono dai .nfo e dalle immagini che Kodi, Jellyfin
 * e tinyMediaManager lasciano accanto ai film, e dai tag e dalle copertine dentro i file (come Infuse); senza niente,
 * una copertina disegnata col titolo pulito. Le immagini si riducono su una tela piccola, una alla volta (il TV ha poca
 * memoria), e lo sfondo sfocato e' una tela di 32x18 ingrandita.
 *
 * Telecomando: nelle pagine le frecce si muovono tra file e pulsanti; nel lettore come il lettore di Home TV nei siti
 * (OK pausa, sinistra/destra 10 s, indietro/avanti veloce 30 s, Giu' il pannello, Su i pulsanti, Rosso sottotitoli,
 * Giallo l'audio dopo, Indietro esce: il punto resta). Solo JavaScript ES5.
 */
(function () {
  'use strict';

  /* ============================================================ piccoli aiuti */

  function $(id) { return document.getElementById(id); }
  function el(tag, classe, testo) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (testo !== undefined && testo !== null) e.textContent = testo;
    return e;
  }
  function svuota(e) { while (e.firstChild) e.removeChild(e.firstChild); }
  var NS = 'http://www.w3.org/2000/svg';
  // le icone: tratti tondi su una griglia di 24 (pieno: riempite, come il play). x e' una voce di ICONE
  function icona(x, classe) {
    var s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    if (typeof x === 'string') x = { d: x };
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('class', 'ic' + (x && x.pieno ? ' pieno' : '') + (classe ? ' ' + classe : ''));
    s.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', x ? x.d : '');
    s.appendChild(p);
    return s;
  }
  var ICONE = {
    play: { d: 'M8 5.7v12.6a1 1 0 0 0 1.5.86l10-6.3a1 1 0 0 0 0-1.72l-10-6.3A1 1 0 0 0 8 5.7z', pieno: true },
    pausa: { d: 'M6.5 5h3.6v14H6.5zM13.9 5h3.6v14h-3.6z', pieno: true },
    info: { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5.5M12 7.7v.1' },
    piu: { d: 'M12 5v14M5 12h14' },
    spunta: { d: 'M5 12.5l4.5 4.5L19 7.5' },
    lista: { d: 'M7 3.5h10a1 1 0 0 1 1 1v16l-6-4.2-6 4.2v-16a1 1 0 0 1 1-1z' },
    ripeti: { d: 'M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 3.5v4h4' },
    cerca: { d: 'M10.5 17.5a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20.5 20.5l-5-5' },
    casa: { d: 'M3.5 10.5L12 3.8l8.5 6.7V20a1 1 0 0 1-1 1H15v-6.5H9V21H4.5a1 1 0 0 1-1-1z' },
    film: { d: 'M4.5 3.5h15a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1zM8 3.5v17M16 3.5v17M3.5 8H8M3.5 12H8M3.5 16H8M16 8h4.5M16 12h4.5M16 16h4.5' },
    serie: { d: 'M3.5 7.5h17a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM8 3l4 4.5L16 3' },
    stagione: { d: 'M3.5 7.5h17a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM8 3l4 4.5L16 3' },
    puntata: { d: 'M3.5 7.5h17a1 1 0 0 1 1 1v10.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1zM8 3l4 4.5L16 3' },
    chiavetta: { d: 'M8 10h8v10a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 20zM9.5 2.5h5V10h-5zM11 5.5h.01M13 5.5h.01' },
    disco: { d: 'M2.5 15l2.8-9.2a1 1 0 0 1 1-.8h11.4a1 1 0 0 1 1 .8l2.8 9.2M2.5 15v3.5a1 1 0 0 0 1 1h17a1 1 0 0 0 1-1V15M2.5 15h19M17.5 17.3h.01' },
    cartella: { d: 'M3 6.5a1 1 0 0 1 1-1h5.2l2.2 2.5H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z' },
    mac: { d: 'M5 5h14a1 1 0 0 1 1 1v9.5H4V6a1 1 0 0 1 1-1zM2 18.5h20' },
    // il Mac dove gira Jellyfin: un server
    jellyfin: { d: 'M4.5 4h15a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM4.5 13.5h15a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-4.5a1 1 0 0 1 1-1zM7.5 7.2h.01M7.5 16.7h.01' },
    // barre sotto un tetto: i picchi tagliati (il limitatore del Mac)
    picchi: { d: 'M3 4.5h18M5.5 20v-5M9.5 20v-9M13.5 20v-9M17.5 20v-6' },
    // un contagiri: la velocita' del TV
    ingranaggio: { d: 'M3.6 17.5a9 9 0 1 1 16.8 0M12 13.5l4-4.5M12 14.2v.1' },
    trailer: { d: 'M3.5 5.5h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM10 9.3v5.4l4.6-2.7z' },
    audio: { d: 'M3.5 9.5h3.5L12 5.5v13l-5-4H3.5zM15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11' },
    testo: { d: 'M3.5 5.5h17a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1zM6.5 14.5h4M13 14.5h4.5M6.5 11h11' },
    cuore: { d: 'M12 20s-7.6-4.6-9-9.6C2.1 7.1 4.2 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.8 1.1-1.7 2.7-2.8 4.7-2.8 3.1 0 5.2 2.6 4.3 5.9C19.6 15.4 12 20 12 20z' },
    avanti: { d: 'M9 5l7 7-7 7' },
    impostazioni: { d: 'M4 7h9.5M18 7h2M4 17h2.5M10.5 17H20M15.8 4.8v4.4M8.5 14.8v4.4' },
    occhio: { d: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z' }
  };
  function due(n) { return (n < 10 ? '0' : '') + n; }
  function tempo(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? h + ':' + due(m) + ':' + due(s % 60) : m + ':' + due(s % 60);
  }
  function durataBella(min) { min = Math.round(min); return min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60 ? (min % 60) + ' min' : '') : min + ' min'; }
  function peso(b) {
    if (b >= 1e9) return (Math.round(b / 1e8) / 10).toString().replace('.', ',') + ' GB';
    if (b >= 1e6) return Math.round(b / 1e6) + ' MB';
    return Math.max(1, Math.round(b / 1e3)) + ' KB';
  }
  function finisceAlle(sec) { var f = new Date(Date.now() + sec * 1000); return 'finisce alle ' + f.getHours() + ':' + due(f.getMinutes()); }
  var LINGUE = { ita: 'Italiano', eng: 'Inglese', ger: 'Tedesco', fre: 'Francese', spa: 'Spagnolo', por: 'Portoghese',
    jpn: 'Giapponese', chi: 'Cinese', rus: 'Russo', dut: 'Olandese', swe: 'Svedese', pol: 'Polacco', kor: 'Coreano',
    ara: 'Arabo', tur: 'Turco', gre: 'Greco', dan: 'Danese', fin: 'Finlandese', nor: 'Norvegese', cze: 'Ceco',
    hun: 'Ungherese', rum: 'Rumeno', heb: 'Ebraico', hin: 'Hindi', tha: 'Thai', ukr: 'Ucraino', und: 'Lingua non indicata' };
  function nomeLingua(l) { return LINGUE[l] || (l ? l.toUpperCase() : 'Lingua non indicata'); }
  function canali(n) { return n === 6 ? '5.1' : n === 8 ? '7.1' : n === 2 ? 'stereo' : n === 1 ? 'mono' : n ? n + ' canali' : ''; }
  // un colore dal nome: le copertine disegnate e le iniziali del cast (come le iniziali della home)
  function tinta(t) { var h = 7; t = String(t || ''); for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return h; }
  function iniziali(n) {
    var p = String(n || '').split(/\s+/).filter(Boolean);
    return ((p[0] || '?').charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : '')).toUpperCase();
  }

  var msgTimer = null;
  function messaggio(t, ms) {
    var m = $('messaggio');
    m.textContent = t;
    m.className = 'on';
    clearTimeout(msgTimer);
    msgTimer = setTimeout(function () { m.className = ''; }, ms || 3500);
  }

  /* ============================================================ dal nome del file al titolo */

  // "Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.HDR.TrueHD-XYZ.mkv" -> Dune Part Two (2024); "Show.S01E02..." -> puntata
  var TECNICI = /^(2160p|1080p|1080i|720p|576p|480p|4k|uhd|hd|fhd|bluray|blu|ray|bdrip|brrip|bdremux|remux|webrip|webdl|web|dl|hdtv|dvdrip|hdrip|x264|x265|h264|h265|hevc|avc|av1|vp9|hdr|hdr10|hdr10plus|dv|dovi|sdr|truehd|atmos|dts|dtshd|hd ma|ma|ddp|dd|dd5|ac3|eac3|aac|flac|lpcm|ita|eng|multi|sub|subs|subita|proper|repack|extended|uncut|imax|internal|limited|10bit|8bit)$/i;
  function titoloDi(nome) {
    var base = String(nome || '').replace(/\.[a-z0-9]{2,4}$/i, ''), s = base.replace(/[._]+/g, ' ').replace(/\s+/g, ' ');
    var out = { titolo: '', anno: 0, stagione: 0, episodio: 0 };
    var se = /^(.*?)[\s\-\[(]*\b[Ss](\d{1,2})[\s\-]*[Ee](\d{1,3})\b/.exec(s) || /^(.*?)[\s\-]*\b(\d{1,2})x(\d{2,3})\b/.exec(s);
    if (se) {
      out.stagione = +se[2];
      out.episodio = +se[3];
      s = se[1];
    } else {
      var an = /^(.*?)[\s\-\[(]*\b(19[2-9]\d|20[0-4]\d)\b/.exec(s);
      if (an && an[1].replace(/\s+/g, '').length >= 2) { out.anno = +an[2]; s = an[1]; }
    }
    var parole = s.split(' '), tenute = [];
    for (var i = 0; i < parole.length; i++) {
      if (TECNICI.test(parole[i].replace(/[\[\]()\-]/g, ''))) break;
      tenute.push(parole[i]);
    }
    out.titolo = tenute.join(' ').replace(/[\s\-\[(]+$/, '').replace(/^\s+/, '') || base;
    return out;
  }
  function etichetta(nome) {
    var t = titoloDi(nome);
    if (t.episodio) return t.titolo + ' · S' + t.stagione + ' E' + t.episodio;
    return t.titolo + (t.anno ? ' (' + t.anno + ')' : '');
  }
  var RE_STAGIONE = /^(?:season|stagione|staffel|saison|temporada|series|serie|s)[\s._-]*(\d{1,3})$|^(specials?|speciali|extra)$/i;

  /* ============================================================ il servizio del TV */

  var serv = { base: '', gettone: '' };
  var permessoInCorso = null;
  // Real4K dal Mac: a pagina intera dal ponte del Mac (http://<Mac>:8098/real4k/), che fa da servizio. Dall'ancora (la mette la
  // home): il gettone del Mac, dove tornare (la home, o la Store che riapre Real4K del TV) e le scelte di Real4K del TV. Vale
  // l'ultima occorrenza: la home li mette dopo l'ancora del film. (segno per il ponte del Mac: quest'app sa fare real4k-dal-mac)
  var DAL_MAC = window.parent === window && location.protocol === 'http:' && location.port === '8098' && /^\/real4k\//.test(location.pathname);
  // i primi passi della pagina (avvio, permesso, dati, prima fila, copertine, banner, font, primo video) al servizio del TV, che
  // li scrive nella sua traccia: il TV chiude il servizio nei primi 10-20 s di Real4K, anche dal Mac (31/10, 15:41), e cosi'
  // dopo una caduta si vede dopo quale lavoro. Solo sul TV (nel riquadro della Store, o a pagina intera dal Mac), ognuno una
  // volta, a fuoco e dimentica: niente risposte da aspettare
  var passiFatti = {};
  function segnaPasso(p) {
    if (passiFatti[p] || !(DAL_MAC || window.name === 'hometv-app')) return;
    passiFatti[p] = true;
    var u = 'http://127.0.0.1:8090/api/passo?da=' + (DAL_MAC ? 'mac' : 'riquadro') + '&p=' + p;
    try { if (navigator.sendBeacon && navigator.sendBeacon(u)) return; } catch (e) {}
    try { var x = new XMLHttpRequest(); x.open('GET', u, true); x.send(); } catch (e) {}
  }
  segnaPasso('r4k-avvio');
  try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { segnaPasso('r4k-font'); }, function () {}); } catch (e) {}
  function dallAncora(nome, forma) {
    var re = new RegExp('[#&?]' + nome + '=([^&]*)', 'g'), m, ultimo = null, x = '';
    while ((m = re.exec(location.hash))) ultimo = m[1];
    try { x = ultimo !== null ? decodeURIComponent(ultimo) : ''; } catch (e) { x = ''; }
    return forma.test(x) ? x : '';
  }
  // dove riaprire Real4K del TV se il Mac non risponde piu': la Store la riapre nel riquadro, senza provare il Mac
  var riapriTv = DAL_MAC ? dallAncora('riapri', /^https:\/\/[a-z0-9-]{1,39}\.github\.io\/[A-Za-z0-9._\/-]{0,200}#apri=[A-Za-z0-9%._:-]{1,160}(&da=home)?&noMac=1$/) : '';
  // le poche domande che dal Mac restano al servizio del TV, col gettone del TV che passa la home (gtv) e il sito dell'app sullo
  // Store (app): il punto per Continua a guardare della home e per la barra del telefono, e la fila delle chiavette (i loro film
  // si aprono su Real4K del TV). Il TV puo' aver chiuso il servizio: allora non rispondono, e basta (film, file e copertine
  // restano del Mac)
  var gettoneTv = DAL_MAC ? dallAncora('gtv', /^[0-9a-f]{64}$/) : '';
  var sitoApp = DAL_MAC ? dallAncora('app', /^https:\/\/[a-z0-9-]{1,39}\.github\.io\/[A-Za-z0-9._-]{1,100}\/$/) : '';
  function chiediTv(via, corpo) {
    return new Promise(function (ok, ko) {
      if (!gettoneTv) { ko(erroreCon('servizio')); return; }
      var x = new XMLHttpRequest();
      x.open(corpo ? 'POST' : 'GET', 'http://127.0.0.1:8090/api/video/g/' + gettoneTv + '/' + via, true);
      x.timeout = 5000;
      x.onload = function () {
        var r = null;
        try { r = JSON.parse(x.responseText); } catch (e) {}
        if (x.status === 200 && r) ok(r); else ko(erroreCon(x.status === 403 ? 'gettone' : 'servizio'));
      };
      x.onerror = x.ontimeout = function () { ko(erroreCon('servizio')); };
      if (corpo) x.setRequestHeader('Content-Type', 'text/plain');
      x.send(corpo ? JSON.stringify(corpo) : null);
    });
  }
  function prendiPermesso() {
    if (permessoInCorso) return permessoInCorso;
    var p = window.HomeTV && typeof HomeTV.permesso === 'function' ? HomeTV.permesso('video') : Promise.resolve(null);
    permessoInCorso = p.then(function (x) {
      // fuori da Home TV (sul computer, per provare l'app servita dal computer stesso, come test_video_jellyfin.py):
      // #servizio=...&gettone=... con un gettone vero del servizio. Dentro Home TV mai: nel riquadro un no arriva come
      // errore, e a pagina intera sul TV l'app sta sul sito della home, dove l'indirizzo lo puo' scrivere qualsiasi sito
      if (!x && (!window.HomeTV || !HomeTV.info || HomeTV.info().piattaforma === 'browser') && window.parent === window &&
        /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
        var m = /[#&]servizio=([^&]+)&gettone=([0-9a-f]{64})/.exec(location.hash);
        if (m) x = { servizio: decodeURIComponent(m[1]), gettone: m[2] };
      }
      // dal Mac (Real4K dal Mac, pagina intera dal ponte) il servizio e' la pagina stessa, mai un indirizzo scritto nell'ancora:
      // da li' viene solo il gettone. La Store apre la pagina senza (cosi' non aspetta il servizio del TV, che il TV chiude
      // nell'istante in cui Real4K si apre): il gettone lo da' il ponte, per la sessione di questo TV
      if (!x && window.parent === window && location.protocol === 'http:' && location.port === '8098' && /^\/real4k\//.test(location.pathname)) {
        var reG = /[#&?]gettone=([0-9a-f]{64})(?=&|$)/g, gm, gUltimo = '';
        while ((gm = reG.exec(location.hash))) gUltimo = gm[1];
        if (gUltimo) x = { servizio: location.protocol + '//' + location.host, gettone: gUltimo };
        else return gettonePonte().then(fine);
      }
      return fine(x);
    }, function (e) { permessoInCorso = null; throw e; });
    function fine(x) {
      permessoInCorso = null;
      if (!x || !x.gettone) throw erroreCon('negato');
      serv.base = String(x.servizio || 'http://127.0.0.1:8090').replace(/\/+$/, '');
      serv.gettone = x.gettone;
      return x;
    }
    // il gettone di questo TV chiesto al ponte (stessa origine, JSON). Se il ponte non ha una sessione viva per il TV, si
    // torna da soli a Real4K del TV
    function gettonePonte() {
      return new Promise(function (ok) {
        var r = new XMLHttpRequest(), fatto = false;
        function esci(g) {
          if (fatto) return;
          fatto = true;
          if (!g && typeof versoIlTv === 'function') versoIlTv('Il Mac non ha ancora la sessione di questo TV: apro Real4K del TV');
          ok(g ? { servizio: location.protocol + '//' + location.host, gettone: g } : null);
        }
        r.open('POST', '/real4k/sessione', true);
        r.timeout = 8000;
        r.setRequestHeader('Content-Type', 'application/json');
        r.onload = function () {
          var j = null;
          try { j = JSON.parse(r.responseText); } catch (e) { j = null; }
          esci(r.status === 200 && j && /^[0-9a-f]{64}$/.test(String(j.gettone || '')) ? j.gettone : '');
        };
        r.onerror = r.ontimeout = function () { esci(''); };
        r.send('{}');
      });
    }
    return permessoInCorso;
  }
  function erroreCon(codice, testo) { var e = new Error(testo || codice); e.codice = codice; return e; }
  function query(o) {
    var l = [];
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null) l.push(k + '=' + encodeURIComponent(o[k]));
    return l.join('&');
  }
  // una domanda al servizio col gettone; se il gettone non vale piu' (servizio ripartito) se ne chiede uno nuovo, una volta
  function chiedi(via, param, corpo, riprovato, metodo) {
    return (serv.gettone ? Promise.resolve() : prendiPermesso()).then(function () {
      return new Promise(function (ok, ko) {
        var x = new XMLHttpRequest(), q = query(param || {});
        x.open(metodo || (corpo ? 'POST' : 'GET'), serv.base + '/api/video/g/' + serv.gettone + '/' + via + (q ? '?' + q : ''), true);
        x.timeout = 20000;
        x.onload = function () {
          if (DAL_MAC) macRisponde();
          var r = null;
          try { r = JSON.parse(x.responseText); } catch (e) {}
          if ((x.status === 200 && r) || x.status === 204 || (x.status >= 200 && x.status < 300 && metodo)) { ok(r || {}); return; }
          // (dal Mac un 403 senza codice e' di Jellyfin, non del gettone: il ponte manda sempre codice "gettone")
          ko(erroreCon(r && r.codice ? r.codice : x.status === 403 && !DAL_MAC ? 'gettone' : x.status === 401 ? 'accesso' : 'servizio', r && r.error));
        };
        x.onerror = function () { if (DAL_MAC) macTace(); ko(erroreCon('servizio')); };
        x.ontimeout = function () { if (DAL_MAC) macTace(); ko(erroreCon('lento')); };
        if (corpo) x.setRequestHeader('Content-Type', 'text/plain');
        x.send(corpo ? JSON.stringify(corpo) : null);
      });
    }).then(null, function (e) {
      if (e.codice === 'gettone' && !riprovato) { serv.gettone = ''; return chiedi(via, param, corpo, true, metodo); }
      // dal Mac un gettone che non vale piu' (sessione chiusa sul Mac): si torna a Real4K del TV
      if (e.codice === 'gettone' && DAL_MAC) macPerso();
      // Jellyfin non riconosce piu' l'accesso (password cambiata, accesso tolto): si torna a collegarlo
      if (e.codice === 'accesso' && via.indexOf('mac/') !== 0 && jf.stato && jf.stato.utente) { jf.stato.utente = null; jf.dati = null; }
      throw e;
    });
  }
  // una domanda a Jellyfin, dal ponte del servizio: percorso di Jellyfin e parametri (il token lo mette il servizio). Al massimo
  // tre in volo, due nei primi 3 s dall'apertura (31/10: all'apertura ne partivano sette nello stesso istante, e il TV chiude il
  // servizio quando la pagina lavora); le altre aspettano in fila: prima quelle che servono adesso, poi quelle di sfondo (coda
  // 'sfondo': le collezioni). Coda 'ora': parte subito anche oltre il limite (uscendo dal film: il punto finale e la conversione
  // da fermare, con la pagina che sta per andarsene)
  var jfCoda = { subito: [], sfondo: [], inVolo: 0 };
  setTimeout(function () { prossimaJf(); }, 3050);
  function chiediJf(percorso, param, corpo, metodo, coda, gruppo) {
    return new Promise(function (ok, ko) {
      var x = { via: 'jf/p/' + percorso, param: param, corpo: corpo, metodo: metodo, ok: ok, ko: ko, gruppo: gruppo || '' };
      if (coda === 'ora') { mandaJf(x); return; }
      jfCoda[coda === 'sfondo' ? 'sfondo' : 'subito'].push(x);
      prossimaJf();
    });
  }
  function prossimaJf() {
    while (jfCoda.inVolo < (Date.now() - apertaAlle < 3000 ? 2 : 3) && (jfCoda.subito.length || jfCoda.sfondo.length)) {
      mandaJf((jfCoda.subito.length ? jfCoda.subito : jfCoda.sfondo).shift());
    }
  }
  function mandaJf(x) {
    jfCoda.inVolo++;
    function fine() { jfCoda.inVolo--; prossimaJf(); }
    chiedi(x.via, x.param, x.corpo, false, x.metodo).then(function (r) { fine(); x.ok(r); }, function (e) { fine(); x.ko(e); });
  }
  // il Mac non risponde: le domande di un gruppo ancora in fila (le file dell'inizio) non partono, finirebbero tutte cosi' una
  // dopo l'altra, e tornano subito con 'rete'. Le altre (un film, una scheda) restano
  function jfGiu(gruppo) {
    var tolte = [];
    ['subito', 'sfondo'].forEach(function (c) {
      jfCoda[c] = jfCoda[c].filter(function (x) { if (x.gruppo === gruppo) { tolte.push(x); return false; } return true; });
    });
    for (var i = 0; i < tolte.length; i++) { try { tolte[i].ko(erroreCon('rete')); } catch (e) {} }
  }
  function urlFile(d, p, nome, audio) {
    // il nome (con l'estensione) nell'indirizzo: alcuni lettori dei TV guardano quello
    return serv.base + '/api/video/g/' + serv.gettone + '/file/' + encodeURIComponent(String(nome || 'video').replace(/[\/\\?#]/g, '_')) +
      '?' + query({ d: d, p: p, a: audio || 0 });
  }
  function urlImmagine(d, ref, w, h, tutta) {
    if (ref.jf) return serv.base + '/api/video/g/' + serv.gettone + '/' + JF.percorsoImmagine(ref, w, h, tutta);
    return serv.base + '/api/video/g/' + serv.gettone + '/immagine?' + query({ d: d, p: ref.p, k: ref.k });
  }

  /* ============================================================ le schede dal servizio (NFO, immagini, tag) */

  // in memoria (al massimo 600), una domanda per volta per voce, tre in volo insieme
  var schede = {}, schedeAttese = {}, schedeCoda = [], schedeInVolo = 0, schedeOrdine = [];
  function chiaveScheda(d, p, pieno) { return d + '|' + p + (pieno ? '|1' : ''); }
  function schedaNota(d, p) { return schede[chiaveScheda(d, p, true)] || schede[chiaveScheda(d, p, false)] || null; }
  function chiediScheda(d, p, pieno, cb) {
    var k = chiaveScheda(d, p, pieno);
    if (schede[k]) { cb(schede[k]); return; }
    if (schedeAttese[k]) { schedeAttese[k].push(cb); return; }
    schedeAttese[k] = [cb];
    schedeCoda.push({ k: k, d: d, p: p, pieno: pieno });
    prossimaScheda();
  }
  function prossimaScheda() {
    while (schedeInVolo < 3 && schedeCoda.length) {
      // prima le ultime chieste (quelle in vista adesso: con le frecce tenute premute le vecchie non servono piu')
      var x = schedeCoda.pop();
      schedeInVolo++;
      (function (x) {
        chiedi('scheda', { d: x.d, p: x.p, pieno: x.pieno ? 1 : undefined }).then(function (s) { fine(s); }, function () { fine(null); });
        function fine(s) {
          schedeInVolo--;
          if (s) {
            schede[x.k] = s;
            schedeOrdine.push(x.k);
            while (schedeOrdine.length > 600) delete schede[schedeOrdine.shift()];
          }
          var l = schedeAttese[x.k] || [];
          delete schedeAttese[x.k];
          for (var i = 0; i < l.length; i++) { try { l[i](s); } catch (e) {} }
          prossimaScheda();
        }
      })(x);
    }
  }

  /* ============================================================ le immagini: ridotte su una tela, una alla volta */

  // il TV decodifica l'immagine originale una volta sola (al massimo 12 milioni di pixel, lo controlla il servizio) e
  // poi tiene solo la piccola, come dataURL: in memoria al massimo circa 6 MB di piccole (si conta la misura, non il numero).
  // Le immagini di Jellyfin no: arrivano gia' ridotte dal server e vanno dritte nella pagina (vedi mettiDritta)
  var imm = { cache: {}, ordine: [], coda: [], inVolo: false, peso: 0 };
  // vivo: chi la vuole e' ancora nella pagina? (con le frecce tenute premute, le copertine gia' passate non si caricano)
  function piccola(d, ref, w, h, cb, tutta, vivo) {
    if (!ref || !ref.p || !serv.gettone) { cb(null); return; }
    var k = d + '|' + ref.p + '|' + (ref.k === undefined ? '' : ref.k) + '|' + w + 'x' + h + (tutta ? 't' : '');
    if (imm.cache[k] !== undefined) { cb(imm.cache[k]); return; }
    for (var i = 0; i < imm.coda.length; i++) if (imm.coda[i].k === k) { imm.coda[i].cb.push(cb); imm.coda[i].vivo.push(vivo || null); return; }
    imm.coda.push({ k: k, d: d, ref: ref, w: w, h: h, tutta: !!tutta, cb: [cb], vivo: [vivo || null] });
    setTimeout(prossimaImg, 0); // al giro dopo: chi l'ha chiesta intanto entra nella pagina
  }
  function serveAncora(x) { for (var i = 0; i < x.vivo.length; i++) if (!x.vivo[i] || x.vivo[i]()) return true; return false; }
  function prossimaImg() {
    if (imm.inVolo) return;
    var x = imm.coda.pop();
    while (x && !serveAncora(x)) { for (var j = 0; j < x.cb.length; j++) { try { x.cb[j](null); } catch (e) {} } x = imm.coda.pop(); }
    if (!x) return;
    var im = new Image(), fatto = false, t = null;
    imm.inVolo = true;
    function fine(url) {
      if (fatto) return;
      fatto = true;
      clearTimeout(t);
      im.onload = im.onerror = null;
      im.src = ''; // la decodifica grande si puo' buttare
      imm.cache[x.k] = url;
      if (url) segnaPasso('r4k-copertine');
      imm.ordine.push(x.k);
      imm.peso += url ? url.length : 0;
      // 3 milioni di caratteri (circa 6 MB nella memoria della pagina): via le piu' vecchie
      while (imm.peso > 3e6 && imm.ordine.length > 1) { var vk = imm.ordine.shift(); imm.peso -= (imm.cache[vk] || '').length; delete imm.cache[vk]; }
      for (var i = 0; i < x.cb.length; i++) { try { x.cb[i](url); } catch (e) {} }
      imm.inVolo = false;
      setTimeout(prossimaImg, 0);
    }
    t = setTimeout(function () { fine(null); }, 15000);
    im.crossOrigin = 'anonymous';
    im.onload = function () {
      var url = null;
      try {
        var c = document.createElement('canvas'), g, iw = im.naturalWidth, ih = im.naturalHeight;
        c.width = x.w;
        c.height = x.h;
        g = c.getContext('2d');
        if (x.tutta) {
          // un logo: tutto, con le sue proporzioni, trasparente
          var s0 = Math.min(x.w / iw, x.h / ih), lw = Math.round(iw * s0), lh = Math.round(ih * s0);
          c.width = Math.max(1, lw);
          c.height = Math.max(1, lh);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
          // un logo quasi vuoto (tutto trasparente: capita) non si usa, resta il titolo scritto
          url = pieno(c) ? c.toDataURL('image/png') : null;
        } else {
          // una copertina o uno sfondo: si riempie tagliando il centro (un po' piu' in alto: i volti)
          var s = Math.max(x.w / iw, x.h / ih), sw = x.w / s, sh = x.h / s;
          g.drawImage(im, (iw - sw) / 2, Math.max(0, (ih - sh) * 0.3), sw, sh, 0, 0, x.w, x.h);
          url = c.toDataURL(x.w * x.h <= 1000 ? 'image/png' : 'image/jpeg', 0.86);
        }
      } catch (e) { url = null; }
      fine(url);
    };
    im.onerror = function () { fine(null); };
    im.src = urlImmagine(x.d, x.ref, x.w, x.h, x.tutta);
  }
  // quanto di un logo si vede: almeno il 2% dei punti non trasparenti (uno ogni 4, basta per saperlo)
  function pieno(c) {
    var d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, visti = 0, tot = 0;
    for (var i = 3; i < d.length; i += 16) { tot++; if (d[i] > 40) visti++; }
    return tot > 0 && visti / tot >= 0.02;
  }
  // le immagini di Jellyfin: ridotte dal server alla misura giusta e tenute dal browser (il ponte le da' per un giorno), quindi
  // niente tela: un <img> che compare quando e' pronto. Al massimo quattro in volo, prima le ultime chieste (le frecce tenute
  // premute non riempiono la coda di copertine gia' passate)
  var dritte = { coda: [], inVolo: 0 }, apertaAlle = Date.now();
  // finiti i 3 s dell'apertura i posti tornano quattro: si riempiono subito, senza aspettare che finisca un'immagine
  setTimeout(function () { prossimaDritta(); }, 3050);
  // il riquadro sta in una carta che ha lasciato andare le sue immagini (lontana dalla scelta, o la pagina sotto il lettore)
  function lontano(box) {
    for (var e = box; e && e !== document.body; e = e.parentNode) {
      if (e.caricata === false) return true;
      if (e.hidden && e.classList && e.classList.contains('schermo')) return true; // uno schermo nascosto (sotto il lettore)
    }
    return false;
  }
  function mettiDritta(box, ref, w, h, poi) {
    dritte.coda.push({ box: box, url: urlImmagine('', ref, w, h, false), poi: poi || null });
    setTimeout(prossimaDritta, 0); // al giro dopo: chi l'ha chiesta intanto mette la casella nella pagina
  }
  function prossimaDritta() {
    // (nei primi 3 s dopo l'apertura due alla volta: 31/10, il TV chiudeva il servizio entro un secondo dall'apertura)
    while (dritte.inVolo < (Date.now() - apertaAlle < 3000 ? 2 : 4) && dritte.coda.length) {
      var x = dritte.coda.pop();
      if (!x.box.parentNode || !document.body.contains(x.box) || lontano(x.box)) { if (x.poi) x.poi(false); continue; }
      // la carta ha gia' la sua immagine, arrivata o in viaggio (una carta in errore uscita e tornata entro 1,5-3 s: il
      // nuovo tentativo e la richiesta nuova). Due <img> uno sopra l'altro sarebbero solo memoria in piu': quella che c'e' basta
      if (x.box.querySelector('img')) continue;
      dritte.inVolo++;
      (function (x) {
        var im = el('img'), fatto = false, t = null;
        // errore: non arrivata (errore del server, o piu' di 6 s), non lasciata da chi non la vuole piu'
        function fine(si, errore) {
          if (fatto) return;
          fatto = true;
          im.fine = null; // non e' piu' in viaggio: lasciarla poi vuol dire solo staccarla
          clearTimeout(t);
          dritte.inVolo--;
          // (tolta intanto: la carta e' andata lontano)
          if (si && (!im.parentNode || lontano(x.box))) si = false;
          if (si) im.className = 'on'; else { im.removeAttribute('src'); if (im.parentNode) im.parentNode.removeChild(im); }
          // non arrivata ma ancora utile: si riprova dopo un attimo, al massimo due volte (31/10 sul TV: alcune copertine non
          // arrivavano mai, per esempio quando il servizio cade e riparte). Chromium non riusa un'immagine andata in errore
          if (!si && errore && (x.prove || 0) < 2 && x.box.parentNode && document.body.contains(x.box) && !lontano(x.box)) {
            x.prove = (x.prove || 0) + 1;
            setTimeout(function () { dritte.coda.push(x); prossimaDritta(); }, 1500 * x.prove);
          } else {
            // non arrivata neanche riprovando: la sua carta lo sa (mancata). Se poi finisce nascosta a sinistra non la tiene, e
            // tornando in vista la chiede di nuovo (vedi caricaVicineOra)
            if (!si && errore) for (var c0 = x.box; c0 && c0 !== document.body; c0 = c0.parentNode) if (c0.caricata !== undefined) { c0.mancata = true; break; }
            if (x.poi) { try { x.poi(si); } catch (e) {} }
          }
          prossimaDritta();
        }
        im.onload = function () { fine(true); };
        im.onerror = function () { fine(false, true); };
        // al massimo 6 s per immagine: il posto si libera in ogni caso e la coda riparte
        t = setTimeout(function () { fine(false, true); }, 6000);
        // (tolto src a un'immagine che si sta caricando, Chromium non manda ne' load ne' error: chi la lascia chiama fine, se no il
        // posto in coda resterebbe preso fino ai 6 secondi)
        im.fine = fine;
        im.alt = '';
        im.src = x.url;
        x.box.insertBefore(im, x.box.firstChild ? x.box.firstChild.nextSibling : null); // sopra la copertina disegnata, sotto barre e segni
      })(x);
    }
  }
  // un'immagine dentro un riquadro: compare con una dissolvenza quando e' pronta
  function mettiImg(box, d, ref, w, h, tutta, poi) {
    if (ref && ref.jf && !tutta && serv.gettone) { mettiDritta(box, ref, w, h, poi); return; }
    piccola(d, ref, w, h, function (url) {
      if (!url || !box.parentNode || lontano(box)) { if (poi) poi(false); return; }
      var im = el('img');
      im.onload = function () { im.className = 'on'; };
      im.src = url;
      box.insertBefore(im, box.firstChild ? box.firstChild.nextSibling : null); // sopra la copertina disegnata, sotto barre e segni
      if (poi) poi(true);
    }, tutta, function () { return !!box.parentNode && document.body.contains(box) && !lontano(box); });
  }
  // una carta lascia andare le sue immagini: quelle messe e quelle in coda. Tornando vicina si ricaricano (carica)
  function lasciaImg(im) {
    if (im.fine) { im.fine(false); return; } // in viaggio: la sua fine la toglie e libera il posto
    im.removeAttribute('src');
    if (im.parentNode) im.parentNode.removeChild(im);
  }
  function lasciaCarta(c) {
    c.caricata = false;
    if (c.caricaImg) c.carica = c.caricaImg;
    var l = c.querySelectorAll('img');
    for (var i = l.length - 1; i >= 0; i--) lasciaImg(l[i]);
    var f = c.querySelectorAll('.finta');
    for (var j = 0; j < f.length; j++) f[j].style.opacity = '';
  }
  // mentre l'immagine di Jellyfin arriva (o dopo che la carta l'ha lasciata andare): i colori della copertina vera, dal suo
  // BlurHash, al posto della copertina disegnata col titolo. Solo CSS: niente immagini da decodificare
  function sfuma(box, ref) {
    var c = ref && ref.jf && ref.jf.blur ? JF.coloriBlur(ref.jf.blur, 3) : null, f = box.querySelector('.finta');
    if (!c || !f) return;
    f.style.backgroundImage = 'linear-gradient(180deg, ' + c[0] + ' 0%, ' + c[1] + ' 50%, ' + c[2] + ' 100%)';
    box.className += ' sfuma';
  }
  // l'immagine e' arrivata (la copertina disegnata sparisce) o no: se la carta e' ancora vicina, torna il titolo
  function arrivata(box, si) {
    var f = box.querySelector('.finta');
    if (si) { if (f) f.style.opacity = '0'; }
    else if (!lontano(box)) box.className = box.className.replace(/\s*\bsfuma\b/, '');
  }
  // la copertina disegnata: titolo pulito, anno, un colore spento dal nome (mai un riquadro grigio)
  function finta(titolo, anno, tipo) {
    var c = el('div', 'finta'), h = tinta(titolo);
    c.style.backgroundImage = 'linear-gradient(160deg, hsl(' + h + ',26%,24%) 0%, hsl(' + ((h + 24) % 360) + ',30%,11%) 100%)';
    c.appendChild(icona(ICONE[tipo] || ICONE.film, 'ico'));
    c.appendChild(el('div', 'ft', titolo));
    if (anno) c.appendChild(el('div', 'fa', String(anno)));
    return c;
  }

  /* ---------------------------------------------------------- lo sfondo */

  var sfondoChiave = null, sfondoA = true, sfondoTimer = null;
  // nitido: l'immagine grande del film (960x540, da Jellyfin e dalle chiavette); se no la copertina della voce scelta,
  // sfocata (32x18 ingrandita)
  function sfondo(d, ref, nitido, subito) {
    var k = ref ? d + '|' + ref.p + '|' + ref.k + '|' + (nitido ? 1 : 0) : '';
    if (k === sfondoChiave) return;
    sfondoChiave = k;
    clearTimeout(sfondoTimer);
    if (!ref) { mettiSfondo(null, ''); return; }
    // con le frecce tenute premute: solo quando ci si ferma. Nelle file e nella griglia dopo una sosta vera (700 ms): ogni
    // sfondo nuovo e' un'immagine da decodificare che il TV tiene in cache, e scorrendo se ne accumulavano decine (31/10: la
    // memoria libera del TV scendeva da 70 a 20 MB in cinque minuti). Sul banner e nella scheda subito
    sfondoTimer = setTimeout(function () {
      if (ref.jf && nitido && serv.gettone) {
        // 960x540 come nella prima versione (2 MB decodificati, 1280x720 ne prendeva 3,5): sotto i veli non si vede la differenza
        immagineDati(urlImmagine('', ref, 960, 540, false), function (dati) { if (sfondoChiave === k) mettiSfondo(dati, dati ? 'nitido' : ''); });
        return;
      }
      piccola(d, ref, nitido ? 960 : 32, nitido ? 540 : 18, function (url) { if (sfondoChiave === k) mettiSfondo(url, nitido ? 'nitido' : 'sfocato'); });
    }, subito ? 0 : $('sfondo').className === 'eroe' ? 260 : 700);
  }
  // un'immagine del ponte come data: URL (letta con una XHR, i byte del server cosi' come sono: niente da decodificare e
  // ricodificare). Chromium non tiene in cache le immagini data:, e quando lo sfondo cambia la vecchia si libera davvero; con
  // l'indirizzo vero ogni sfondo visto restava decodificato in cache (31/10: +105 MB dopo 30 film, la prima versione +25)
  // (gli ultimi quattro restano come testo, circa 150 KB l'uno, non decodificati: il banner che gira non li riscarica)
  var datiCache = [];
  function immagineDati(url, cb) {
    for (var i = 0; i < datiCache.length; i++) if (datiCache[i].url === url) { cb(datiCache[i].dati); return; }
    var x = new XMLHttpRequest(), finito = false;
    function fine(v) {
      if (finito) return;
      finito = true;
      if (v) { datiCache.unshift({ url: url, dati: v }); if (datiCache.length > 4) datiCache.pop(); }
      cb(v);
    }
    try {
      x.open('GET', url, true);
      x.responseType = 'blob';
      x.timeout = 15000;
      x.onload = function () {
        if (x.status !== 200 || !x.response || !/^image\//.test(x.response.type || '')) { fine(null); return; }
        var r = new FileReader();
        r.onload = function () { fine(typeof r.result === 'string' && r.result.indexOf('data:image/') === 0 ? r.result : null); };
        r.onerror = function () { fine(null); };
        r.readAsDataURL(x.response);
      };
      x.onerror = x.ontimeout = x.onabort = function () { fine(null); };
      x.send();
    } catch (e) { fine(null); }
  }
  var svuotaTimer = null;
  // lo sfondo cambia senza dissolvenza: animava due strati a pieno schermo piu' il velo, e sul TV ogni strato e' memoria video
  // (8 MB): 31,6 MB invece di 12 a ogni cambio del banner (31/10). Il nuovo strato va sopra il vecchio, che resta sotto finche'
  // il nuovo non e' disegnato (niente lampo scuro) e poi lascia andare la sua immagine
  function mettiSfondo(url, tipo) {
    var nuovo = $(sfondoA ? 'sfondo-b' : 'sfondo-a'), vecchio = $(sfondoA ? 'sfondo-a' : 'sfondo-b');
    sfondoA = !sfondoA;
    nuovo.style.backgroundImage = url ? 'url("' + url + '")' : 'none';
    if (url) segnaPasso('r4k-banner');
    $('sfondo').insertBefore(nuovo, $('trailer')); // sopra il vecchio, sotto trailer e velo
    nuovo.className = 'strato' + (url ? ' on' : '') + (tipo ? ' ' + tipo : '');
    clearTimeout(svuotaTimer);
    if (!url) { vecchio.className = 'strato'; vecchio.style.backgroundImage = 'none'; return; }
    svuotaTimer = setTimeout(function () { vecchio.className = 'strato'; vecchio.style.backgroundImage = 'none'; }, 300);
  }
  // come si guarda lo sfondo: eroe (tutta l'immagine), righe (piu' piccola in alto a destra), scheda, piatto (senza immagine)
  function modoSfondo(m) { $('sfondo').className = m; }

  /* ============================================================ memoria (64 KB per app, tenuta dalla home) */

  // il trailer dietro la scheda (un secondo video da decodificare, che passa dal servizio): spento su tutti i TV finche' non e'
  // provato sul TV vero. Su un Samsung del 2022 il servizio cadeva quando partiva un video (30/10): niente video che partono da soli
  var TRAILER_DIETRO = false;
  // videoDiretto: i film di Jellyfin dal Mac al lettore senza passare dal servizio del TV (prova, Altro › Video diretto dal Mac)
  var prefs = { lingue: ['ita', 'eng'], sottoAuto: true, dimSotto: 'medi', posSotto: 0, schermo: 'adatta', qualita: 'orig', anteprime: false,
    anteprimeScelte: false, videoDiretto: false, real4kMacNo: false };
  var punti = {}; // chiave -> { d, p, dim, nome, t, dur, quando, finito }
  var cartelle = {}; // "disco|cartella" -> { a: lingua dell'audio, s: lingua dei sottotitoli o 'no', quando }: le puntate
  function leggiMemoria() {
    // (le anteprime salvate valgono solo se scelte a mano: le versioni di prima salvavano tutto, anche il vecchio "accese")
    var anteprime0 = prefs.anteprime, salvate = HomeTV.memoria.leggi('prefs');
    // dal Mac la prima volta (memoria della pagina del Mac ancora vuota): le scelte di Real4K del TV, passate dalla home
    // (qualita', lingue, sottotitoli...), cosi' per chi guarda non cambia niente
    if (DAL_MAC && !salvate) salvate = dallAncora('prefs', /^\{[\x20-\x7e]{0,2000}\}$/);
    try { var x = JSON.parse(salvate || '{}'); for (var k in x) if (Object.prototype.hasOwnProperty.call(prefs, k)) prefs[k] = x[k]; } catch (e) {}
    // (un "false" salvato e' sempre una scelta a mano: prima il default era "accese")
    if (prefs.anteprimeScelte !== true && prefs.anteprime === true) prefs.anteprime = anteprime0;
    try { punti = JSON.parse(HomeTV.memoria.leggi('punti') || '{}') || {}; } catch (e) { punti = {}; }
    try { cartelle = JSON.parse(HomeTV.memoria.leggi('cartelle') || '{}') || {}; } catch (e) { cartelle = {}; }
  }
  // le puntate di una serie stanno nella stessa cartella: audio e sottotitoli scelti a mano valgono anche per le altre
  // puntate (per i film no: ogni film ha le sue lingue)
  function chiaveCartella(voce) { return voce.d + '|' + String(voce.p).replace(/\/?[^\/]*$/, ''); }
  function sceltaCartella(voce) { return titoloDi(voce.nome).episodio ? cartelle[chiaveCartella(voce)] || null : null; }
  function ricordaCartella(voce, cosa, valore) {
    if (!titoloDi(voce.nome).episodio) return;
    var k = chiaveCartella(voce), x = cartelle[k] || {};
    x[cosa] = valore;
    x.quando = Date.now();
    cartelle[k] = x;
    var l = Object.keys(cartelle).sort(function (a, b) { return cartelle[b].quando - cartelle[a].quando; });
    while (l.length > 30) delete cartelle[l.pop()];
    HomeTV.memoria.scrivi('cartelle', JSON.stringify(cartelle));
  }
  function lingueDi(voce) {
    var s = sceltaCartella(voce), l = prefs.lingue.slice();
    if (s && s.a) l = [s.a].concat(l.filter(function (x) { return x !== s.a; }));
    return l.join(',');
  }
  function salvaPrefs() { HomeTV.memoria.scrivi('prefs', JSON.stringify(prefs)); }
  function chiaveDi(p, dim) { return p + '|' + dim; }
  function salvaPunti() {
    var l = Object.keys(punti).sort(function (a, b) { return punti[b].quando - punti[a].quando; });
    while (l.length > 40) delete punti[l.pop()];
    if (!HomeTV.memoria.scrivi('punti', JSON.stringify(punti))) {
      // memoria piena: via i piu' vecchi finche' ci sta
      while (l.length > 5) { delete punti[l.pop()]; if (HomeTV.memoria.scrivi('punti', JSON.stringify(punti))) break; }
    }
  }
  // un punto da cui si riprende: dopo il primo minuto e non negli ultimi due (le stesse regole per carte, barre e lettore)
  function riprendibile(pt, durata) {
    var d = durata || (pt && pt.dur) || 0;
    return !!pt && !pt.finito && pt.t > 60 && (!d || pt.t < d - 120);
  }
  function puntoDi(d, p, dim) {
    var pt = dim ? punti[chiaveDi(p, dim)] : null;
    if (pt) return pt;
    for (var k in punti) if (Object.prototype.hasOwnProperty.call(punti, k) && punti[k].p === p && punti[k].d === d) return punti[k];
    return null;
  }

  /* ============================================================ schermi */

  var schermo = '';
  var memInizio = null;
  var CON_IMMAGINI = { inizio: 'schermo-inizio', scheda: 'schermo-scheda', libreria: 'schermo-libreria', cerca: 'schermo-cerca' };
  // l'apertura di index.html (il marchio al centro mentre arrivano script e dati): se ne va quando l'inizio e' pronto, o subito
  // quando si apre un altro schermo (un film dalla home)
  function apertura(pronta) { try { if (window.Apertura) { if (pronta) window.Apertura.pronta(); else window.Apertura.via(); } } catch (e) {} }
  function mostra(nome) {
    if (nome !== 'inizio') apertura(false);
    if (schermo === 'inizio' && nome !== 'inizio' && pag && pag.corpo === $('inizio-corpo')) memInizio = pag;
    // lo schermo che si lascia lascia andare le sue immagini (tornando si ridisegna sempre): sul TV restano decodificate solo
    // quelle della pagina che si vede
    if (nome !== schermo && CON_IMMAGINI[schermo]) lasciaImmagini([CON_IMMAGINI[schermo]], false);
    schermo = nome;
    $('schermo-inizio').hidden = nome !== 'inizio';
    $('schermo-libreria').hidden = nome !== 'libreria';
    $('schermo-scheda').hidden = nome !== 'scheda';
    $('schermo-lettore').hidden = nome !== 'lettore';
    $('schermo-cerca').hidden = nome !== 'cerca';
    $('schermo-collega').hidden = nome !== 'collega';
    $('sfondo').hidden = nome === 'lettore';
    if (nome === 'lettore') lasciaImmagini(['schermo-inizio', 'schermo-scheda', 'schermo-libreria', 'schermo-cerca'], true);
    // il trailer dietro la scheda: solo li' (e mai insieme al lettore: un decoder alla volta)
    if (nome !== 'scheda') fermaTrailer();
    // il banner che cambia film, la ricerca del Mac e il binario: solo all'inizio
    if (nome !== 'inizio') { fermaVetrina(); benvFerma(); chiudiBinario(true); }
    if (nome === 'scheda') modoSfondo('scheda');
    else if (nome === 'libreria') modoSfondo('righe');
    else if (nome === 'cerca' || nome === 'collega') modoSfondo('piatto');
  }
  // via le immagini degli schermi che non si vedono (con sfondo: anche lo sfondo, entrando nel lettore). Sul TV il 4K del film
  // vuole tanta memoria, e se manca il TV chiude il servizio (che porta il film). Tornando, la pagina si ridisegna e le ricarica
  function lasciaImmagini(ids, sfondoAnche) {
    ids.forEach(function (id) {
      var radice = $(id);
      // prima via dalla coda (se no le immagini in viaggio, chiudendosi, farebbero partire quelle di questo schermo), poi quelle
      // in viaggio e quelle messe
      dritte.coda = dritte.coda.filter(function (x) {
        if (!radice.contains(x.box)) return true;
        if (x.poi) { try { x.poi(false); } catch (e) {} }
        return false;
      });
      var l = radice.querySelectorAll('img');
      for (var i = l.length - 1; i >= 0; i--) lasciaImg(l[i]);
      if (id === 'schermo-inizio') { eroeChiave = ''; eroeGiro++; }
      // la scheda rifa' il logo tornando (se no restava vuota: il titolo scritto era gia' stato tolto quando il logo era arrivato)
      if (id === 'schermo-scheda' && sch) sch.logoFatto = false;
    });
    if (!sfondoAnche) return;
    imm.coda = [];
    clearTimeout(sfondoTimer);
    clearTimeout(svuotaTimer);
    ['sfondo-a', 'sfondo-b'].forEach(function (id) { $(id).style.backgroundImage = 'none'; $(id).className = 'strato'; });
    sfondoChiave = null;
  }
  var fermoAzioni = [];
  // opz.lista: una voce per riga, col suo "piccolo" a destra (la qualita' dalla scheda); opz.scelta: la voce scelta all'inizio
  function fermo(titolo, testo, pulsanti, opz) {
    opz = opz || {};
    $('fermo-titolo').textContent = titolo;
    $('fermo-testo').textContent = testo || '';
    var box = $('fermo-pulsanti');
    svuota(box);
    if (opz.lista) $('fermo').classList.add('lista'); else $('fermo').classList.remove('lista');
    fermoAzioni = pulsanti || [{ testo: 'Indietro', fn: chiudiFermo }];
    var prima = Math.max(0, Math.min(opz.scelta || 0, fermoAzioni.length - 1));
    for (var i = 0; i < fermoAzioni.length; i++) {
      var b = el('button', 'pulsante', fermoAzioni[i].testo);
      if (fermoAzioni[i].piccolo) b.appendChild(el('small', '', fermoAzioni[i].piccolo));
      b.setAttribute('data-tv', '');
      b.addEventListener('click', (function (f) { return function () { f.fn(); }; })(fermoAzioni[i]));
      box.appendChild(b);
      if (i === prima) HomeTV.scegli(b);
    }
    $('fermo').hidden = false;
  }
  function chiudiFermo() { $('fermo').hidden = true; }
  function fermoAperto() { return !$('fermo').hidden; }

  /* ============================================================ le pagine: righe col telecomando
   * Inizio e scheda sono righe (pulsanti, file di carte): Su e Giu' cambiano riga, Sinistra e Destra la voce. La fila
   * scorre per tenere in vista la voce scelta, la pagina scorre per tenere in vista la riga; tutto con transform. */

  var pag = null; // { corpo, righe: [{ box, voci, k, sezione, quando(el, k), crea, n, passo }], r, disponi }
  function nuovaPagina(corpo, disponi) { pag = { corpo: corpo, righe: [], r: 0, disponi: disponi || null }; return pag; }
  // una riga: le sue voci (elementi), oppure una fila lunga "virtuale" (crea(i) fa la voce i, n quante sono, passo in vw):
  // di quelle si disegnano solo le voci vicine a quella scelta, e solo nelle file vicine (100 film o 300 puntate restano leggeri)
  function aggiungiRiga(box, voci, opz) {
    opz = opz || {};
    var n = opz.crea ? opz.n || 0 : voci.length;
    // una fila virtuale nuova sullo stesso riquadro (la scheda rifa' le righe quando arriva altro): via le carte di prima
    if (opz.crea) svuota(box);
    var R = { box: box, voci: voci, k: Math.max(0, Math.min(opz.k || 0, n - 1)), sezione: opz.sezione || box, quando: opz.quando || null, chiave: opz.chiave || '',
      crea: opz.crea || null, n: n, passo: opz.passo || 0 };
    pag.righe.push(R);
    return R;
  }
  function quanteIn(R) { return R.crea ? R.n : R.voci.length; }
  // le carte disegnate di una fila virtuale: da tre prima della prima che si vede a dieci dopo la scelta. In fondo alla fila
  // l'ultima resta attaccata al bordo destro e si vedono anche le sette prima della scelta (vedi scorriFila): contando dalla
  // scelta mancavano, mezza fila vuota su "Tutti i film" (31/10 sul TV: «delle copertine mentre scorro a sinistra scompaiono»)
  function disegnaRiga(R) {
    var da = Math.max(0, primaVisibile(R) - 3), a = Math.min(R.n - 1, R.k + 10), passo = window.innerWidth * R.passo, i;
    for (i in R.voci) {
      if (!Object.prototype.hasOwnProperty.call(R.voci, i) || (+i >= da && +i <= a)) continue;
      var vecchia = R.voci[i];
      if (vecchia && vecchia.parentNode) vecchia.parentNode.removeChild(vecchia);
      delete R.voci[i];
    }
    for (i = da; i <= a; i++) {
      if (R.voci[i]) continue;
      var c = R.crea(i);
      if (!c) continue;
      c.style.left = Math.round(i * passo) + 'px';
      R.box.appendChild(c);
      R.voci[i] = c;
    }
  }
  function svuotaRiga(R) {
    for (var i in R.voci) if (Object.prototype.hasOwnProperty.call(R.voci, i) && R.voci[i] && R.voci[i].parentNode) R.voci[i].parentNode.removeChild(R.voci[i]);
    R.voci = [];
  }
  function vociDi(box) { return Array.prototype.slice.call(box.children); }
  function sceltaPagina() { var R = pag && pag.righe[pag.r]; return R ? R.voci[R.k] || null : null; }
  function altezzaIn(e, corpo) { var y = 0; while (e && e !== corpo) { y += e.offsetTop; e = e.offsetParent; } return y; }
  // la fila scorre: la voce scelta a sinistra (quelle prima spariscono), ma l'ultima resta attaccata al bordo destro
  function scorriFila(R) {
    if (!R.box || !/\bfila\b/.test(R.box.className)) return;
    var W = window.innerWidth, e = R.voci[R.k], visibile = W * 0.924, passo = R.crea ? W * R.passo : 0;
    if (!e) return;
    var tot = R.crea ? R.n * passo - W * 0.0125 : R.box.scrollWidth, x0 = R.crea ? R.k * passo : e.offsetLeft;
    var sposta = Math.max(0, Math.min(x0, tot - visibile));
    R.box.style.transform = 'translateX(' + (-Math.round(sposta)) + 'px)';
    var l = R.crea ? R.voci : vociDi(R.box);
    for (var i in l) {
      if (!Object.prototype.hasOwnProperty.call(l, i) || !l[i] || !l[i].classList) continue;
      var x = R.crea ? +i * passo : l[i].offsetLeft;
      if (x - sposta < -W * 0.02) l[i].classList.add('prima'); else l[i].classList.remove('prima');
    }
  }
  function evidenzia() {
    var vecchie = document.querySelectorAll('.sel');
    for (var i = 0; i < vecchie.length; i++) if (!vecchie[i].classList.contains('v') && !vecchie[i].classList.contains('bv')) vecchie[i].classList.remove('sel');
    if (!pag) return;
    // le file lunghe: disegnate solo intorno a quella scelta
    for (var r = 0; r < pag.righe.length; r++) {
      var Rr = pag.righe[r];
      if (!Rr.crea) continue;
      if (!pag.disponi || (r >= pag.r - 1 && r <= pag.r + 2)) { disegnaRiga(Rr); scorriFila(Rr); } else if (Rr.voci.length) svuotaRiga(Rr);
    }
    var R = pag.righe[pag.r];
    if (!R || !quanteIn(R)) return;
    var e = R.voci[R.k];
    if (!e) return;
    e.classList.add('sel');
    scorriFila(R);
    if (pag.disponi) pag.disponi(R, e);
    else {
      // la pagina: la prima riga dall'alto; le altre tutte in vista
      var sez = R.sezione, alto = altezzaIn(sez, pag.corpo), h = window.innerHeight;
      var y = pag.r === 0 ? 0 : Math.max(0, alto + sez.offsetHeight - h * 0.93);
      pag.corpo.style.transform = 'translateY(' + (-Math.round(y)) + 'px)';
      var sch0 = pag.corpo.parentNode;
      if (sch0 && sch0.classList) { if (y > 0) sch0.classList.add('scorso'); else sch0.classList.remove('scorso'); }
      // nella scheda, scendendo, l'immagine si scurisce (le file si leggono meglio)
      if (sch0 === $('schermo-scheda')) {
        if (y > 0) { $('sfondo').classList.add('scuro'); fermaTrailer(); } else $('sfondo').classList.remove('scuro');
      }
    }
    if (R.quando) R.quando(e, R.k);
    caricaVicine();
  }
  function tastoPagina(a) {
    if (schermo === 'inizio' && bin.aperto) return tastoBinario(a);
    if (!pag || !pag.righe.length) return a === 'up' || a === 'down' || a === 'left' || a === 'right';
    var R = pag.righe[pag.r];
    if (a === 'left' || a === 'right') {
      var k = R.k + (a === 'left' ? -1 : 1);
      if (k >= 0 && k < quanteIn(R)) { R.k = k; pag.mosso = true; evidenzia(); }
      // il banner: oltre l'ultimo pulsante il film dopo; all'inizio di ogni fila, Sinistra apre il binario
      else if (a === 'right' && R.chiave === 'eroe') { pag.mosso = true; cambiaSlide(1); }
      else if (a === 'left' && schermo === 'inizio' && bin.voci.length) apriBinario();
      return true;
    }
    if (a === 'up' || a === 'down') {
      pag.mosso = true;
      var r = pag.r + (a === 'up' ? -1 : 1);
      while (r >= 0 && r < pag.righe.length && !quanteIn(pag.righe[r])) r += a === 'up' ? -1 : 1;
      if (r >= 0 && r < pag.righe.length) { pag.r = r; evidenzia(); }
      return true;
    }
    if (a === 'ok') { var e = sceltaPagina(); if (e) e.click(); return true; }
    return false;
  }
  // un pulsante: icona e scritta; tondo: solo l'icona, la scritta compare sotto quando e' scelto
  function pulsante(testo, ic, fn, piccolo, tondo) {
    var b = el('div', 'pulsante' + (tondo ? ' tondo' : ''));
    if (ic) b.appendChild(icona(ICONE[ic]));
    b.appendChild(el('span', 't', testo));
    if (piccolo) b.appendChild(el('small', '', piccolo));
    b.addEventListener('click', fn);
    return b;
  }

  /* ============================================================ inizio: il film da riprendere, Continua, chiavette */

  var dischi = [], dischiTimer = null, ultimiDischi = '', dischiErrore = null, dischiVisti = false;
  function nomeDisco(id) {
    var m = /^USBDrive([A-Z])(\d+)$/i.exec(id);
    if (m) return 'Chiavetta USB ' + m[1].toUpperCase() + (m[2] !== '1' ? ' · parte ' + m[2] : '');
    return id;
  }
  function trovaDisco(id) { for (var i = 0; i < dischi.length; i++) if (dischi[i].id === id) return dischi[i]; return null; }
  function continua() {
    return Object.keys(punti).map(function (k) { return punti[k]; }).filter(function (x) { return riprendibile(x); })
      .sort(function (a, b) { return b.quando - a.quando; }).slice(0, 12);
  }
  // dischiDopo: le chiavette le chiede dopo chi apre l'app (vedi HomeTV.pronto)
  function apriInizio(scegli, dischiDopo) {
    mostra('inizio');
    sfondoChiave = null;
    disegnaInizio(scegli || 'tieni');
    jfCaricaInizio(false);
    if (!dischiDopo) caricaDischi(true);
    clearInterval(dischiTimer);
    // una chiavetta appena attaccata compare da sola, entro 15 s (31/10: ogni 4 s, sempre, anche col TV fermo sulla home)
    dischiTimer = setInterval(function () { if (schermo === 'inizio' && !fermoAperto()) caricaDischi(false); }, 15000);
  }
  // una chiavetta: dal Mac si apre su Real4K del TV, gia' su di lei (i film delle chiavette li legge il servizio del TV)
  function apriDisco(id) {
    if (DAL_MAC) { versoIlTv('Le chiavette le apro su Real4K del TV', '#/d/' + encodeURIComponent(id)); return; }
    apriLibreria(id, '');
  }
  function caricaDischi(primo) {
    // dal Mac le chiavette le dice il servizio del TV (gettone del TV) e i loro film si aprono su Real4K del TV. Se il servizio
    // non risponde la fila non c'e', senza messaggi: il resto della pagina e' del Mac
    if (DAL_MAC) {
      chiediTv('dischi').then(function (r) {
        var l = Array.isArray(r.dischi) ? r.dischi : [], firma = l.map(function (d) { return d.id; }).join('|');
        if (firma === ultimiDischi) return;
        if (!primo && l.length > dischi.length) messaggio('Chiavetta trovata');
        dischi = l;
        ultimiDischi = firma;
        if (schermo === 'inizio') disegnaInizio('tieni');
      }, function () {});
      return;
    }
    chiedi('dischi').then(function (r) {
      var prima = dischiErrore ? dischiErrore.codice : '';
      dischi = r.dischi || [];
      // un TV dove il servizio non sa ancora dove sono le chiavette (LG, oggi)
      dischiErrore = r.previsto === false ? erroreCon('nonPrevisto') : null;
      var firma = dischi.map(function (d) { return d.id; }).join('|');
      // (si ridisegna anche quando un errore di prima e' passato: il messaggio deve sparire)
      if (firma === ultimiDischi && prima === (dischiErrore ? dischiErrore.codice : '') && (!primo || dischiVisti)) return;
      dischiVisti = true;
      if (!primo && dischi.length > ultimiDischi.split('|').filter(Boolean).length) messaggio('Chiavetta trovata');
      ultimiDischi = firma;
      if (schermo === 'inizio') disegnaInizio('tieni');
    }, function (e) {
      if (!primo && e.codice === 'servizio') return;
      // lo stesso errore di 15 secondi fa: niente da ridisegnare (il banner non riparte da capo ogni volta)
      if (dischiErrore && dischiErrore.codice === e.codice && !dischi.length) return;
      dischi = [];
      ultimiDischi = '';
      dischiErrore = e;
      if (schermo === 'inizio') disegnaInizio('tieni');
    });
  }
  // vetrina: Jellyfin collegato (il banner coi film nuovi, le file con le informazioni della voce scelta in alto); semplice:
  // senza Jellyfin (il riquadro "Guarda i film del tuo Mac" o un problema, poi le chiavette e Altro, una sotto l'altra)
  var disegnando = false, attesaFinita = false;
  function disegnaInizio(scegli) {
    disegnando = true;
    try { disegnaInizio0(scegli); } finally { disegnando = false; }
  }
  function disegnaInizio0(scegli) {
    var vecchia = pag && pag.corpo === $('inizio-corpo') ? pag : memInizio, l = continuaTutti();
    var vetrina = jfAttivo() && !!jf.dati, sch = $('schermo-inizio');
    if (vetrina) sch.classList.add('vetrina'); else { sch.classList.remove('vetrina'); sch.classList.remove('righe'); }
    // finche' non si sa se Jellyfin e' collegato non si mostra niente (niente riquadro del Mac che lampeggia a chi e' collegato),
    // ma al massimo un secondo e mezzo (un servizio lento non lascia la pagina vuota)
    $('inizio-corpo').style.visibility = jf.stato || dischiErrore || attesaFinita ? '' : 'hidden';
    // la fila Continua a guardare (chiavette e Jellyfin)
    var fc = $('fila-continua');
    svuota(fc);
    fc.style.transform = '';
    $('sez-continua').hidden = !l.length;
    l.forEach(function (c) {
      if (!c.jf) { cartaContinua(c.x, fc); return; }
      var s = c.s, resta = s.durata ? Math.max(0, s.durata * 60 - s.punto) : 0;
      cartaJf(c.jf, 'oriz', fc, { sopra: c.prossimo ? 'Prossimo episodio' : 'Continua a guardare',
        sotto: c.prossimo ? 'S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') : resta ? 'Mancano ' + durataResta(resta) : '',
        apri: function () { guardaJf(c.jf, { ritorno: tornaInizio, t: c.prossimo ? 0 : s.punto }); } });
    });
    var righeJf = disegnaRigheJf();
    // chiavette e dischi
    var fd = $('fila-dischi');
    svuota(fd);
    fd.style.transform = '';
    $('sez-dischi').hidden = !dischi.length;
    dischi.forEach(function (d) {
      var c = cartaPiccola('disco:' + d.id, /^USBDrive/i.test(d.id) ? 'chiavetta' : 'disco', nomeDisco(d.id), 'Tutti i video', function () { apriDisco(d.id); });
      c.info = { sopra: 'Chiavetta', titolo: nomeDisco(d.id), trama: 'I video di questa chiavetta, cartella per cartella: il TV li legge direttamente.' };
      fd.appendChild(c);
    });
    var blocco = disegnaVuoto(l.length);
    disegnaBenvenuto(!vetrina && !blocco && !!jf.stato && !jfAttivo());
    disegnaAltro();
    disegnaBinario();
    // il banner: i film arrivati da poco (cambia da solo); senza, si parte dalle file
    vetr.slide = vetrina ? slideDi(jf.dati) : [];
    if (vetr.k >= vetr.slide.length) vetr.k = 0;
    $('eroe').hidden = !vetrina;
    if (!vetrina) { modoSfondo('piatto'); sfondo(null); fermaVetrina(); }
    // le righe col telecomando: banner (o riquadro del Mac), Continua, Jellyfin, chiavette (o il problema), Altro
    nuovaPagina($('inizio-corpo'), vetrina ? disponiVetrina : null);
    if (vetr.slide.length) {
      mostraSlide(vetr.k);
      aggiungiRiga($('eroe-pulsanti'), vociDi($('eroe-pulsanti')), { sezione: $('eroe'), chiave: 'eroe' });
    }
    if (!$('benvenuto').hidden) aggiungiRiga($('benv-pulsanti'), vociDi($('benv-pulsanti')), { sezione: $('benvenuto'), chiave: 'benvenuto' });
    if (l.length) aggiungiRiga(fc, vociDi(fc), { sezione: $('sez-continua'), chiave: 'continua' });
    righeJf.forEach(function (R) { aggiungiRiga(R.box, R.crea ? [] : vociDi(R.box), { sezione: R.sezione, chiave: R.chiave, crea: R.crea, n: R.n, passo: R.passo }); });
    if (dischi.length) aggiungiRiga(fd, vociDi(fd), { sezione: $('sez-dischi'), chiave: 'dischi' });
    if (blocco) aggiungiRiga($('vuoto'), [$('vuoto-riprova')], { sezione: $('vuoto'), chiave: 'vuoto' });
    aggiungiRiga($('fila-altro'), vociDi($('fila-altro')), { sezione: $('sez-altro'), chiave: 'altro' });
    // la scelta resta dov'era (stessa riga, stessa voce; le altre file restano dove le avevi lasciate); la prima volta sul
    // banner, o sulle chiavette se Jellyfin non c'e'
    // (passando dal riquadro del Mac alla vetrina, o viceversa, si riparte dall'alto: le righe sono altre)
    if (vecchia && vecchia.mosso && scegli === 'tieni' && !!vecchia.disponi === vetrina) {
      pag.mosso = true;
      var R0 = vecchia.righe[vecchia.r], trovata = false;
      for (var i = 0; i < pag.righe.length; i++) {
        var R1 = pag.righe[i];
        for (var iv = 0; iv < vecchia.righe.length; iv++) if (vecchia.righe[iv].chiave === R1.chiave && R1.crea) R1.k = Math.min(vecchia.righe[iv].k, Math.max(0, R1.n - 1));
        if (!R0 || R1.chiave !== R0.chiave) continue;
        var v0 = R0.voci[R0.k], kk = v0 ? v0.getAttribute('data-chiave') : null;
        pag.r = i;
        trovata = true;
        R1.k = Math.min(R0.k, Math.max(0, quanteIn(R1) - 1));
        if (!R1.crea) for (var j0 = 0; j0 < R1.voci.length; j0++) if (kk && R1.voci[j0].getAttribute('data-chiave') === kk) R1.k = j0;
      }
      // la riga non c'e' piu' (la chiavetta tolta): si resta li' vicino, non si torna in cima
      if (!trovata && pag.righe.length) {
        pag.r = Math.min(vecchia.r, pag.righe.length - 1);
        while (pag.r > 0 && !quanteIn(pag.righe[pag.r])) pag.r--;
      }
    } else if (scegli === 'dischi' || (!vetrina && dischi.length && !blocco)) {
      for (var j = 0; j < pag.righe.length; j++) if (pag.righe[j].chiave === 'dischi') pag.r = j;
    }
    // (niente animazione d'entrata: banner e file che salivano in dissolvenza nel primo secondo e mezzo raddoppiavano i livelli
    // della scheda video proprio quando il TV prepara l'app, e il 31/10 il TV ha chiuso il servizio all'apertura di Real4K)
    evidenzia();
    if (vetrina) vetrinaTimer();
    // l'apertura se ne va quando l'inizio e' quello vero: la vetrina coi film, o senza Jellyfin (o con un problema) le file
    // semplici. Mentre Jellyfin manda le file si aspetta (al massimo 9 s, vedi index.html)
    if (vetrina || dischiErrore || jf.errore || (jf.stato && !jfAttivo())) apertura(true);
  }
  // un problema che ferma tutto (il permesso, il servizio del TV vecchio o che non risponde): grande al centro. Le chiavette
  // che il TV non legge sono una riga piccola nel riquadro del Mac
  function disegnaVuoto(quantiContinua) {
    var v = $('vuoto'), c = dischiErrore && dischiErrore.codice, t = '', x = '';
    if (c === 'vecchio') { t = 'Su questo TV Real4K non si apre ancora'; x = 'Riavvia il TV: Home TV si aggiorna da sola. Se resta così, su questo modello arriverà con un prossimo aggiornamento.'; }
    else if (c === 'negato') { t = 'Apri Real4K dalla home di Home TV'; x = 'I film del Mac e delle chiavette si vedono solo dentro Home TV, sul TV.'; }
    else if ((c === 'servizio' || c === 'lento') && !jfAttivo()) { t = 'Il servizio del TV non risponde'; x = 'Riapri Home TV; se continua, riavvia il TV.'; }
    v.hidden = !t;
    if (!t) return false;
    $('vuoto-titolo').textContent = t;
    $('vuoto-testo').textContent = x;
    v.className = quantiContinua ? '' : 'solo';
    return true;
  }
  function durataResta(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return 'meno di un minuto';
    var m = Math.round(sec / 60);
    return m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min';
  }
  // una carta di Continua a guardare (chiavetta): l'immagine del film, il titolo sopra, quanto manca, la barra
  function cartaContinua(x, fila) {
    var c = el('div', 'carta oriz'), q = el('div', 'quadro'), t = titoloDi(x.nome), presente = !!trovaDisco(x.d);
    c.setAttribute('data-chiave', 'punto:' + x.p);
    c.setAttribute('data-tv', '');
    if (!presente && dischi.length) c.className += ' manca';
    q.appendChild(finta(t.titolo, t.episodio ? 'S' + t.stagione + ' E' + t.episodio : t.anno, t.episodio ? 'puntata' : 'film'));
    var b = el('div', 'barra'), f = el('i');
    f.style.width = Math.min(100, Math.round(x.t / Math.max(1, x.dur) * 100)) + '%';
    b.appendChild(f);
    q.appendChild(b);
    var sc = el('div', 'scritta'), nome = el('div', 'nome', etichetta(x.nome));
    sc.appendChild(nome);
    sc.appendChild(el('div', 'sotto', presente || !dischi.length ? 'Mancano ' + durataResta(x.dur - x.t) : 'Attacca la chiavetta di questo film'));
    q.appendChild(sc);
    c.appendChild(q);
    c.addEventListener('click', function () { riprendi(x, 'inizio'); });
    c.info = function () {
      return { sopra: t.episodio ? 'Puntata' : 'Film', titolo: t.titolo, prima: t.episodio ? 'S' + t.stagione + ' E' + t.episodio : '', meta: [t.anno ? String(t.anno) : '', nomeDisco(x.d)].filter(Boolean),
        trama: presente || !dischi.length ? '' : 'Attacca la chiavetta di questo film per riprenderlo.',
        dopo: presente ? function (cb) { chiediScheda(x.d, x.p, false, function (s) { if (s) cb(infoDaScheda(s, x.d)); }); } : null };
    };
    fila.appendChild(c);
    if (presente) {
      chiediScheda(x.d, x.p, false, function (s) {
        if (!s || !c.parentNode) return;
        nome.textContent = s.tipo === 'puntata' && s.serie ? s.serie.titolo + ' · S' + s.stagione + ' E' + s.episodio : s.titolo + (s.anno ? ' (' + s.anno + ')' : '');
        var ref = s.img.landscape || s.img.fanart || s.img.poster;
        // l'immagine solo quando la carta e' vicina alla scelta (come le altre carte)
        if (ref) {
          c.carica = function () { mettiImg(q, x.d, ref, 448, 252, false, function (si) { var f0 = q.querySelector('.finta'); if (si && f0) f0.style.opacity = '0'; }); };
          caricaVicine();
        }
      });
    }
    return c;
  }
  // una carta piccola: icona, nome, stato (chiavette, Altro)
  function cartaPiccola(chiave, ic, nome, stato, fn) {
    var c = el('div', 'carta piccola'), q = el('div', 'quadro'), sc = el('div', 'scritta');
    c.setAttribute('data-tv', '');
    c.setAttribute('data-chiave', chiave);
    q.appendChild(icona(ICONE[ic]));
    sc.appendChild(el('div', 'nome', nome));
    if (stato) sc.appendChild(el('div', 'stato', stato));
    q.appendChild(sc);
    c.appendChild(q);
    c.addEventListener('click', fn);
    return c;
  }
  // la riga anno · durata · voto · classificazione · generi
  function metaDi(box, s, info, prima) {
    svuota(box);
    function pezzo(t, cl) { if (t) box.appendChild(el('span', cl || '', t)); }
    pezzo(prima);
    pezzo(s.anno ? String(s.anno) : '');
    var min = s.durata || (info && info.durata ? info.durata / 60 : 0) || (s.secondi ? s.secondi / 60 : 0);
    if (min > 2) pezzo(durataBella(min));
    if (s.voto) pezzo('★ ' + String(s.voto).replace('.', ','), 'voto');
    pezzo(s.generi && s.generi.length ? s.generi.slice(0, 3).join(', ') : '');
    pezzo(s.classificazione, 'cert');
  }
  // le informazioni della voce scelta, per il banner o in alto sopra le file: dalla scheda (Jellyfin o chiavetta)
  function tipoNome(s) {
    return s.tipo === 'serie' ? 'Serie' : s.tipo === 'puntata' ? 'Puntata' : s.tipo === 'collezione' ? 'Collezione' : s.tipo === 'stagione' ? 'Stagione' :
      s.tipo === 'cartella' ? 'Cartella' : 'Film';
  }
  function infoDaScheda(s, d) {
    var serie = s.tipo === 'puntata' && s.serie, fs = s.serie && s.serie.img ? s.serie.img : {};
    return { s: s, d: d || '', sopra: tipoNome(s), titolo: serie ? s.serie.titolo : s.titolo,
      prima: s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') : '',
      logo: s.img.logo || fs.logo || null, trama: s.trama || (s.serie && s.serie.trama) || '',
      sfondo: s.img.fanart || s.img.landscape || fs.fanart || s.img.poster || null, nitido: !!(s.img.fanart || s.img.landscape || fs.fanart) };
  }
  var eroeGiro = 0, eroeChiave = '';
  function riempiEroe(x) {
    var chiave = [x.s ? x.s.id || x.s.titolo : '', x.titolo, x.sopra, x.nuovo ? 1 : 0, x.prima, (x.meta || []).join('|'), x.trama ? x.trama.length : 0].join('\u0001');
    if (chiave === eroeChiave) { if (x.sfondo) sfondo(x.d || '', x.sfondo, x.nitido !== false); else sfondo(null); return; }
    eroeChiave = chiave;
    var g = ++eroeGiro, logo = $('eroe-logo'), sopra = $('eroe-sopra'), meta = $('eroe-meta');
    // le carte di servizio (Altro, chiavette, Tutti i film): il titolo piu' piccolo, non e' un film
    if (x.s || x.nuovo) $('eroe').classList.remove('semplice'); else $('eroe').classList.add('semplice');
    svuota(sopra);
    if (x.nuovo) sopra.appendChild(el('b', '', 'Nuovo'));
    if (x.sopra) sopra.appendChild(document.createTextNode(x.sopra));
    svuota(logo);
    logo.appendChild(el('h1', '', x.titolo || ''));
    // il logo del titolo: quelli di Jellyfin dritti in un <img> (ridotti dal server), nelle file dopo una pausa di 220 ms;
    // quelli delle chiavette dalla tela (se gia' pronti arrivano subito: niente titolo scritto che lampeggia)
    if (x.logo && x.logo.jf && serv.gettone) {
      var url0 = urlImmagine('', x.logo, 500, 192, true);
      setTimeout(function () {
        if (g !== eroeGiro) return;
        var im0 = el('img');
        im0.alt = x.titolo || '';
        im0.onload = function () { if (g !== eroeGiro) return; svuota(logo); logo.appendChild(im0); im0.className = 'on'; };
        im0.src = url0;
      }, x.nuovo ? 0 : 220);
    } else if (x.logo) {
      piccola(x.d || '', x.logo, 500, 192, function (url) {
        if (!url || g !== eroeGiro) return;
        var im = el('img');
        im.alt = x.titolo || '';
        im.onload = function () { im.className = 'on'; };
        im.src = url;
        svuota(logo);
        logo.appendChild(im);
      }, true, function () { return g === eroeGiro; });
    }
    if (x.s) metaDi(meta, x.s, null, x.prima || '');
    else { svuota(meta); if (x.prima) meta.appendChild(el('span', '', x.prima)); (x.meta || []).forEach(function (t) { meta.appendChild(el('span', '', t)); }); }
    $('eroe-trama').textContent = x.trama || '';
    if (x.sfondo) sfondo(x.d || '', x.sfondo, x.nitido !== false); else sfondo(null);
  }
  // in alto, sopra le file: la voce scelta (il suo titolo, l'anno, la trama, l'immagine)
  function mostraInfo(e) {
    if (!e) return;
    var x = typeof e.info === 'function' ? e.info() : e.info;
    riempiEroe(x || { titolo: '' });
    if (x && x.dopo) x.dopo(function (y) { if (sceltaPagina() === e) riempiEroe(y); });
  }

  /* ---------------------------------------------------------- il banner: i film arrivati da poco, che cambiano da soli */

  var vetr = { slide: [], k: 0, timer: null, dissolvi: null, giri: 0 };
  // i film nuovi con un'immagine grande (il banner senza immagine e' brutto); se sono pochi, anche le serie. Al massimo tre
  // (31/10: erano sei, e a ogni cambio logo e sfondo da scaricare e disegnare)
  function slideDi(d) {
    function conSfondo(it) { return !!JF.scheda(it).img.fanart; }
    var l = d.nuovi.filter(function (it) { return it.Type === 'Movie' && conSfondo(it); });
    if (l.length < 3) l = l.concat(d.nuovi.filter(function (it) { return it.Type !== 'Movie' && conSfondo(it); }));
    if (!l.length) l = d.nuovi.slice(0, 1);
    return l.slice(0, 3);
  }
  function infoSlide(it) { var x = infoDaScheda(JF.scheda(it), ''); x.nuovo = true; return x; }
  function mostraSlide(k) {
    var it = vetr.slide[k];
    if (!it) return;
    vetr.k = k;
    riempiEroe(infoSlide(it));
    var s = JF.scheda(it), pp = $('eroe-pulsanti'), ripr = riprendibileJf(s), film = s.tipo !== 'serie';
    svuota(pp);
    pp.appendChild(pulsante(film ? ripr ? 'Riprendi' : 'Guarda' : 'Episodi', 'play', function () {
      if (film) guardaJf(it, { ritorno: tornaInizio, t: ripr ? s.punto : 0 }); else apriJf(it, { indietro: tornaInizio });
    }, ripr ? 'da ' + tempo(s.punto) : ''));
    pp.appendChild(pulsante('Dettagli', 'info', function () { apriJf(it, { indietro: tornaInizio }); }));
    var punti0 = $('eroe-punti');
    svuota(punti0);
    if (vetr.slide.length > 1) for (var i = 0; i < vetr.slide.length; i++) punti0.appendChild(el('i', i === k ? 'on' : ''));
    for (var r = 0; pag && r < pag.righe.length; r++) {
      if (pag.righe[r].chiave === 'eroe') { pag.righe[r].voci = vociDi(pp); pag.righe[r].k = Math.min(pag.righe[r].k, pp.children.length - 1); }
    }
  }
  // il film dopo (o prima): il testo sparisce piano, cambia, ritorna; l'immagine passa sopra la vecchia
  function cambiaSlide(dir, daSolo) {
    if (vetr.slide.length < 2) return;
    var k = (vetr.k + dir + vetr.slide.length) % vetr.slide.length, d0 = $('eroe-dentro');
    d0.classList.add('via');
    clearTimeout(vetr.dissolvi);
    vetr.dissolvi = setTimeout(function () {
      mostraSlide(k);
      d0.classList.remove('via');
      if (schermo === 'inizio' && pag && pag.righe[pag.r] && pag.righe[pag.r].chiave === 'eroe') evidenzia();
    }, 230);
    vetrinaTimer(daSolo);
  }
  // dopo 20 secondi senza tasti, se si e' sul banner (31/10: erano 9); dopo un giro di tutti i film si ferma (riparte al primo tasto)
  function vetrinaTimer(daSolo) {
    clearTimeout(vetr.timer);
    if (!daSolo) vetr.giri = 0;
    if (vetr.slide.length < 2 || vetr.giri >= vetr.slide.length) return;
    vetr.timer = setTimeout(function () {
      if (schermo !== 'inizio') return;
      if (fermoAperto() || bin.aperto || !pag || !pag.righe[pag.r] || pag.righe[pag.r].chiave !== 'eroe') { vetrinaTimer(true); return; }
      vetr.giri++;
      cambiaSlide(1, true);
    }, 20000);
  }
  function fermaVetrina() { clearTimeout(vetr.timer); clearTimeout(vetr.dissolvi); var d0 = $('eroe-dentro'); if (d0) d0.classList.remove('via'); }
  // la vetrina col telecomando: sul banner il film grande e la prima fila che si affaccia in basso; nelle file la fila scelta a
  // meta' schermo, quelle sopra spariscono, in alto le informazioni della voce scelta (l'immagine piu' piccola, in alto a destra)
  function disponiVetrina(R, e) {
    var sch = $('schermo-inizio'), H = window.innerHeight, eroe = R.chiave === 'eroe', prima = null, y, r;
    for (r = 0; r < pag.righe.length; r++) if (pag.righe[r].chiave !== 'eroe') { prima = pag.righe[r]; break; }
    y = eroe ? H * 0.86 - (prima ? altezzaIn(prima.sezione, pag.corpo) : 0) : H * 0.5 - altezzaIn(R.sezione, pag.corpo);
    pag.corpo.style.transform = 'translateY(' + Math.round(y) + 'px)';
    if (eroe) sch.classList.remove('righe'); else sch.classList.add('righe');
    modoSfondo(eroe ? 'eroe' : 'righe');
    for (r = 0; r < pag.righe.length; r++) {
      var s = pag.righe[r].sezione;
      if (!s || s === $('eroe')) continue;
      if (!eroe && r < pag.r) s.classList.add('sopra'); else s.classList.remove('sopra');
    }
    if (eroe) riempiEroe(infoSlide(vetr.slide[vetr.k]));
    else mostraInfo(e);
  }

  /* ---------------------------------------------------------- il binario a sinistra: Home, Cerca, La mia lista, Film... */

  var bin = { aperto: false, k: 0, voci: [] };
  function disegnaBinario() {
    var box = $('binario-voci'), d = jfAttivo() ? jf.dati : null, l = [];
    svuota(box);
    l.push({ id: 'casa', ic: 'casa', nome: 'Home', fn: function () { chiudiBinario(true); vaiRiga(0); } });
    if (jfAttivo()) l.push({ id: 'cerca', ic: 'cerca', nome: 'Cerca', fn: function () { apriCerca(tornaInizio); } });
    if (d && d.preferiti.length) l.push({ id: 'lista', ic: 'lista', nome: 'La mia lista', fn: function () {
      apriLibreriaJf({ titolo: 'La mia lista', query: { Filters: 'IsFavorite', IncludeItemTypes: 'Movie,Series', Recursive: true }, indietro: tornaInizio });
    } });
    if (d && d.film && d.film.tot) l.push({ id: 'film', ic: 'film', nome: 'Film', fn: function () { apriTuttiJf('Movie'); } });
    if (d && d.serie && d.serie.tot) l.push({ id: 'serie', ic: 'serie', nome: 'Serie', fn: function () { apriTuttiJf('Series'); } });
    if (dischi.length) l.push({ id: 'chiavette', ic: 'chiavetta', nome: 'Chiavette USB', fn: function () {
      if (dischi.length === 1) apriDisco(dischi[0].id); else { chiudiBinario(true); vaiRiga('dischi'); }
    } });
    l.push({ id: 'altro', ic: 'impostazioni', nome: 'Altro', fn: function () { chiudiBinario(true); vaiRiga('altro'); } });
    var idScelto = bin.voci[bin.k] ? bin.voci[bin.k].id : '';
    bin.voci = l;
    for (var b0 = 0; b0 < l.length; b0++) if (l[b0].id === idScelto) bin.k = b0;
    if (bin.k >= l.length) bin.k = l.length - 1;
    l.forEach(function (x, i) {
      var e = el('div', 'bv' + (x.id === 'casa' ? ' qui' : '') + (bin.aperto && i === bin.k ? ' sel' : ''));
      e.setAttribute('data-chiave', 'binario:' + x.id);
      e.appendChild(icona(ICONE[x.ic]));
      e.appendChild(el('span', '', x.nome));
      e.addEventListener('click', function () { bin.k = i; x.fn(); });
      box.appendChild(e);
    });
  }
  function segnaBinario() {
    var l = $('binario-voci').children;
    for (var i = 0; i < l.length; i++) { if (i === bin.k && bin.aperto) l[i].classList.add('sel'); else l[i].classList.remove('sel'); }
  }
  function apriBinario() {
    bin.aperto = true;
    bin.k = 0;
    $('binario').className = 'aperto';
    $('schermo-inizio').classList.add('binario');
    segnaBinario();
  }
  function chiudiBinario(senzaScelta) {
    if (!bin.aperto) return;
    bin.aperto = false;
    $('binario').className = '';
    $('schermo-inizio').classList.remove('binario');
    segnaBinario();
    if (!senzaScelta && schermo === 'inizio') evidenzia();
  }
  function tastoBinario(a) {
    if (a === 'up' && bin.k > 0) { bin.k--; segnaBinario(); }
    else if (a === 'down' && bin.k < bin.voci.length - 1) { bin.k++; segnaBinario(); }
    else if (a === 'right') chiudiBinario();
    else if (a === 'ok') { var e = $('binario-voci').children[bin.k]; if (e) e.click(); }
    return true;
  }
  // una riga per chiave (o per numero): la scelta ci va, sulla prima voce
  function vaiRiga(chiave) {
    if (!pag) return false;
    for (var r = 0; r < pag.righe.length; r++) {
      if (chiave === r || pag.righe[r].chiave === chiave) { if (!quanteIn(pag.righe[r])) continue; pag.r = r; pag.righe[r].k = 0; pag.mosso = true; evidenzia(); return true; }
    }
    return false;
  }
  // Film o Serie, tutti in griglia (con ordine e filtri): la libreria di Jellyfin, se e' una sola
  function apriTuttiJf(tipo) {
    var film = tipo === 'Movie', viste = (jf.dati && jf.dati.viste || []).filter(function (v) { return v.CollectionType === (film ? 'movies' : 'tvshows'); });
    if (viste.length === 1) apriLibreriaJf({ titolo: film ? 'Film' : 'Serie', vista: viste[0], indietro: tornaInizio });
    else apriLibreriaJf({ titolo: film ? 'Film' : 'Serie', query: { IncludeItemTypes: tipo, Recursive: true }, indietro: tornaInizio });
  }

  /* ---------------------------------------------------------- senza Jellyfin: "Guarda i film del tuo Mac", col codice
   * Si cerca il Mac nella rete di casa (Jellyfin risponde al broadcast); trovato, un pulsante lo collega (mai da soli: nelle prove
   * sul Mac risponderebbe il Jellyfin vero); poi il codice di 6 cifre, da scrivere sul Mac in Home TV Film › Collega il TV (o da
   * confermare con Quick Connect di Jellyfin). Quando il Mac lo conferma, l'inizio si riempie da solo. */

  var benv = { fase: '', giro: 0, timer: null, codice: '', codiceDa: 0, server: [], attivo: false };
  function disegnaBenvenuto(si) {
    $('benvenuto').hidden = !si;
    if (!si) { benvFerma(); return; }
    if (!benv.attivo) benvAvvia(); else benvDisegna();
  }
  function benvAvvia() {
    benv.attivo = true;
    var st = jf.stato || {};
    if (st.errore && !st.server) { benv.giro++; benv.fase = st.errore === 'assente' || st.errore === 'vecchio' ? 'vecchio' : 'errore'; benvDisegna(); }
    // il codice di prima vale ancora (il servizio lo tiene 10 minuti): non se ne fa uno nuovo, se no chi l'ha gia' scritto sul
    // Mac non collega piu' il TV
    else if (st.server && benv.codice && Date.now() - benv.codiceDa < 540000) benvAspetta(++benv.giro);
    else if (st.server) benvCodice();
    else benvCerca();
  }
  function benvFerma() { benv.giro++; benv.attivo = false; clearTimeout(benv.timer); }
  function benvDopo(fn, ms) {
    var giro = benv.giro;
    clearTimeout(benv.timer);
    benv.timer = setTimeout(function () { if (giro === benv.giro && schermo === 'inizio' && benv.attivo) fn(); }, ms);
  }
  function benvCerca() {
    var giro = ++benv.giro;
    clearTimeout(benv.timer);
    benv.fase = 'cerca';
    benv.server = [];
    benvDisegna();
    chiedi('jf/cerca').then(function (r) {
      if (giro !== benv.giro) return;
      benv.server = (r.server || []).slice(0, 3);
      benv.fase = benv.server.length ? 'scegli' : 'nessuno';
      benvDisegna();
      if (!benv.server.length) benvDopo(benvCerca, 20000);
    }, function (e) {
      if (giro !== benv.giro) return;
      benv.fase = e.codice === 'assente' || e.codice === 'vecchio' ? 'vecchio' : 'nessuno';
      benvDisegna();
      if (benv.fase === 'nessuno') benvDopo(benvCerca, 20000);
    });
  }
  function benvScegli(indirizzo) {
    var giro = ++benv.giro;
    clearTimeout(benv.timer);
    benv.fase = 'collego';
    benv.dove = indirizzo;
    benvDisegna();
    chiedi('jf/server', null, { indirizzo: indirizzo }).then(function (r) {
      if (giro !== benv.giro) return;
      jf.stato = r;
      benvCodice();
    }, function (e) {
      if (giro !== benv.giro) return;
      messaggio(erroreServer(e, indirizzo), 5000);
      benv.fase = benv.server.length ? 'scegli' : 'nessuno';
      benvDisegna();
    });
  }
  function benvCodice() {
    var giro = ++benv.giro;
    clearTimeout(benv.timer);
    benv.fase = 'prepara';
    benvDisegna();
    chiedi('jf/qc', null, {}).then(function (r) {
      if (giro !== benv.giro) return;
      benv.codice = String(r.codice || '');
      benv.codiceDa = Date.now();
      benvAspetta(giro);
    }, function (e) {
      if (giro !== benv.giro) return;
      benv.fase = e.codice === 'quickconnect' ? 'qcspento' : 'giu';
      benvDisegna();
      if (benv.fase === 'giu') benvDopo(benvCodice, 20000);
    });
  }
  // il codice e' sul TV: si aspetta che il Mac (o il telefono) lo confermi
  function benvAspetta(giro) {
    clearTimeout(benv.timer);
    benv.fase = 'codice';
    benvDisegna();
    (function controlla() {
      benvDopo(function () {
        chiedi('jf/qc').then(function (s) {
          if (giro !== benv.giro || schermo !== 'inizio') return;
          if (s.stato === 'fatto') { benv.codice = ''; benvFerma(); collegato(); return; }
          // scaduto, o il servizio non lo conosce piu' (e' ripartito): un codice nuovo
          if (s.stato === 'scaduto' || s.stato === 'nessuno') { benv.codice = ''; benvCodice(); return; }
          controlla();
        }, function () { if (giro === benv.giro) controlla(); });
      }, 2500);
    })();
  }
  // un codice di 6 cifre in caselle (a gruppi di tre)
  function cifreIn(box, codice) {
    svuota(box);
    for (var i = 0; i < codice.length; i++) box.appendChild(el('span', 'cifra' + (i === 2 && codice.length === 6 ? ' meta3' : ''), codice.charAt(i)));
  }
  function benvIndirizzo() {
    HomeTV.chiediTesto({ titolo: 'Indirizzo del Mac (es. 192.168.1.20:8096)', valore: '' }).then(function (t) { if (t) benvScegli(t); });
  }
  function benvDisegna() {
    var nome = jf.stato && jf.stato.server ? jf.stato.server.nome || 'Jellyfin' : 'Jellyfin', t = '', stato = '', nota = '', p = [];
    var cerca = { testo: 'Cerca di nuovo', ic: 'cerca', fn: benvCerca }, scrivi = { testo: 'Scrivi l\'indirizzo', fn: benvIndirizzo };
    var altro = { testo: 'Un altro Mac', fn: benvCerca }, pw = { testo: 'Nome e password', fn: function () { collegaPassword(benvAvvia); } };
    if (benv.fase === 'cerca') { t = 'Cerco il Mac nella rete di casa…'; stato = 'Cerco…'; p = [scrivi]; }
    else if (benv.fase === 'scegli') {
      t = benv.server.length === 1 ? 'Ho trovato il tuo Mac. Collegalo: poi sul Mac scrivi il codice che compare qui.' : 'Ho trovato più Mac: scegli il tuo.';
      p = benv.server.map(function (s) { return { testo: 'Collega ' + (s.nome || 'Jellyfin'), ic: 'mac', fn: function () { benvScegli(s.indirizzo); } }; }).concat([scrivi]);
    } else if (benv.fase === 'nessuno') {
      t = 'Non trovo il Mac nella rete di casa. Accendilo e apri Home TV Film: il TV e il Mac devono stare sulla stessa Wi-Fi.';
      stato = 'Riprovo da solo';
      p = [cerca, scrivi];
    } else if (benv.fase === 'collego') { t = 'Mi collego a ' + String(benv.dove || '').replace(/^https?:\/\//, '') + '…'; }
    else if (benv.fase === 'prepara') { t = 'Preparo il codice…'; p = [altro]; }
    else if (benv.fase === 'codice') {
      t = 'Sul Mac apri Home TV Film, scegli «Collega il TV» e scrivi questo codice.';
      stato = 'Aspetto il Mac · ' + nome;
      nota = 'Usi Jellyfin? Il tuo profilo › Quick Connect, stesso codice.';
      p = [pw, altro];
    } else if (benv.fase === 'giu') { t = nome + ' non risponde: il Mac è acceso, con Home TV Film aperta?'; stato = 'Riprovo da solo'; p = [{ testo: 'Riprova', ic: 'ripeti', fn: benvCodice }, altro]; }
    else if (benv.fase === 'qcspento') { t = 'Su questo Mac il collegamento col codice è spento: entra con nome e password.'; p = [pw, altro]; }
    else if (benv.fase === 'vecchio') { t = 'Il servizio di questo TV non sa ancora parlare col Mac: riavvia il TV per aggiornare Home TV.'; p = [{ testo: 'Riprova', ic: 'ripeti', fn: function () { jfCaricaStato(function () { benvFerma(); disegnaInizio('tieni'); }); } }]; }
    else if (benv.fase === 'errore') { t = 'Non riesco a parlare col servizio del TV: riprova tra poco.'; p = [{ testo: 'Riprova', ic: 'ripeti', fn: function () { jfCaricaStato(function () { benvFerma(); disegnaInizio('tieni'); }); } }]; }
    else t = 'Un attimo…';
    $('benv-testo').textContent = t;
    var cod = $('benv-codice');
    svuota(cod);
    cod.hidden = benv.fase !== 'codice';
    if (benv.fase === 'codice') cifreIn(cod, benv.codice);
    var st = $('benv-stato');
    svuota(st);
    if (stato) { st.appendChild(el('i')); st.appendChild(document.createTextNode(stato)); }
    // le chiavette: se non ce ne sono, una riga per dire che si puo'
    var c = dischiErrore && dischiErrore.codice;
    if (!nota && !dischi.length) nota = c === 'permesso' ? 'Le chiavette: il TV non lascia leggerle (si vede in «Questo TV»).' : c === 'nonPrevisto' ? 'Su questo TV le chiavette non si leggono ancora.' :
      'Hai un film su una chiavetta? Attaccala al TV: compare qui sotto.';
    $('benv-nota').textContent = nota;
    var pp = $('benv-pulsanti'), scelto = pp.querySelector('.sel'), testoScelto = scelto ? scelto.textContent : '';
    svuota(pp);
    p.forEach(function (x) { pp.appendChild(pulsante(x.testo, x.ic || '', x.fn)); });
    // la riga del telecomando: i pulsanti nuovi
    for (var r = 0; !disegnando && pag && pag.corpo === $('inizio-corpo') && r < pag.righe.length; r++) {
      if (pag.righe[r].chiave !== 'benvenuto') continue;
      pag.righe[r].voci = vociDi(pp);
      pag.righe[r].k = Math.min(pag.righe[r].k, Math.max(0, pp.children.length - 1));
      for (var q = 0; testoScelto && q < pp.children.length; q++) if (pp.children[q].textContent === testoScelto) pag.righe[r].k = q;
      if (pag.r === r && schermo === 'inizio') evidenzia();
    }
  }
  // un film di Continua a guardare: sulla stessa chiavetta, oppure su un'altra attaccata (la lettera puo' cambiare)
  function riprendi(x, ritorno) {
    var prove = [x.d].concat(dischi.map(function (d) { return d.id; }).filter(function (id) { return id !== x.d; }));
    (function prova(k) {
      if (k >= prove.length) { messaggio('Non trovo "' + etichetta(x.nome) + '": attacca la sua chiavetta', 5000); return; }
      chiedi('info', { d: prove[k], p: x.p, lingue: lingueDi({ d: prove[k], p: x.p, nome: x.nome }) }).then(function (info) {
        if (x.dim && info.dim !== x.dim) { prova(k + 1); return; }
        // anche la sua cartella: le puntate dopo e i sottotitoli accanto
        var dove = x.p.indexOf('/') === -1 ? '' : x.p.slice(0, x.p.lastIndexOf('/')), voce = { d: prove[k], p: x.p, nome: x.nome, dim: info.dim };
        chiedi('cartella', { d: prove[k], p: dove }).then(function (c) {
          apriVideo(voce, { info: info, vicini: c.video || [], cartella: dove, sotto: c.sotto || [], daCapo: x.daCapo, t: x.t, ritorno: ritorno });
        }, function () { apriVideo(voce, { info: info, vicini: null, daCapo: x.daCapo, t: x.t, ritorno: ritorno }); });
      }, function () { prova(k + 1); });
    })(0);
  }

  /* ============================================================ Jellyfin: il server di casa, dal ponte del servizio
   * Il servizio del TV parla con UN server Jellyfin (scelto qui, salvato li' col suo token: l'app non lo vede mai). Le
   * file dell'inizio, le schede, le persone, la ricerca e il lettore usano le stesse pagine delle chiavette. */

  var jf = { stato: null, dati: null, caricato: 0, giro: 0, errore: '', riprova: null };
  function uid() { return jf.stato && jf.stato.utente ? jf.stato.utente.id : ''; }
  function jfAttivo() { return !!uid(); }
  function lettiTv() { return jf.stato && jf.stato.letti ? jf.stato.letti : null; }
  function voci(r) { return r && Array.isArray(r.Items) ? r.Items : Array.isArray(r) ? r : []; }
  // i campi e le immagini da chiedere nelle liste (pochi: il TV ha poca memoria)
  // (Jellyfin 12.4: le rotte nuove, con userId nella domanda: /Items, /UserViews, /UserItems/Resume, /UserFavoriteItems...)
  function conCampi(o) {
    if (!o.UserId && !o.userId) o.userId = uid();
    o.Fields = o.Fields || JF.CAMPI;
    o.EnableImageTypes = 'Primary,Backdrop,Thumb,Logo';
    o.ImageTypeLimit = 1;
    o.EnableUserData = true;
    return o;
  }
  function jfCaricaStato(poi) {
    chiedi('jf/stato').then(function (r) { jf.stato = r; if (poi) poi(); }, function (e) {
      // un servizio senza il ponte (TV non aggiornato): niente Jellyfin, le chiavette restano
      jf.stato = { server: null, utente: null, errore: e.codice };
      if (poi) poi();
    });
  }
  // il limitatore del Mac (mac/ nel servizio): toglie i picchi dei film troppo pesanti; la chiave la tiene il servizio
  var mac = { stato: null };
  // il tetto del TV (lo tiene il servizio): oltre questi Mbps il film puo' scattare
  var tettoTv = { scelta: '80', mbps: 80, prova: null, unione: 10 };
  function caricaTetto(poi) { chiedi('tv/tetto').then(function (r) { if (r && r.mbps > 0) tettoTv = r; if (poi) poi(); }, function () {}); }
  function macAttivo() { return !!(mac.stato && mac.stato.collegato); }
  function macCaricaStato(poi) {
    // (dal Mac il limitatore non c'e': passa dall'HLS, che dalla pagina del Mac non va)
    if (DAL_MAC) { mac.stato = null; if (poi) poi(); return; }
    chiedi('mac/stato').then(function (r) { mac.stato = r; if (poi) poi(); }, function () { mac.stato = null; if (poi) poi(); });
  }
  // per Jellyfin decide il server (le sue soglie: un punto lo salva solo se vale la pena riprendere)
  function riprendibileJf(s) { return !!s && !s.visto && s.punto > 1 && (!s.durata || s.punto < s.durata * 60 - 1); }
  function sottoJf(s) {
    if (s.tipo === 'puntata') return 'S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '');
    if (s.tipo === 'serie') return (s.anno ? s.anno + ' · ' : '') + (s.figli ? s.figli + (s.figli === 1 ? ' stagione' : ' stagioni') : 'Serie');
    if (s.tipo === 'collezione') return s.figli ? s.figli + ' film' : 'Collezione';
    return [s.anno ? String(s.anno) : '', s.durata > 2 ? durataBella(s.durata) : ''].filter(Boolean).join(' · ') || 'Film';
  }

  // le file dell'inizio, tutte insieme (al massimo ogni minuto); si ridisegna quando arrivano. Le collezioni: ognuna coi suoi
  // film (servono per le file e per "Altri della collezione" nella scheda); Film e Serie: quanti sono, le pagine quando la fila
  // si avvicina. Le domande passano da chiediJf, due o tre alla volta
  function jfCaricaInizio(forza) {
    if (!jfAttivo()) { jf.dati = null; return; }
    if (!forza && jf.dati && Date.now() - jf.caricato < 60000) return;
    if (!forza && jf.inCorso && Date.now() - jf.inCorso < 30000) return;
    var giro = ++jf.giro, u = uid(), d = { riprendi: [], prossimi: [], viste: [], nuovi: [], collezioni: [], preferiti: [], film: null, serie: null };
    // le collezioni (una domanda per collezione) e le file Film e Serie cambiano di rado: si tengono 10 minuti
    var lenti = forza !== 'tutto' && jf.lenti && jf.lenti.utente === u && Date.now() - jf.lenti.quando < 600000 ? jf.lenti : null, arrivati = 0;
    jf.caricato = Date.now();
    jf.inCorso = Date.now();
    // due domande cadute per la rete bastano (il Mac spento o muto: il servizio rinuncia dopo 15 s): quelle ancora in fila non
    // partono, quelle in volo non si aspettano e si dice subito che il Mac non risponde (31/10: con due o tre domande alla volta
    // arrivava dopo 33 s invece di 15)
    var cadute = 0, giu = null, giuArrivato = new Promise(function (ok) { giu = ok; }), gr = 'inizio' + giro;
    function no(e) {
      if (e && (e.codice === 'rete' || e.codice === 'servizio' || e.codice === 'lento') && ++cadute === 2 && giro === jf.giro) {
        jfGiu(gr);
        var x = erroreCon('rete');
        giu([x, x, x]);
      }
      return e;
    }
    Promise.race([giuArrivato, Promise.all([
      chiediJf('UserItems/Resume', conCampi({ Limit: 12, MediaTypes: 'Video' }), null, null, '', gr).then(function (r) { d.riprendi = voci(r); }, no),
      chiediJf('Shows/NextUp', conCampi({ UserId: u, Limit: 12, EnableResumable: false }), null, null, '', gr).then(function (r) { d.prossimi = voci(r); }, no),
      chiediJf('UserViews', { userId: u }, null, null, '', gr).then(function (r) {
        d.viste = voci(r).filter(function (x) { return /^(movies|tvshows|homevideos|boxsets|mixed)$/.test(x.CollectionType || 'mixed'); });
        return Promise.all(d.viste.filter(function (x) { return x.CollectionType !== 'boxsets'; }).slice(0, 4).map(function (vista) {
          return chiediJf('Items/Latest', conCampi({ ParentId: vista.Id, Limit: 16, GroupItems: true }), null, null, '', gr).then(function (r2) { d.nuovi = d.nuovi.concat(voci(r2)); }, no);
        }));
      }, no),
      chiediJf('Items', conCampi({ Filters: 'IsFavorite', IncludeItemTypes: 'Movie,Series', Recursive: true, SortBy: 'DatePlayed,SortName',
        SortOrder: 'Descending', Limit: 30 }), null, null, '', gr).then(function (r) { d.preferiti = voci(r); }, no),
      lenti ? Promise.resolve(d.film = lenti.film) : elencoJf('Movie', gr).then(function (x) { d.film = x; arrivati++; }, no),
      lenti ? Promise.resolve(d.serie = lenti.serie) : elencoJf('Series', gr).then(function (x) { d.serie = x; arrivati++; }, no)
    ])]).then(function (r) {
      if (giro !== jf.giro) return;
      jf.inCorso = 0;
      // i nuovi di tutte le librerie insieme, i piu' recenti prima
      d.nuovi.sort(function (a, b) { return (Date.parse(b.DateCreated || '') || 0) - (Date.parse(a.DateCreated || '') || 0); });
      d.nuovi = d.nuovi.slice(0, 20);
      var rete = r.filter(function (x) { return x && (x.codice === 'rete' || x.codice === 'servizio' || x.codice === 'lento'); }).length;
      jf.errore = rete >= 3 ? 'rete' : '';
      if (r.some(function (x) { return x && x.codice === 'accesso'; })) { jf.dati = null; if (jf.stato) jf.stato.utente = null; }
      else if (jf.errore) { jf.dati = null; jf.caricato = 0; }
      else {
        d.utente = u;
        // le collezioni: quelle tenute (10 minuti), o intanto quelle di prima (niente file che spariscono e ritornano)
        d.collezioni = lenti ? lenti.collezioni : jf.dati && jf.dati.utente === u ? jf.dati.collezioni : [];
        jf.dati = d;
      }
      ridisegnaJf();
      if (jf.dati) segnaPasso('r4k-fila');
      // il Mac spento: si riprova da soli ogni 30 secondi finche' si sta all'inizio
      clearTimeout(jf.riprova);
      if (jf.errore) jf.riprova = setTimeout(function () { if (schermo === 'inizio' && jfAttivo()) jfCaricaInizio(true); }, 30000);
      if (lenti || jf.dati !== d) return;
      // poi le collezioni (una domanda per collezione): arrivano dopo, l'inizio non le aspetta
      var dc = { collezioni: [] };
      caricaCollezioni(dc).then(function (tutte) {
        if (giro !== jf.giro || jf.dati !== d) return;
        d.collezioni = dc.collezioni;
        // (si tengono 10 minuti solo se e' arrivato tutto: una fila vuota per un errore non resta)
        if (tutte && arrivati === 2) jf.lenti = { quando: Date.now(), utente: u, collezioni: d.collezioni, film: d.film, serie: d.serie };
        ridisegnaJf();
      }, function () {});
    });
  }
  // l'inizio si ridisegna solo se le file di Jellyfin sono cambiate davvero (tornando da un film si ricaricano: se sono uguali
  // niente lavoro per il TV)
  function firmaJf() {
    var d = jf.dati;
    if (!d) return 'niente|' + jf.errore;
    function ids(l) { return (l || []).map(function (it) { var x = it.UserData || {}; return it.Id + (x.Played ? 'v' : '') + Math.round(x.PlayedPercentage || 0) + (x.IsFavorite ? 'f' : ''); }).join(','); }
    return [ids(d.riprendi), ids(d.prossimi), ids(d.nuovi), ids(d.preferiti), d.collezioni.map(function (c) { return c.it.Id + ':' + ids(c.voci); }).join(';'),
      d.film ? d.film.tot : 0, d.serie ? d.serie.tot : 0, jf.errore].join('|');
  }
  function ridisegnaJf() {
    var f = firmaJf();
    if (f === jf.firma && schermo === 'inizio' && pag && pag.corpo === $('inizio-corpo')) return;
    jf.firma = f;
    if (schermo === 'inizio') disegnaInizio('tieni');
  }
  // le collezioni (BoxSet): quelle di TheMovieDb e quelle che fa l'app del Mac. L'ordine lo decide il Mac col nome per ordinare
  // ("01 MCU", "02 ..."): prima quelle col numero, poi le altre per nome (JF.ordinaCollezioni). Al massimo 40, dalla fila di
  // sfondo di chiediJf: passano dopo le domande che servono adesso (una scheda aperta intanto non le aspetta)
  function caricaCollezioni(d) {
    return chiediJf('Items', conCampi({ IncludeItemTypes: 'BoxSet', Recursive: true, SortBy: 'SortName', Limit: 100, Fields: JF.CAMPI + ',SortName,Tags,ProviderIds' }), null, null, 'sfondo').then(function (r) {
      var l = JF.ordinaCollezioni(voci(r)).filter(function (it) { return !(it.ChildCount >= 0) || it.ChildCount >= 2; }).slice(0, 40), k = 0, mancate = 0;
      d.collezioni = l.map(function (it) { return { it: it, voci: [] }; });
      function prossima() {
        var c = d.collezioni[k++];
        if (!c) return Promise.resolve();
        // (con l'utente e Recursive, come dice il contratto con l'app del Mac: senza, Jellyfin ne da' 0)
        return chiediJf('Items', conCampi({ ParentId: c.it.Id, IncludeItemTypes: 'Movie,Series', Recursive: true, SortBy: 'PremiereDate,ProductionYear,SortName',
          SortOrder: 'Ascending', Limit: 60 }), null, null, 'sfondo').then(function (r2) { c.voci = voci(r2).filter(function (it) { return it.Type !== 'BoxSet'; }); }, function () { mancate++; }).then(prossima);
      }
      return Promise.all([prossima(), prossima(), prossima(), prossima()]).then(function () { return !mancate; });
    });
  }
  // dopo una visione, un "Visto" o "La mia lista": la voce si aggiorna anche nelle file tenute 10 minuti (una domanda sola)
  function aggiornaVoceLenti(id) {
    var l = jf.lenti;
    if (!l || !id) return;
    chiediJf('Items/' + id, { userId: uid() }).then(function (it) {
      if (jf.lenti !== l || !it || !it.Id) return;
      function cambia(lista) { for (var i = 0; lista && i < lista.length; i++) if (lista[i] && lista[i].Id === it.Id) lista[i] = it; }
      l.collezioni.forEach(function (c) { cambia(c.voci); });
      if (l.film) cambia(l.film.voci);
      if (l.serie) cambia(l.serie.voci);
    }, function () {});
  }
  // le collezioni (gia' caricate) che contengono questo film
  function collezioniDi(id) {
    var out = [];
    (jf.dati ? jf.dati.collezioni : []).forEach(function (c) { for (var i = 0; i < c.voci.length; i++) if (c.voci[i].Id === id) { out.push(c); return; } });
    return out;
  }
  // una fila lunga (Film, Serie): tutti i titoli per nome, a pagine di 40. All'apertura solo quanti sono (una voce sola, senza
  // campi): le pagine arrivano quando la fila si avvicina, dalle sue carte in attesa (31/10: la prima pagina di Film, 91 KB coi
  // campi, partiva con tutto il resto anche con la fila in fondo)
  var PAGINA = 40;
  function elencoJf(tipo, gruppo) {
    var x = { tipo: tipo, tot: 0, voci: [], pagine: {} };
    return chiediJf('Items', { userId: uid(), IncludeItemTypes: tipo, Recursive: true, Limit: 1, EnableImages: false, EnableUserData: false }, null, null, '',
      gruppo).then(function (r) {
      x.tot = typeof r.TotalRecordCount === 'number' ? r.TotalRecordCount : voci(r).length;
      return x;
    });
  }
  function paginaElenco(x, k) {
    x.pagine[k] = 'in volo';
    return chiediJf('Items', conCampi({ IncludeItemTypes: x.tipo, Recursive: true, SortBy: 'SortName', SortOrder: 'Ascending', StartIndex: k * PAGINA, Limit: PAGINA })).then(function (r) {
      var l = voci(r);
      x.tot = typeof r.TotalRecordCount === 'number' ? r.TotalRecordCount : Math.max(x.tot, k * PAGINA + l.length);
      for (var i = 0; i < l.length; i++) x.voci[k * PAGINA + i] = l[i];
      x.pagine[k] = true;
    }, function (e) { x.pagine[k] = false; throw e; });
  }
  function caricaPaginaFila(x, k, chiave) {
    if (x.pagine[k]) return;
    var giro = jf.giro;
    paginaElenco(x, k).then(function () {
      if (giro !== jf.giro || schermo !== 'inizio' || !pag) return;
      for (var r = 0; r < pag.righe.length; r++) if (pag.righe[r].chiave === chiave) { svuotaRiga(pag.righe[r]); evidenzia(); }
    }, function () {
      // non arrivata: si riprova da sola dopo 5 s, se la fila ha ancora disegnate carte di quella pagina (31/10: aspettava il
      // primo tasto)
      setTimeout(function () {
        if (giro !== jf.giro || schermo !== 'inizio' || !pag || x.pagine[k]) return;
        for (var r = 0; r < pag.righe.length; r++) {
          var R = pag.righe[r];
          if (R.chiave !== chiave) continue;
          for (var i in R.voci) if (Object.prototype.hasOwnProperty.call(R.voci, i) && Math.floor(+i / PAGINA) === k) { caricaPaginaFila(x, k, chiave); return; }
        }
      }, 5000);
    });
  }
  // Continua a guardare: le chiavette (la memoria dell'app) e Jellyfin (il punto lo tiene il server), i piu' recenti prima;
  // poi i prossimi episodi delle serie iniziate
  function continuaTutti() {
    var l = continua().map(function (x) { return { x: x, quando: x.quando }; }), serie = {};
    if (jf.dati) jf.dati.riprendi.forEach(function (it) { var s = JF.scheda(it); if (it.SeriesId) serie[it.SeriesId] = 1; l.push({ jf: it, s: s, quando: s.ultimaVolta }); });
    l.sort(function (a, b) { return b.quando - a.quando; });
    if (jf.dati) jf.dati.prossimi.forEach(function (it) {
      if (it.SeriesId && serie[it.SeriesId]) return;
      if (it.SeriesId) serie[it.SeriesId] = 1;
      l.push({ jf: it, s: JF.scheda(it), quando: 0, prossimo: true });
    });
    return l.slice(0, 16);
  }
  // una carta di Jellyfin: poster (2:3) o orizzontale (16:9, il titolo sopra l'immagine); l'immagine quando la fila si
  // avvicina (vedi caricaVicine). Nelle file lunghe la mette nella pagina la fila (fila null)
  function cartaJf(it, forma, fila, opz) {
    opz = opz || {};
    var s = JF.scheda(it), poster = forma === 'poster', c = el('div', 'carta' + (poster ? ' poster' : ' oriz')), q = el('div', 'quadro');
    var titolo = s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo;
    c.setAttribute('data-chiave', 'jf:' + it.Id);
    c.setAttribute('data-tv', '');
    q.appendChild(finta(titolo, s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio : s.anno || '', s.tipo === 'puntata' || s.tipo === 'serie' ? 'serie' : s.tipo === 'collezione' ? 'cartella' : 'film'));
    if (s.visto && s.tipo !== 'serie') { var vs = el('div', 'vista'); vs.appendChild(icona(ICONE.spunta)); q.appendChild(vs); }
    else if (s.percento > 0 && s.percento < 100) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.round(s.percento) + '%'; b.appendChild(f); q.appendChild(b); }
    else if (s.tipo === 'serie' && s.nonVisti) q.appendChild(el('div', 'num', String(s.nonVisti)));
    if (opz.fonte) q.appendChild(el('div', 'fonte', opz.fonte));
    var nome = el('div', 'nome', opz.nome || titolo), sotto = el('div', 'sotto', opz.sotto !== undefined ? opz.sotto : sottoJf(s));
    if (!poster) { var sc = el('div', 'scritta'); sc.appendChild(nome); if (sotto.textContent) sc.appendChild(sotto); q.appendChild(sc); }
    c.appendChild(q);
    if (poster) { c.appendChild(nome); c.appendChild(sotto); }
    c.addEventListener('click', function () { if (opz.apri) opz.apri(it); else apriJf(it, { indietro: tornaInizio }); });
    var ref = poster ? s.img.poster : opz.ref || s.img.landscape || s.img.fanart || s.img.poster;
    sfuma(q, ref);
    c.carica = function () {
      if (ref) mettiImg(q, '', ref, poster ? 220 : 448, poster ? 330 : 252, false, function (si) { arrivata(q, si); });
    };
    c.scheda = s;
    c.info = function () { return infoDaScheda(s, ''); };
    if (fila) fila.appendChild(c);
    return c;
  }
  // una carta in attesa (la sua pagina sta arrivando) e l'ultima di Film e Serie: tutti in griglia
  function cartaAttesa() {
    var c = el('div', 'carta poster attesa');
    c.setAttribute('data-tv', '');
    c.appendChild(el('div', 'quadro'));
    c.info = { titolo: '' };
    return c;
  }
  function cartaTutti(chiave, testo, sotto, fn) {
    var c = el('div', 'carta poster tutti'), q = el('div', 'quadro');
    c.setAttribute('data-tv', '');
    c.setAttribute('data-chiave', chiave);
    q.appendChild(icona(ICONE.avanti));
    q.appendChild(el('div', 'tt', testo));
    q.appendChild(el('div', 'ts', sotto));
    c.appendChild(q);
    c.addEventListener('click', fn);
    c.info = { titolo: testo, meta: [sotto], trama: 'Tutti in griglia: per titolo, anno, voto o data, solo quelli da vedere, per genere.' };
    return c;
  }
  // le immagini delle carte che si vedono: la fila scelta e quella sotto (nelle pagine semplici anche quella sopra e la seconda
  // sotto), dalla prima carta che si vede all'ultima, piu' una (ultimaVicina). Con le frecce tenute premute si chiedono lo
  // stesso, al massimo ogni 300 ms (prima le ultime chieste: vedi prossimaDritta); le altre lasciano andare le immagini
  // subito. Nella fila scelta anche le due carte nascoste subito a sinistra, che tornano con Sinistra (31/10 sul TV: «delle
  // copertine mentre scorro a sinistra scompaiono»; nel riquadro dell'app il TV non le ha in cache e le riscaricava): due
  // poster, circa 0,6 MB. Mentre una copertina arriva la carta mostra i suoi colori (sfuma). Nel lettore si lasciano tutte
  var vicineTimer = null, vicineUltima = 0, VICINE_OGNI = 300;
  // la prima voce che si vede nella fila: di solito la scelta (sta a sinistra), ma in fondo alla fila l'ultima resta attaccata
  // al bordo destro e si vedono anche quelle prima. Con la soglia di scorriFila: una carta che comincia piu' di 2vw a sinistra
  // del bordo e' nascosta (in fondo alle file larghe, Continua e puntate, quella a cavallo del bordo contava come vista)
  function primaVisibile(R) {
    if (!R.box || !/\bfila\b/.test(R.box.className)) return Math.max(0, R.k - 1);
    var W = window.innerWidth, visibile = W * 0.924, i;
    if (R.crea) {
      var passo = W * R.passo, sposta = Math.max(0, Math.min(R.k * passo, R.n * passo - W * 0.0125 - visibile));
      return Math.max(0, Math.min(R.k, Math.ceil((sposta - W * 0.02) / passo - 0.001)));
    }
    var e = R.voci[R.k];
    if (!e) return Math.max(0, R.k - 1);
    var x = Math.max(0, Math.min(e.offsetLeft, R.box.scrollWidth - visibile));
    for (i = R.k; i > 0 && R.voci[i - 1] && R.voci[i - 1].offsetLeft - x >= -W * 0.02; i--) { /* indietro */ }
    return i;
  }
  // l'ultima carta da caricare, contando dalla prima che si vede (p): quelle che si vedono e una dopo. Nelle file di poster
  // otto dopo, come prima; in quelle larghe (Continua, le puntate) se ne vedono quattro e un pezzo: cinque dopo invece di otto
  // (31/10: all'apertura la fila Continua chiedeva quattro immagini grandi che non si vedevano)
  function ultimaVicina(R, p) {
    var visibile = window.innerWidth * 0.924, e = R.voci[p], i;
    if (!R.box || !/\bfila\b/.test(R.box.className)) return p + 8;
    if (R.crea) return p + Math.ceil(visibile / (window.innerWidth * R.passo));
    if (!e) return p + 8;
    for (i = p; i < R.voci.length - 1 && R.voci[i].offsetLeft - e.offsetLeft < visibile; i++) { /* avanti */ }
    return i;
  }
  function caricaVicine() {
    if (vicineTimer) return;
    // (nel primo secondo e mezzo la pagina e' ancora nascosta, vedi attesaFinita: prima arrivano sfondo e logo, poi le copertine)
    vicineTimer = setTimeout(function () { vicineTimer = null; vicineUltima = Date.now(); caricaVicineOra(); },
      Math.max(80, vicineUltima + VICINE_OGNI - Date.now(), apertaAlle + 1500 - Date.now()));
  }
  function caricaVicineOra() {
    if (!pag) return;
    var da = pag.disponi ? pag.r : Math.max(0, pag.r - 1), a = pag.disponi ? pag.r + 1 : pag.r + 2, vicine = [];
    for (var r = da; r <= Math.min(pag.righe.length - 1, a); r++) {
      var R = pag.righe[r], p = primaVisibile(R);
      for (var k = Math.max(0, p - (r === pag.r ? 2 : 0)), z = Math.min(quanteIn(R) - 1, ultimaVicina(R, p)); k <= z; k++) {
        var c = R.voci[k];
        if (!c) continue;
        // nascosta a sinistra senza la sua copertina (mancata anche riprovando): non si tiene, tornando in vista la richiede
        if (k < p && c.mancata) continue;
        vicine.push(c);
        if (c.carica) { c.mancata = false; c.caricaImg = c.carica; c.carica = null; c.caricata = true; c.caricaImg(); }
      }
    }
    // le altre carte ancora disegnate (la fila sopra, quelle piu' in la') lasciano andare le immagini: sul TV restano
    // decodificate solo quelle che si vedono (la memoria serve al 4K del film)
    for (var r2 = 0; r2 < pag.righe.length; r2++) {
      var R2 = pag.righe[r2], l = R2.crea ? R2.voci : vociDi(R2.box);
      for (var i in l) {
        if (!Object.prototype.hasOwnProperty.call(l, i)) continue;
        var c2 = l[i];
        if (c2 && c2.caricata === true && vicine.indexOf(c2) === -1) lasciaCarta(c2);
      }
    }
  }
  function tornaInizio() { apriInizio('tieni'); }
  // le file di Jellyfin dentro l'inizio: [{ box, sezione, chiave, crea, n, passo }]. Tutte "virtuali": si disegnano solo
  // le carte vicine alla scelta
  function disegnaRigheJf() {
    var box = $('jf-righe'), out = [], d = jf.dati;
    svuota(box);
    if (!d && jfAttivo()) {
      // il server non risponde (o le file stanno arrivando): una riga sola, col perche'
      var giu = jf.errore === 'rete', sz = el('section', 'sezione jf-giu'), pp = el('div', 'pulsanti');
      sz.appendChild(el('h2', '', giu ? 'Il Mac non risponde' : 'Un attimo'));
      sz.appendChild(el('p', 'trama', giu ? 'Non raggiungo «' + (jf.stato.server.nome || 'Jellyfin') + '». Controlla che il Mac sia acceso, con Home TV Film aperta: riprovo da solo.' :
        'Carico i film del Mac…'));
      if (giu) pp.appendChild(pulsante('Riprova adesso', 'ripeti', function () { messaggio('Riprovo…'); jfCaricaInizio(true); }));
      sz.appendChild(pp);
      box.appendChild(sz);
      if (giu) out.push({ box: pp, sezione: sz, chiave: 'jf:giu' });
      return out;
    }
    if (!d) return out;
    function fila(titolo, chiave, n, crea, piccolo) {
      if (!n) return;
      var sz = el('section', 'sezione'), f = el('div', 'fila virtuale f-poster'), h = el('h2', '', titolo);
      if (piccolo) h.appendChild(el('small', '', piccolo));
      sz.appendChild(h);
      sz.appendChild(f);
      box.appendChild(sz);
      out.push({ box: f, sezione: sz, chiave: chiave, crea: crea, n: n, passo: 0.1185 });
    }
    function lista(l, sopra) { return function (i) { return l[i] ? cartaJf(l[i], 'poster', null, { sopra: sopra }) : null; }; }
    fila('La mia lista', 'jf:lista', d.preferiti.length, lista(d.preferiti, 'La mia lista'));
    fila('Aggiunti di recente', 'jf:nuovi', d.nuovi.length, lista(d.nuovi, 'Aggiunto di recente'));
    // una fila per collezione (con almeno due film: le collezioni di TheMovieDb con un film solo non dicono niente)
    d.collezioni.forEach(function (c) {
      if (c.voci.length >= 2) fila(String(c.it.Name || ''), 'jf:coll:' + c.it.Id, c.voci.length, lista(c.voci, String(c.it.Name || '')), c.voci.length + ' film');
    });
    [{ x: d.film, chiave: 'film', nome: 'Film', tutti: 'Tutti i film', uno: ' film' }, { x: d.serie, chiave: 'serie', nome: 'Serie', tutti: 'Tutte le serie', uno: ' serie' }].forEach(function (y) {
      var x = y.x;
      if (!x || !x.tot) return;
      fila(y.nome, 'jf:' + y.chiave, x.tot + 1, function (i) {
        if (i === x.tot) return cartaTutti('tutti:' + y.chiave, y.tutti, x.tot + y.uno, function () { apriTuttiJf(x.tipo); });
        if (x.voci[i]) return cartaJf(x.voci[i], 'poster', null, { sopra: y.nome });
        caricaPaginaFila(x, Math.floor(i / PAGINA), 'jf:' + y.chiave);
        return cartaAttesa();
      }, x.tot + y.uno);
    });
    return out;
  }
  // la fila "Altro": cerca, Jellyfin (collegare o vedere com'e' collegato), il Mac, il tetto, la velocita', le anteprime
  function disegnaAltro() {
    var f = $('fila-altro');
    svuota(f);
    f.style.transform = '';
    function carta(chiave, ic, nome, stato, info, fn) {
      var c = cartaPiccola('altro:' + chiave, ic, nome, stato, fn);
      c.info = { sopra: 'Altro', titolo: nome, meta: stato ? [stato] : [], trama: info };
      f.appendChild(c);
    }
    var st = jf.stato || {};
    // (dal Mac niente Cerca, per ora: fuori dal riquadro il testo lo chiederebbe una finestra del browser)
    if (jfAttivo() && !st.dalMac) carta('cerca', 'cerca', 'Cerca', 'film, serie, persone', 'Cerca nei film e nelle serie del Mac, o un attore.', function () { apriCerca(tornaInizio); });
    carta('jellyfin', 'jellyfin', jfAttivo() ? 'Jellyfin · ' + (st.server.nome || 'server') : 'Collega Jellyfin',
      jfAttivo() ? (jf.errore === 'rete' ? 'non risponde' : 'collegato come ' + st.utente.nome) : 'film e serie dal Mac',
      jfAttivo() ? 'Il Jellyfin del Mac: da qui vedi com\'è collegato, lo scolleghi o cambi Mac.' : 'Collega il Jellyfin del Mac con un codice.', function () {
        // dal Mac il collegamento e' quello del TV: si cambia da Real4K sul TV
        if (st.dalMac) { messaggio('Jellyfin si collega da Real4K sul TV: spegni Real4K dal Mac (qui in Altro) e riapri Real4K', 6000); return; }
        apriCollega(tornaInizio);
      });
    var tm = testiAltro();
    if (jfAttivo() && !st.dalMac) carta('mac', 'picchi', tm.mac[0], tm.mac[1],
      'Il limitatore del Mac toglie i picchi dei film troppo pesanti per il TV, senza toccare il resto.', function () { apriCollegaMac(tornaInizio); });
    carta('tetto', 'ingranaggio', 'Tetto del TV', tm.tetto,
      'Quanti Mbps il TV regge senza scatti: oltre, l\'app avvisa e il Mac toglie i picchi.', apriTetto);
    if (!st.dalMac) carta('velocita', 'audio', 'Velocità del TV', 'per l\'audio DTS', 'Quanto è veloce questo TV per convertire da solo l\'audio DTS e TrueHD.', misuraVelocita);
    // Real4K dal Mac: solo col servizio nuovo, o a pagina intera dal Mac. Acceso di base: la carta serve a spegnerlo (e riaccenderlo)
    if (jfAttivo() && (st.real4kMac || st.dalMac)) carta('real4kmac', 'mac', 'Real4K dal Mac', testoReal4kMac(),
      'Con il Mac acceso Real4K si apre da lì, a pagina intera, e il Mac fa tutto il lavoro (liste, copertine, film): il servizio del TV resta fermo. I film delle chiavette si aprono su Real4K del TV. Qui lo spegni.',
      cambiaReal4kMac);
    // (solo se il servizio del TV lo sa fare: con la home non ancora aggiornata la carta non c'e')
    if (jfAttivo() && st.diretto) carta('diretto', 'mac', 'Video diretto dal Mac', prefs.videoDiretto ? 'acceso · prova' : 'spento',
      'Prova: i film di Jellyfin arrivano al lettore direttamente dal Mac e il servizio del TV resta quasi fermo. Se non va, il film riparte da solo come sempre, dallo stesso punto.', cambiaDiretto);
    if (TRAILER_DIETRO) carta('anteprime', 'trailer', 'Anteprime nella scheda', prefs.anteprime ? 'accese' : 'spente', 'Il trailer parte da solo, senza audio, dietro la scheda del film.', function () {
      prefs.anteprime = !prefs.anteprime;
      prefs.anteprimeScelte = true;
      salvaPrefs();
      messaggio(prefs.anteprime ? 'Anteprime accese: il trailer parte da solo, senza audio' : 'Anteprime spente');
      disegnaInizio('tieni');
    });
  }
  // l'interruttore del video diretto: acceso, si dice subito se il ponte del Mac risponde (spento o assente: film come sempre)
  function cambiaDiretto() {
    prefs.videoDiretto = !prefs.videoDiretto;
    salvaPrefs();
    direttoBloccato = '';
    direttoVia = '';
    direttoTempi = 0;
    disegnaInizio('tieni');
    if (!prefs.videoDiretto) { messaggio('Video diretto spento: i film passano dal TV come sempre'); return; }
    messaggio('Video diretto acceso: controllo il Mac…');
    chiedi('jf/diretto-ponte').then(function (r) {
      messaggio(r && r.pronto ? 'Video diretto acceso: il Mac è pronto' : 'Video diretto acceso, ma il Mac non risponde: i film vanno come sempre', 5000);
    }, function () { messaggio('Video diretto acceso: i film vanno dal Mac quando è pronto', 4000); });
  }
  // Real4K dal Mac, acceso di base: l'apertura di Real4K arriva dal Mac a pagina intera quando il Mac c'e'. La scelta sta sul
  // ponte del Mac, per questo TV: dal TV la si legge e la si cambia dal servizio, a pagina intera dal Mac direttamente
  var mac4k = { letto: false, pronto: false, acceso: false };
  function leggiReal4kMac() {
    chiedi('jf/real4k-mac').then(function (r) { mac4k = { letto: true, pronto: !!(r && r.pronto), acceso: !!(r && r.acceso) }; ricordaReal4kMac(); aggiornaAltro(); },
      function () { mac4k = { letto: true, pronto: false, acceso: false }; aggiornaAltro(); });
  }
  // nel riquadro lo spento va anche nelle preferenze (le tiene la home): spento, la home non prova il Mac e l'apertura di Real4K
  // resta quella di sempre, senza domande in piu'. Il ponte decide, ma solo verso spento (spento comanda)
  function ricordaReal4kMac() {
    if (DAL_MAC || !mac4k.pronto || mac4k.acceso || prefs.real4kMacNo) return;
    prefs.real4kMacNo = true;
    salvaPrefs();
  }
  function testoReal4kMac() {
    if (DAL_MAC) return !mac4k.letto || mac4k.acceso ? 'acceso' : 'spento dalla prossima volta';
    if (!mac4k.letto) return prefs.real4kMacNo ? 'spento' : 'acceso';
    return !mac4k.pronto ? 'il Mac non risponde' : mac4k.acceso ? 'acceso' : 'spento';
  }
  function cambiaReal4kMac() {
    var acceso = DAL_MAC ? !(!mac4k.letto || mac4k.acceso) : !(mac4k.letto ? mac4k.acceso : !prefs.real4kMacNo);
    // spento comanda: sul TV vale subito, anche se il Mac non risponde
    if (!acceso && !DAL_MAC) { prefs.real4kMacNo = true; salvaPrefs(); }
    chiedi('jf/real4k-mac', null, { acceso: acceso }).then(function (r) {
      mac4k = { letto: true, pronto: true, acceso: !!(r && r.acceso) };
      if (!DAL_MAC && prefs.real4kMacNo !== !mac4k.acceso) { prefs.real4kMacNo = !mac4k.acceso; salvaPrefs(); }
      aggiornaAltro();
      if (DAL_MAC) messaggio(mac4k.acceso ? 'Real4K dal Mac: acceso' : 'Real4K dal Mac spento: dalla prossima volta Real4K si apre dal TV', 6000);
      else messaggio(mac4k.acceso ? 'Real4K dal Mac acceso: esci e riapri Real4K, arriva dal Mac' : 'Real4K dal Mac spento', 6000);
    }, function () { aggiornaAltro(); messaggio(acceso ? 'Il Mac non risponde: Real4K resta sul TV' : 'Real4K dal Mac spento', 5000); });
  }
  // le scritte delle carte del limitatore e del tetto in Altro
  function testiAltro() {
    return { mac: macAttivo() ? ['Senza picchi · Mac', 'collegato'] : ['Collega il Mac', 'toglie i picchi dei remux'],
      tetto: tettoTv.mbps + ' Mbps' + (tettoTv.scelta === 'prova' ? ' · misurato' : '') };
  }
  // limitatore e tetto arrivano dopo l'apertura: le loro carte cambiano scritta al loro posto, senza ridisegnare la pagina
  function aggiornaAltro() {
    var tm = testiAltro();
    function scrivi(chiave, nome, stato) {
      var c = $('fila-altro').querySelector('[data-chiave="altro:' + chiave + '"]');
      if (!c) return;
      var n = c.querySelector('.nome'), s = c.querySelector('.stato');
      if (n) n.textContent = nome;
      if (s) s.textContent = stato;
      if (c.info) c.info.meta = [stato];
    }
    if (jfAttivo()) scrivi('mac', tm.mac[0], tm.mac[1]);
    scrivi('tetto', 'Tetto del TV', tm.tetto);
    scrivi('real4kmac', 'Real4K dal Mac', testoReal4kMac());
  }
  // il tetto: 150 sui TV dal 2020 (80 sui 2017-2019), 80, o misurato dal TV col video a scalini del Mac ("Prova da solo")
  function apriTetto() {
    var indietro = function () { chiudiFermo(); disegnaInizio('tieni'); }, m = tettoTv.misura;
    function scegli(corpo, detto) {
      chiedi('tv/tetto', null, corpo).then(function (r) { tettoTv = r; chiudiFermo(); messaggio(detto(r)); apriTetto(); },
        function () { messaggio('Non riesco a salvare: riprova'); });
    }
    function detto(r) { return 'Tetto del TV: ' + r.mbps + ' Mbps'; }
    var prossima = tettoTv.unione === 10 ? 30 : tettoTv.unione === 30 ? 60 : 10, misurato = m && m.mbps >= 10 ? m.mbps : tettoTv.prova ? tettoTv.prova.mbps : 0;
    var pulsanti = [{ testo: '80 Mbps' + (tettoTv.scelta === '80' ? ' ✓' : ''), fn: function () { scegli({ scelta: '80' }, detto); } },
      { testo: '150 Mbps' + (tettoTv.scelta === '150' ? ' ✓' : ''), fn: function () { scegli({ scelta: '150' }, detto); } }];
    if (misurato) pulsanti.push({ testo: 'Misurato: ' + misurato + ' Mbps' + (tettoTv.scelta === 'prova' && tettoTv.mbps === misurato ? ' ✓' : ''),
      fn: function () { scegli({ scelta: 'prova', mbps: misurato }, detto); } });
    pulsanti.push({ testo: 'Prova da solo', fn: provaTetto },
      { testo: 'Giunture: ' + tettoTv.unione + ' s', fn: function () { scegli({ unione: prossima }, function (r) { return 'Giunture: il Mac unisce i tratti vicini meno di ' + r.unione + ' s'; }); } },
      { testo: 'Indietro', fn: indietro });
    fermo('Tetto del TV · ' + tettoTv.mbps + ' Mbps', 'Quanti Mbps il TV regge senza scatti. Sopra il tetto l\'app avvisa (chiavetta) e il Mac toglie i picchi ' +
      '(Jellyfin). «Prova da solo» lo misura: il TV guarda il video a scalini del Mac, fino a 300 Mbps, e tiene l\'ultimo scalino senza scatti.\n' +
      'Giunture: il Mac unisce i tratti da rifare vicini meno di ' + tettoTv.unione + ' s. Se il TV scatta dove il Mac ha rifatto un pezzo, unisci di più: meno giunture.', pulsanti);
  }
  // la prova del tetto fatta dal TV: il video a scalini del Mac (4K HEVC Main 10, 10 s per scalino), guardato dal ponte come i film
  // del limitatore. Il TV non dice i fotogrammi persi: per ogni scalino contano le fermate e il tempo vero rispetto a quello del video
  var provaStato = { giro: 0, v: null, cane: 0 };
  function chiudiProva() {
    provaStato.giro++;
    clearInterval(provaStato.cane);
    $('fermo').className = '';
    var pv = provaStato.v;
    provaStato.v = null;
    if (pv) {
      pv.removeAttribute('src');
      try { pv.load(); } catch (e) {}
      if (pv.parentNode) pv.parentNode.removeChild(pv);
    }
  }
  function provaTetto() {
    chiudiProva();
    var giro = provaStato.giro;
    function vivo() { return giro === provaStato.giro; }
    function annulla() { chiudiProva(); apriTetto(); }
    function male(e) {
      if (!vivo()) return;
      var c = e && e.codice;
      fermo('Prova del tetto', c === 'accesso' ? 'Il Mac non riconosce più questo TV: ricollegalo (Altro › Senza picchi · Mac).' :
        c === 'spazio' ? 'Sul Mac manca lo spazio per il video di prova (circa 1,5 GB).' : c === 'lista' ? 'Il servizio di questo TV è vecchio: riavvia il TV.' :
        'Il Mac non risponde: controlla che il limitatore sia acceso.', [{ testo: 'Indietro', fn: annulla }]);
    }
    function aspetta(id) {
      chiedi('mac/p/lavori/' + id).then(function (r) {
        if (!vivo()) return;
        var l = r && r.lavoro || {};
        if (l.stato === 'fatto') {
          chiedi('mac/p/prova-tetto').then(function (r2) { if (!vivo()) return; if (r2 && r2.prova) guardaProva(r2.prova, vivo, annulla); else male(null); }, male);
          return;
        }
        if (l.stato === 'errore' || l.stato === 'fermato') { male({ codice: l.codice }); return; }
        $('fermo-testo').textContent = 'Il Mac prepara il video di prova: si fa una volta sola, circa 3 minuti… ' +
          Math.round(+(l.avanzamento && l.avanzamento.percentuale) || 0) + '%';
        setTimeout(function () { if (vivo()) aspetta(id); }, 2000);
      }, male);
    }
    if (!macAttivo()) { fermo('Prova del tetto', 'Serve il limitatore del Mac: collegalo da Altro › Senza picchi · Mac.', [{ testo: 'Indietro', fn: apriTetto }]); return; }
    fermaTrailer();
    fermo('Prova del tetto', 'Chiedo al Mac il video di prova…', [{ testo: 'Annulla', fn: annulla }]);
    chiedi('mac/p/prova-tetto', null, {}, false, 'POST').then(function (r) {
      if (!vivo()) return;
      if (r && r.pronto && r.prova) guardaProva(r.prova, vivo, annulla);
      else if (r && r.lavoro && /^prova-[0-9]{1,9}$/.test(String(r.lavoro.id))) aspetta(r.lavoro.id);
      else male(null);
    }, male);
  }
  function guardaProva(pr, vivo, annulla) {
    var sc = (Array.isArray(pr.scalini) ? pr.scalini : []).filter(function (s) { return s && +s.da >= 0 && +s.a > +s.da; }).slice(0, 10);
    if (!sc.length) { fermo('Prova del tetto', 'Il video di prova del Mac non ha scalini: riprova.', [{ testo: 'Indietro', fn: annulla }]); return; }
    var via = /^\/prova-tetto\/(index\.m3u8|p[0-9]{3,6}_[0-9]{5,9}\.ts)$/.test(String(pr.playlist || '')) ? pr.playlist : '/prova-tetto/index.m3u8';
    var es = sc.map(function (s) { return { mbps: +s.mbps || +s.richiesti || 0, da: +s.da, a: +s.a, fermate: 0, msFermo: 0, t0: -1, t1: -1 }; });
    var pv = el('video'), durata = es[es.length - 1].a, partito = false, finito = false, tFermo = 0, kFermo = -1, k0 = -1;
    var ultimoT = -1, fermoDa = Date.now(), inizio = Date.now();
    function scalino(t) { for (var i = 0; i < es.length; i++) if (t >= es[i].da && t < es[i].a) return i; return -1; }
    // quando il video passa un confine (inizio o fine di uno scalino): l'ora vera di quel punto, ricavata da dove si e' adesso
    function segna() {
      var t = pv.currentTime || 0, ora = Date.now();
      for (var i = 0; i < es.length; i++) {
        if (es[i].t0 < 0 && t >= es[i].da) es[i].t0 = ora - (t - es[i].da) * 1000;
        if (es[i].t1 < 0 && t >= es[i].a) es[i].t1 = ora - (t - es[i].a) * 1000;
      }
      var k = scalino(t);
      if (k >= 0 && k !== k0) { k0 = k; $('fermo-titolo').textContent = 'Prova del tetto · ' + Math.round(es[k].mbps) + ' Mbps (' + (k + 1) + ' di ' + es.length + ')'; }
    }
    function decimi(ms) { return String(Math.round(ms / 100) / 10).replace('.', ','); }
    function usa(corpo) {
      chiedi('tv/tetto', null, corpo).then(function (r) { tettoTv = r; messaggio('Tetto del TV: ' + r.mbps + ' Mbps'); apriTetto(); },
        function () { messaggio('Non riesco a salvare: riprova'); });
    }
    function fine(motivo, codice) {
      if (finito) return;
      finito = true;
      segna();
      var ora = Date.now(), ultimo = es[es.length - 1], i;
      // la fine del video arriva un soffio prima dell'ultimo confine
      if (motivo === 'fine' && ultimo.t0 >= 0 && ultimo.t1 < 0) ultimo.t1 = ora - ((pv.currentTime || ultimo.a) - ultimo.a) * 1000;
      if (tFermo && kFermo >= 0) es[kFermo].msFermo += ora - tFermo;
      chiudiProva();
      if (es[0].t0 < 0) {
        fermo('Prova del tetto', motivo === 'errore' ? 'Il TV non riesce a leggere il video di prova (errore ' + codice + ').' :
          'Il video di prova non parte: controlla che il Mac sia acceso e riprova.', [{ testo: 'Riprova', fn: provaTetto }, { testo: 'Indietro', fn: apriTetto }]);
        return;
      }
      var buono = 0, righe = [], dati = [];
      for (i = 0; i < es.length; i++) {
        var e = es[i], sec = e.a - e.da, ms = e.t0 >= 0 && e.t1 >= 0 ? Math.round(e.t1 - e.t0) : -1;
        e.liscio = ms >= 0 && !e.fermate && ms <= sec * 1000 + 600;
        righe.push(Math.round(e.mbps) + ' Mbps: ' + (ms < 0 ? 'non arrivato' : e.liscio ? 'liscio' : e.fermate ?
          e.fermate + (e.fermate === 1 ? ' fermata, ' : ' fermate, ') + decimi(e.msFermo) + ' s da fermo' : 'in ritardo di ' + decimi(ms - sec * 1000) + ' s'));
        dati.push({ mbps: e.mbps, fermate: e.fermate, msFermo: Math.round(e.msFermo), ms: Math.max(0, ms), secondi: sec });
      }
      for (i = 0; i < es.length && es[i].liscio; i++) buono = Math.floor(es[i].mbps);
      // la misura resta nel servizio anche se non la si sceglie (chi prova il TV la legge dal Mac)
      chiedi('tv/tetto', null, { misura: { mbps: buono, scalini: dati, motivo: motivo, errore: codice || 0 } }).then(function (r) { tettoTv.misura = r.misura; }, function () {});
      if (buono >= 10) fermo('Prova del tetto · ' + buono + ' Mbps', 'Senza scatti fino a ' + buono + ' Mbps.\n' + righe.join('\n'), [
        { testo: 'Usa ' + buono + ' Mbps', fn: function () { usa({ scelta: 'prova', mbps: buono }); } }, { testo: 'Lascia com\'era', fn: apriTetto }]);
      else fermo('Prova del tetto', 'Il TV scatta già a ' + Math.round(es[0].mbps) + ' Mbps: meglio il tetto a 80.\n' + righe.join('\n'), [
        { testo: 'Usa 80 Mbps', fn: function () { usa({ scelta: '80' }); } }, { testo: 'Lascia com\'era', fn: apriTetto }]);
    }
    pv.id = 'prova-video';
    pv.muted = true;
    pv.setAttribute('playsinline', '');
    pv.preload = 'auto';
    provaStato.v = pv;
    $('fermo').parentNode.insertBefore(pv, $('fermo'));
    $('fermo').className = 'sopra-video';
    fermo('Prova del tetto', 'Non toccare niente: dura circa ' + Math.ceil(durata / 10) * 10 + ' secondi.', [{ testo: 'Annulla', fn: annulla }]);
    pv.addEventListener('playing', function () {
      if (!vivo()) return;
      partito = true;
      if (tFermo) { if (kFermo >= 0) es[kFermo].msFermo += Date.now() - tFermo; tFermo = 0; }
    });
    pv.addEventListener('waiting', function () {
      if (!vivo() || !partito || tFermo || pv.seeking) return;
      kFermo = scalino(pv.currentTime || 0);
      if (kFermo >= 0) es[kFermo].fermate++;
      tFermo = Date.now();
    });
    pv.addEventListener('timeupdate', function () { if (vivo() && partito) segna(); });
    pv.addEventListener('ended', function () { if (vivo()) fine('fine'); });
    pv.addEventListener('error', function () { if (vivo()) fine('errore', pv.error ? pv.error.code : 0); });
    // il cane da guardia: fermo da 20 s, o molto oltre la durata, e la prova finisce con quello che c'e'
    provaStato.cane = setInterval(function () {
      if (!vivo()) return;
      var t = pv.currentTime || 0, ora = Date.now();
      if (t !== ultimoT) { ultimoT = t; fermoDa = ora; }
      if (ora - fermoDa > 20000 || ora - inizio > (durata + 90) * 1000) fine('bloccato');
    }, 1000);
    pv.src = serv.base + '/api/video/g/' + serv.gettone + '/mac/p' + via;
    var pp = pv.play();
    if (pp && pp.then) pp.then(null, function () {});
  }
  // quanto e' veloce questo TV per convertire l'audio DTS e TrueHD (prove/audio-tv): qualche secondo di misura nel servizio
  function misuraVelocita() {
    var indietro = [{ testo: 'Indietro', fn: chiudiFermo }];
    fermo('Velocità del TV', 'Misuro… (qualche secondo)', indietro);
    chiedi('tv/cpu').then(function (r) {
      if (!fermoAperto()) return;
      var t;
      if (!r.wasm) t = 'Questo TV non ha WebAssembly (Node ' + r.node + '): l\'audio DTS non si potrà convertire sul TV.';
      else {
        var q = Math.round(r.dtsAc3 * 100), q2 = Math.round(r.truehdAc3 * 100);
        t = 'Rispetto al Mac di riferimento questo TV è ' + String(r.rapporto).replace('.', ',') + ' volte più lento.\n' +
          'Convertire l\'audio DTS in Dolby Digital costerebbe circa il ' + q + '% di un core' + (q < 50 ? ' (regge)' : q < 80 ? ' (al limite)' : ' (troppo)') +
          '; il TrueHD Atmos il ' + q2 + '%.\nIl TV converte da solo l\'audio che regge; quello che non regge resta senza audio (meglio dal Mac).' +
          '\nNode ' + r.node + ' · ' + r.arch + ' · worker_threads ' + (r.workerThreads ? 'sì' : 'no') +
          '\nWebAssembly: fir ' + r.wasm.fir + ' ms, quant ' + r.wasm.quant + ' ms · JavaScript: fir ' + r.js.fir + ' ms, quant ' + r.js.quant + ' ms';
      }
      fermo('Velocità del TV', t, indietro);
    }, function (e) {
      if (fermoAperto()) fermo('Velocità del TV', e.codice === 'assente' || e.codice === 'vecchio' ? 'Il servizio di questo TV è vecchio: riavvia il TV.' : 'Non riesco a misurare: riprova.', indietro);
    });
  }

  // OK su una voce di Jellyfin: film, puntata e serie la scheda; collezioni e librerie la griglia; persone la loro pagina
  function apriJf(it, opz) {
    opz = opz || {};
    var t = it.Type;
    if (t === 'Season' && it.SeriesId) apriSchedaJf(it.SeriesId, { stagione: it.Id, indietro: opz.indietro });
    else if (t === 'BoxSet') apriLibreriaJf({ titolo: it.Name, query: { ParentId: it.Id, SortBy: 'ProductionYear,SortName', SortOrder: 'Ascending' }, indietro: opz.indietro, collezione: true });
    else if (t === 'CollectionFolder' || t === 'UserView' || t === 'Folder') apriLibreriaJf({ titolo: it.Name, vista: it, indietro: opz.indietro });
    else if (t === 'Person') apriPersonaJf(it.Id, opz.indietro);
    else apriSchedaJf(it.Id, { indietro: opz.indietro });
  }

  /* ---------------------------------------------------------- la scheda di Jellyfin (film, puntata, serie) */

  function pulisciScheda(titolo) {
    var logo = $('sc-logo');
    svuota(logo);
    logo.appendChild(el('h1', '', titolo || ''));
    $('sc-sopratitolo').textContent = '';
    svuota($('sc-meta'));
    svuota($('sc-badge'));
    $('sc-slogan').textContent = '';
    $('sc-trama').textContent = '';
    svuota($('sc-pulsanti'));
    svuota($('sc-righe'));
    $('sc-avviso').hidden = true;
    $('sc-resta').hidden = true;
    ['sez-stagioni', 'sez-puntate', 'sez-collezione', 'sez-cast', 'sez-simili', 'sez-info'].forEach(function (id) { $(id).hidden = true; });
    nuovaPagina($('scheda-corpo'));
    evidenzia();
  }
  // per tornare a questa scheda (dalla persona, da un film simile, dal lettore), sulla riga di adesso
  function riapriScheda(x) {
    var R = pag && pag.corpo === $('scheda-corpo') ? pag.righe[pag.r] : null, riga = R ? { chiave: R.chiave, k: R.k } : null;
    return function () {
      var o = {};
      for (var k in x.opz) if (Object.prototype.hasOwnProperty.call(x.opz, k)) o[k] = x.opz[k];
      o.riga = riga;
      if (x.stagioneId) o.stagione = x.stagioneId;
      apriSchedaJf(x.id, o);
    };
  }
  function apriSchedaJf(id, opz) {
    opz = opz || {};
    var giro = ++schGiro, x = sch = { jf: true, id: id, opz: opz, indietro: opz.indietro || tornaInizio, s: null, it: null, giro: giro,
      stagioni: [], puntate: [], k: 0, simili: [] };
    clearInterval(dischiTimer);
    mostra('scheda');
    pulisciScheda('');
    chiediJf('Items/' + id, { userId: uid() }).then(function (it) {
      if (x.giro !== schGiro) return;
      x.it = it;
      x.s = JF.scheda(it);
      if (it.Type === 'Series') schedaSerieJf(x); else disegnaSchedaJf(x);
      chiediJf('Items/' + (it.Type === 'Episode' && it.SeriesId ? it.SeriesId : id) + '/Similar', conCampi({ UserId: uid(), Limit: 16 })).then(function (r) {
        if (x.giro !== schGiro) return;
        x.simili = voci(r);
        disegnaSimili(x);
        righeScheda(x);
      }, function () {});
      preparaTrailer(x);
    }, function (e) {
      if (x.giro !== schGiro) return;
      $('sc-avviso').textContent = e.codice === 'accesso' ? 'Jellyfin chiede di collegarsi di nuovo.' : e.codice === 'rete' ?
        'Jellyfin non risponde: il Mac e\' acceso?' : 'Non riesco ad aprire questa scheda.';
      $('sc-avviso').hidden = false;
    });
  }
  function disegnaSchedaJf(x) {
    var s = x.s, it = x.it, logo = $('sc-logo'), ms = JF.sorgente(it), L0 = lettiTv();
    var titolo = s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo;
    $('sc-sopratitolo').textContent = s.tipo === 'puntata' ? 'Stagione ' + s.stagione + ' · Puntata ' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') : '';
    if (x.logoFatto !== chiaveLogo(s)) {
      x.logoFatto = chiaveLogo(s);
      svuota(logo);
      logo.appendChild(el('h1', '', titolo));
      if (s.img.logo) mettiImg(logo, '', s.img.logo, 500, 192, true, function (si) { if (si && x.giro === schGiro) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    }
    metaDi($('sc-meta'), s, null, '');
    if (s.durata) $('sc-meta').appendChild(el('span', '', finisceAlle(s.durata * 60 - (riprendibileJf(s) ? s.punto : 0))));
    etichetteIn($('sc-badge'), JF.etichette(it));
    $('sc-slogan').textContent = s.slogan;
    $('sc-trama').textContent = s.trama;
    var pp = $('sc-pulsanti'), ripr = riprendibileJf(s);
    svuota(pp);
    x.guarda = function () { guardaJf(it, { ritorno: riapriScheda(x), t: ripr ? s.punto : 0 }); };
    pp.appendChild(pulsante(ripr ? 'Riprendi' : 'Guarda', 'play', x.guarda, ripr ? 'da ' + tempo(s.punto) : ''));
    if (ripr) pp.appendChild(pulsante('Dall\'inizio', 'ripeti', function () { guardaJf(it, { ritorno: riapriScheda(x), daCapo: true }); }, '', true));
    if (s.trailer) pp.appendChild(pulsante('Trailer', 'trailer', function () { guardaTrailerJf(x); }));
    pp.appendChild(pulsanteQualita(x));
    pp.appendChild(pulsanteStato(s.preferito, 'lista', 'La mia lista', function (b) { cambiaPreferito(x, b); }));
    pp.appendChild(pulsanteStato(s.visto, 'spunta', 'Visto', function (b) { cambiaVisto(x, b); }));
    restaIn($('sc-resta'), ripr && s.durata ? s.punto / (s.durata * 60) : -1, ripr && s.durata ? s.durata * 60 - s.punto : 0);
    var righe = $('sc-righe'), v0 = ms ? JF.flussi(ms, 'Video')[0] : null, a0 = ms ? JF.flussi(ms, 'Audio') : [];
    svuota(righe);
    function riga(a, b) { if (!b) return; var r = el('div'); r.appendChild(el('span', 'k', a)); r.appendChild(el('b', '', b)); righe.appendChild(r); }
    riga('Regia', s.registi.join(', '));
    riga('Scritto da', s.scrittori.join(', '));
    riga('Studio', s.studi.join(', '));
    var strada = JF.strada(it, L0);
    if (v0) riga('Video', [JF.nomeVideo(v0), (+v0.Width || 0) + '×' + (+v0.Height || 0), hdrDi(v0.VideoRangeType || v0.VideoRange) === 'DV' ? 'Dolby Vision' :
      hdrDi(v0.VideoRangeType || v0.VideoRange)].filter(Boolean).join(' · '));
    if (a0.length) riga('Audio', a0.slice(0, 4).map(function (t) {
      var legge = !L0 || L0.audio[JF.famiglia(t.Codec)] === true;
      return nomeLingua(lingua3(t.Language)) + ' ' + JF.nomeAudio(t) + (t.Channels ? ' ' + canali(+t.Channels) : '') + (legge ? '' : ' (lo converte il server)');
    }).join(', ') + (a0.length > 4 ? '…' : ''));
    if (ms) riga('File', String(ms.Path || ms.Name || '').split(/[\/\\]/).pop() + (ms.Size ? ' · ' + peso(ms.Size) : '') +
      (ms.Bitrate ? ' · ' + String(Math.round(ms.Bitrate / 1e5) / 10).replace('.', ',') + ' Mbps' : ''));
    riga('Al TV', strada === 'diretta' ? 'il file vero, come da una chiavetta' : strada === 'audio' ? 'video originale, audio convertito dal server' :
      strada === 'converti' ? 'convertito dal server' : '');
    $('sez-info').hidden = !righe.children.length;
    var avv = '';
    if (strada === 'converti') avv = 'Il TV non legge questo video cosi\' com\'e\': lo converte Jellyfin (il Mac lavora, la qualita\' cala un po\').';
    else if (strada === 'audio') avv = 'L\'audio di questo film il TV non lo legge: Jellyfin lo converte in Dolby Digital Plus, il video resta l\'originale.';
    else if (ms && ms.Bitrate > 80e6) avv = 'File molto pesante (' + Math.round(ms.Bitrate / 1e6) + ' Mbps): su alcuni TV Samsung del 2022 oltre 80 Mbps il video puo\' scattare. Nel pannello del lettore c\'e\' la qualita\'.';
    $('sc-avviso').textContent = avv;
    $('sc-avviso').hidden = !avv;
    sfondo('', s.img.fanart || s.img.landscape || s.img.poster, !!(s.img.fanart || s.img.landscape), true);
    disegnaCast(x);
    disegnaCollezione(x);
    disegnaSimili(x);
    righeScheda(x);
  }
  // le etichette della scheda: 4K, HDR10, 5.1, Sottotitoli
  function etichetteIn(box, l) {
    svuota(box);
    l.forEach(function (t) { box.appendChild(el('span', 'badge', t)); });
  }
  // sotto i pulsanti: la barra di quanto hai visto e quanto manca (f < 0: niente)
  function restaIn(box, f, sec) {
    svuota(box);
    box.hidden = !(f > 0);
    if (!(f > 0)) return;
    var i = el('i'), b = el('b');
    b.style.width = Math.min(100, Math.round(f * 100)) + '%';
    i.appendChild(b);
    box.appendChild(i);
    box.appendChild(document.createTextNode('Mancano ' + durataResta(sec)));
  }
  // la qualita' dei film di Jellyfin scelta prima di partire (richiesta del 31/10: «posso scegliere la qualità prima di far partire il
  // video?»): la stessa del pannello del lettore, salvata nelle preferenze come lì, così vale anche per i film dopo
  function nomeQualitaScelta() {
    var q = qualitaBuona(prefs.qualita);
    return (QUALITA_JF.filter(function (z) { return z.id === q; })[0] || QUALITA_JF[0]).nome;
  }
  function pulsanteQualita(x) {
    var b = pulsante('Qualità', 'ingranaggio', function () { scegliQualita(x, b); }, nomeQualitaScelta());
    return b;
  }
  // solo quelle che il TV regge (sotto il suo tetto, più quella già scelta); un film HDR convertito dal server esce senza HDR
  function scegliQualita(x, b) {
    var q0 = qualitaBuona(prefs.qualita), scelta = 0, ms = x.it ? JF.sorgente(x.it) : null, v0 = ms ? JF.flussi(ms, 'Video')[0] : null;
    var hdr = !!(v0 && hdrDi(v0.VideoRangeType || v0.VideoRange)), mbFilm = ms && ms.Bitrate ? ms.Bitrate / 1e6 : 0;
    var voci = QUALITA_JF.filter(function (q) { return !q.mbps || q.mbps <= tettoTv.mbps || q.id === q0; });
    var azioni = voci.map(function (q, i) {
      if (q.id === q0) scelta = i;
      var piccolo = q.id === 'orig' ? 'il video così com\'è' : q.piccolo;
      if (hdr && q.mbps && (!mbFilm || mbFilm > q.mbps)) piccolo += ' · senza HDR';
      return { testo: q.nome + (q.id === q0 ? ' ✓' : ''), piccolo: piccolo, fn: function () {
        prefs.qualita = q.id;
        salvaPrefs();
        chiudiFermo();
        var p = b.querySelector('small');
        if (p) p.textContent = q.nome;
        evidenzia();
        messaggio('Qualità: ' + q.nome + ', anche per i prossimi film');
      } };
    });
    azioni.push({ testo: 'Indietro', fn: function () { chiudiFermo(); evidenzia(); } });
    fermo('Qualità', 'Con quale qualità partono i film di Jellyfin. Resta anche per i prossimi.', azioni, { lista: true, scelta: scelta });
  }
  // un pulsante tondo acceso/spento (La mia lista, visto): la scritta compare sotto quando e' scelto
  function pulsanteStato(acceso, ic, testo, fn) {
    var b = pulsante(testo, ic, function () { fn(b); }, '', true);
    if (acceso) b.className += ' acceso';
    return b;
  }
  // gli altri film della stessa collezione (MCU, "Iron Man - Collezione"...): la prima che lo contiene, in ordine di uscita
  function disegnaCollezione(x) {
    var f = $('fila-collezione'), c = collezioniDi(x.id)[0], altri = c ? c.voci.filter(function (it) { return it.Id !== x.id; }) : [];
    svuota(f);
    f.style.transform = '';
    $('sez-collezione').hidden = !altri.length;
    var h = $('collezione-titolo');
    svuota(h);
    h.appendChild(document.createTextNode('Altri della collezione'));
    if (c) h.appendChild(el('small', '', String(c.it.Name || '')));
    f.className = 'fila virtuale f-poster';
    x.altriCollezione = altri;
  }
  function righeCollezione(x) {
    var l = x.altriCollezione || [];
    aggiungiRiga($('fila-collezione'), [], { sezione: $('sez-collezione'), chiave: 'collezione', n: l.length, passo: 0.1185,
      crea: function (i) { var it = l[i]; return it ? cartaJf(it, 'poster', null, { apri: function () { apriJf(it, { indietro: riapriScheda(x) }); } }) : null; } });
  }
  function cambiaPreferito(x, b) {
    var si = !/\bacceso\b/.test(b.className);
    b.className = b.className.replace(/\s*\bacceso\b/, '') + (si ? ' acceso' : '');
    chiediJf('UserFavoriteItems/' + x.id, { userId: uid() }, si ? {} : null, si ? 'POST' : 'DELETE').then(function () {
      x.s.preferito = si;
      jf.caricato = 0;
      aggiornaVoceLenti(x.id);
      messaggio(si ? 'Nei preferiti' : 'Tolto dai preferiti');
    }, function () { messaggio('Jellyfin non risponde: riprova'); });
  }
  function cambiaVisto(x, b) {
    var si = !/\bacceso\b/.test(b.className);
    b.className = b.className.replace(/\s*\bacceso\b/, '') + (si ? ' acceso' : '');
    chiediJf('UserPlayedItems/' + x.id, { userId: uid() }, si ? {} : null, si ? 'POST' : 'DELETE').then(function () {
      x.s.visto = si;
      jf.caricato = 0;
      aggiornaVoceLenti(x.id);
      messaggio(si ? 'Segnato come visto' : 'Segnato da vedere');
    }, function () { messaggio('Jellyfin non risponde: riprova'); });
  }
  function disegnaSimili(x) {
    var f = $('fila-simili');
    svuota(f);
    $('sez-simili').hidden = !x.simili.length;
    x.simili.forEach(function (it) { cartaJf(it, 'poster', f, { apri: function () { apriJf(it, { indietro: riapriScheda(x) }); } }); });
  }
  // le righe della scheda col telecomando (la scelta resta dov'era: tornando da una persona o dal lettore)
  function righeScheda(x) {
    var vecchia = pag && pag.corpo === $('scheda-corpo') ? pag : null, R0 = vecchia ? vecchia.righe[vecchia.r] : null;
    var voluta = R0 ? { chiave: R0.chiave, k: R0.k } : null;
    // la riga dove tornare (dal lettore, da una persona) vale finche' non arriva, se intanto non ci si e' mossi
    if (vecchia && vecchia.mosso) x.opz.riga = null;
    nuovaPagina($('scheda-corpo'));
    var pp = $('sc-pulsanti');
    aggiungiRiga(pp, vociDi(pp), { sezione: $('sc-sopra'), chiave: 'pulsanti' });
    if (!$('sez-stagioni').hidden) aggiungiRiga($('fila-stagioni'), vociDi($('fila-stagioni')), { sezione: $('sez-stagioni'), k: x.k, chiave: 'stagioni' });
    if (!$('sez-puntate').hidden) righePuntate(x);
    if (!$('sez-collezione').hidden) righeCollezione(x);
    if (!$('sez-cast').hidden) aggiungiRiga($('fila-cast'), vociDi($('fila-cast')), { sezione: $('sez-cast'), chiave: 'cast' });
    if (!$('sez-simili').hidden) aggiungiRiga($('fila-simili'), vociDi($('fila-simili')), { sezione: $('sez-simili'), chiave: 'simili' });
    if (!$('sez-info').hidden) aggiungiRiga($('fila-info'), vociDi($('fila-info')), { sezione: $('sez-info'), chiave: 'info' });
    for (var r0 = 0; x.opz.riga && r0 < pag.righe.length; r0++) if (pag.righe[r0].chiave === x.opz.riga.chiave) { voluta = x.opz.riga; x.opz.riga = null; }
    if (voluta) {
      for (var r = 0; r < pag.righe.length; r++) {
        if (pag.righe[r].chiave === voluta.chiave) { pag.r = r; pag.righe[r].k = Math.min(voluta.k, Math.max(0, quanteIn(pag.righe[r]) - 1)); }
      }
    }
    if (vecchia && vecchia.mosso) pag.mosso = true;
    evidenzia();
  }
  // una serie: le stagioni, le puntate della stagione scelta, Riprendi o Guarda la prossima (lo dice Jellyfin)
  function schedaSerieJf(x) {
    var u = uid();
    Promise.all([
      chiediJf('Shows/' + x.id + '/Seasons', conCampi({ UserId: u })).then(voci, function () { return []; }),
      chiediJf('Shows/NextUp', conCampi({ UserId: u, SeriesId: x.id, Limit: 1 })).then(voci, function () { return []; })
    ]).then(function (r) {
      if (x.giro !== schGiro) return;
      x.stagioni = r[0];
      x.prossima = r[1][0] || null;
      var voluta = x.opz.stagione || (x.prossima && x.prossima.SeasonId) || '';
      x.k = 0;
      for (var i = 0; i < x.stagioni.length; i++) if (x.stagioni[i].Id === voluta) x.k = i;
      disegnaSerieJf(x);
    });
  }
  function disegnaSerieJf(x) {
    var s = x.s, logo = $('sc-logo');
    svuota(logo);
    logo.appendChild(el('h1', '', s.titolo));
    if (s.img.logo) mettiImg(logo, '', s.img.logo, 500, 192, true, function (si) { if (si && x.giro === schGiro) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    $('sc-sopratitolo').textContent = 'Serie' + (x.stagioni.length ? ' · ' + x.stagioni.length + (x.stagioni.length === 1 ? ' stagione' : ' stagioni') : '');
    metaDi($('sc-meta'), s, null, '');
    $('sc-trama').textContent = s.trama;
    sfondo('', s.img.fanart || s.img.poster, true, true);
    disegnaCast(x);
    var fs = $('fila-stagioni');
    svuota(fs);
    $('sez-stagioni').hidden = x.stagioni.length < 2;
    // le stagioni: linguette (OK cambia le puntate qui sotto)
    x.stagioni.forEach(function (st, i) {
      var ss = JF.scheda(st), c = el('div', 'stagione' + (i === x.k ? ' attiva' : ''));
      c.appendChild(el('span', 'nome', ss.titolo));
      c.setAttribute('data-tv', '');
      c.addEventListener('click', function () { x.k = i; x.stagioneId = st.Id; puntateJf(x); });
      fs.appendChild(c);
    });
    x.stagioneId = x.stagioni[x.k] ? x.stagioni[x.k].Id : '';
    puntateJf(x);
  }
  function puntateJf(x) {
    var st = x.stagioni[x.k];
    var stg = $('fila-stagioni').children;
    for (var i = 0; i < stg.length; i++) stg[i].className = 'stagione' + (i === x.k ? ' attiva' : '');
    if (!st) { x.puntate = []; disegnaPuntateJf(x); return; }
    chiediJf('Shows/' + x.id + '/Episodes', conCampi({ UserId: uid(), SeasonId: st.Id })).then(function (r) {
      if (x.giro !== schGiro) return;
      x.puntate = voci(r);
      disegnaPuntateJf(x);
    }, function () { if (x.giro === schGiro) { x.puntate = []; disegnaPuntateJf(x); } });
  }
  function disegnaPuntateJf(x) {
    var fp = $('fila-puntate'), st = x.stagioni[x.k];
    svuota(fp);
    fp.className = 'fila virtuale f-puntata';
    fp.style.transform = '';
    $('sez-puntate').hidden = !x.puntate.length;
    $('puntate-titolo').textContent = (st ? JF.scheda(st).titolo : 'Puntate') + ' · ' + x.puntate.length + (x.puntate.length === 1 ? ' puntata' : ' puntate');
    x.kPuntata = 0;
    x.puntate.forEach(function (ep, j) { if (x.prossima && x.prossima.Id === ep.Id) x.kPuntata = j; });
    // una stagione puo' avere 300 puntate: si fanno solo le carte vicine alla scelta (la fila e' virtuale, vedi righePuntate)
    x.cartaPuntata = function (j) {
      var ep = x.puntate[j];
      if (!ep) return null;
      var s = JF.scheda(ep), c = el('div', 'carta puntata'), q = el('div', 'quadro');
      q.appendChild(finta(s.titolo, 'S' + s.stagione + ' E' + s.episodio, 'puntata'));
      q.appendChild(el('div', 'num', 'E' + (s.episodio >= 0 ? s.episodio : j + 1)));
      if (s.visto) { var vs = el('div', 'vista'); vs.appendChild(icona(ICONE.spunta)); q.appendChild(vs); }
      else if (s.percento > 0) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.round(s.percento) + '%'; b.appendChild(f); q.appendChild(b); }
      c.appendChild(q);
      c.appendChild(el('div', 'nome', (s.episodio >= 0 ? s.episodio + '. ' : '') + s.titolo));
      if (s.durata > 1) c.appendChild(el('div', 'dur', durataBella(s.durata)));
      c.appendChild(el('div', 'trama-p', s.trama));
      c.setAttribute('data-tv', '');
      c.addEventListener('click', function () { guardaJf(ep, { ritorno: riapriScheda(x), t: riprendibileJf(s) ? s.punto : 0 }); });
      c.carica = function () { if (s.img.landscape) mettiImg(q, '', s.img.landscape, 448, 252); };
      return c;
    };
    var pp = $('sc-pulsanti'), p = x.prossima;
    svuota(pp);
    if (p) {
      var sp = JF.scheda(p), ripr = riprendibileJf(sp);
      x.guarda = function () { guardaJf(p, { ritorno: riapriScheda(x), t: ripr ? sp.punto : 0 }); };
      pp.appendChild(pulsante(ripr ? 'Riprendi' : 'Guarda', 'play', x.guarda, 'S' + sp.stagione + ' E' + sp.episodio + (ripr ? ' da ' + tempo(sp.punto) : '')));
    } else if (x.puntate[0]) {
      x.guarda = function () { guardaJf(x.puntate[0], { ritorno: riapriScheda(x) }); };
      pp.appendChild(pulsante('Guarda', 'play', x.guarda, 'S' + JF.scheda(x.puntate[0]).stagione + ' E1'));
    } else x.guarda = null;
    if (x.guarda) pp.appendChild(pulsanteQualita(x));
    pp.appendChild(pulsanteStato(x.s.preferito, 'lista', 'La mia lista', function (b) { cambiaPreferito(x, b); }));
    disegnaSimili(x);
    righeScheda(x);
  }
  // le puntate nelle righe della scheda: una fila virtuale
  function righePuntate(x) {
    aggiungiRiga($('fila-puntate'), [], { sezione: $('sez-puntate'), chiave: 'puntate', k: x.kPuntata || 0, crea: x.cartaPuntata, n: x.puntate.length, passo: 0.2245 });
  }

  /* ---------------------------------------------------------- il trailer dietro la scheda (senza audio) */

  var trailer = { timer: null, x: null, sessione: '' };
  function fermaTrailer() {
    clearTimeout(trailer.timer);
    trailer.x = null;
    // un trailer convertito dal server: la conversione si ferma subito
    if (trailer.sessione) { chiediJf('Videos/ActiveEncodings', { PlaySessionId: trailer.sessione }, null, 'DELETE').then(null, function () {}); trailer.sessione = ''; }
    var t = $('trailer');
    if (!t || !t.getAttribute('src')) { if (t) t.hidden = true; return; }
    t.className = '';
    try { t.pause(); } catch (e) {}
    t.removeAttribute('src');
    try { t.load(); } catch (e) {}
    t.hidden = true;
  }
  // dopo 4 secondi fermi sulla scheda: il trailer di Jellyfin; se non c'e', il film stesso da un quarto, solo se e' SDR fino
  // al 1080p (un film HDR accenderebbe l'HDR del TV sotto le scritte)
  function preparaTrailer(x) {
    fermaTrailer();
    if (!TRAILER_DIETRO || !prefs.anteprime || !x.it || x.it.Type === 'Series') return;
    trailer.timer = setTimeout(function () {
      if (sch !== x || schermo !== 'scheda' || fermoAperto()) return;
      function parti(id, da) {
        chiedi('jf/guarda/' + id, { q: '1080' }).then(function (g) {
          if (sch !== x || schermo !== 'scheda') return;
          // il film stesso solo dal file (il server non lavora per un'anteprima); un trailer anche con l'audio convertito
          if (da ? g.modo !== 'diretto' : g.modo === 'converti') return;
          var t = $('trailer');
          trailer.x = x;
          trailer.sessione = g.modo === 'diretto' ? '' : g.sessione;
          t.hidden = false;
          t.muted = true;
          t.src = serv.base + '/api/video/g/' + serv.gettone + '/' + (g.modo === 'diretto' ? g.url + '&a=0' : g.url);
          t.onloadedmetadata = function () { if (da && t.duration) { try { t.currentTime = t.duration * da; } catch (e) {} } };
          t.onplaying = function () { if (trailer.x === x) t.className = 'on'; };
          t.onended = function () { t.className = ''; };
          var p = t.play();
          if (p && p.then) p.then(null, function () {});
        }, function () {});
      }
      if (x.s.trailer) {
        chiediJf('Items/' + x.id + '/LocalTrailers', { userId: uid() }).then(function (r) { var l = voci(r); if (l[0]) parti(l[0].Id, 0); }, function () {});
        return;
      }
      var ms = JF.sorgente(x.it), v0 = ms ? JF.flussi(ms, 'Video')[0] : null;
      if (v0 && (+v0.Width || 0) <= 1920 && !/HDR|DOVI|HLG|PQ/i.test(String(v0.VideoRangeType || v0.VideoRange || '')) && JF.strada(x.it, lettiTv()) === 'diretta') parti(x.id, 0.25);
    }, 4000);
  }
  function guardaTrailerJf(x) {
    chiediJf('Items/' + x.id + '/LocalTrailers', { userId: uid() }).then(function (r) {
      var l = voci(r);
      if (!l[0]) { messaggio('Il trailer non c\'e\' su Jellyfin'); return; }
      guardaJf(l[0], { ritorno: riapriScheda(x), daCapo: true, trailer: true });
    }, function () { messaggio('Jellyfin non risponde: riprova'); });
  }

  /* ---------------------------------------------------------- la pagina di una persona */

  function apriPersonaJf(id, indietro) {
    chiediJf('Items/' + id, { userId: uid() }).then(function (p) {
      var s = JF.scheda(p), sotto = [s.nascita ? dataBella(s.nascita) : '', s.luogo, s.morte ? '† ' + dataBella(s.morte) : ''].filter(Boolean).join(' · ');
      apriLibreriaJf({ titolo: s.titolo, persona: { titolo: s.titolo, meta: sotto, trama: s.trama, img: s.img.poster },
        query: { PersonIds: id, IncludeItemTypes: 'Movie,Series', Recursive: true, SortBy: 'PremiereDate,ProductionYear,SortName', SortOrder: 'Descending' },
        indietro: indietro || tornaInizio });
    }, function () { messaggio('Non riesco ad aprire questa persona'); });
  }
  var MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'];
  function dataBella(d) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || ''));
    return m ? (+m[3]) + ' ' + MESI[+m[2] - 1] + ' ' + m[1] : String(d || '');
  }

  /* ---------------------------------------------------------- una libreria di Jellyfin: la griglia, con ordine e filtri */

  var ORDINI = [{ nome: 'Aggiunti di recente', by: 'DateCreated,SortName', ordine: 'Descending' }, { nome: 'Titolo', by: 'SortName', ordine: 'Ascending' },
    { nome: 'Anno', by: 'ProductionYear,PremiereDate,SortName', ordine: 'Descending' }, { nome: 'Voto', by: 'CommunityRating,SortName', ordine: 'Descending' },
    { nome: 'Casuale', by: 'Random', ordine: 'Ascending' }];
  var FILTRI = [{ nome: 'Tutti', f: '' }, { nome: 'Da vedere', f: 'IsUnplayed' }, { nome: 'Visti', f: 'IsPlayed' }, { nome: 'Preferiti', f: 'IsFavorite' }];
  // opz: { titolo, vista (una libreria), query (ParentId, PersonIds, Genres...), persona, collezione, indietro }
  function apriLibreriaJf(opz, sel) {
    var giro = ++lib.giro, vecchia = lib.jf && lib.opz === opz ? lib.barra : null;
    clearInterval(dischiTimer);
    lib = { jf: true, opz: opz, d: '', p: '', voci: [], sel: sel || 0, dom: {}, m: null, giro: giro, tot: 0, pagine: {}, mosso: !!sel,
      indietro: opz.indietro || tornaInizio, barra: vecchia || { o: opz.persona || opz.collezione ? (opz.persona ? 2 : -1) : 0, f: 0, g: 0, generi: null }, inBarra: false };
    if (lib.barra.o < 0) lib.barra.o = 0;
    mostra('libreria');
    pag = null;
    $('lib-conta').textContent = 'Apro…';
    var g0 = $('griglia-dentro');
    svuota(g0);
    caricaPaginaJf(0, function () { if (giro === lib.giro) disegnaLibreria(); });
    // i generi della libreria (per la barra), una volta
    if (opz.vista && !lib.barra.generi) {
      chiediJf('Genres', { ParentId: opz.vista.Id, UserId: uid(), SortBy: 'SortName', Limit: 60 }).then(function (r) {
        if (giro !== lib.giro) return;
        lib.barra.generi = voci(r).map(function (g) { return String(g.Name || ''); }).filter(Boolean);
        disegnaBarra();
      }, function () {});
    }
  }
  function queryLib(da) {
    var o = {}, q = lib.opz.query || {}, k, b = lib.barra, ord = ORDINI[b.o] || ORDINI[0];
    for (k in q) if (Object.prototype.hasOwnProperty.call(q, k)) o[k] = q[k];
    if (lib.opz.vista) {
      o.ParentId = lib.opz.vista.Id;
      o.Recursive = true;
      o.IncludeItemTypes = lib.opz.vista.CollectionType === 'tvshows' ? 'Series' : lib.opz.vista.CollectionType === 'boxsets' ? 'BoxSet' : 'Movie';
    }
    if (!lib.opz.collezione || b.o) { o.SortBy = ord.by; o.SortOrder = ord.ordine; }
    if (FILTRI[b.f] && FILTRI[b.f].f) o.Filters = FILTRI[b.f].f;
    if (b.g && b.generi && b.generi[b.g - 1]) o.Genres = b.generi[b.g - 1];
    o.StartIndex = da;
    o.Limit = 100;
    return conCampi(o);
  }
  // a pagine di 100 (anche con 5000 film: si chiede solo cio' che si vede)
  function caricaPaginaJf(k, poi) {
    if (lib.pagine[k]) { if (poi && lib.pagine[k] === true) poi(); return; }
    lib.pagine[k] = 'in volo';
    var giro = lib.giro;
    chiediJf('Items', queryLib(k * 100)).then(function (r) {
      if (giro !== lib.giro) return;
      var l = voci(r);
      lib.tot = typeof r.TotalRecordCount === 'number' ? r.TotalRecordCount : Math.max(lib.tot, k * 100 + l.length);
      for (var i = 0; i < l.length; i++) lib.voci[k * 100 + i] = { tipo: 'jf', jf: l[i], s: JF.scheda(l[i]), nome: l[i].Name };
      if (lib.voci.length < lib.tot) lib.voci.length = lib.tot;
      lib.pagine[k] = true;
      if (poi) poi(); else if (schermo === 'libreria') finestraGriglia();
    }, function (e) {
      if (giro !== lib.giro) return;
      lib.pagine[k] = false;
      $('lib-conta').textContent = '';
      messaggio(e.codice === 'rete' ? 'Jellyfin non risponde: il Mac e\' acceso?' : 'Non riesco ad aprire questa libreria', 4000);
      if (poi && k === 0) poi();
    });
  }
  function disegnaBarra() {
    var b = $('lib-barra');
    svuota(b);
    b.hidden = !lib.jf;
    if (!lib.jf) return;
    var x = lib.barra, chip = [];
    chip.push('Ordine: ' + (lib.opz.collezione && !x.o ? 'della collezione' : (ORDINI[x.o] || ORDINI[0]).nome));
    chip.push('Mostra: ' + FILTRI[x.f].nome);
    if (x.generi && x.generi.length) chip.push('Genere: ' + (x.g ? x.generi[x.g - 1] : 'tutti'));
    x.n = chip.length;
    if (x.k === undefined || x.k >= chip.length) x.k = 0;
    for (var i = 0; i < chip.length; i++) b.appendChild(el('span', 'chip' + (lib.inBarra && i === x.k ? ' sel' : ''), chip[i]));
  }
  function tastoBarra(a) {
    var x = lib.barra;
    if (a === 'left') { if (x.k > 0) x.k--; }
    else if (a === 'right') { if (x.k < x.n - 1) x.k++; }
    else if (a === 'down') { lib.inBarra = false; finestraGriglia(); }
    else if (a === 'ok') {
      if (x.k === 0) x.o = (x.o + 1) % ORDINI.length;
      else if (x.k === 1) x.f = (x.f + 1) % FILTRI.length;
      else if (x.k === 2 && x.generi) x.g = (x.g + 1) % (x.generi.length + 1);
      var opz = lib.opz;
      apriLibreriaJf(opz, 0);
      lib.inBarra = true;
      disegnaBarra();
      return true;
    }
    disegnaBarra();
    return true;
  }

  /* ---------------------------------------------------------- cerca (tastiera del TV o del telefono) */

  var cerca = { testo: '', filtro: 0, r: null, giro: 0, indietro: null };
  var FILTRI_CERCA = [{ nome: 'Tutto' }, { nome: 'Film', chiave: 'film' }, { nome: 'Serie', chiave: 'serie' }, { nome: 'Persone', chiave: 'persone' }];
  function apriCerca(indietro) {
    if (indietro) cerca.indietro = indietro;
    clearInterval(dischiTimer);
    mostra('cerca');
    sfondo(null);
    disegnaCerca();
    if (!cerca.testo) scriviCerca();
  }
  function scriviCerca() {
    HomeTV.chiediTesto({ titolo: 'Cerca film, serie e persone', valore: cerca.testo }).then(function (t) {
      if (t === null || t === undefined || schermo !== 'cerca') return;
      cerca.testo = String(t).replace(/\s+/g, ' ').trim().slice(0, 100);
      cercaOra();
    });
  }
  function cercaOra() {
    var giro = ++cerca.giro, u = uid(), t = cerca.testo;
    if (!t) { cerca.r = null; disegnaCerca(); return; }
    $('cerca-stato').textContent = 'Cerco "' + t + '"…';
    function lista(tipo) { return chiediJf('Items', conCampi({ searchTerm: t, IncludeItemTypes: tipo, Recursive: true, Limit: 24 })).then(voci, function () { return []; }); }
    Promise.all([lista('Movie'), lista('Series'), lista('Episode'),
      chiediJf('Persons', { searchTerm: t, UserId: u, Limit: 24, EnableImageTypes: 'Primary', ImageTypeLimit: 1 }).then(voci, function () { return []; })]).then(function (r) {
      if (giro !== cerca.giro) return;
      cerca.r = { film: r[0], serie: r[1], puntate: r[2], persone: r[3] };
      disegnaCerca();
    });
  }
  function disegnaCerca() {
    var pp = $('cerca-pulsanti'), righe = $('cerca-righe'), vecchia = pag && pag.corpo === $('cerca-corpo') ? pag : null;
    svuota(pp);
    svuota(righe);
    pp.appendChild(pulsante(cerca.testo ? cerca.testo : 'Scrivi cosa cerchi', 'cerca', scriviCerca));
    FILTRI_CERCA.forEach(function (f, i) {
      var b = pulsante(f.nome, '', function () { cerca.filtro = i; disegnaCerca(); });
      if (i === cerca.filtro) b.className += ' forte';
      pp.appendChild(b);
    });
    nuovaPagina($('cerca-corpo'));
    aggiungiRiga(pp, vociDi(pp), { sezione: $('cerca-sopra'), chiave: 'campo' });
    var r = cerca.r, quante = 0, chiave = (FILTRI_CERCA[cerca.filtro] || {}).chiave;
    function sezione(titolo, k, lista, forma) {
      if (!lista.length || (chiave && chiave !== k)) return;
      quante += lista.length;
      var sz = el('section', 'sezione'), fila = el('div', 'fila');
      sz.appendChild(el('h2', '', titolo + ' · ' + lista.length));
      sz.appendChild(fila);
      righe.appendChild(sz);
      lista.forEach(function (it) {
        if (k === 'persone') {
          var p = el('div', 'persona'), f = el('div', 'foto');
          f.style.backgroundColor = 'hsl(' + tinta(it.Name) + ',38%,30%)';
          f.appendChild(el('div', 'ini', iniziali(it.Name)));
          p.appendChild(f);
          p.appendChild(el('div', 'pn', String(it.Name || '')));
          p.setAttribute('data-tv', '');
          p.addEventListener('click', function () { apriPersonaJf(it.Id, function () { apriCerca(); }); });
          fila.appendChild(p);
          var ref = it.ImageTags && it.ImageTags.Primary ? JF.ref(it.Id, 'Primary', it.ImageTags.Primary) : null;
          if (ref) p.carica = function () { mettiImg(f, '', ref, 180, 180); };
        } else cartaJf(it, forma, fila, { apri: function () { apriJf(it, { indietro: function () { apriCerca(); } }); } });
      });
      aggiungiRiga(fila, vociDi(fila), { sezione: sz, chiave: k });
    }
    if (r) {
      sezione('Film', 'film', r.film, 'poster');
      sezione('Serie', 'serie', r.serie, 'poster');
      sezione('Puntate', 'puntate', r.puntate, 'orizzontale');
      sezione('Persone', 'persone', r.persone);
    }
    $('cerca-stato').textContent = !cerca.testo ? 'OK per scrivere: con la tastiera del TV o dal telefono.' : !r ? '' : quante ? '' : 'Niente per "' + cerca.testo + '".';
    if (vecchia && vecchia.righe[vecchia.r]) {
      var R0 = vecchia.righe[vecchia.r];
      for (var i = 0; i < pag.righe.length; i++) if (pag.righe[i].chiave === R0.chiave) { pag.r = i; pag.righe[i].k = Math.min(R0.k, pag.righe[i].voci.length - 1); }
    }
    evidenzia();
  }

  /* ---------------------------------------------------------- collegare Jellyfin: il server, poi il codice dal telefono */

  var coll = { fase: '', timer: null, indietro: null, giro: 0 };
  function apriCollega(indietro) {
    if (indietro) coll.indietro = indietro;
    clearInterval(dischiTimer);
    mostra('collega');
    sfondo(null);
    if (jfAttivo()) collegaGestisci();
    else if (jf.stato && jf.stato.server) collegaCodice();
    else collegaCerca();
  }
  function collegaPagina(titolo, testo, pulsanti, server) {
    $('collega-titolo').textContent = titolo;
    $('collega-testo').textContent = testo;
    var pp = $('collega-pulsanti'), fs = $('fila-server');
    svuota(pp);
    pulsanti.forEach(function (p) { pp.appendChild(pulsante(p.testo, p.ic || '', p.fn, p.piccolo)); });
    svuota(fs);
    $('sez-server').hidden = !(server && server.length);
    (server || []).forEach(function (sv) {
      var c = el('div', 'carta altro'), q = el('div', 'quadro');
      c.setAttribute('data-tv', '');
      q.appendChild(icona(sv.icona || ICONE.jellyfin));
      q.appendChild(el('div', 'stato', sv.indirizzo.replace(/^https?:\/\//, '')));
      c.appendChild(q);
      c.appendChild(el('div', 'nome', sv.nome || 'Jellyfin'));
      c.addEventListener('click', function () { (sv.fn || scegliServerJf)(sv.indirizzo); });
      fs.appendChild(c);
    });
    nuovaPagina($('collega-corpo'));
    if (server && server.length) aggiungiRiga(fs, vociDi(fs), { sezione: $('sez-server'), chiave: 'server' });
    aggiungiRiga(pp, vociDi(pp), { sezione: $('collega-sopra'), chiave: 'pulsanti' });
    if (server && server.length) pag.r = 0;
    evidenzia();
  }
  function collegaCerca() {
    var giro = ++coll.giro;
    coll.fase = 'cerca';
    $('qc-codice').hidden = true;
    var base = [{ testo: 'Scrivi l\'indirizzo', fn: scriviIndirizzo }, { testo: 'Indietro', fn: function () { coll.indietro(); } }];
    collegaPagina('Collega Jellyfin', 'Cerco Jellyfin nella rete di casa…', base);
    chiedi('jf/cerca').then(function (r) {
      if (giro !== coll.giro || schermo !== 'collega') return;
      var l = r.server || [];
      collegaPagina('Collega Jellyfin', l.length ? 'Scegli il server. Il Mac (o il computer dove gira Jellyfin) deve essere acceso.' :
        'Non vedo Jellyfin nella rete di casa. Controlla che sul Mac sia acceso, oppure scrivi il suo indirizzo (per esempio 192.168.1.20:8096).', base, l);
    }, function (e) {
      if (giro !== coll.giro) return;
      collegaPagina('Collega Jellyfin', e.codice === 'assente' || e.codice === 'vecchio' ? 'Il servizio di questo TV non sa ancora parlare con Jellyfin: riavvia il TV per aggiornarlo.' :
        'Il servizio del TV non risponde: riprova tra poco.', base);
    });
  }
  function scriviIndirizzo() {
    HomeTV.chiediTesto({ titolo: 'Indirizzo di Jellyfin (es. 192.168.1.20:8096)', valore: '' }).then(function (t) { if (t) scegliServerJf(t); });
  }
  function scegliServerJf(indirizzo) {
    $('collega-testo').textContent = 'Mi collego a ' + indirizzo + '…';
    chiedi('jf/server', null, { indirizzo: indirizzo }).then(function (r) {
      jf.stato = r;
      collegaCodice();
    }, function (e) {
      messaggio(erroreServer(e, indirizzo), 5000);
      $('collega-testo').textContent = 'Riprova, o scrivi un altro indirizzo.';
    });
  }
  function erroreServer(e, indirizzo) {
    return e.codice === 'indirizzo' ? 'Indirizzo non valido' : e.codice === 'jellyfin' ? 'A quell\'indirizzo non risponde Jellyfin' :
      e.codice === 'troppe' ? 'Troppi indirizzi provati: riprova tra qualche minuto' :
      e.codice === 'certificato' ? 'Il TV non accetta il certificato https di quel server: prova con http://' + String(indirizzo).replace(/^https?:\/\//i, '') :
      e.codice === 'rete' ? 'Il server non risponde: e\' acceso?' : 'Non riesco a collegarmi';
  }
  // Quick Connect: il codice sul TV, la conferma dal telefono (o dal computer) dove Jellyfin e' gia' aperto
  function collegaCodice() {
    var giro = ++coll.giro;
    coll.fase = 'codice';
    clearTimeout(coll.timer);
    var nome = jf.stato && jf.stato.server ? jf.stato.server.nome : 'Jellyfin';
    var altri = [{ testo: 'Nome e password', fn: collegaPassword }, { testo: 'Cambia server', fn: collegaCerca }, { testo: 'Indietro', fn: function () { coll.giro++; coll.indietro(); } }];
    $('qc-codice').hidden = true;
    collegaPagina('Collega ' + nome, 'Preparo il codice…', altri);
    chiedi('jf/qc', null, {}).then(function (r) {
      if (giro !== coll.giro || schermo !== 'collega') return;
      cifreIn($('qc-codice'), String(r.codice || ''));
      $('qc-codice').hidden = false;
      collegaPagina('Collega ' + nome, 'Sul telefono apri Jellyfin, tocca il tuo profilo, poi Quick Connect, e scrivi questo codice.\n' +
        'Dal computer: la tua immagine in alto a destra › Quick Connect.', altri);
      (function controlla() {
        coll.timer = setTimeout(function () {
          if (giro !== coll.giro || schermo !== 'collega') return;
          chiedi('jf/qc').then(function (s) {
            if (giro !== coll.giro || schermo !== 'collega') return;
            if (s.stato === 'fatto') { collegato(); return; }
            if (s.stato === 'scaduto' || s.stato === 'nessuno') { collegaCodice(); return; }
            controlla();
          }, function () { if (giro === coll.giro) controlla(); });
        }, 2500);
      })();
    }, function (e) {
      if (giro !== coll.giro) return;
      collegaPagina('Collega ' + nome, e.codice === 'quickconnect' ? 'Su questo server Quick Connect e\' spento: entra con nome e password (oppure accendilo in Jellyfin › Pannello di controllo › Generale).' :
        e.codice === 'rete' ? 'Jellyfin non risponde: il Mac e\' acceso?' : 'Non riesco a preparare il codice.', altri);
    });
  }
  // nome e password; senza (o sbagliati) si torna da dove si era venuti (il codice del collegamento, o il riquadro del Mac)
  function collegaPassword(indietro) {
    var poi = typeof indietro === 'function' ? indietro : collegaCodice;
    coll.giro++;
    if (typeof indietro === 'function') benvFerma();
    HomeTV.chiediTesto({ titolo: 'Nome utente di Jellyfin', valore: '' }).then(function (nome) {
      if (!nome) { poi(); return; }
      HomeTV.chiediTesto({ titolo: 'Password di ' + nome, valore: '' }).then(function (pw) {
        if (pw === null || pw === undefined) { poi(); return; }
        chiedi('jf/accedi', null, { nome: nome, password: pw }).then(function () { collegato(); }, function (e) {
          messaggio(e.codice === 'password' ? 'Nome o password sbagliati' : 'Non riesco a entrare', 5000);
          poi();
        });
      });
    });
  }
  function collegato() {
    coll.giro++;
    jfCaricaStato(function () {
      messaggio(jfAttivo() ? 'Jellyfin collegato: ciao ' + jf.stato.utente.nome + '!' : 'Jellyfin collegato', 4000);
      jfCaricaInizio('tutto');
      apriInizio('tieni');
    });
  }
  function collegaGestisci() {
    var st = jf.stato, giro = ++coll.giro;
    coll.fase = 'gestisci';
    $('qc-codice').hidden = true;
    collegaPagina('Jellyfin', 'Collegato a ' + st.server.nome + ' (' + st.server.indirizzo.replace(/^https?:\/\//, '') + ', versione ' + st.server.versione + ') come ' +
      st.utente.nome + '.\nIl collegamento lo tiene il servizio del TV: l\'app non vede mai la chiave di Jellyfin.', [
      { testo: 'Indietro', fn: function () { coll.indietro(); } },
      { testo: 'Scollega', fn: function () {
        chiedi('jf/esci', null, {}).then(function (r) { if (giro !== coll.giro) return; jf.stato = r; jf.dati = null; messaggio('Jellyfin scollegato'); apriInizio('tieni'); },
          function () { messaggio('Non riesco a scollegare: riprova'); });
      } },
      { testo: 'Cambia server', fn: collegaCerca }]);
  }

  /* il limitatore ai picchi del Mac: si collega con un codice di 6 cifre che il Mac mostra (notifica e finestra del limitatore) */
  function apriCollegaMac(indietro) {
    if (indietro) coll.indietro = indietro;
    clearInterval(dischiTimer);
    mostra('collega');
    sfondo(null);
    $('qc-codice').hidden = true;
    if (macAttivo()) macGestisci(); else macCerca();
  }
  function macIndietro() { coll.giro++; coll.indietro(); }
  function macCerca() {
    var giro = ++coll.giro;
    coll.fase = 'mac';
    var base = [{ testo: 'Scrivi l\'indirizzo', fn: macScriviIndirizzo }, { testo: 'Indietro', fn: macIndietro }];
    collegaPagina('Collega il Mac', 'Cerco il limitatore sul Mac di Jellyfin…', base);
    chiedi('mac/cerca').then(function (r) {
      if (giro !== coll.giro || schermo !== 'collega') return;
      var l = (r.trovati || []).map(function (ind) { return { indirizzo: ind, nome: 'Limitatore', icona: ICONE.picchi, fn: macAbbina }; });
      collegaPagina('Collega il Mac', l.length ? 'Scegli il Mac. Il limitatore toglie i picchi dei film troppo pesanti per la rete o per il TV.' :
        'Non trovo il limitatore. Sul Mac accendilo (doppio clic su avvia-limitatore.command), poi scrivi qui l\'indirizzo del Mac con :8097.', base, l);
    }, function (e) {
      if (giro !== coll.giro) return;
      collegaPagina('Collega il Mac', e.codice === 'assente' || e.codice === 'vecchio' ? 'Il servizio di questo TV non sa ancora parlare col Mac: riavvia il TV per aggiornarlo.' :
        'Non riesco a cercare il Mac: riprova.', base);
    });
  }
  function macScriviIndirizzo() {
    var s0 = jf.stato && jf.stato.server ? jf.stato.server.indirizzo.replace(/^https?:\/\//, '').replace(/[:\/].*$/, '') + ':8097' : '';
    HomeTV.chiediTesto({ titolo: 'Indirizzo del Mac (es. 192.168.1.20:8097)', valore: s0 }).then(function (t) { if (t) macAbbina(t); });
  }
  function macAbbina(indirizzo) {
    var giro = ++coll.giro;
    coll.macInd = indirizzo;
    var altri = [{ testo: 'Scrivi il codice', fn: macCodice }, { testo: 'Un altro codice', fn: function () { macAbbina(indirizzo); } }, { testo: 'Indietro', fn: macIndietro }];
    collegaPagina('Collega il Mac', 'Chiedo un codice al Mac…', [{ testo: 'Indietro', fn: macIndietro }]);
    chiedi('mac/abbina', null, { indirizzo: indirizzo }).then(function () {
      if (giro !== coll.giro || schermo !== 'collega') return;
      collegaPagina('Collega il Mac', 'Sul Mac è comparso un codice di 6 cifre (in una notifica e nella finestra del limitatore). Scrivilo qui: vale 5 minuti.', altri);
    }, function (e) {
      if (giro !== coll.giro) return;
      collegaPagina('Collega il Mac', e.codice === 'indirizzo' ? 'Indirizzo non valido.' : e.codice === 'limitatore' ? 'A quell\'indirizzo non risponde il limitatore.' :
        e.codice === 'troppe' ? 'Troppi tentativi: riprova tra qualche minuto.' : e.codice === 'rete' ? 'Il Mac non risponde: è acceso? E il limitatore?' :
        'Non riesco a collegarmi.', [{ testo: 'Riprova', fn: macCerca }, { testo: 'Indietro', fn: macIndietro }]);
    });
  }
  function macCodice() {
    var giro = coll.giro;
    HomeTV.chiediTesto({ titolo: 'Il codice del Mac (6 cifre)', valore: '' }).then(function (t) {
      if (!t || giro !== coll.giro) return;
      chiedi('mac/codice', null, { codice: t }).then(function (r) {
        mac.stato = r;
        messaggio('Mac collegato: nel lettore, Giù › Qualità › Senza picchi', 5000);
        macIndietro();
      }, function (e) {
        if (e.codice === 'scaduto') { messaggio('Codice scaduto: ne chiedo un altro', 4000); macAbbina(coll.macInd); return; }
        messaggio(e.codice === 'codice' ? 'Codice sbagliato: riprova' : e.codice === 'rete' ? 'Il Mac non risponde' : 'Non riesco a collegarmi', 4500);
      });
    });
  }
  function macGestisci() {
    var giro = ++coll.giro, st = mac.stato;
    coll.fase = 'mac';
    var pulsanti = [{ testo: 'Indietro', fn: macIndietro }, { testo: 'Scollega', fn: function () {
      chiedi('mac/esci', null, {}).then(function (r) { mac.stato = r; messaggio('Mac scollegato'); macIndietro(); }, function () { messaggio('Non riesco a scollegare: riprova'); });
    } }];
    var base = 'Collegato al limitatore del Mac (' + st.server.indirizzo.replace(/^https?:\/\//, '') + '). Nel lettore di un film di Jellyfin: Giù › Qualità › Senza picchi.';
    collegaPagina('Senza picchi · Mac', base, pulsanti);
    chiedi('mac/stato', { vivo: 1 }).then(function (r) {
      if (giro !== coll.giro || schermo !== 'collega') return;
      mac.stato = r;
      if (!r.collegato) { macCerca(); return; }
      var c = r.mac && r.mac.cartelle || [];
      collegaPagina('Senza picchi · Mac', base + '\n' + (!r.acceso ? 'Il Mac adesso non risponde: è acceso?' : c.length ?
        'Cartelle che il Mac guarda: ' + c.map(function (x) { return x.nome + (x.esiste ? '' : ' (disco staccato?)'); }).join(', ') + '.' :
        'Il Mac non guarda ancora nessuna cartella: aggiungila sul Mac (node limitatore.js cartella Film "/Volumes/T7/film").'), pulsanti);
    }, function () {});
  }

  /* ============================================================ una cartella: la griglia delle copertine
   * Si disegnano solo le righe vicine a quella scelta (anche con 3000 video); le frecce le gestisce l'app. */

  var lib = { d: '', p: '', voci: [], sel: 0, dom: {}, m: null, giro: 0, troppi: false };
  function apriLibreria(d, p, scegliNome, poi) {
    var giro = ++lib.giro;
    clearInterval(dischiTimer);
    $('lib-conta').textContent = 'Apro…';
    chiedi('cartella', { d: d, p: p }).then(function (r) {
      if (giro !== lib.giro) return; // nel frattempo Indietro o un'altra cartella
      var voci = [];
      (r.cartelle || []).forEach(function (c) { voci.push({ tipo: 'cartella', nome: c.nome, p: unisci(p, c.nome) }); });
      (r.video || []).forEach(function (v) { voci.push({ tipo: 'video', nome: v.nome, p: unisci(p, v.nome), dim: v.dim, data: v.data }); });
      lib = { d: d, p: p, voci: voci, sel: 0, dom: {}, m: null, giro: giro, troppi: !!r.troppi, sotto: r.sotto || [], video: r.video || [], jf: false };
      for (var i = 0; i < voci.length; i++) if (scegliNome && voci[i].nome === scegliNome) lib.sel = i;
      mostra('libreria');
      pag = null;
      disegnaLibreria();
      if (poi) poi();
    }, function (e) {
      if (giro !== lib.giro) return;
      $('lib-conta').textContent = '';
      if (e.codice === 'disco') { messaggio('La chiavetta non c\'è più'); apriInizio(); return; }
      messaggio(e.codice === 'permesso' ? 'Il TV non lascia leggere questa cartella' : e.codice === 'lento' || e.codice === 'servizio' ?
        'Il servizio del TV non risponde: riprova' : 'Non riesco ad aprire la cartella', 4000);
    });
  }
  function unisci(p, nome) { return p ? p + '/' + nome : nome; }
  function misureGriglia() {
    var W = window.innerWidth, H = window.innerHeight, col = 7, tw = W * 0.106;
    return { col: col, tw: tw, th: tw * 1.5 + H * 0.098, gx: (W * 0.88 - col * tw) / (col - 1), pw: Math.round(tw * 1.25), ph: Math.round(tw * 1.875) };
  }
  function disegnaLibreria() {
    var g = $('griglia-dentro');
    svuota(g);
    lib.dom = {};
    lib.m = misureGriglia();
    var bric = $('briciole'), parti = lib.p ? lib.p.split('/') : [];
    svuota(bric);
    disegnaBarra();
    if (lib.jf) {
      bric.appendChild(el('b', '', lib.opz.titolo || 'Jellyfin'));
      $('lib-conta').textContent = lib.tot ? lib.tot + (lib.tot === 1 ? ' titolo' : ' titoli') : '';
      $('vuoto-cartella').textContent = lib.barra.f || lib.barra.g ? 'Niente con questi filtri.' : 'Qui non c\'è niente.';
      $('vuoto-cartella').hidden = lib.tot > 0;
      if (!lib.tot) { $('ls-titolo').textContent = lib.opz.titolo || ''; svuota($('ls-meta')); $('ls-trama').textContent = ''; sfondo(null); }
      finestraGriglia();
      return;
    }
    $('vuoto-cartella').textContent = 'Qui non ci sono video.';
    // solo le ultime due parti: la cartella dove sei si legge sempre
    var mostrate = [nomeDisco(lib.d)].concat(parti);
    if (mostrate.length > 3) mostrate = ['…'].concat(mostrate.slice(-2));
    for (var i = 0; i < mostrate.length; i++) {
      if (i) bric.appendChild(document.createTextNode('  ›  '));
      if (i === mostrate.length - 1) bric.appendChild(el('b', '', mostrate[i])); else bric.appendChild(document.createTextNode(mostrate[i]));
    }
    var nv = lib.voci.filter(function (v) { return v.tipo === 'video'; }).length, nc = lib.voci.length - nv;
    $('lib-conta').textContent = [nc ? nc + (nc === 1 ? ' cartella' : ' cartelle') : '', nv ? nv + ' video' : ''].filter(Boolean).join(' · ') +
      (lib.troppi ? ' · solo i primi 3000' : '');
    $('vuoto-cartella').hidden = lib.voci.length > 0;
    if (!lib.voci.length) { $('ls-titolo').textContent = parti.length ? parti[parti.length - 1] : nomeDisco(lib.d); $('ls-meta').textContent = ''; $('ls-trama').textContent = ''; sfondo(null); }
    finestraGriglia();
  }
  function titoloVoce(v) {
    var s = v.scheda;
    if (s && s.titolo) return s.tipo === 'puntata' && s.episodio >= 0 ? s.episodio + '. ' + s.titolo : s.titolo;
    if (v.tipo === 'cartella') return v.nome;
    var t = titoloDi(v.nome);
    return t.episodio ? 'S' + t.stagione + ' E' + t.episodio + ' · ' + t.titolo : t.titolo;
  }
  function sottoVoce(v) {
    var s = v.scheda;
    if (s) {
      if (s.tipo === 'serie') return 'Serie' + (s.anno ? ' · ' + s.anno : '');
      if (s.tipo === 'stagione') return s.serie && s.serie.titolo ? s.serie.titolo : 'Stagione';
      if (s.tipo === 'cartella') return typeof s.video === 'number' && s.video ? s.video + ' video' : 'Cartella';
      if (s.tipo === 'puntata') return 'Stagione ' + s.stagione + (v.dim ? ' · ' + peso(v.dim) : '');
      return (s.anno ? s.anno + ' · ' : '') + (v.dim ? peso(v.dim) : 'Film');
    }
    if (v.tipo === 'cartella') return 'Cartella';
    var t = titoloDi(v.nome);
    return (t.anno ? t.anno + ' · ' : '') + peso(v.dim);
  }
  // le righe in vista: da una prima della scelta a due dopo (le altre si tolgono: anche con 3000 video la pagina e' leggera)
  function finestraGriglia() {
    var m = lib.m, rs = Math.floor(lib.sel / m.col), righe = Math.ceil(lib.voci.length / m.col);
    var da = Math.max(0, rs - 1), a = Math.min(righe - 1, rs + 2), i;
    for (var k in lib.dom) {
      if (!Object.prototype.hasOwnProperty.call(lib.dom, k)) continue;
      var r = Math.floor(+k / m.col);
      if (r < da || r > a) { var t0 = lib.dom[k]; if (t0.parentNode) t0.parentNode.removeChild(t0); delete lib.dom[k]; }
    }
    for (var r2 = da; r2 <= a; r2++) {
      for (var c = 0; c < m.col; c++) {
        i = r2 * m.col + c;
        // Jellyfin: le voci arrivano a pagine; quelle che mancano si chiedono adesso
        if (i < lib.voci.length && !lib.dom[i]) { if (lib.voci[i]) tile(i); else if (lib.jf) caricaPaginaJf(Math.floor(i / 100)); }
      }
    }
    $('griglia-dentro').style.transform = 'translateY(' + (-Math.round(rs * m.th)) + 'px)';
    for (var j in lib.dom) if (Object.prototype.hasOwnProperty.call(lib.dom, j)) lib.dom[j].className = 'tile' + (+j === lib.sel && !lib.inBarra ? ' sel' : '');
    sceltaLibreria();
  }
  function tile(i) {
    var v = lib.voci[i], m = lib.m, t = el('div', 'tile'), cop = el('div', 'copertina');
    t.style.left = Math.round((i % m.col) * (m.tw + m.gx)) + 'px';
    t.style.top = Math.round(Math.floor(i / m.col) * m.th) + 'px';
    t.setAttribute('data-tv', '');
    if (v.jf) return tileJf(i, v, t, cop);
    var tt = titoloDi(v.nome);
    cop.appendChild(finta(v.tipo === 'cartella' ? v.nome : tt.titolo, v.tipo === 'cartella' ? '' : tt.episodio ? 'S' + tt.stagione + ' E' + tt.episodio : tt.anno, v.tipo === 'cartella' ? 'cartella' : tt.episodio ? 'puntata' : 'film'));
    t.appendChild(cop);
    var nome = el('div', 'nome', titoloVoce(v)), sotto = el('div', 'sotto', sottoVoce(v));
    t.appendChild(nome);
    t.appendChild(sotto);
    if (v.tipo === 'video') segniVisto(cop, v);
    t.addEventListener('click', function () { lib.sel = i; finestraGriglia(); apriVoce(i); });
    $('griglia-dentro').appendChild(t);
    lib.dom[i] = t; // prima della scheda: se e' gia' in memoria arriva subito
    var giro = lib.giro;
    chiediScheda(lib.d, v.p, false, function (s) {
      if (!s || giro !== lib.giro) return;
      v.scheda = s;
      if (lib.dom[i] !== t) return;
      nome.textContent = titoloVoce(v);
      sotto.textContent = sottoVoce(v);
      var ref = s.img.poster || (s.tipo === 'stagione' && s.img.stagione) || null;
      if (ref) {
        mettiImg(cop, lib.d, ref, m.pw, m.ph, false, function (si) { var f = cop.querySelector('.finta'); if (si && f) f.style.opacity = '0'; });
      } else if (s.titolo) {
        // niente poster: la copertina disegnata col titolo vero
        var f0 = cop.querySelector('.finta');
        if (f0) cop.replaceChild(finta(s.titolo, s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio : s.anno, s.tipo === 'cartella' && !s.cartellaFilm ? 'cartella' : s.tipo), f0);
      }
      if (i === lib.sel) sceltaLibreria();
    });
    return t;
  }
  function tileJf(i, v, t, cop) {
    var s = v.s, m = lib.m;
    cop.appendChild(finta(s.titolo, s.anno || '', s.tipo === 'serie' ? 'serie' : s.tipo === 'collezione' ? 'cartella' : 'film'));
    if (s.visto && s.tipo !== 'serie') { var vs = el('div', 'vista'); vs.appendChild(icona(ICONE.spunta)); cop.appendChild(vs); }
    else if (s.percento > 0 && s.percento < 100) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.round(s.percento) + '%'; b.appendChild(f); cop.appendChild(b); }
    else if (s.tipo === 'serie' && s.nonVisti) cop.appendChild(el('div', 'cartella-segno', String(s.nonVisti)));
    t.appendChild(cop);
    t.appendChild(el('div', 'nome', s.titolo));
    t.appendChild(el('div', 'sotto', sottoJf(s)));
    t.addEventListener('click', function () { lib.sel = i; lib.inBarra = false; finestraGriglia(); apriVoce(i); });
    $('griglia-dentro').appendChild(t);
    lib.dom[i] = t;
    sfuma(cop, s.img.poster);
    if (s.img.poster) mettiImg(cop, '', s.img.poster, m.pw, m.ph, false, function (si) { arrivata(cop, si); });
    return t;
  }
  // visto (spunta) o a meta' (barra)
  function segniVisto(box, v) {
    var pt = puntoDi(lib.d, v.p, v.dim);
    if (!pt) return;
    if (pt.finito) { var s = el('div', 'vista'); s.appendChild(icona(ICONE.spunta)); box.appendChild(s); return; }
    if (riprendibile(pt)) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.min(100, Math.round(pt.t / Math.max(1, pt.dur) * 100)) + '%'; b.appendChild(f); box.appendChild(b); }
  }
  // in alto: titolo, anno, durata, voto e trama della voce scelta; lo sfondo e' la sua copertina sfocata
  var sceltaTimer = null;
  function sceltaLibreria() {
    var v = lib.voci[lib.sel];
    if (lib.jf) {
      // la pagina di una persona: lei in alto finche' non ci si muove
      var pe = lib.opz.persona;
      if (pe && !lib.mosso) {
        $('ls-titolo').textContent = pe.titolo;
        $('ls-meta').textContent = pe.meta || '';
        $('ls-trama').textContent = pe.trama || '';
        sfondo('', pe.img || null, false);
        return;
      }
      if (!v) return;
      $('ls-titolo').textContent = v.s.titolo;
      metaDi($('ls-meta'), v.s, null, v.s.tipo === 'serie' ? 'Serie' : v.s.tipo === 'collezione' ? 'Collezione' : '');
      $('ls-trama').textContent = v.s.trama;
      sfondo('', v.s.img.fanart || v.s.img.poster || null, !!v.s.img.fanart);
      return;
    }
    if (!v) return;
    var s = v.scheda, tt = titoloDi(v.nome);
    $('ls-titolo').textContent = s && s.titolo ? (s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo) : v.tipo === 'cartella' ? v.nome : tt.titolo;
    if (s) {
      metaDi($('ls-meta'), s, null, s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') : s.tipo === 'serie' ? 'Serie' :
        s.tipo === 'stagione' ? s.titolo : s.tipo === 'cartella' ? 'Cartella' : '');
      $('ls-trama').textContent = s.trama || (s.serie && s.serie.trama) || '';
      var fa = s.img.fanart || s.img.landscape || (s.serie && s.serie.img && s.serie.img.fanart) || null;
      sfondo(lib.d, fa || s.img.poster || null, !!fa);
    } else {
      svuota($('ls-meta'));
      $('ls-meta').textContent = v.tipo === 'cartella' ? 'Cartella' : (tt.anno ? tt.anno + '   ' : '') + peso(v.dim);
      $('ls-trama').textContent = '';
    }
  }
  function tastoLibreria(a) {
    if (lib.jf && lib.inBarra) return tastoBarra(a);
    var m = lib.m;
    if (lib.jf && a === 'up' && (!lib.voci.length || lib.sel < (m ? m.col : 1))) { lib.inBarra = true; disegnaBarra(); if (m) finestraGriglia(); return true; }
    if (!m || !lib.voci.length) return a === 'up' || a === 'down' || a === 'left' || a === 'right';
    var i = lib.sel, n = lib.voci.length;
    if (a === 'left') { if (i % m.col > 0) i--; }
    else if (a === 'right') { if (i % m.col < m.col - 1 && i + 1 < n) i++; }
    else if (a === 'up') { if (i - m.col >= 0) i -= m.col; }
    else if (a === 'down') { if (i + m.col < n) i += m.col; else if (Math.floor(i / m.col) < Math.floor((n - 1) / m.col)) i = n - 1; }
    else if (a === 'ok') { apriVoce(i); return true; }
    else if (a === 'play') { var v = lib.voci[i]; if (v && (v.tipo === 'video' || (v.jf && /^(Movie|Episode|Video)$/.test(v.jf.Type)))) guardaVoce(v); else apriVoce(i); return true; }
    else return false;
    if (i !== lib.sel) { lib.sel = i; lib.mosso = true; finestraGriglia(); }
    return true;
  }
  // per tornare a questa libreria di Jellyfin, sulla stessa copertina
  function riapriLibreria() { var o = lib.opz, sel = lib.sel; return function () { apriLibreriaJf(o, sel); }; }
  // OK su una copertina: la cartella di un film o di una serie apre la sua scheda; un video la sua; le altre si aprono
  function apriVoce(i) {
    var v = lib.voci[i];
    if (!v) return;
    if (v.jf) { apriJf(v.jf, { indietro: riapriLibreria() }); return; }
    if (v.tipo === 'video') { apriScheda(lib.d, v.p, { da: 'libreria', video: true }); return; }
    function decidi(s) {
      if (s && s.cartellaFilm && s.video) apriScheda(lib.d, unisci(v.p, s.video), { da: 'libreria', cartellaFilm: v.p, video: true });
      else if (s && (s.tipo === 'serie' || s.tipo === 'stagione')) apriScheda(lib.d, v.p, { da: 'libreria', video: false });
      else apriLibreria(lib.d, v.p);
    }
    if (v.scheda) decidi(v.scheda); else chiediScheda(lib.d, v.p, false, decidi);
  }
  function guardaVoce(v) {
    if (v.jf) { guardaJf(v.jf, { ritorno: riapriLibreria(), t: riprendibileJf(v.s) ? v.s.punto : 0 }); return; }
    var pt = puntoDi(lib.d, v.p, v.dim);
    apriVideo({ d: lib.d, p: v.p, nome: v.nome, dim: v.dim }, { vicini: lib.video.slice(), cartella: lib.p, sotto: lib.sotto, ritorno: 'libreria', t: riprendibile(pt) ? pt.t : -1 });
  }
  function indietroLibreria() {
    if (!lib.p) { apriInizio('dischi'); return; }
    var k = lib.p.lastIndexOf('/');
    apriLibreria(lib.d, k === -1 ? '' : lib.p.slice(0, k), lib.p.slice(k + 1));
  }

  /* ============================================================ la scheda: film, puntata, serie, stagione */

  var sch = null, schGiro = 0;
  // da: dove si torna con Indietro ('libreria', 'inizio'); cartellaFilm: la cartella del film (si torna sulla sua copertina)
  function apriScheda(d, p, opz) {
    opz = opz || {};
    var giro = ++schGiro, x = sch = { d: d, p: p, da: opz.da || 'libreria', cartellaFilm: opz.cartellaFilm || '', s: null, info: null, giro: giro,
      audio: 0, sotto: null, stagioni: [], puntate: [], stagione: opz.stagione };
    clearInterval(dischiTimer);
    mostra('scheda');
    var nome = p.split('/').pop(), tt = titoloDi(nome), logo = $('sc-logo');
    svuota(logo);
    logo.appendChild(el('h1', '', tt.titolo || nome));
    $('sc-sopratitolo').textContent = '';
    svuota($('sc-meta'));
    svuota($('sc-badge'));
    $('sc-slogan').textContent = '';
    $('sc-trama').textContent = '';
    svuota($('sc-pulsanti'));
    svuota($('sc-righe'));
    $('sc-avviso').hidden = true;
    $('sc-resta').hidden = true;
    ['sez-stagioni', 'sez-puntate', 'sez-collezione', 'sez-cast', 'sez-simili', 'sez-info'].forEach(function (id) { $(id).hidden = true; });
    nuovaPagina($('scheda-corpo'));
    evidenzia();
    var video = opz.video !== undefined ? !!opz.video : /\.(mkv|webm|mk3d|mp4|m4v|mov|avi|ts|m2ts|mts|mpg|mpeg|wmv|asf|3gp|vob|flv|trp|tp)$/i.test(nome);
    chiediScheda(d, p, video, function (s) {
      if (x.giro !== schGiro) return;
      x.s = s || { tipo: video ? 'film' : 'cartella', titolo: tt.titolo || nome, anno: tt.anno, img: {}, cast: [], generi: [], studi: [], registi: [], scrittori: [] };
      if (!video || x.s.tipo === 'serie' || x.s.tipo === 'stagione') { schedaSerie(x); return; }
      x.voce = { d: d, p: p, nome: nome, dim: 0 };
      disegnaScheda(x);
      chiedi('info', { d: d, p: p, lingue: lingueDi(x.voce) }).then(function (info) {
        if (x.giro !== schGiro) return;
        x.info = info;
        x.voce.dim = info.dim;
        x.audio = (info.scelta && info.scelta.audio) || 0;
        disegnaScheda(x);
      }, function (e) {
        if (x.giro !== schGiro) return;
        $('sc-avviso').textContent = e.codice === 'disco' ? 'La chiavetta non c\'è più.' : e.codice === 'lento' || e.codice === 'servizio' ?
          'Il servizio del TV non risponde: riprova tra poco.' : 'Non riesco a leggere questo file.';
        $('sc-avviso').hidden = false;
      });
    });
  }
  // quale logo ha la scheda (o nessuno): si rifa' solo quando cambia. La scheda corta della chiavetta arriva senza, e quella
  // piena col logo; tornando dal lettore (che lascia andare le immagini) si rifa' comunque (logoFatto = false)
  function chiaveLogo(s) { var l = s && s.img ? s.img.logo : null; return l ? 'logo:' + l.p + '|' + (l.k === undefined ? '' : l.k) : 'titolo'; }
  function disegnaScheda(x) {
    var s = x.s, d = x.d, info = x.info, logo = $('sc-logo');
    var titolo = s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo;
    $('sc-sopratitolo').textContent = s.tipo === 'puntata' ? 'Stagione ' + s.stagione + ' · Puntata ' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') :
      s.collezione ? s.collezione : '';
    if (x.logoFatto !== chiaveLogo(s)) {
      x.logoFatto = chiaveLogo(s);
      svuota(logo);
      logo.appendChild(el('h1', '', titolo));
      if (s.img.logo) mettiImg(logo, d, s.img.logo, 500, 192, true, function (si) { if (si && x.giro === schGiro) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    }
    metaDi($('sc-meta'), s, info, '');
    if (info && info.durata) $('sc-meta').appendChild(el('span', '', finisceAlle(info.durata - (riprendibile(puntoDi(d, x.p, info.dim), info.durata) ? puntoDi(d, x.p, info.dim).t : 0))));
    etichetteIn($('sc-badge'), info ? etichetteInfo(info) : []);
    $('sc-slogan').textContent = s.slogan || '';
    $('sc-trama').textContent = s.trama || (s.serie && s.serie.trama) || '';
    // i pulsanti: Guarda o Riprendi, Dall'inizio, Audio e Sottotitoli scelti prima di partire
    var pp = $('sc-pulsanti'), pt = info ? puntoDi(d, x.p, info.dim) : null, ripr = riprendibile(pt, info && info.durata);
    svuota(pp);
    function parti(daCapo) {
      apriVideo(x.voce, { info: info, cartella: x.p.replace(/\/?[^\/]*$/, ''), ritorno: 'scheda', daCapo: daCapo, t: daCapo ? 0 : ripr ? pt.t : -1,
        audio: x.audio, sotto: null, sottoScelto: x.sotto, conVicini: true });
    }
    x.guarda = function () { parti(false); };
    pp.appendChild(pulsante(ripr ? 'Riprendi' : 'Guarda', 'play', function () { parti(false); }, ripr ? 'da ' + tempo(pt.t) : ''));
    if (ripr) pp.appendChild(pulsante('Dall\'inizio', 'ripeti', function () { parti(true); }, '', true));
    restaIn($('sc-resta'), ripr && info.durata ? pt.t / info.durata : -1, ripr && info.durata ? info.durata - pt.t : 0);
    if (info) {
      var buoni = info.audio.filter(function (a) { return a.letto; });
      if (buoni.length > 1) {
        var a = info.audio.filter(function (z) { return z.num === x.audio; })[0];
        pp.appendChild(pulsante('Audio', 'audio', function () {
          var k = 0;
          for (var i = 0; i < buoni.length; i++) if (buoni[i].num === x.audio) k = i;
          x.audio = buoni[(k + 1) % buoni.length].num;
          disegnaScheda(x);
        }, a ? nomeLingua(a.lingua) + ' · ' + a.nomeCodec + (a.tv ? ' dal TV' : '') : ''));
      }
      var sl = info.sotto.filter(function (z) { return z.leggibile; });
      if (sl.length) {
        var sc = x.sotto ? sl.filter(function (z) { return z.num === x.sotto; })[0] : null;
        pp.appendChild(pulsante('Sottotitoli', 'testo', function () {
          var k = -1;
          for (var i = 0; i < sl.length; i++) if (sl[i].num === x.sotto) k = i;
          x.sotto = k + 1 < sl.length ? sl[k + 1].num : null;
          disegnaScheda(x);
        }, sc ? nomeLingua(sc.lingua) + (sc.forzata ? ' forzati' : '') : 'Automatici'));
      }
    }
    // le righe: regia, generi, studio, file
    var righe = $('sc-righe');
    svuota(righe);
    function riga(a, b) { if (!b) return; var r = el('div'); r.appendChild(el('span', 'k', a)); r.appendChild(el('b', '', b)); righe.appendChild(r); }
    riga('Regia', (s.registi || []).join(', '));
    riga('Scritto da', (s.scrittori || []).join(', '));
    riga('Studio', (s.studi || []).join(', '));
    if (info && info.video) riga('Video', info.video.nomeCodec + ' · ' + info.video.largh + '×' + info.video.alt + (info.video.hdr ? ' · ' + (info.video.hdr === 'DV' ? 'Dolby Vision ' + (info.video.dv ? info.video.dv.profilo + ' ' : '') + '(' + notaDv(info.video.dv) + ')' : info.video.hdr) : ''));
    if (info && info.audio.length) riga('Audio', info.audio.slice(0, 4).map(function (a) {
      return nomeLingua(a.lingua) + ' ' + a.nomeCodec + (a.canali ? ' ' + canali(a.canali) : '') + (a.tv ? ' (lo converte il TV)' : a.letto ? '' : ' (il TV non lo legge)');
    }).join(', ') + (info.audio.length > 4 ? '…' : ''));
    if (info) riga('File', x.p.split('/').pop() + ' · ' + peso(info.dim) + (info.mbps ? ' · ' + String(info.mbps).replace('.', ',') + ' Mbps' : ''));
    $('sez-info').hidden = !righe.children.length;
    var avv = info ? avvisoDi(info) : '';
    // il TV non sente questo film: lo stesso su Jellyfin si sente (il Mac converte l'audio)
    // Dolby Vision 5: lo stesso film su Jellyfin si vede coi colori giusti (il Mac lo converte)
    if (info && info.avvisi.indexOf('colori') !== -1) {
      if (!jfAttivo()) avv = avv.replace(/ Si vede giusto.*$/, ' Si vede giusto da Jellyfin sul Mac, che lo converte (Altro › Collega Jellyfin).');
      else if (x.gemello === undefined) {
        x.gemello = null;
        cercaGemelloJf(s, info, x.p, function (it) { if (sch === x) { x.gemello = it || false; disegnaScheda(x); } });
      } else if (x.gemello) {
        avv = avv.replace(/ Si vede giusto.*$/, ' Su Jellyfin c\'è lo stesso film: "Guarda da Jellyfin" lo mostra coi colori giusti.');
        pp.insertBefore(pulsante('Guarda da Jellyfin', 'jellyfin', function () { guardaJf(x.gemello, { ritorno: 'scheda' }); }, 'colori giusti'), pp.firstChild);
      } else if (x.gemello === false) avv = avv.replace(/ Si vede giusto.*$/, ' Su Jellyfin non trovo lo stesso film: aggiungilo alla libreria di Jellyfin e il Mac lo convertirà.');
    } else if (info && info.avvisi.indexOf('audio') !== -1) {
      if (!jfAttivo()) avv = avv.replace(/ Si potrà sentire.*$/, ' Con Jellyfin sul Mac si sente: il Mac converte l\'audio (Altro › Collega Jellyfin).');
      else if (x.gemello === undefined) {
        x.gemello = null;
        cercaGemelloJf(s, info, x.p, function (it) { if (sch === x) { x.gemello = it || false; disegnaScheda(x); } });
      } else if (x.gemello) {
        avv = avv.replace(/ Si potrà sentire.*$/, ' Su Jellyfin c\'è lo stesso film: "Guarda da Jellyfin" lo fa sentire (il Mac converte l\'audio).');
        pp.insertBefore(pulsante('Guarda da Jellyfin', 'jellyfin', function () { guardaJf(x.gemello, { ritorno: 'scheda' }); }, 'con l\'audio'), pp.firstChild);
      } else if (x.gemello === false) avv = avv.replace(/ Si potrà sentire.*$/, ' Su Jellyfin non trovo lo stesso film: aggiungilo alla libreria di Jellyfin e il Mac ne convertirà l\'audio.');
    }
    $('sc-avviso').textContent = avv;
    $('sc-avviso').hidden = !avv;
    sfondo(d, s.img.fanart || s.img.landscape || (s.serie && s.serie.img && s.serie.img.fanart) || s.img.poster, true, true);
    // il cast
    disegnaCast(x);
    var k0 = pag && pag.righe[0] ? pag.righe[0].k : 0;
    nuovaPagina($('scheda-corpo'));
    aggiungiRiga(pp, vociDi(pp), { sezione: $('sc-sopra'), k: k0 });
    if (!$('sez-cast').hidden) aggiungiRiga($('fila-cast'), vociDi($('fila-cast')), { sezione: $('sez-cast') });
    if (!$('sez-info').hidden) aggiungiRiga($('fila-info'), vociDi($('fila-info')), { sezione: $('sez-info'), chiave: 'info' });
    evidenzia();
  }
  function disegnaCast(x) {
    var s = x.s, fila = $('fila-cast'), cast = (s.cast && s.cast.length ? s.cast : s.serie && s.serie.cast) || [];
    svuota(fila);
    $('sez-cast').hidden = !cast.length;
    cast.slice(0, 20).forEach(function (c) {
      var p = el('div', 'persona'), f = el('div', 'foto');
      f.style.backgroundColor = 'hsl(' + tinta(c.nome) + ',38%,30%)';
      f.appendChild(el('div', 'ini', iniziali(c.nome)));
      p.appendChild(f);
      p.appendChild(el('div', 'pn', c.nome));
      p.appendChild(el('div', 'pr', c.ruolo || ''));
      p.setAttribute('data-tv', '');
      p.addEventListener('click', function () { if (x.jf && c.id) apriPersonaJf(c.id, riapriScheda(x)); });
      fila.appendChild(p);
      // la foto quando la fila del cast si avvicina (caricaVicine)
      if (c.foto) p.carica = function () { mettiImg(f, x.d || '', c.foto, 180, 180); };
    });
  }
  // una serie (o una sua stagione): le stagioni, le puntate della stagione scelta, Riprendi la puntata giusta
  function schedaSerie(x) {
    var s = x.s, d = x.d, cartellaSerie = s.tipo === 'stagione' ? x.p.replace(/\/?[^\/]*$/, '') : x.p;
    chiedi('cartella', { d: d, p: cartellaSerie }).then(function (r) {
      if (x.giro !== schGiro) return;
      var st = (r.cartelle || []).filter(function (c) { return RE_STAGIONE.test(c.nome); }).map(function (c) {
        var m = RE_STAGIONE.exec(c.nome);
        return { nome: c.nome, p: unisci(cartellaSerie, c.nome), n: m[1] !== undefined ? +m[1] : 0, video: null };
      }).sort(function (a, b) { return (a.n || 999) - (b.n || 999); });
      if (!st.length) {
        // le puntate tutte nella cartella della serie: le stagioni dai nomi dei file
        var per = {};
        (r.video || []).forEach(function (v) { var n = titoloDi(v.nome).stagione || 1; (per[n] = per[n] || []).push(v); });
        st = Object.keys(per).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return { nome: 'Stagione ' + n, p: cartellaSerie, n: n, video: per[n] }; });
      }
      x.stagioni = st;
      x.cartellaSerie = cartellaSerie;
      var att = 0;
      for (var i = 0; i < st.length; i++) if ((s.tipo === 'stagione' && st[i].p === x.p) || (x.stagione !== undefined && st[i].n === x.stagione)) att = i;
      x.k = att;
      disegnaSerie(x);
    }, function () { if (x.giro === schGiro) disegnaSerie(x); });
  }
  function disegnaSerie(x) {
    var s = x.s, d = x.d, logo = $('sc-logo'), serie = s.tipo === 'stagione' && s.serie ? s.serie : s;
    svuota(logo);
    logo.appendChild(el('h1', '', serie.titolo || s.titolo));
    var loghi = (s.serie && s.serie.img && s.serie.img.logo) || s.img.logo;
    if (loghi) mettiImg(logo, d, loghi, 500, 192, true, function (si) { if (si) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    $('sc-sopratitolo').textContent = 'Serie' + (x.stagioni.length ? ' · ' + x.stagioni.length + (x.stagioni.length === 1 ? ' stagione' : ' stagioni') : '');
    metaDi($('sc-meta'), serie, null, '');
    $('sc-trama').textContent = serie.trama || s.trama || '';
    sfondo(d, s.img.fanart || (s.serie && s.serie.img && s.serie.img.fanart) || s.img.poster, true, true);
    disegnaCast(x);
    // le stagioni
    var fs = $('fila-stagioni');
    svuota(fs);
    $('sez-stagioni').hidden = x.stagioni.length < 2;
    x.stagioni.forEach(function (st, i) {
      var c = el('div', 'stagione' + (i === x.k ? ' attiva' : ''));
      c.appendChild(el('span', 'nome', st.n ? 'Stagione ' + st.n : st.nome));
      c.setAttribute('data-tv', '');
      c.addEventListener('click', function () { x.k = i; puntateDi(x); });
      fs.appendChild(c);
    });
    puntateDi(x);
  }
  function puntateDi(x) {
    var st = x.stagioni[x.k], d = x.d;
    function fatto(video, cartella) {
      if (x.giro !== schGiro) return;
      x.puntate = video.map(function (v) { return { d: d, p: unisci(cartella, v.nome), nome: v.nome, dim: v.dim }; });
      x.cartellaPuntate = cartella;
      x.videoPuntate = video;
      disegnaPuntate(x);
    }
    if (!st) { fatto([], x.cartellaSerie || ''); return; }
    if (st.video) { fatto(st.video, st.p); return; }
    chiedi('cartella', { d: d, p: st.p }).then(function (r) { st.video = r.video || []; st.sotto = r.sotto || []; fatto(st.video, st.p); }, function () { fatto([], st.p); });
  }
  function disegnaPuntate(x) {
    var fp = $('fila-puntate'), d = x.d, st = x.stagioni[x.k];
    svuota(fp);
    fp.className = 'fila virtuale f-puntata';
    fp.style.transform = '';
    $('sez-puntate').hidden = !x.puntate.length;
    $('puntate-titolo').textContent = st ? (st.n ? 'Stagione ' + st.n : st.nome) + ' · ' + x.puntate.length + (x.puntate.length === 1 ? ' puntata' : ' puntate') : 'Puntate';
    var stg = $('fila-stagioni').children;
    for (var i = 0; i < stg.length; i++) stg[i].className = 'stagione' + (i === x.k ? ' attiva' : '');
    var daRiprendere = null;
    x.puntate.forEach(function (v) { var pt = puntoDi(d, v.p, v.dim); if (!daRiprendere && riprendibile(pt)) daRiprendere = { v: v, pt: pt }; });
    // la fila e' virtuale: le carte (e le loro schede) solo vicino alla scelta
    x.cartaPuntata = function (j) {
      var v = x.puntate[j];
      if (!v) return null;
      var c = el('div', 'carta puntata'), q = el('div', 'quadro'), tt = titoloDi(v.nome), pt = puntoDi(d, v.p, v.dim);
      q.appendChild(finta(tt.titolo, 'S' + (tt.stagione || 1) + ' E' + (tt.episodio || j + 1), 'puntata'));
      q.appendChild(el('div', 'num', 'E' + (tt.episodio || j + 1)));
      if (pt && pt.finito) { var vs = el('div', 'vista'); vs.appendChild(icona(ICONE.spunta)); q.appendChild(vs); }
      else if (riprendibile(pt)) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.min(100, Math.round(pt.t / Math.max(1, pt.dur) * 100)) + '%'; b.appendChild(f); q.appendChild(b); }
      c.appendChild(q);
      var nome = el('div', 'nome', 'Puntata ' + (tt.episodio || j + 1)), sotto = el('div', 'trama-p', '');
      c.appendChild(nome);
      c.appendChild(sotto);
      c.setAttribute('data-tv', '');
      c.addEventListener('click', function () { guardaPuntata(x, v); });
      chiediScheda(d, v.p, false, function (s) {
        // (puo' arrivare subito, dalla memoria: la carta non e' ancora nella fila, la mette disegnaRiga)
        if (!s) return;
        if (s.titolo) nome.textContent = (s.episodio >= 0 ? s.episodio + '. ' : '') + s.titolo;
        sotto.textContent = s.trama || '';
        var ref = s.img.landscape || s.img.fanart;
        if (ref) mettiImg(q, d, ref, 448, 252);
      });
      return c;
    };
    // Riprendi la puntata a meta' (la piu' recente), se no Guarda la prossima da vedere
    var pp = $('sc-pulsanti');
    svuota(pp);
    var recente = null;
    x.puntate.forEach(function (v) { var pt = puntoDi(d, v.p, v.dim); if (riprendibile(pt) && (!recente || pt.quando > recente.pt.quando)) recente = { v: v, pt: pt }; });
    var prossima = null;
    for (var i2 = 0; i2 < x.puntate.length && !prossima; i2++) { var p2 = puntoDi(d, x.puntate[i2].p, x.puntate[i2].dim); if (!p2 || !p2.finito) prossima = x.puntate[i2]; }
    if (recente) {
      var tr = titoloDi(recente.v.nome);
      pp.appendChild(pulsante('Riprendi', 'play', function () { guardaPuntata(x, recente.v); }, 'S' + tr.stagione + ' E' + tr.episodio + ' da ' + tempo(recente.pt.t)));
    } else if (prossima || x.puntate[0]) {
      var tp = titoloDi((prossima || x.puntate[0]).nome);
      pp.appendChild(pulsante('Guarda', 'play', function () { guardaPuntata(x, prossima || x.puntate[0]); }, tp.episodio ? 'S' + tp.stagione + ' E' + tp.episodio : ''));
    }
    x.guarda = recente ? function () { guardaPuntata(x, recente.v); } : (prossima || x.puntate[0]) ? function () { guardaPuntata(x, prossima || x.puntate[0]); } : null;
    var r0 = pag && pag.corpo === $('scheda-corpo') ? pag.r : 0, kp = pag && pag.righe[r0] ? pag.righe[r0].k : 0, chiaveR = pag && pag.righe[r0] ? pag.righe[r0].chiave : '';
    nuovaPagina($('scheda-corpo'));
    aggiungiRiga(pp, vociDi(pp), { sezione: $('sc-sopra'), chiave: 'pulsanti' });
    if (!$('sez-stagioni').hidden) aggiungiRiga($('fila-stagioni'), vociDi($('fila-stagioni')), { sezione: $('sez-stagioni'), k: x.k, chiave: 'stagioni' });
    x.kPuntata = daRiprendere ? x.puntate.indexOf(daRiprendere.v) : 0;
    if (x.puntate.length) righePuntate(x);
    if (!$('sez-cast').hidden) aggiungiRiga($('fila-cast'), vociDi($('fila-cast')), { sezione: $('sez-cast'), chiave: 'cast' });
    for (var r = 0; r < pag.righe.length; r++) if (chiaveR && pag.righe[r].chiave === chiaveR) { pag.r = r; if (chiaveR === 'stagioni') pag.righe[r].k = x.k; else if (chiaveR !== 'puntate') pag.righe[r].k = Math.min(kp, quanteIn(pag.righe[r]) - 1); }
    evidenzia();
  }
  function guardaPuntata(x, v) {
    var pt = puntoDi(x.d, v.p, v.dim), st = x.stagioni[x.k];
    apriVideo({ d: x.d, p: v.p, nome: v.nome, dim: v.dim }, { vicini: x.videoPuntate || null, cartella: x.cartellaPuntate, sotto: (st && st.sotto) || [],
      ritorno: 'scheda', t: riprendibile(pt) ? pt.t : -1 });
  }
  function indietroScheda() {
    var x = sch;
    if (!x) { apriInizio(); return; }
    if (x.da === 'inizio') { apriInizio(); return; }
    var dove = x.cartellaFilm || x.p, k = dove.lastIndexOf('/');
    apriLibreria(x.d, k === -1 ? '' : dove.slice(0, k), dove.slice(k + 1));
  }
  // dopo il lettore: la scheda di prima, coi punti aggiornati (Riprendi da..., le barre delle puntate)
  function tornaAllaScheda() {
    var x = sch;
    if (!x) { apriInizio(); return; }
    mostra('scheda');
    if (x.s && (x.s.tipo === 'serie' || x.s.tipo === 'stagione')) { disegnaPuntate(x); return; }
    if (x.s) disegnaScheda(x);
  }

  /* ============================================================ informazioni tecniche: insegne e avvisi */

  // conv: il video rifatto da Jellyfin per una qualita' piu' bassa ({ mbps, larg }). Jellyfin quando converte esce sempre in
  // SDR ("Currently we only encode to SDR"): i colori di un film HDR li adatta il chip del Mac, e l'insegna lo dice
  function badgeDi(info, audio, conv) {
    var out = [], v = info.video;
    if (v) {
      var largh = conv && conv.larg ? Math.min(v.largh, conv.larg) : v.largh;
      out.push({ t: largh >= 3200 ? '4K' : largh >= 1900 ? 'HD 1080' : largh >= 1200 ? 'HD 720' : 'SD', forte: largh >= 3200 });
      if (conv && v.hdr) out.push({ t: 'SDR · colori adattati', conv: true });
      else if (v.hdr === 'DV') out.push({ t: 'DOLBY VISION', forte: false, nota: notaDv(v.dv) });
      else if (v.hdr) out.push({ t: v.hdr, forte: true });
      out.push({ t: v.nomeCodec });
    }
    var a = null, num = audio !== undefined ? audio : (info.scelta || {}).audio;
    for (var i = 0; i < info.audio.length; i++) if (info.audio[i].num === num) a = info.audio[i];
    // il DTS o TrueHD che converte il TV esce in Dolby Digital 5.1 (al massimo 6 canali)
    if (a) out.push({ t: a.nomeCodec + (a.canali ? ' ' + canali(a.tv ? Math.min(6, a.canali) : a.canali) : '') + (a.server ? ' · convertito' : a.tv ? ' · convertito dal TV' : ''), conv: !!(a.server || a.tv) });
    else if (info.audio.length) out.push({ t: 'AUDIO NON LETTO', no: true });
    if (info.sotto.length) out.push({ t: 'SOTTOTITOLI' });
    return out;
  }
  // le etichette semplici della scheda di un film della chiavetta (come JF.etichette): 4K, HDR, 5.1, Sottotitoli
  function etichetteInfo(info) {
    var out = [], v = info.video, mx = 0;
    if (v) {
      out.push(v.largh >= 3200 ? '4K' : v.largh >= 1260 ? 'HD' : 'SD');
      if (v.hdr) out.push(v.hdr === 'DV' ? 'Dolby Vision' : v.hdr);
    }
    info.audio.forEach(function (a) { mx = Math.max(mx, a.canali || 0); });
    if (mx >= 6) out.push(canali(mx));
    if (info.sotto.length) out.push('Sottotitoli');
    return out;
  }
  // le insegne in alto nel lettore: 4K, l'HDR (o "SDR · colori adattati" se Jellyfin converte), i canali dell'audio scelto
  function badgeOsd(info, audio, conv) {
    return badgeDi(info, audio, conv).filter(function (b, i) { return i === 0 || b.conv && /colori/.test(b.t) || b.no || /^(HDR|DOLBY|HLG)/.test(b.t); }).map(function (b) {
      return { t: b.t === 'DOLBY VISION' ? 'Dolby Vision' : b.t === 'AUDIO NON LETTO' ? 'Audio non letto' : b.t, no: b.no, conv: b.conv };
    }).concat((function () {
      var a = null;
      for (var i = 0; i < info.audio.length; i++) if (info.audio[i].num === (audio !== undefined ? audio : (info.scelta || {}).audio)) a = info.audio[i];
      var n = a ? (a.tv ? Math.min(6, a.canali || 0) : a.canali || 0) : 0;
      return n >= 6 ? [{ t: canali(n) }] : [];
    })());
  }
  function sconosciuto(info) { return info.avvisi.indexOf('sconosciuto') !== -1 || info.avvisi.indexOf('struttura') !== -1; }
  // il Dolby Vision di un file della chiavetta: il TV (senza Dolby Vision) usa la base, se c'e' (profili 8.1 e 7: HDR10)
  function notaDv(dv) {
    var c = dv ? dv.compatibile : -1;
    return c === 1 || c === 6 ? 'il TV usa HDR10' : c === 4 ? 'il TV usa HLG' : c === 2 ? 'il TV usa SDR' : c === 0 ? 'colori sbagliati sul TV' : 'il TV usa la base';
  }
  // la traccia audio scelta, se e' un DTS o TrueHD che converte il TV (il servizio: tv-sito/audio-tv.js)
  function audioDelTv(info, num) {
    for (var i = 0; info && i < info.audio.length; i++) if (info.audio[i].num === num && info.audio[i].tv) return info.audio[i];
    return null;
  }
  function avvisoDi(info, senzaColori) {
    if (info.avvisi.indexOf('video') !== -1) return 'Il TV non legge il video di questo file (' + (info.video ? info.video.nomeCodec : 'formato sconosciuto') + ').';
    if (!senzaColori && info.avvisi.indexOf('colori') !== -1) {
      return 'Questo film è in Dolby Vision ' + (info.video && info.video.dv ? info.video.dv.profilo : 5) + ', senza la base HDR10: il TV non ha il Dolby Vision e ' +
        'lo mostrerebbe con i colori sbagliati (viola e verdi). Si vede giusto da Jellyfin sul Mac, che lo converte.';
    }
    if (info.avvisi.indexOf('audio') !== -1) {
      var nomi = info.audio.map(function (x) { return x.nomeCodec; }).filter(function (x, i, l) { return l.indexOf(x) === i; }).join(' e ');
      // il TV potrebbe convertirlo (audio-tv.js nel servizio): perche' non lo fa
      var at = info.audioTv || {}, perche = at.stato === 'lento' ? ', e questo TV è troppo lento per convertirlo (Altro › Velocità del TV)' :
        at.stato === 'spento' ? ', e questo TV non può convertirlo' : at.stato === 'rotto' ? ', e non riesce a convertirlo in questo file' :
        at.stato === 'misura' ? ', e non so ancora se riesce a convertirlo (Altro › Velocità del TV)' : '';
      return 'L\'audio di questo film (' + nomi + ') il TV non lo legge' + perche + ': il video parte senza audio. Si potrà sentire guardandolo dal Mac, che converte l\'audio.';
    }
    if (sconosciuto(info)) return 'Questo formato (' + String(info.formato || '').toUpperCase() + ') l\'app non lo apre per controllarlo: lo prova direttamente il lettore del TV.';
    if (info.mbps > 80 && info.video && info.video.codec === 'HEVC') return 'File molto pesante (' + Math.round(info.mbps) + ' Mbps di media): su alcuni TV Samsung del 2022 oltre 80 Mbps il video può scattare.';
    return '';
  }

  /* ============================================================ il lettore */

  var v = $('video'), pgs = null;
  var L = null; // il video aperto: { voce, info, audio, sotto, eventi, vicini, ritorno, ... }
  var osdTimer = null, salvaTimer = null, attesaTimer = null;
  function tela() { if (!pgs) pgs = PGS.crea($('pgs')); return pgs; }

  // ritorno: dove si va con Indietro ('scheda', 'libreria', 'inizio', 'esci' = alla home di Home TV)
  function apriVideo(voce, o) {
    o = o || {};
    clearInterval(dischiTimer);
    chiudiPannello();
    var x = L = { voce: voce, info: o.info || null, audio: 0, sotto: null, eventi: [], completi: false, chiesto: -1,
      vicini: o.vicini || null, cartella: o.cartella !== undefined && o.cartella !== null ? o.cartella : voce.p.replace(/\/?[^\/]*$/, ''),
      esterni: o.sotto || [], partito: false, riprendiFino: 0, guardato: 0, ultimoT: -1, velocita: 1, fineConto: 0, errori: 0,
      ritardo: 0, ritorno: o.ritorno || 'inizio', saltato: {}, jf: null, tvAltro: o.tvAltro || null, spost: 0 };
    mostra('lettore');
    $('osd-titolo').textContent = voce.jf ? titoloJf(voce.jf) : etichetta(voce.nome);
    pulisciLettore();
    attesa(true);
    var info = x.info ? Promise.resolve(x.info) : voce.jf ? infoJf(x, o) : chiedi('info', { d: voce.d, p: voce.p, lingue: lingueDi(voce), tetto: tettoTv.mbps });
    // la versione TV del limitatore accanto al film: si guarda quella (l'originale resta nel pannello)
    var cercaTv = voce.jf || o.originale || voce.tvDi ? Promise.resolve(null) : x.vicini ? Promise.resolve(x.vicini) :
      chiedi('cartella', { d: voce.d, p: x.cartella }).then(function (c) { return c.video || []; }, function () { return null; });
    var vicini = voce.jf || x.vicini || !o.conVicini ? Promise.resolve(null) :
      chiedi('cartella', { d: voce.d, p: x.cartella }).then(function (c) { x.vicini = c.video || []; x.esterni = c.sotto || []; }, function () {});
    Promise.all([info, vicini, cercaTv]).then(function (r) {
      var i = r[0];
      if (L !== x) return;
      var tv = (r[2] || []).filter(function (z) { return z.nome === voce.nome && z.tv; })[0];
      if (tv) {
        apriVideo({ d: voce.d, p: (x.cartella ? x.cartella + '/' : '') + tv.tv.nome, nome: tv.tv.nome, dim: tv.tv.dim, tvDi: voce },
          { vicini: x.vicini, cartella: x.cartella, sotto: x.esterni, ritorno: x.ritorno, t: o.t, daCapo: o.daCapo, audio: o.audio });
        return;
      }
      // la chiavetta: il TV stima i picchi dalle Cues (o dalle tabelle dell'MP4); oltre il tetto si avvisa prima
      if (!voce.jf && !voce.tvDi && !o.picchiOk && i.picchi && i.picchi.momenti > 0 && i.avvisi.indexOf('video') === -1) {
        attesa(false);
        avvisoPicchi(x, voce, o, i);
        return;
      }
      x.info = i;
      if (!voce.jf) chiediScheda(voce.d, voce.p, false, function (s) { if (L === x && s && s.titolo) $('osd-titolo').textContent = s.tipo === 'puntata' && s.serie ? s.serie.titolo + ' · S' + s.stagione + ' E' + s.episodio + ' · ' + s.titolo : s.titolo + (s.anno ? ' (' + s.anno + ')' : ''); });
      if (i.avvisi.indexOf('video') !== -1) {
        attesa(false);
        fermo('Il TV non legge questo video', avvisoDi(i), [{ testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } }]);
        return;
      }
      // Dolby Vision 5 dalla chiavetta: i colori verrebbero sbagliati. Si chiede prima (dalla scheda c'e' "Guarda da Jellyfin")
      if (i.avvisi.indexOf('colori') !== -1 && !o.coloriOk) {
        attesa(false);
        fermo('Colori sbagliati su questo TV', avvisoDi(i), [
          { testo: 'Guardalo lo stesso', fn: function () {
            chiudiFermo();
            var o2 = {};
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) o2[k] = o[k];
            o2.coloriOk = true;
            o2.info = i;
            apriVideo(voce, o2);
          } },
          { testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } }]);
        return;
      }
      x.audio = o.audio || (i.scelta && i.scelta.audio) || 0;
      scegliSottotitoliIniziali(x, o.sottoScelto);
      disegnaBadgeOsd();
      if (i.avvisi.indexOf('audio') !== -1) avvisoLettore(avvisoDi(i, true), 9000);
      else if (!voce.jf && audioDelTv(i, x.audio)) avvisoLettore('Audio ' + audioDelTv(i, x.audio).nomeCodec + ': lo converte il TV in Dolby Digital', 5000);
      var vo = voce.tvDi || voce, pt = voce.jf ? null : punti[chiaveDi(vo.p, vo.dim)];
      var da = riprendibile(pt, i.durata) ? pt.t : 0;
      // dalla scheda o dalla home: il punto che si vedeva li'
      if (o.t >= 0) da = o.t > 60 && (!i.durata || o.t < i.durata - 120) ? o.t : 0;
      // Jellyfin: il punto lo tiene il server (deciso in infoJf)
      if (voce.jf) da = x.jfDa || 0;
      if (o.daCapo) da = 0;
      if (o.esatto >= 0) da = o.esatto;
      carica(da);
      if (x.jf && x.jf.limDopo) { x.jf.limDopo = false; if (puoLimitare(x)) limitaJf(true); }
      if (da) {
        x.riprendiFino = Date.now() + 9000;
        avvisoLettore('Riprendo da ' + tempo(da) + ' · Giù per ricominciare da capo', 9000);
      }
      clearInterval(salvaTimer);
      var giri = 0;
      salvaTimer = setInterval(function () {
        if (L !== x) return;
        giri++;
        vegliaMeta(x);
        vegliaMac(x);
        if (L !== x) return;
        // Jellyfin vuole l'avanzamento ogni 10 secondi (passa dalla rete); la memoria dell'app e Continua a guardare della home
        // (scritture sulla memoria flash del TV) solo ogni minuto, piu' a pausa, salto e uscita
        if (!v.paused) { if (giri % 6 === 0) salvaPunto(false); else if (x.jf) riportaJf('avanti', v.currentTime - (x.spost || 0)); }
        // in pausa con l'HLS del server: la conversione resta viva (se no Jellyfin la chiude e il film non riparte)
        else if (x.jf && (x.jf.modo === 'copia' || x.jf.modo === 'converti') && x.jf.sessione) chiediJf('Sessions/Playing/Ping', { playSessionId: x.jf.sessione }, {}).then(null, function () {});
      }, 10000);
    }, function (e) {
      if (L !== x) return;
      attesa(false);
      fermo('Non riesco ad aprire questo video', e.codice === 'disco' ? 'La chiavetta non c\'è più.' : e.codice === 'permesso' ?
        'Il TV non lascia leggere questo file.' : e.codice === 'lento' || e.codice === 'servizio' ? 'Il servizio del TV non risponde: riprova tra poco.' :
        e.codice === 'rete' ? 'Jellyfin non risponde: il Mac è acceso?' : e.codice === 'accesso' ? 'Jellyfin chiede di collegarsi di nuovo (Altro › Jellyfin).' :
        e.codice === 'formato' && voce.jf ? 'Jellyfin non sa preparare questo film per il TV.' :
        'Il file non si legge.', [{ testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } }]);
    });
  }
  // il file dal servizio, con la traccia audio scelta, dal secondo "da"
  var dopoPlay = null;
  function carica(da, restaInPausa) {
    var x = L;
    x.partito = false;
    x.daQui = da || 0;
    // (per il video diretto: il punto chiesto, e l'orologio della veglia a meta' film che riparte da qui)
    x.daCarica = da || 0;
    x.dirUltimoT = da || 0;
    x.dirFermoDa = Date.now();
    // dal Mac un film che non parte si riapre su Real4K del TV, dallo stesso punto: in 45 s nessuna immagine (ne' errore), o
    // "playing" col tempo che in 15 s non va avanti di 1 s (Il Faro sul TV, sonda del 31/10: playing a 2 s, poi fermo a 0 per
    // 38 s). Non per i trailer, ne' in pausa o col TV a schermo spento: allora si riguarda dopo. Partito il film, veglia vegliaMac
    if (DAL_MAC) {
      clearTimeout(x.macAvvio);
      var inizio = Date.now(), base = -1, fermoDa = 0;
      x.macAvvio = setTimeout(function avvio() {
        if (L !== x || !v.getAttribute('src') || (x.jf && x.jf.trailer)) return;
        var ora = Date.now();
        if (x.pausaVoluta || document.hidden || (x.partito && v.paused)) { inizio = ora; base = -1; }
        else if (x.partito && !v.seeking) {
          if (base < 0) { base = v.currentTime; fermoDa = ora; }
          else if (Math.abs(v.currentTime - base) >= 1) return;
          else if (ora - fermoDa >= 15000) { versoIlTv('Questo film dal Mac non parte: lo apro su Real4K del TV'); return; }
        } else if (!x.partito && ora - inizio >= 45000) { versoIlTv('Questo film dal Mac non parte: lo apro su Real4K del TV'); return; }
        x.macAvvio = setTimeout(avvio, 3000);
      }, 3000);
    }
    if (dopoPlay) { v.removeEventListener('playing', dopoPlay); dopoPlay = null; }
    if (restaInPausa) {
      dopoPlay = function () { v.removeEventListener('playing', dopoPlay); dopoPlay = null; v.pause(); };
      v.addEventListener('playing', dopoPlay);
    }
    // un disco copiato (cartella Blu-ray o DVD): nell'indirizzo il nome con .m2ts o .vob (info.disco.file)
    v.src = x.jf ? urlJf(x) : urlFile(x.voce.d, x.voce.p, (x.info && x.info.disco && x.info.disco.file) || x.voce.nome, x.audio);
    v.playbackRate = 1;
    x.velocita = 1;
    applicaSchermo();
    if (pgs) pgs.azzera();
    try { v.load(); } catch (e) {}
    var p = v.play();
    if (p && p.then) p.then(null, function () {});
    mostraOsd();
    if (usaDiretto(x)) vegliaDiretto(x);
  }
  v.addEventListener('loadedmetadata', function () {
    if (!L) return;
    // l'HLS del limitatore ha i tempi del film +10 s: se il lettore del TV li mostra cosi' (durata = film + 10), si toglie
    var dd = L.info && L.info.durata, sp = L.jf && L.jf.modo === 'mac' && dd && v.duration - dd > 8 && v.duration - dd < 12 ? 10 : 0;
    L.spost = sp;
    if (L.daQui || sp) { try { v.currentTime = (L.daQui || 0) + sp; } catch (e) {} }
    L.daQui = 0;
  });
  v.addEventListener('playing', function () {
    segnaPasso('r4k-video');
    attesa(false);
    if (L) { L.partito = true; L.errori = 0; } // riparte: le prove dopo un errore ricominciano da zero
    if (L && L.jf) riportaJf('inizio');
    if (L) salvaPunto(false); // il telefono vede subito che il video va
    nascondiOsdPresto();
  });
  v.addEventListener('waiting', function () { attesa(true); });
  v.addEventListener('seeking', function () { attesa(true); });
  v.addEventListener('seeked', function () {
    attesa(false);
    if (!L) return;
    if (pgs) pgs.azzera();
    sottoMostrato = null; // la tela e' vuota: l'immagine giusta va ridisegnata
    L.chiesto = -1;
    aggiornaSotto(true);
    disegnaSotto(v.currentTime);
    salvaPunto(false);
  });
  v.addEventListener('pause', function () { if (L) salvaPunto(false); mostraOsd(true); });
  // uscire senza passare dal lettore (il tasto verde chiude l'app, il tasto Home, il TV che si spegne): il punto si salva lo
  // stesso, una volta. Chiusa davvero: anche Jellyfin smette di convertire; solo nascosta: solo il punto
  function salvaUscendo(chiusa) {
    var x = L;
    // (una volta sola: quando il riquadro se ne va arrivano anche pagehide e la pagina nascosta, che non devono rimettere
    // "in visione" un film appena chiuso)
    if (!x || schermo !== 'lettore' || x.uscito) return;
    if (chiusa) x.uscito = true;
    salvaPunto(true, false, chiusa);
    if (chiusa && x.jf) { fermaConversione(x.jf); fineDirettoJf(x.jf); }
  }
  window.addEventListener('hometvchiudi', function () { salvaUscendo(true); });
  // dal Mac: si deve andare via (home o Real4K del TV) ma la meta non risponde (rete del TV): si resta e si riprova
  window.addEventListener('hometvsenzarete', function () { messaggio('Senza rete: aspetto e riprovo da solo', 9000); });
  window.addEventListener('pagehide', function () { salvaUscendo(true); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) salvaUscendo(false); });
  v.addEventListener('ended', function () { if (L) finito(); });
  // il diario del lettore (per il giro di prove sul TV): primo fotogramma, fermate, salti, ritmo rispetto al tempo vero,
  // errori. Al servizio vanno solo numeri tecnici (niente titoli ne' percorsi), quando il lettore si chiude
  function diarioDi(x) { if (!x.diario) x.diario = { t0: Date.now(), primo: 0, fermate: 0, msFermo: 0, tFermo: 0, salti: 0, errore: 0, muro: 0, avanti: 0, tm: 0, mt: -1 }; return x.diario; }
  v.addEventListener('playing', function () {
    if (!L) return;
    var d = diarioDi(L), ora = Date.now();
    if (!d.primo) d.primo = ora - d.t0;
    if (d.tFermo) { d.msFermo += ora - d.tFermo; d.tFermo = 0; }
    d.tm = ora;
    d.mt = v.currentTime;
  });
  v.addEventListener('waiting', function () { if (!L) return; var d = diarioDi(L); if (d.primo && !d.tFermo && !v.seeking) { d.fermate++; d.tFermo = Date.now(); } });
  v.addEventListener('seeking', function () { if (L) { var d = diarioDi(L); d.salti++; d.mt = -1; } });
  v.addEventListener('pause', function () { if (L) diarioDi(L).mt = -1; });
  v.addEventListener('timeupdate', function () {
    if (!L || v.paused || v.seeking) return;
    var d = diarioDi(L), ora = Date.now();
    // il ritmo: secondi di film avanzati per secondo vero, mentre si guarda (1 = in tempo reale)
    if (d.mt >= 0 && v.currentTime > d.mt && ora > d.tm && ora - d.tm < 5000) { d.avanti += v.currentTime - d.mt; d.muro += (ora - d.tm) / 1000; }
    d.tm = ora;
    d.mt = v.currentTime;
  });
  function mandaDiario(x) {
    var d = x.diario, i = x.info || {}, vv = i.video || {}, j = x.jf, a = (i.audio || []).filter(function (t) { return t.num === x.audio; })[0] || {};
    if (!d || !d.primo && !d.errore) return;
    var strada = j ? (j.modo === 'mac' ? 'mac' : j.modo || 'diretto') : x.voce.tvDi ? 'versione-tv' : /^(blu-ray|dvd)$/.test(i.formato || '') ? 'disco' : 'chiavetta';
    chiedi('tv/diario', null, { strada: strada, formato: j && j.modo !== 'diretto' && j.modo !== 'file' ? 'hls' : String(i.formato || '').toLowerCase(),
      codec: vv.codec || '', larghezza: vv.largh || 0, altezza: vv.alt || 0, hdr: vv.hdr || '', audio: a.codec || '', mbps: i.mbps || 0,
      picco: i.picchi ? i.picchi.massimo : 0, secondi: Math.round(d.avanti), msPrimo: d.primo, fermate: d.fermate,
      msFermo: d.msFermo + (d.tFermo ? Date.now() - d.tFermo : 0), salti: d.salti, ritmo: d.muro > 5 ? d.avanti / d.muro : 0, errore: d.errore,
      diretto: x.dirInfo || '', dirErrore: x.dirErrore || 0, dirRichieste: x.dirRichieste || 0, dirHttps: x.dirHttps || 0 }).then(null, function () {});
  }
  v.addEventListener('error', function () {
    if (!L || !v.getAttribute('src')) return;
    var codice = v.error ? v.error.code : 0, x = L, t = v.currentTime || x.daQui || 0;
    // dal Mac: il ponte c'e' ancora? (se no si torna a Real4K del TV; intanto il lettore fa come sempre)
    if (DAL_MAC) controllaMac();
    // il video diretto dal Mac: un errore riporta alla strada di sempre, dallo stesso punto (prima del film, a volte passando
    // dall'indirizzo del Mac nel <video>)
    if (usaDiretto(x)) { erroreDiretto(x); return; }
    diarioDi(x).errore = codice || 9;
    attesa(false);
    if (codice === 2 && x.errori < 2) {
      // la chiavetta ha rallentato o il servizio si e' fermato un attimo: si riprende da li'
      x.errori++;
      setTimeout(function () { if (L === x) carica(t); }, 1500);
      return;
    }
    // una qualita' convertita dal server che il TV non riesce a leggere (30/10/2026: la scelta resta per tutti i film, e il
    // lettore non partiva piu' con nessuno): si torna da soli all'originale, che resta scelto. Una volta sola per film
    if (x.jf && x.jf.q && x.jf.q !== 'orig' && !x.giaOriginale) {
      x.giaOriginale = true;
      prefs.qualita = 'orig';
      salvaPrefs();
      x.jf.q = 'orig';
      // (con l'audio che era scelto: se no tornerebbe quello di partenza)
      ricaricaJf({ a: audioPerJf(x), testo: 'Questa qualità non va sul TV: riparto in Originale' });
      return;
    }
    // dal Mac un film che il lettore non legge neanche cosi': invece di fermarsi qui si riapre su Real4K del TV, dallo stesso punto
    if (DAL_MAC && x.jf && !x.jf.trailer) { versoIlTv('Questo film dal Mac non parte: lo apro su Real4K del TV'); return; }
    var azioni = [{ testo: 'Riprova', fn: function () { chiudiFermo(); if (L === x) { x.errori = 0; carica(t); } } }];
    if (x.jf && x.jf.q !== 'orig') {
      azioni.push({ testo: 'Guarda in Originale', fn: function () {
        chiudiFermo();
        if (L !== x) return;
        prefs.qualita = 'orig';
        salvaPrefs();
        x.jf.q = 'orig';
        ricaricaJf({ a: audioPerJf(x), testo: 'Qualità: Originale' });
      } });
    }
    azioni.push({ testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } });
    fermo('Il TV non riesce a leggere questo video', codice === 4 ? 'Il formato non va bene per il lettore del TV.' : 'La lettura si è fermata.', azioni);
  });
  v.addEventListener('timeupdate', function () {
    if (!L) return;
    var t = v.currentTime;
    if (L.ultimoT >= 0 && t > L.ultimoT && t - L.ultimoT < 3) L.guardato += t - L.ultimoT;
    L.ultimoT = t;
    if (t > 0 && !v.seeking) L.ultimoBuono = t;
    disegnaSotto(t);
    aggiornaSotto(false);
    guardaSigla(t);
    if ($('osd').className === 'on') disegnaTempo();
  });

  function attesa(si) {
    clearTimeout(attesaTimer);
    if (!si) { $('attesa').hidden = true; return; }
    attesaTimer = setTimeout(function () { $('attesa').hidden = false; }, 350);
  }
  function avvisoLettore(t, ms) {
    var a = $('avviso-lettore');
    a.textContent = t;
    a.hidden = !t;
    clearTimeout(avvisoLettore.timer);
    if (t) { mostraOsd(); avvisoLettore.timer = setTimeout(function () { a.hidden = true; }, ms || 4000); }
  }
  function mostraOsd(fisso) {
    $('osd').className = 'on';
    disegnaTempo();
    posSotto();
    clearTimeout(osdTimer);
    if (!fisso) nascondiOsdPresto();
  }
  function nascondiOsdPresto() {
    clearTimeout(osdTimer);
    osdTimer = setTimeout(function () {
      if (L && !v.paused && $('pannello').hidden && !L.chip && !salto.attivo && !L.fineConto) { $('osd').className = ''; posSotto(); }
    }, 4000);
  }
  function disegnaTempo() {
    if (!L) return;
    var d = (L.info && L.info.durata) || v.duration || 0, t = salto.attivo ? anteprima() : v.currentTime;
    var f = d ? Math.max(0, Math.min(1, t / d)) : 0;
    $('osd-fatto').style.transform = 'scaleX(' + f + ')';
    var car = 0;
    try { for (var i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 1 && v.buffered.end(i) >= v.currentTime) car = v.buffered.end(i); } catch (e) {}
    $('osd-car').style.transform = 'scaleX(' + (d ? Math.min(1, car / d) : 0) + ')';
    $('osd-testa').style.left = 'calc(5vw + ' + (f * 90) + 'vw)';
    $('osd-ora').textContent = tempo(t);
    var resta = Math.max(0, d - t) / Math.max(0.25, L.velocita || 1);
    $('osd-resta').textContent = d ? '-' + tempo(d - t) + ' · ' + finisceAlle(resta) : '';
    anteprimaBarra(salto.attivo ? t : -1, f);
    var meta = $('osd-meta');
    if (salto.attivo) {
      // il punto dove si va: il minuto grande, poi quanto si salta e il capitolo
      var cap = capitoloA(t), dt = Math.round(t - v.currentTime);
      svuota(meta);
      meta.appendChild(el('b', '', tempo(t)));
      meta.appendChild(el('small', '', [Math.abs(dt) >= 1 ? (dt > 0 ? '+' : '−') + tempo(Math.abs(dt)) : '', cap && cap.nome ? cap.nome : ''].filter(Boolean).join(' · ')));
      meta.hidden = false;
      meta.style.left = 'calc(5vw + ' + Math.max(7, Math.min(83, f * 90)) + 'vw)';
    } else meta.hidden = true;
  }
  function disegnaBadgeOsd() {
    var b = $('osd-badge');
    svuota(b);
    if (!L || !L.info) return;
    var g = L.jf && L.jf.g, conv = g && g.modo === 'converti' ? g.qualita || {} : null;
    badgeOsd(L.info, L.audio, conv).forEach(function (x) { b.appendChild(el('span', 'badge' + (x.no ? ' no' : '') + (x.conv ? ' conv' : ''), x.t)); });
  }
  var centroTimer = null;
  function centro(nome) {
    var c = $('osd-centro');
    svuota(c);
    c.appendChild(icona(ICONE[nome]));
    c.className = 'on';
    clearTimeout(centroTimer);
    centroTimer = setTimeout(function () { c.className = ''; }, 700);
  }

  // lo scorrimento: le pressioni vicine si sommano e, tenendo premuto, vanno sempre piu' veloci (10 s a pressione, poi 30 s,
  // 1 e 2 minuti); sopra la barra l'anteprima del punto (le tessere di Jellyfin o l'immagine del capitolo) col minuto grande.
  // Il video salta quando lasci: OK, o poco piu' di un secondo fermo. Indietro annulla e si resta dove si era.
  // Dal telefono: "scorri" mostra il punto mentre il dito trascina la barra, "vai" salta quando lo alza
  var salto = { tot: 0, timer: null, attivo: false, serie: 0, ultimo: 0, verso: 0, punto: -1 };
  function anteprima() {
    var d = (L.info && L.info.durata) || v.duration || 0;
    return Math.max(0, Math.min(d ? d - 1 : Infinity, salto.punto >= 0 ? salto.punto : v.currentTime + salto.tot));
  }
  function salta(sec) {
    if (!L) return;
    var ora = Date.now(), verso = sec > 0 ? 1 : -1;
    // si stava scorrendo dal telefono: le frecce partono da quel punto
    if (salto.punto >= 0) { salto.tot = salto.punto - v.currentTime; salto.punto = -1; }
    salto.serie = salto.attivo && ora - salto.ultimo < 420 && verso === salto.verso ? salto.serie + 1 : 0;
    salto.ultimo = ora;
    salto.verso = verso;
    salto.tot += sec * (salto.serie < 4 ? 1 : salto.serie < 10 ? 3 : salto.serie < 18 ? 6 : 12);
    // mai oltre l'inizio o la fine: tornando indietro non c'e' niente da "smaltire"
    var d = (L.info && L.info.durata) || v.duration || 0;
    salto.tot = Math.max(-v.currentTime, Math.min((d ? d - 1 : Infinity) - v.currentTime, salto.tot));
    salto.attivo = true;
    mostraOsd();
    clearTimeout(salto.timer);
    salto.timer = setTimeout(confermaSalto, 1100);
  }
  function confermaSalto() {
    clearTimeout(salto.timer);
    if (!salto.attivo) return;
    var t = anteprima();
    fineSalto();
    vai(t);
    mostraOsd();
  }
  function fineSalto() { clearTimeout(salto.timer); salto.tot = 0; salto.attivo = false; salto.serie = 0; salto.punto = -1; }
  function annullaSalto() { fineSalto(); disegnaTempo(); }
  // dal telefono, mentre il dito trascina la barra (sec = il punto sotto il dito): se il dito non si alza piu' (telefono spento),
  // dopo 5 secondi si torna dov'eri
  function scorriA(sec) {
    if (!L || !isFinite(sec)) return;
    salto.punto = Math.max(0, sec);
    salto.tot = 0;
    salto.attivo = true;
    mostraOsd();
    clearTimeout(salto.timer);
    salto.timer = setTimeout(annullaSalto, 5000);
  }
  // il capitolo al punto t (per il nome sotto il minuto)
  function capitoloA(t) {
    var l = L && L.info && L.info.capitoli || [], c = null;
    for (var i = 0; i < l.length; i++) if (l[i].t <= t + 0.5) c = l[i];
    return c;
  }
  function vai(t) {
    if (!L) return;
    try { v.currentTime = t; } catch (e) {}
    if (pgs) pgs.azzera();
    sottoMostrato = null;
    $('sottotitoli').textContent = '';
    $('sottotitoli').removeAttribute('data-firma');
    L.chiesto = -1;
  }
  function playPausa(solo) {
    if (!L) return;
    // (pausaVoluta: la pausa chiesta da chi guarda; dopo un errore v.paused non lo dice piu', e il ritorno da solo la rispetta)
    if (solo === 'play' || (solo !== 'pausa' && v.paused)) { L.pausaVoluta = false; var p = v.play(); if (p && p.then) p.then(null, function () {}); centro('play'); }
    else { L.pausaVoluta = true; v.pause(); centro('pausa'); }
    mostraOsd();
  }

  /* ---------------------------------------------------------- il lettore con Jellyfin
   * La strada la sceglie il servizio (jf/guarda): "diretto" = il file vero passa dal "vuoto" come una chiavetta (tracce,
   * capitoli e sottotitoli li legge il servizio); "copia" = HLS di Jellyfin col video originale e l'audio convertito;
   * "converti" = HLS rifatto dal server. Il punto lo tiene Jellyfin (Sessions/Playing, Progress, Stopped). */

  // il 4K si tiene: cambiano solo i Mbps (Jellyfin converte in HEVC col chip del Mac), e 1080p solo per le reti molto lente
  var QUALITA_JF = [{ id: 'orig', nome: 'Originale' }, { id: 'auto', nome: 'Automatica', piccolo: 'misura la rete' },
    { id: '4k40', nome: '4K 40 Mbps', piccolo: 'quasi come l\'originale', mbps: 40 }, { id: '4k25', nome: '4K 25 Mbps', piccolo: 'come lo streaming in 4K', mbps: 25 },
    { id: '4k15', nome: '4K 15 Mbps', piccolo: 'per le reti lente', mbps: 15 }, { id: '1080p8', nome: '1080p 8 Mbps', piccolo: 'per le reti molto lente', mbps: 8 }];
  // le scelte di prima salvate nelle preferenze (4K 80, 1080p 20, 720p 8): la nuova piu' vicina
  var QUALITA_VECCHIE = { '4k': '4k40', '1080': '4k15', '720': '1080p8' };
  function qualitaBuona(q) {
    q = QUALITA_VECCHIE[q] || q;
    return QUALITA_JF.some(function (z) { return z.id === q; }) ? q : 'orig';
  }
  // quella scelta dal servizio per l'Automatica: "4K fino a 21 Mbps"
  function nomeQualita(x) { return (x.larg >= 3840 ? '4K' : x.larg >= 1920 ? '1080p' : x.larg >= 1280 ? '720p' : '480p') + ' fino a ' + x.mbps + ' Mbps'; }
  var NOMI_COD = { EAC3: 'Dolby Digital Plus', AC3: 'Dolby Digital', TRUEHD: 'Dolby TrueHD', DTS: 'DTS', AAC: 'AAC', FLAC: 'FLAC', OPUS: 'Opus',
    MP3: 'MP3', MP2: 'MPEG audio', PCM: 'PCM', VORBIS: 'Vorbis', HEVC: 'HEVC', AVC: 'H.264', AV1: 'AV1', VP9: 'VP9', VP8: 'VP8', MPEG2: 'MPEG-2',
    MPEG4: 'MPEG-4', VC1: 'VC-1', SRT: 'Testo', ASS: 'Testo (ASS)', VTT: 'Testo (WebVTT)', PGS: 'Immagini (PGS)', VOBSUB: 'Immagini (DVD)', TX3G: 'Testo' };
  var LINGUE3 = { it: 'ita', en: 'eng', de: 'ger', deu: 'ger', fr: 'fre', fra: 'fre', es: 'spa', pt: 'por', ja: 'jpn', zh: 'chi', zho: 'chi',
    ru: 'rus', nl: 'dut', nld: 'dut', sv: 'swe', pl: 'pol', ko: 'kor', ar: 'ara', tr: 'tur', el: 'gre', ell: 'gre', da: 'dan', fi: 'fin',
    no: 'nor', nb: 'nor', cs: 'cze', ces: 'cze', hu: 'hun', ro: 'rum', ron: 'rum', he: 'heb', hi: 'hin', th: 'tha', uk: 'ukr' };
  function lingua3(l) { l = String(l || '').toLowerCase().split('-')[0]; return LINGUE3[l] || l || 'und'; }
  function hdrDi(r) { r = String(r || ''); return /DOVI/i.test(r) ? 'DV' : /HDR10Plus/i.test(r) ? 'HDR10+' : /HDR|PQ/i.test(r) ? 'HDR10' : /HLG/i.test(r) ? 'HLG' : ''; }
  var MOTIVI = { AudioCodecNotSupported: 'audio non letto dal TV', VideoCodecNotSupported: 'video non letto dal TV', ContainerNotSupported: 'contenitore',
    ContainerBitrateExceedsLimit: 'troppi Mbps per la qualità scelta', VideoBitrateNotSupported: 'troppi Mbps per la qualità scelta',
    VideoResolutionNotSupported: 'risoluzione oltre la qualità scelta', AudioChannelsNotSupported: 'canali audio', SubtitleCodecNotSupported: 'sottotitoli',
    VideoRangeTypeNotSupported: 'HDR non letto', VideoLevelNotSupported: 'livello del video', VideoProfileNotSupported: 'profilo del video' };
  function motivoBello(m) { return MOTIVI[m] || m; }
  function titoloJf(it) {
    var s = JF.scheda(it);
    if (s.tipo === 'puntata' && s.serie) return s.serie.titolo + ' · S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '');
    return s.titolo + (s.anno ? ' (' + s.anno + ')' : '');
  }
  // guardare un film o una puntata di Jellyfin. o: { t (secondi), daCapo, ritorno (funzione o 'esci'), trailer }
  function guardaJf(it, o) {
    o = o || {};
    fermaTrailer();
    apriVideo({ jf: it, nome: String(it.Name || ''), d: '', p: 'jf:' + it.Id, dim: 0 }, { ritorno: o.ritorno || tornaInizio, t: o.t, daCapo: o.daCapo, trailer: o.trailer, daHome: !!o.daHome });
  }
  // lo stesso film (o la stessa puntata) su Jellyfin, per un file della chiavetta che il TV non sente: prima lo stesso file
  // (nome o misura), poi stesso titolo e anno (o stessa serie, stagione e puntata)
  function cercaGemelloJf(s, info, p, cb) {
    var nome = String(p).split('/').pop(), t = titoloDi(nome), puntata = s.tipo === 'puntata' || !!t.episodio;
    var titolo = puntata ? (s.serie && s.serie.titolo) || t.titolo : s.titolo || t.titolo, anno = s.anno || t.anno;
    var st = s.stagione || t.stagione, ep = s.episodio >= 0 && s.tipo === 'puntata' ? s.episodio : t.episodio;
    function stesso(l) {
      for (var i = 0; i < l.length; i++) {
        var ms = JF.sorgente(l[i]) || {}, base = String(ms.Path || '').split(/[\/\\]/).pop();
        if ((ms.Size && ms.Size === info.dim) || (base && base === nome)) return l[i];
      }
      return null;
    }
    if (!titolo) { cb(null); return; }
    if (!puntata) {
      chiediJf('Items', conCampi({ searchTerm: titolo, IncludeItemTypes: 'Movie', Recursive: true, Limit: 20, Fields: JF.CAMPI + ',MediaSources' })).then(function (r) {
        var l = voci(r);
        cb(stesso(l) || l.filter(function (it) { return !anno || !it.ProductionYear || Math.abs(it.ProductionYear - anno) <= 1; })[0] || null);
      }, function () { cb(null); });
      return;
    }
    chiediJf('Items', conCampi({ searchTerm: titolo, IncludeItemTypes: 'Series', Recursive: true, Limit: 5 })).then(function (r) {
      var serie = voci(r)[0];
      if (!serie || !st || !ep) { cb(null); return; }
      chiediJf('Shows/' + serie.Id + '/Episodes', conCampi({ UserId: uid(), Season: st, Fields: JF.CAMPI + ',MediaSources' })).then(function (r2) {
        var l = voci(r2);
        cb(stesso(l) || l.filter(function (it) { return +it.IndexNumber === ep; })[0] || null);
      }, function () { cb(null); });
    }, function () { cb(null); });
  }
  function infoJf(x, o) {
    var it = x.voce.jf, j = x.jf = { id: it.Id, it: it, q: o.trailer ? 'orig' : qualitaBuona(prefs.qualita), mbps: 0, segmenti: [], tp: null, sessione: '', modo: '',
      ms: '', url: '', g: null, partito: false, prossimo: null, trailer: !!o.trailer };
    // la scheda intera (capitoli, anteprime della barra, serie) se si e' partiti da una voce corta
    var pieno = it.Chapters !== undefined && it.MediaSources ? Promise.resolve(it) : chiediJf('Items/' + it.Id, { userId: uid() });
    return pieno.then(function (itp) {
      j.it = itp;
      x.voce.nome = String(itp.Name || x.voce.nome);
      if (L === x) $('osd-titolo').textContent = titoloJf(itp);
      var s = JF.scheda(itp);
      x.jfDa = o.daCapo ? 0 : o.daHome && riprendibileJf(s) ? s.punto : o.t > 0 ? o.t : riprendibileJf(s) ? s.punto : 0;
      if (j.q === 'auto') return chiedi('jf/veloce').then(function (r) { j.mbps = r.mbps; }, function () { j.q = 'orig'; });
    }).then(function () { return stradaJf(x, x.jfDa); }).then(function (info) {
      if (L !== x || !puoLimitare(x)) return info;
      var fatto = false;
      return new Promise(function (ok) {
        function fine(r) {
          if (fatto) return;
          fatto = true;
          if (r && r.serve && r.pronto && r.url && (r.completo || r.secondiPronti > (x.jfDa || 0) + 30)) { j.lim = r; j.modo = 'mac'; j.url = r.url; }
          else j.limDopo = true;
          ok(info);
        }
        chiedi('jf/limita/' + j.id, { ms: j.ms, tetto: tettoMac(j), a: undefined }).then(fine, function () { fine(null); });
        setTimeout(function () { fine(null); }, 2500);
      });
    }).then(function (info) {
      if (L !== x) return info;
      chiediJf('MediaSegments/' + j.id, {}).then(function (r) { if (L === x) j.segmenti = JF.segmenti(r); }, function () {});
      j.tp = JF.trickplay(j.it, j.ms);
      if (j.it.Type === 'Episode' && j.it.SeriesId) {
        chiediJf('Shows/' + j.it.SeriesId + '/Episodes', conCampi({ UserId: uid(), StartItemId: j.id, Limit: 2 })).then(function (r) {
          var l = voci(r);
          if (L === x && l[0] && l[0].Id === j.id && l[1]) j.prossimo = l[1];
        }, function () {});
      }
      return info;
    });
  }
  // la strada e le tracce per il pannello, nella forma delle chiavette (a: l'audio voluto, indice di Jellyfin)
  function stradaJf(x, t, a) {
    var j = x.jf;
    j.giroMac = (j.giroMac || 0) + 1;
    var q = { q: j.q, t: Math.round(t || 0), ms: j.ms || undefined };
    if (j.q === 'auto') q.mbps = j.mbps || undefined;
    if (a !== undefined && a !== null) q.a = a;
    var vuole = vuoleDiretto(x);
    if (vuole) q.diretto = 1;
    return chiedi('jf/guarda/' + j.id, q).then(function (g) {
      // dal Mac solo i film a file (Originale, con Range): l'HLS nativo del TV da una pagina http del Mac non parte (sonda del
      // 31/10). Una qualita' convertita, un audio da convertire o Senza picchi vanno subito su Real4K del TV, dallo stesso punto.
      // Anche l'audio che Jellyfin fa sentire quando il TV non lo legge (DTS, TrueHD): a file si sentirebbe un'altra traccia, cioe'
      // un'altra lingua (Il Faro, 31/10: l'italiano e' DTS, dal Mac solo l'inglese). Sul TV il server lo converte
      var sentito = DAL_MAC ? (g.audio || []).filter(function (z) { return z.indice === g.audioScelto; })[0] : null;
      if (DAL_MAC && ((g.modo !== 'diretto' && g.modo !== 'file') || (sentito && !sentito.letto))) {
        if (!x.partito) x.daCarica = t || 0;
        versoIlTv(sentito && !sentito.letto ? 'Questo film ha l\'audio che converte il server: lo apro su Real4K del TV' :
          'Questo film, con questa qualità, lo apro su Real4K del TV');
        return new Promise(function () {});
      }
      j.g = g;
      j.modo = g.modo;
      j.url = g.url;
      j.ms = g.ms;
      j.sessione = g.sessione;
      j.partito = false;
      // il video diretto dal Mac: il biglietto (la strada di sempre resta in j.url, per il ritorno da solo)
      j.diretto = vuole && g.diretto && /^jf\/diretto\/[0-9a-f]{64}\/./.test(String(g.diretto.url || '')) ? { url: String(g.diretto.url), biglietto: String(g.diretto.biglietto),
        mac: /^http:\/\/[^\/?#\s]+\/v\/[0-9a-f]{64}\/./.test(String(g.diretto.mac || '')) ? String(g.diretto.mac) : '' } : null;
      if (vuole && !j.diretto) x.dirInfo = g.direttoNo === 'biglietto' ? 'biglietto' : 'mac';
      var mkv = /^(mkv|webm|matroska)/i.test(g.contenitore || '');
      // le tracce e i sottotitoli dentro il file li legge il servizio dal file vero (anche quando il video arriva in HLS)
      var nostra = g.modo === 'diretto' || mkv ? chiedi('jf/info/' + j.id, { ms: g.ms, lingue: prefs.lingue.join(','), tetto: tettoTv.mbps }).then(null, function () { return null; }) : Promise.resolve(null);
      return nostra.then(function (i) {
        var info;
        if (g.modo === 'diretto' && i) {
          info = i;
          if (a !== undefined && a !== null) { var t0 = i.audio.filter(function (z) { return z.ordine === a; })[0]; if (t0) info.scelta = { audio: t0.num }; }
        } else {
          info = { nome: x.voce.nome, dim: g.dim, formato: g.contenitore, durata: g.durata / 1000, titolo: '', avvisi: [], capitoli: [],
            video: g.video ? { codec: g.video.codec, nomeCodec: NOMI_COD[g.video.codec] || g.video.codec, largh: g.video.largh, alt: g.video.alt, hdr: hdrDi(g.video.hdr), letto: true } : null,
            audio: g.audio.map(function (z) {
              return { num: z.indice, ordine: z.indice, codec: z.codec, nomeCodec: NOMI_COD[z.codec] || z.codec, lingua: lingua3(z.lingua), nome: z.nome,
                canali: z.canali, predefinita: z.predefinita, letto: true, server: !z.letto };
            }), sotto: i ? i.sotto : [], scelta: { audio: g.audioScelto } };
        }
        info.durata = info.durata || g.durata / 1000;
        if (g.mbps) info.mbps = g.mbps;
        var cap = JF.capitoli(j.it);
        if (cap.length > 1) info.capitoli = cap;
        // i sottotitoli che da' Jellyfin: quelli accanto al film, e tutti se il file non e' un MKV
        info.esterniJf = g.sotto.filter(function (z) { return (z.esterno || !mkv) && /^(SRT|ASS|VTT|TX3G)$/.test(z.codec); }).map(function (z) {
          return { indice: z.indice, lingua: lingua3(z.lingua), nome: z.nome, forzata: z.forzata };
        });
        return info;
      });
    });
  }
  function urlJf(x) {
    var j = x.jf, b = serv.base + '/api/video/g/' + serv.gettone + '/';
    // il video diretto: il servizio rimanda al ponte del Mac, e playlist e pezzi arrivano da li' (o l'indirizzo del Mac nel
    // <video>, se il lettore non segue il rinvio)
    if (usaDiretto(x)) return (x.provaMac || direttoVia === 'mac') && j.diretto.mac ? j.diretto.mac : b + j.diretto.url;
    if (j.modo !== 'diretto') return b + j.url;
    // il nome col suo tipo nell'indirizzo, come per le chiavette
    var ms = JF.sorgente(j.it), nome = String(ms && ms.Path || 'video.mkv').split(/[\/\\]/).pop().replace(/[?#%]/g, '_');
    return b + 'jf/file/' + j.id + '/' + encodeURIComponent(nome) + '?ms=' + j.ms + '&a=' + (x.audio || 0);
  }

  /* ---------------------------------------------------------- il video diretto dal Mac (prova)
   * Con l'interruttore acceso (Altro › Video diretto dal Mac) playlist e pezzi del film vanno dal ponte del Mac al lettore,
   * senza passare dal servizio del TV: il servizio da' il biglietto e il primo rinvio, poi resta quasi fermo. Tutto il
   * resto (qualita', lingua, salti, anteprime, sottotitoli, avanzamento, telefono) e' come sempre. Il film non resta mai
   * fermo per questo: errore del lettore, nessuna domanda arrivata al Mac in 4 s, nessun dato nuovo e niente film a 10 s,
   * niente film in 30 s o fermo 25 s a meta' film, e si torna da soli alla strada di sempre dallo stesso punto. Se il video diretto non parte, per questa apertura
   * dell'app non si riprova (direttoBloccato); il motivo va nel diario del lettore (8091/tv).
   * Il <video> chiede prima al servizio, che rinvia al Mac (302). Se il servizio ha rinviato ma al Mac non e' arrivato niente
   * (un lettore che non segue i rinvii), una volta si prova l'indirizzo del Mac direttamente nel <video>; se va, per questa
   * apertura dell'app si usa quello (direttoVia). */
  var direttoBloccato = '', direttoVia = '', direttoTempi = 0;
  function vuoleDiretto(x) { return !!(prefs.videoDiretto && x && x.jf && !x.jf.trailer && !x.direttoNo && !direttoBloccato); }
  function usaDiretto(x) { var j = x && x.jf; return !!(j && j.diretto && !x.direttoNo && j.modo !== 'diretto' && j.modo !== 'mac'); }
  // il biglietto non serve piu' (film chiuso, qualita' o lingua cambiate, limitatore, puntata dopo): si chiude sul Mac
  function fineDirettoJf(j) {
    if (!j || !j.diretto) return;
    chiedi('jf/diretto-fine/' + j.diretto.biglietto, null, {}).then(null, function () {});
    j.diretto = null;
  }
  // perche' il video diretto non e' partito, da quello che ha visto il Mac: nessuna domanda arrivata (il motore del TV non
  // l'ha fatta, o l'ha portata a https), o arrivate ma il lettore non va
  // (domande arrivate ma rifiutate dal Mac, per esempio da un altro indirizzo del TV: non e' il motore che blocca)
  function motivoDiretto(s) { return !s || !s.mac ? 'mac' : !s.richieste ? (s.https > 0 ? 'https' : s.rifiutate > 0 ? 'errore' : 'bloccato') : 'errore'; }
  // da che punto si riparte: prima del via quello chiesto a carica(); dopo, il tempo del film (o l'ultimo buono, se il lettore
  // dopo un errore l'ha rimesso a 0)
  function puntoDiretto(x) { return x.partito ? (v.currentTime > 0 ? v.currentTime : x.ultimoBuono || x.daCarica || 0) : x.daCarica || 0; }
  // lo stato visto dal Mac, chiesto al servizio. Se il servizio non risponde o non conosce piu' il biglietto (caduto o
  // ripartito) del Mac non si sa niente: null
  function statoDiretto(k) { return chiedi('jf/diretto-stato/' + k).then(function (s) { return s && typeof s === 'object' && 'mac' in s ? s : null; }, function () { return null; }); }
  // l'indirizzo del Mac direttamente nel <video>, una volta per film: non passa dal servizio
  function provaMac(x) {
    if (x.provaMac || direttoVia === 'mac' || !x.jf.diretto.mac) return false;
    x.provaMac = true;
    carica(x.daCarica || 0, !!x.pausaVoluta);
    return true;
  }
  // prima del film: cosa fare con quello che ha visto il Mac (s), o senza saperlo (s = null). Rinviato dal servizio ma nessuna
  // domanda al Mac: forse il lettore non segue i rinvii, una volta l'indirizzo del Mac. Non si sa niente: dopo un errore del
  // lettore una volta l'indirizzo del Mac; senza errore si aspetta ancora il film (restano i 30 s)
  function decidiDiretto(x, s, errore) {
    if (!s) {
      if (errore && !provaMac(x)) ritornoDiretto(x, 'servizio');
      return;
    }
    var mo = motivoDiretto(s);
    if (mo === 'bloccato' && s.rinvii > 0 && provaMac(x)) return;
    ritornoDiretto(x, mo, s);
  }
  function vegliaDiretto(x) {
    var j = x.jf, k = j.diretto.biglietto, giro = x.giroDiretto = (x.giroDiretto || 0) + 1, ancora = 1;
    function vivo() { return L === x && x.jf === j && usaDiretto(x) && j.diretto.biglietto === k && x.giroDiretto === giro && !x.partito; }
    // a 4 s cosa ha visto il Mac. Il lettore non ha chiesto niente nemmeno al servizio: e' solo lento, si riguarda a 8 s e poi si
    // aspetta il film. Le domande arrivano al Mac: 6 s dopo, se nessun byte in piu', il Mac non sta aspettando Jellyfin e niente
    // film, la strada di sempre. Se lo stato non si legge si aspetta
    function guarda() {
      if (!vivo()) return;
      statoDiretto(k).then(function (s) {
        if (!vivo() || !s) return;
        // (con l'indirizzo del Mac nel <video> il servizio non rinvia: li' niente al Mac vuol dire bloccato)
        if (s.mac && !s.richieste && !s.rinvii && !x.provaMac && direttoVia !== 'mac') { if (ancora-- > 0) setTimeout(guarda, 4000); return; }
        if (motivoDiretto(s) !== 'errore') { decidiDiretto(x, s, false); return; }
        var byte0 = s.byte;
        setTimeout(function () {
          if (!vivo()) return;
          statoDiretto(k).then(function (s2) { if (vivo() && !x.pausaVoluta && s2 && s2.mac && s2.byte <= byte0 && !(s2.attese > 0)) ritornoDiretto(x, 'tempo', s2); });
        }, 6000);
      });
    }
    setTimeout(guarda, 4000);
    // a 30 s senza film (in pausa voluta prima del via non si conta): la strada di sempre; ma col servizio che non risponde
    // prima una volta l'indirizzo del Mac
    setTimeout(function () {
      if (!vivo() || x.pausaVoluta) return;
      statoDiretto(k).then(function (s) {
        if (!vivo()) return;
        if (!s && provaMac(x)) return;
        ritornoDiretto(x, s ? 'tempo' : 'servizio', s);
      });
    }, 30000);
  }
  // un errore del lettore col video diretto: a meta' film subito la strada di sempre; prima del film decide quello che ha
  // visto il Mac (e la veglia di prima non decide piu')
  function erroreDiretto(x) {
    x.dirErrore = v.error ? v.error.code : 9;
    if (x.partito) { ritornoDiretto(x, 'meta'); return; }
    var j = x.jf, k = j.diretto.biglietto, giro = x.giroDiretto = (x.giroDiretto || 0) + 1;
    function vivo() { return L === x && x.jf === j && usaDiretto(x) && j.diretto.biglietto === k && x.giroDiretto === giro; }
    statoDiretto(k).then(function (s) { if (vivo()) decidiDiretto(x, s, true); });
  }
  // si torna alla strada di sempre (i pezzi dal servizio del TV), dallo stesso punto e come si era (in pausa solo se l'aveva
  // chiesta chi guarda). s = lo stato visto dal Mac, per il diario
  function ritornoDiretto(x, motivo, s) {
    var j = x.jf, k = j && j.diretto ? j.diretto.biglietto : '', mac = j && j.diretto && j.diretto.mac;
    if (!usaDiretto(x)) return;
    x.direttoNo = motivo;
    x.dirInfo = motivo;
    if (s && s.mac) { x.dirRichieste = s.richieste; x.dirHttps = s.https; }
    // il motore del TV non lo fa partire (https; o niente al Mac anche con l'indirizzo del Mac nel <video>), e lo dice il Mac:
    // per questa apertura dell'app i film vanno subito dalla strada di sempre. Il Mac lento a partire: solo alla seconda volta.
    // Gli altri motivi (errore, Mac o servizio che non rispondono, a meta' film) valgono solo per questo film
    if (s && s.mac && (motivo === 'https' || (motivo === 'bloccato' && (x.provaMac || direttoVia === 'mac' || (!mac && s.rinvii > 0))))) direttoBloccato = motivo;
    if (motivo === 'tempo' && ++direttoTempi >= 2) direttoBloccato = motivo;
    fineDirettoJf({ diretto: { biglietto: k } });
    carica(puntoDiretto(x), !!x.pausaVoluta);
  }
  // a meta' film, ogni 10 s (salvaTimer): col video diretto il tempo del film fermo per 25 s (Mac addormentato, Wi-Fi caduto,
  // ponte piantato: il lettore del TV puo' non dire niente, e 'waiting' non sempre arriva) -> la strada di sempre dallo stesso
  // punto. La pausa, la fine e la pagina nascosta non contano; copre anche un salto che non finisce mai
  function vegliaMeta(x) {
    var ora = Date.now();
    if (!usaDiretto(x) || !x.partito || v.paused || v.ended || document.hidden || Math.abs(v.currentTime - (x.dirUltimoT || 0)) > 0.5) {
      x.dirUltimoT = v.currentTime;
      x.dirFermoDa = ora;
      return;
    }
    if (ora - (x.dirFermoDa || ora) >= 25000) ritornoDiretto(x, 'meta');
  }
  v.addEventListener('playing', function () {
    if (!L || !usaDiretto(L)) return;
    L.dirInfo = (L.provaMac || direttoVia === 'mac') && L.jf.diretto.mac ? 'si2' : 'si';
    if (L.provaMac) direttoVia = 'mac';
  });
  // a Jellyfin: si guarda (inizio), a che punto (avanti, ogni 10 s e a pausa e salti), smesso (fine)
  function riportaJf(evento, t) {
    var x = L, j = x && x.jf;
    if (!j || !j.sessione) return;
    if (evento === 'inizio') { if (j.partito) evento = 'avanti'; j.partito = true; }
    else if (!j.partito) return;
    var corpo = { ItemId: j.id, MediaSourceId: j.ms, PlaySessionId: j.sessione, PositionTicks: JF.ticks(t !== undefined ? t : v.currentTime - (x.spost || 0)),
      IsPaused: !!v.paused, IsMuted: false, CanSeek: true, PlayMethod: j.modo === 'diretto' || j.modo === 'file' ? 'DirectPlay' : j.modo === 'copia' || j.modo === 'mac' ? 'DirectStream' : 'Transcode' };
    if (j.modo !== 'diretto') corpo.AudioStreamIndex = x.audio;
    if (evento === 'fine') j.partito = false;
    // (la fine parte subito, anche con altre domande in volo: si puo' star chiudendo l'app)
    chiediJf(evento === 'inizio' ? 'Sessions/Playing' : evento === 'fine' ? 'Sessions/Playing/Stopped' : 'Sessions/Playing/Progress', null, corpo, null,
      evento === 'fine' ? 'ora' : '').then(null, function () {});
  }
  // la home mostra anche i film di Jellyfin in Continua a guardare (la scheda li riapre qui, con l'ancora #/jf/<id>)
  function puntoJf(x, t, d, fine, chiuso) {
    riportaJf(fine || chiuso ? 'fine' : 'avanti', fine ? d : t);
    if (x.jf.trailer) return;
    var s = JF.scheda(x.jf.it), puntata = s.tipo === 'puntata';
    var corpo = { jf: x.jf.id, titolo: puntata && s.serie ? s.serie.titolo : s.titolo, anno: puntata ? 0 : s.anno, stagione: puntata ? s.stagione : 0,
      episodio: puntata ? s.episodio : 0, posizione: Math.round(fine ? d : t), durata: Math.round(d), guardato: Math.round(x.guardato), inPausa: v.paused,
      chiuso: !!chiuso || !!fine, app: String(location.href).split('#')[0] };
    // (dal Mac il punto va a Jellyfin con riportaJf e, per Continua a guardare della home e la barra del telefono, al servizio
    // del TV col suo gettone, con il sito dell'app sullo Store: la scheda della home riapre Real4K da li')
    if (!DAL_MAC) chiedi('punto', null, corpo).then(null, function () {});
    else if (sitoApp) { corpo.app = sitoApp; chiediTv('punto', corpo).then(null, function () {}); }
  }
  // Real4K dal Mac: se il Mac non risponde piu' (spento, addormentato, ponte fermo) si torna da soli a Real4K del TV, dallo
  // stesso punto del film se ce n'era uno. Vale un segno chiaro: il gettone del Mac non piu' valido, o il ponte che non risponde
  // a /stato per tre volte in 15 s (si controlla dopo cinque domande senza risposta in almeno 15 s, un errore del lettore o un
  // film fermo da 20 s)
  var macGiu = { n: 0, da: 0, finito: false, controllo: false };
  function macRisponde() { macGiu.n = 0; }
  function macTace() {
    if (!DAL_MAC || macGiu.finito) return;
    var ora = Date.now();
    if (!macGiu.n) macGiu.da = ora;
    macGiu.n++;
    if (macGiu.n >= 5 && ora - macGiu.da >= 15000) controllaMac();
  }
  // il ponte c'e'? /stato fino a 3 volte, 5 s tra l'una e l'altra: si torna al TV solo se non risponde mai (un ponte che riparte
  // ci mette circa 10 s, e le sessioni le ritrova)
  function controllaMac() {
    if (!DAL_MAC || macGiu.finito || macGiu.controllo) return;
    macGiu.controllo = true;
    var prove = 0;
    (function prova() {
      var x = new XMLHttpRequest();
      function no() { if (++prove >= 3) { macGiu.controllo = false; macPerso(); } else setTimeout(prova, 5000); }
      x.open('GET', serv.base + '/stato', true);
      x.timeout = 4000;
      x.onload = function () { if (x.status === 200) { macGiu.controllo = false; macRisponde(); } else no(); };
      x.onerror = no;
      x.ontimeout = no;
      x.send();
    })();
  }
  function macPerso() { versoIlTv('Il Mac non risponde: torno a Real4K del TV'); }
  // il film di adesso come lo riapre la Store: #/jf/<id>?t=<secondi> (il punto vero, o quello da cui doveva partire)
  function ancoraFilm(x) {
    var t = x ? (x.partito && v.currentTime > 0 ? v.currentTime - (x.spost || 0) : x.daCarica || 0) : 0;
    return x && x.jf && !x.jf.trailer ? '#/jf/' + x.jf.id + '?t=' + Math.max(0, Math.floor(t)) : '';
  }
  // si torna a Real4K del TV (la Store la riapre nel riquadro, senza il Mac), col film di adesso dallo stesso punto
  // (ancora: dove riaprire, se non e' il film di adesso: una chiavetta)
  function versoIlTv(testo, ancora) {
    if (!DAL_MAC || macGiu.finito) return;
    macGiu.finito = true;
    var a = ancora || ancoraFilm(L);
    try { v.pause(); } catch (e) {}
    messaggio(testo + (a && !ancora ? ', dallo stesso punto' : ''), 5000);
    // (l'uscita di tv-app.js: prima l'app salva, poi si va solo se la Store risponde; un Indietro durante l'attesa va a casa)
    setTimeout(function () {
      if (riapriTv && HomeTV.vaiDalMac) HomeTV.vaiDalMac(riapriTv + (a ? '&ancora=' + encodeURIComponent(a) : ''));
      else HomeTV.esci();
    }, 2500);
  }
  // il film dal Mac fermo da 20 s mentre dovrebbe andare: si controlla il ponte. Fermo da 40 s col ponte che risponde (il
  // lettore del TV che non va avanti): si torna a Real4K del TV, dallo stesso punto
  function vegliaMac(x) {
    if (!DAL_MAC) return;
    var ora = Date.now();
    if (!x.partito || v.paused || v.ended || document.hidden || Math.abs(v.currentTime - (x.macUltimoT || 0)) > 0.5) {
      x.macUltimoT = v.currentTime;
      x.macFermoDa = ora;
      x.macControllato = false;
      return;
    }
    var fermo = ora - (x.macFermoDa || ora);
    if (fermo >= 40000) versoIlTv('Il film dal Mac si è fermato: lo riapro su Real4K del TV');
    else if (fermo >= 20000 && !x.macControllato) { x.macControllato = true; controllaMac(); }
  }
  // una conversione del server che non serve piu' (si cambia qualita' o audio, si esce): si ferma subito
  function fermaConversione(j) {
    if (!j || j.modo === 'diretto' || j.modo === 'file' || !j.sessione) return;
    chiediJf('Videos/ActiveEncodings', { PlaySessionId: j.sessione }, null, 'DELETE', 'ora').then(null, function () {});
  }
  // stesso film, altra strada (audio o qualita' cambiati): dallo stesso punto, in pausa se lo era
  function ricaricaJf(opz) {
    var x = L;
    if (!x || !x.jf) return;
    var t = v.currentTime || x.daQui || 0, pausa = v.paused, vecchio = { modo: x.jf.modo, sessione: x.jf.sessione, diretto: x.jf.diretto };
    riportaJf('fine', t);
    attesa(true);
    stradaJf(x, t, opz.a).then(function (info) {
      if (L !== x) return;
      fermaConversione(vecchio);
      fineDirettoJf(vecchio);
      x.info = info;
      x.audio = info.scelta && info.scelta.audio !== undefined && info.scelta.audio !== null ? info.scelta.audio : 0;
      j_tp(x);
      disegnaBadgeOsd();
      carica(t, pausa);
      if (opz.testo) messaggio(opz.testo, 3500);
      if (puoLimitare(x)) limitaJf(true);
    }, function (e) {
      attesa(false);
      messaggio(e.codice === 'rete' ? 'Jellyfin non risponde: riprova' : 'Jellyfin non riesce a preparare il film cosi\'', 4500);
    });
  }
  function j_tp(x) { x.jf.tp = JF.trickplay(x.jf.it, x.jf.ms); }
  // il tetto per il limitatore: quello del TV, o il 70% della rete se e' stata misurata (Automatica) e va meno
  function tettoMac(j) { var t = tettoTv.mbps || 80; return j && j.mbps ? Math.max(10, Math.min(t, Math.round(j.mbps * 0.7))) : t; }
  // l'audio scelto come lo conta Jellyfin (indice nel file); nella strada diretta l'app ha il numero della traccia MKV
  function audioPerJf(x) {
    if (!x.jf || !x.info) return undefined;
    var t = (x.info.audio || []).filter(function (z) { return z.num === x.audio; })[0];
    return t ? t.ordine : undefined;
  }
  function puoLimitare(x) { return !!(x && x.jf && !x.jf.trailer && !x.jf.noLim && macAttivo() && /^(diretto|file|copia)$/.test(x.jf.modo)); }
  // il limitatore del Mac, da solo: il Mac guarda i picchi del film (una volta, poi li ricorda); se superano il tetto del TV
  // prepara l'HLS "copia + picchi" e il lettore ci passa dallo stesso punto appena e' pronto piu' avanti di dove si e'
  function limitaJf(auto) {
    var x = L;
    if (!x || !x.jf) return;
    var j = x.jf, giro = j.giroMac = (j.giroMac || 0) + 1, tetto = tettoMac(j), detto = false;
    if (!auto) messaggio('Chiedo al Mac la versione senza picchi…', 3000);
    (function prova() {
      if (L !== x || j.giroMac !== giro) return;
      chiedi('jf/limita/' + j.id, { ms: j.ms, tetto: tetto, a: audioPerJf(x) }).then(function (r) {
        if (L !== x || j.giroMac !== giro) return;
        j.lim = r;
        if (!r.serve && r.pronto) { if (!auto) messaggio('Questo film non ha picchi oltre ' + tetto + ' Mbps: va bene com\'è', 5000); return; }
        var t = v.currentTime || 0;
        if (r.pronto && r.url && (r.completo || r.secondiPronti > t + 30)) { passaAlMac(x, r); return; }
        if (!auto || !detto) {
          messaggio(r.fase === 'analisi' ? 'Il Mac guarda i picchi del film… ' + Math.round(r.lavoro && r.lavoro.percentuale || 0) + '%' :
            'Il Mac toglie i picchi oltre ' + tetto + ' Mbps… ' + Math.round(r.secondiPronti || 0) + ' s pronti', 2600);
          detto = auto && r.fase === 'hls';
        }
        setTimeout(prova, 2000);
      }, function (e) {
        if (L !== x || j.giroMac !== giro) return;
        j.lim = { errore: e.codice || 'errore' };
        var p = x.info && x.info.picchi;
        if (e.codice === 'cartella') { if (!auto) messaggio('Il Mac non vede questo film: aggiungi la sua cartella al limitatore', 6000); return; }
        if (e.codice === 'mac') { messaggio('Il Mac non riconosce più questo TV: ricollegalo (Altro › Senza picchi · Mac)', 6000); return; }
        // il Mac spento: si guarda l'originale, con i momenti a rischio (stimati dal TV) se ce ne sono
        if (p && p.momenti) avvisoLettore('Il Mac non risponde: il film può scattare in ' + p.momenti + (p.momenti === 1 ? ' momento: ' : ' momenti: ') + momentiTesto(p), 9000);
        else if (!auto) messaggio(e.codice === 'rete' ? 'Il Mac non risponde' : 'Il Mac non riesce a preparare questo film', 6000);
      });
    })();
  }
  function passaAlMac(x, r) {
    var j = x.jf, t = v.currentTime || x.daQui || 0, pausa = v.paused;
    riportaJf('fine', t);
    fermaConversione({ modo: j.modo, sessione: j.sessione });
    fineDirettoJf(j);
    j.modo = 'mac';
    j.url = r.url;
    disegnaBadgeOsd();
    carica(t, pausa);
    messaggio('Il Mac ha tolto i picchi oltre ' + r.tetto + ' Mbps: continuo da qui, senza scatti', 4500);
  }
  // dalla versione TV all'originale (o al contrario), dallo stesso punto
  function passaVersione(originale) {
    var x = L, t = Math.round(v.currentTime || 0), o = { vicini: x.vicini, cartella: x.cartella, sotto: x.esterni, ritorno: x.ritorno, esatto: t, picchiOk: true };
    if (originale) { o.originale = true; o.tvAltro = x.voce; apriVideo(x.voce.tvDi, o); }
    else apriVideo(x.tvAltro, o);
  }
  // i primi momenti oltre il tetto, per gli avvisi: "0:14:30 (121 Mbps), ..."
  function momentiTesto(p) {
    return p.lista.slice(0, 4).map(function (m) { return tempo(m.da) + ' (' + Math.round(m.mbps) + ' Mbps)'; }).join(', ') + (p.momenti > 4 ? '…' : '');
  }
  // la chiavetta: il film supera il tetto del TV in qualche momento. Si dice prima, con le strade possibili
  function avvisoPicchi(x, voce, o, i) {
    var p = i.picchi, hevc = i.video && i.video.codec === 'HEVC';
    function continua() {
      chiudiFermo();
      var o2 = {};
      for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) o2[k] = o[k];
      o2.picchiOk = true;
      o2.info = i;
      apriVideo(voce, o2);
    }
    var testo = 'Questo film supera il tetto del TV (' + p.tetto + ' Mbps) in ' + p.momenti + (p.momenti === 1 ? ' momento: ' : ' momenti: ') + momentiTesto(p) +
      '. Lì può scattare.' + (hevc ? '' : ' Il Mac sa togliere i picchi solo dai video HEVC.');
    var pulsanti = [{ testo: 'Guardalo lo stesso', fn: continua }];
    if (hevc) pulsanti.push({ testo: 'Prepara la versione TV', fn: function () { istruzioniVersioneTv(voce, p.tetto, function () { fermo('Può scattare', testo, pulsanti); }); } });
    pulsanti.push({ testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } });
    fermo('Può scattare', testo, pulsanti);
    // lo stesso film anche in Jellyfin, col Mac collegato: si guarda da li', e il Mac toglie i picchi
    if (jfAttivo() && macAttivo()) trovaInJf(voce).then(function (it) {
      if (!it || L !== x || $('fermo').hidden) return;
      var pt = punti[chiaveDi(voce.p, voce.dim)];
      pulsanti.unshift({ testo: 'Guardalo dal Mac, senza scatti', fn: function () { chiudiFermo(); guardaJf(it, { ritorno: x.ritorno, t: riprendibile(pt, i.durata) ? pt.t : undefined }); } });
      fermo('Può scattare', testo, pulsanti);
    });
  }
  // lo stesso file in Jellyfin: stessa misura, o stesso nome
  function trovaInJf(voce) {
    var tt = titoloDi(voce.nome);
    return chiediJf('Items', { searchTerm: tt.titolo, IncludeItemTypes: 'Movie,Episode', Recursive: true, Fields: 'MediaSources', Limit: 20, userId: uid() }).then(function (r) {
      var l = voci(r);
      for (var a = 0; a < l.length; a++) {
        var ms = l[a].MediaSources || [];
        for (var b = 0; b < ms.length; b++) {
          if ((voce.dim && +ms[b].Size === voce.dim) || String(ms[b].Path || '').split(/[\/\\]/).pop() === voce.nome) return l[a];
        }
      }
      return null;
    }, function () { return null; });
  }
  function istruzioniVersioneTv(voce, tetto, indietro) {
    var base = voce.nome.replace(/\.[^.]+$/, '');
    fermo('Prepara la versione TV', 'Sul Mac: 1) attacca questa chiavetta al Mac; 2) accendi il limitatore (doppio clic su avvia-limitatore.command); ' +
      '3) nel Terminale scrivi: node ~/Documents/home-tv/mac/limitatore/limitatore.js versione-tv "/Volumes/<nome della chiavetta>/' + voce.p + '" ' + tetto + ' --accanto\n' +
      'Il Mac scrive «' + base + ' [TV ' + tetto + '].mkv» accanto al film, con tutti gli audio, i sottotitoli e i capitoli. Rimetti la chiavetta nel TV: ' +
      'l\'app la guarda da sola, e l\'originale resta nel pannello.', [{ testo: 'Ho capito', fn: indietro }]);
  }
  function cambiaQualita(q) {
    if (!L || !L.jf) return;
    var j0 = L.jf;
    // "senza limitatore": il file vero coi picchi; "Originale" lo rimette (il Mac li toglie di nuovo da solo)
    if (q === 'nolim') { j0.noLim = true; j0.giroMac = (j0.giroMac || 0) + 1; j0.q = 'orig'; ricaricaJf({ testo: 'Originale senza limitatore: coi picchi' }); return; }
    if (q === 'orig' && j0.noLim) j0.noLim = false;
    prefs.qualita = q;
    salvaPrefs();
    var x = L, nome = (QUALITA_JF.filter(function (z) { return z.id === q; })[0] || {}).nome || q;
    x.jf.q = q;
    if (q !== 'auto') { ricaricaJf({ testo: 'Qualità: ' + nome }); return; }
    messaggio('Misuro la rete…');
    // scelta a mano: una misura nuova (per i film il servizio tiene l'ultima per 20 minuti)
    chiedi('jf/veloce', { nuova: 1 }).then(function (r) {
      if (L !== x) return;
      x.jf.mbps = r.mbps;
      ricaricaJf({ testo: 'Qualità automatica: la rete fa ' + r.mbps + ' Mbps' });
    }, function () { messaggio('Non riesco a misurare la rete: resto sull\'originale', 4000); x.jf.q = 'orig'; });
  }
  // l'anteprima grande sopra la barra mentre si scorre: le tessere di Jellyfin (trickplay); senza, l'immagine del capitolo se c'e'
  // (Jellyfin). Dalle chiavette niente immagini (estrarle peserebbe sul TV): resta il minuto grande col nome del capitolo.
  // I fogli di tessere (richiesta del 31/10): mentre se ne guarda uno arrivano anche quello prima e quello dopo, e finche' il
  // foglio nuovo non c'e' resta la tessera di prima: mai un riquadro nero. Al massimo 3 fogli (piu' quello che si vede),
  // lasciati andare finito lo scorrimento (fino a 3200x1800: 23 MB decodificati, mentre gira il 4K)
  var fogli = { l: {}, voluto: '', visto: '', ultimo: null };
  function foglioTessere(u) {
    var x = fogli.l[u];
    if (x) return x;
    x = fogli.l[u] = { img: el('img'), pronto: false };
    x.img.alt = '';
    x.img.onload = function () {
      x.pronto = true;
      // il foglio che serviva adesso: si mostra subito, senza aspettare la prossima pressione
      if (fogli.voluto === u && fogli.ultimo) anteprimaBarra(fogli.ultimo[0], fogli.ultimo[1]);
    };
    x.img.onerror = function () { x.img.onload = x.img.onerror = null; };
    x.img.src = u;
    return x;
  }
  function lasciaFogli(tenere) {
    for (var u in fogli.l) {
      if (!Object.prototype.hasOwnProperty.call(fogli.l, u) || (tenere && tenere[u])) continue;
      var x = fogli.l[u];
      x.img.onload = x.img.onerror = null;
      if (x.img.parentNode) x.img.parentNode.removeChild(x.img);
      x.img.removeAttribute('src');
      delete fogli.l[u];
    }
  }
  function anteprimaBarra(t, f) {
    var an = $('osd-anteprima'), tp = L && L.jf ? L.jf.tp : null, te = $('osd-tessera'), ci = $('osd-capitolo');
    var cap = t >= 0 && !tp ? capitoloA(t) : null, img = cap && cap.img && serv.gettone ? cap.img : null;
    if (t < 0 || (!tp && !img)) {
      if (!an.hidden) an.hidden = true;
      if (fogli.voluto || fogli.visto) { lasciaFogli(null); fogli.voluto = fogli.visto = ''; fogli.ultimo = null; }
      if (ci.getAttribute('src')) { ci.removeAttribute('src'); ci.hidden = true; }
      return;
    }
    var W = window.innerWidth, h = Math.round(window.innerHeight * 0.24), w;
    if (tp) {
      var ts = JF.tessera(tp, t), sc = h / ts.h, n = tp.quante ? Math.ceil(tp.quante / (tp.col * tp.righe)) : 0;
      var base = serv.base + '/api/video/g/' + serv.gettone + '/jf/p/Videos/' + L.jf.id + '/Trickplay/' + tp.larg + '/', coda = '.jpg?MediaSourceId=' + L.jf.ms;
      var url = base + ts.foglio + coda, prima = base + (ts.foglio - 1) + coda, dopo = base + (ts.foglio + 1) + coda;
      var vicini = {}, qui = foglioTessere(url);
      vicini[url] = 1;
      if (ts.foglio > 0) { vicini[prima] = 1; foglioTessere(prima); }
      if (!n || ts.foglio + 1 < n) { vicini[dopo] = 1; foglioTessere(dopo); }
      fogli.voluto = url;
      fogli.ultimo = [t, f];
      w = Math.round(ts.w * sc);
      if (qui.pronto) {
        if (te.firstChild !== qui.img) { svuota(te); te.appendChild(qui.img); }
        fogli.visto = url;
        te.style.width = ts.W + 'px';
        te.style.height = ts.H + 'px';
        te.style.transform = 'scale(' + sc + ') translate(' + (-ts.x) + 'px,' + (-ts.y) + 'px)';
      } else if (!fogli.visto) {
        // nessun foglio ancora arrivato: il riquadro aspetta (il minuto grande si vede gia') e si mostra appena arriva
        lasciaFogli(vicini);
        if (!an.hidden) an.hidden = true;
        ci.hidden = true;
        return;
      }
      // il foglio che si vede resta finche' il nuovo non arriva (con la tessera di prima); quelli lontani si lasciano andare
      vicini[fogli.visto] = 1;
      lasciaFogli(vicini);
      te.hidden = false;
      ci.hidden = true;
    } else {
      var u2 = urlImmagine('', img, 480, 270, false);
      w = Math.round(h * 16 / 9);
      if (ci.getAttribute('src') !== u2) ci.src = u2;
      ci.hidden = false;
      te.hidden = true;
    }
    an.style.width = w + 'px';
    an.style.height = h + 'px';
    // il centro sul punto della barra, ma sempre tutta dentro lo schermo
    an.style.left = Math.round(Math.max(w / 2 + W * 0.03, Math.min(W - w / 2 - W * 0.03, W * 0.05 + f * W * 0.9)) - w / 2) + 'px';
    an.style.marginLeft = '0';
    an.hidden = false;
  }

  /* ---------------------------------------------------------- Salta sigla: dai capitoli coi nomi giusti */

  var SIGLE = [{ re: /^(intro|opening|op|sigla|sigla iniziale|apertura)\b/i, testo: 'Salta sigla' },
    { re: /^(recap|riassunto|previously|nella puntata precedente|nelle puntate precedenti)\b/i, testo: 'Salta riassunto' },
    { re: /^(ending|ed|credits|end credits|titoli di coda|sigla finale|outro)\b/i, testo: 'Salta titoli di coda', fine: true }];
  function siglaDi(t) {
    // i segmenti di Jellyfin (sigla, riassunto, titoli di coda) valgono prima dei capitoli
    var g = L && L.jf ? L.jf.segmenti : null;
    if (g) for (var j = 0; j < g.length; j++) if (t >= g[j].da && t < g[j].a - 1) return { da: g[j].da, fine: g[j].a, testo: g[j].testo, ultima: g[j].ultima };
    var c = L && L.info && L.info.capitoli;
    if (!c || c.length < 2) return null;
    for (var i = 0; i < c.length; i++) {
      var fine = i + 1 < c.length ? c[i + 1].t : ((L.info && L.info.durata) || v.duration || 0);
      if (t >= c[i].t && t < fine - 1) {
        for (var k = 0; k < SIGLE.length; k++) if (SIGLE[k].re.test(String(c[i].nome || '').replace(/^\s+/, ''))) return { da: c[i].t, fine: fine, testo: SIGLE[k].testo, ultima: !!SIGLE[k].fine };
        return null;
      }
    }
    return null;
  }
  function guardaSigla(t) {
    var s = siglaDi(t), b = $('salta');
    if (!s || pan || (L && (L.chip || L.fineConto))) { if (!b.hidden) b.hidden = true; if (L) L.sigla = null; return; }
    var n = s.ultima ? prossimoDi(L) : null;
    L.sigla = s;
    L.sigla.prossimo = n;
    // si vede per 12 secondi dall'inizio del capitolo (o finche' i comandi sono in vista)
    var inizio = s.da, vedi = t - inizio < 12 || $('osd').className === 'on';
    var testo = n ? 'Prossimo episodio' : s.testo;
    if (b.hidden !== !vedi || b.getAttribute('data-t') !== testo) {
      svuota(b);
      b.appendChild(document.createTextNode(testo));
      b.appendChild(el('small', '', 'OK'));
      b.setAttribute('data-t', testo);
      b.hidden = !vedi;
    }
  }
  function saltaSigla() {
    var s = L && L.sigla;
    if (!s || $('salta').hidden) return false;
    $('salta').hidden = true;
    if (s.prossimo) { vaiA(s.prossimo); return true; }
    if (s.ultima && s.fine >= ((L.info && L.info.durata) || v.duration || 0) - 1) { finito(); return true; }
    vai(s.fine);
    return true;
  }

  /* ---------------------------------------------------------- sottotitoli */

  function scegliSottotitoliIniziali(x, scelto) {
    var i = x.info, a = i.audio.filter(function (t) { return t.num === x.audio; })[0], la = a ? a.lingua : '', prima = prefs.lingue[0];
    var interni = i.sotto.filter(function (s) { return s.leggibile; }), sc = sceltaCartella(x.voce);
    x.sotto = null;
    // scelti nella scheda prima di partire
    if (scelto) x.sotto = { tipo: 'interna', num: scelto };
    // i forzati nella lingua dell'audio (le parti in un'altra lingua): sempre
    var forz = interni.filter(function (s) { return s.forzata && s.lingua === la; })[0];
    if (!x.sotto && forz) x.sotto = { tipo: 'interna', num: forz.num, forzati: true };
    // scelti a mano in un'altra puntata della stessa serie
    if (!scelto && sc && sc.s && sc.s !== 'no') {
      var mio = interni.filter(function (s) { return s.lingua === sc.s && !s.forzata; })[0];
      var suo = mio ? null : esterniDi(x).filter(function (e) { return e.lingua === sc.s && !e.forzata; })[0];
      if (mio) x.sotto = { tipo: 'interna', num: mio.num };
      else if (suo) x.sotto = { tipo: 'esterna', p: suo.p };
    }
    // audio in un'altra lingua: i sottotitoli nella tua (se lo vuoi: prefs.sottoAuto)
    if (!x.sotto && !(sc && sc.s) && prefs.sottoAuto && la && la !== prima) {
      var tua = interni.filter(function (s) { return s.lingua === prima && !s.forzata; })[0];
      if (tua) x.sotto = { tipo: 'interna', num: tua.num };
      else {
        var est = esterniDi(x).filter(function (e) { return e.lingua === prima; })[0];
        if (est) x.sotto = { tipo: 'esterna', p: est.p };
      }
    }
    if (x.sotto && !x.sotto.forzati) x.ultimoSotto = x.sotto; // Rosso li rispegne e li riaccende
    x.eventi = [];
    x.completi = false;
    x.chiesto = -1;
    aggiornaSotto(true);
  }
  // i sottotitoli accanto al film: "Film.ita.srt", "Film.srt", "Film.en.forced.srt"
  function esterniDi(x) {
    // Jellyfin: i sottotitoli accanto al film (o dentro un file che non e' MKV) li da' il server
    if (x.jf) return ((x.info && x.info.esterniJf) || []).map(function (e) { return { nome: e.nome || nomeLingua(e.lingua), p: 'jf:' + e.indice, lingua: e.lingua, forzata: e.forzata }; });
    var base = String(x.voce.nome).replace(/\.[^.]+$/, '').toLowerCase(), out = [];
    var cartella = x.cartella !== null ? x.cartella : x.voce.p.replace(/\/?[^\/]*$/, '');
    for (var i = 0; i < (x.esterni || []).length; i++) {
      var n = x.esterni[i].nome, nl = n.toLowerCase();
      if (nl.indexOf(base) !== 0) continue;
      var resto = nl.slice(base.length).replace(/\.(srt|ass|ssa|vtt)$/, ''), parti = resto.split('.').filter(Boolean);
      var lng = 'und';
      for (var k = 0; k < parti.length; k++) {
        var p = parti[k];
        if (/^(it|ita|italian|italiano)$/.test(p)) lng = 'ita';
        else if (/^(en|eng|english|inglese)$/.test(p)) lng = 'eng';
        else if (/^[a-z]{3}$/.test(p) && LINGUE[p]) lng = p;
      }
      out.push({ nome: n, p: cartella ? cartella + '/' + n : n, lingua: lng, forzata: /forced|forzat/.test(resto) });
    }
    return out;
  }
  // si chiedono al servizio a tratti vicino a dove guardi (i file accanto tutti insieme); "dopo": solo quelli nuovi
  function aggiornaSotto(subito) {
    var x = L;
    if (!x || !x.sotto) { if (x) { $('sottotitoli').textContent = ''; if (pgs) pgs.pulisci(); } return; }
    var t = Math.floor((v.currentTime - (L && L.spost || 0)) * 1000);
    if (x.completi) return;
    if (!subito && x.chiesto >= 0 && (Date.now() - x.chiestoAlle < (x.pgs ? 8000 : 2500))) return;
    if (x.inVolo) return;
    x.inVolo = true;
    var dopo = !subito && x.chiesto >= 0 && x.eventi.length ? x.eventi[x.eventi.length - 1].t : undefined;
    x.chiesto = t;
    x.chiestoAlle = Date.now();
    var s = x.sotto, quale = s;
    var r = x.jf ? (s.tipo === 'esterna' ? chiedi('jf/sottoesterni/' + x.jf.id, { ms: x.jf.ms, i: String(s.p).slice(3) }) :
      chiedi('jf/sotto/' + x.jf.id, { ms: x.jf.ms, t: s.num, da: t, dopo: dopo })) :
      s.tipo === 'esterna' ? chiedi('sotto', { d: x.voce.d, e: s.p }) : chiedi('sotto', { d: x.voce.d, p: x.voce.p, t: s.num, da: t, dopo: dopo });
    r.then(function (res) {
      x.inVolo = false;
      if (L !== x || x.sotto !== quale) return;
      var visti = {};
      for (var i = 0; i < x.eventi.length; i++) visti[x.eventi[i].t + ':' + (x.eventi[i].x || x.eventi[i].pgs || '').length] = true;
      (res.eventi || []).forEach(function (e) { var k = e.t + ':' + (e.x || e.pgs || '').length; if (!visti[k]) { x.eventi.push(e); visti[k] = true; } });
      x.eventi.sort(function (a, b) { return a.t - b.t; });
      x.pgs = x.eventi.length && !!x.eventi[0].pgs;
      if (x.pgs) { $('pgs').hidden = false; tela(); }
      if (x.pgs && x.eventi.length > 400) x.eventi = x.eventi.filter(function (e) { return Math.abs(e.t - t) < 600000; });
      x.completi = !!res.completi && s.tipo === 'esterna';
      if (res.complessi) messaggio('Sottotitoli troppo complessi per il TV: si vedono solo in parte', 5000);
      disegnaSotto(v.currentTime);
    }, function () { x.inVolo = false; });
  }
  var sottoMostrato = null;
  function disegnaSotto(sec) {
    var x = L, box = $('sottotitoli');
    if (!x || !x.sotto) return;
    // il ritardo scelto a mano: positivo = i sottotitoli arrivano dopo
    var t = (sec - (x.ritardo || 0)) * 1000, ev = null, i;
    if (x.pgs) {
      // PGS: vale l'ultima immagine iniziata (una vuota la toglie)
      for (i = x.eventi.length - 1; i >= 0; i--) if (x.eventi[i].t <= t + 40) { ev = x.eventi[i]; break; }
      if (ev && ev.d > 0 && t > ev.t + ev.d) ev = null;
      if (ev !== sottoMostrato) { sottoMostrato = ev; if (ev) tela().mostra(ev.pgs); else tela().pulisci(); }
      return;
    }
    // gli attivi: dall'ultimo iniziato (ricerca a meta'), indietro di qualche evento (si sovrappongono poco)
    var attivi = [], lo = 0, hi = x.eventi.length - 1, k = -1;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (x.eventi[mid].t <= t) { k = mid; lo = mid + 1; } else hi = mid - 1; }
    for (i = k; i >= 0 && i > k - 20; i--) { var e = x.eventi[i]; if (t < e.t + e.d) attivi.unshift(e); }
    var firma = attivi.map(function (e) { return e.t; }).join(',');
    if (firma === box.getAttribute('data-firma')) return;
    box.setAttribute('data-firma', firma);
    svuota(box);
    box.setAttribute('data-su', attivi.length && attivi[0].su ? '1' : '');
    posSotto();
    for (i = 0; i < attivi.length; i++) {
      var span = el('span', attivi[i].i ? 'corsivo' : '', attivi[i].x);
      box.appendChild(span);
      if (i < attivi.length - 1) box.appendChild(el('br'));
    }
  }
  // dove stanno: in alto se il file lo chiede; se no all'altezza scelta, e sopra la barra del tempo coi comandi in vista
  var ALTEZZE = [8, 15, 22, 30];
  function posSotto() {
    var box = $('sottotitoli'), su = box.getAttribute('data-su') === '1';
    box.className = (prefs.dimSotto || 'medi') + (su ? ' su' : '');
    box.style.bottom = su ? '' : Math.max(ALTEZZE[prefs.posSotto || 0] || 8, $('osd').className === 'on' ? 30 : 0) + 'vh';
  }
  function impostaSotto(s, manuale) {
    if (!L) return;
    if (manuale) {
      // si ricorda per le altre puntate della serie (i forzati no: quelli si accendono da soli)
      var lng = !s ? 'no' : s.tipo === 'esterna' ? (esterniDi(L).filter(function (e) { return e.p === s.p; })[0] || {}).lingua :
        (L.info.sotto.filter(function (t) { return t.num === s.num && !t.forzata; })[0] || {}).lingua;
      if (lng) ricordaCartella(L.voce, 's', lng);
    }
    L.sotto = s;
    L.eventi = [];
    L.completi = false;
    L.pgs = false;
    L.chiesto = -1;
    sottoMostrato = null;
    if (pgs) pgs.azzera();
    $('pgs').hidden = true;
    $('sottotitoli').textContent = '';
    $('sottotitoli').removeAttribute('data-firma');
    if (s) { if (!s.forzati) L.ultimoSotto = s; aggiornaSotto(true); }
  }
  // Rosso: spegne; riaccende gli ultimi, o quelli nella tua lingua (dentro il file o accanto)
  function rossoSotto() {
    if (!L || !L.info) return;
    if (L.sotto && !L.sotto.forzati) { impostaSotto(null, true); messaggio('Sottotitoli spenti'); return; }
    var s = L.ultimoSotto;
    if (!s) {
      var interni = L.info.sotto.filter(function (z) { return z.leggibile && !z.forzata; }), est = esterniDi(L).filter(function (e) { return !e.forzata; });
      for (var k = 0; k < prefs.lingue.length && !s; k++) {
        var i0 = interni.filter(function (z) { return z.lingua === prefs.lingue[k]; })[0], e0 = est.filter(function (e) { return e.lingua === prefs.lingue[k]; })[0];
        if (i0) s = { tipo: 'interna', num: i0.num }; else if (e0) s = { tipo: 'esterna', p: e0.p };
      }
      if (!s && interni[0]) s = { tipo: 'interna', num: interni[0].num };
      if (!s && est[0]) s = { tipo: 'esterna', p: est[0].p };
    }
    if (!s) { messaggio('Questo video non ha sottotitoli'); return; }
    impostaSotto(s, true);
    messaggio('Sottotitoli accesi');
  }

  /* ---------------------------------------------------------- audio, velocita', schermo */

  function cambiaAudio(num) {
    if (!L || num === L.audio) return;
    var a = L.info.audio.filter(function (t) { return t.num === num; })[0];
    if (!a) return;
    if (L.jf && !(L.jf.modo === 'diretto' && a.letto)) {
      // l'audio lo prepara Jellyfin (convertito, o di nuovo diretto se il TV lo legge): si riparte dallo stesso punto
      ricaricaJf({ a: L.jf.modo === 'diretto' || L.jf.modo === 'mac' ? a.ordine : a.num, testo: 'Audio: ' + nomeLingua(a.lingua) + ' · ' + a.nomeCodec + (a.letto ? '' : ' (convertito dal server)') });
      return;
    }
    if (!a.letto) { messaggio('Il TV non legge l\'audio ' + a.nomeCodec + ': scegline un altro', 4000); return; }
    var t = v.currentTime, pausa = v.paused;
    ricordaCartella(L.voce, 'a', a.lingua);
    L.audio = num;
    L.info.scelta = { audio: num };
    carica(t, pausa);
    disegnaBadgeOsd();
    messaggio('Audio: ' + nomeLingua(a.lingua) + ' · ' + a.nomeCodec + (a.tv ? ' (lo converte il TV)' : ''));
  }
  function prossimoAudio() {
    if (!L || !L.info) return;
    if (sconosciuto(L.info)) { messaggio('L\'audio di questo file lo sceglie il lettore del TV'); return; }
    var buoni = L.info.audio.filter(function (a) { return a.letto || L.jf; });
    if (buoni.length < 2) { messaggio(buoni.length ? 'C\'è solo questo audio' : 'Nessun audio che il TV legge'); return; }
    var k = 0;
    for (var i = 0; i < buoni.length; i++) if (buoni[i].num === L.audio) k = i;
    cambiaAudio(buoni[(k + 1) % buoni.length].num);
  }
  function cambiaVelocita(r) {
    if (!L) return;
    var x = L, prima = v.currentTime, ora = Date.now();
    try { v.playbackRate = r; } catch (e) {}
    x.velocita = r;
    messaggio('Velocità ' + String(r).replace('.', ',') + '×');
    if (r === 1) return;
    // il TV a volte non la cambia davvero: dopo 2 s si controlla quanto e' andato avanti
    setTimeout(function () {
      if (L !== x || v.paused || x.velocita !== r) return;
      var fatto = (v.currentTime - prima) / ((Date.now() - ora) / 1000);
      if (fatto > 0 && Math.abs(fatto - r) > 0.35 && Math.abs(fatto - 1) < 0.2) {
        x.velocita = 1;
        try { v.playbackRate = 1; } catch (e) {}
        messaggio('Questo TV non cambia la velocità di questo video', 4500);
      }
    }, 2200);
  }
  var SCHERMI = [{ id: 'adatta', nome: 'Originale' }, { id: 'riempi', nome: 'Riempi lo schermo' }, { id: 'allarga', nome: 'Allarga' }, { id: 'zoom', nome: 'Zoom' }];
  function applicaSchermo() { v.className = prefs.schermo && prefs.schermo !== 'adatta' ? prefs.schermo : ''; }
  function testoRitardo(r) { return (r > 0 ? '+' : r < 0 ? '−' : '') + String(Math.abs(Math.round(r * 10) / 10)).replace('.', ',') + ' s'; }

  /* ---------------------------------------------------------- pannello (Giu') */

  var pan = null; // { colonne: [{ titolo, voci: [{ testo, piccolo, attiva, spenta, fn, tieni }] }], c, r: [] }
  function apriPannello(vecchio) {
    if (!L || !L.info) return;
    var i = L.info, cols = [], ignoto = sconosciuto(i);
    cols.push({ titolo: 'Audio', voci: ignoto ? [{ testo: 'Audio del file', piccolo: 'lo sceglie il lettore del TV', attiva: true }] : i.audio.length ? i.audio.map(function (a) {
      var conv = L.jf && (!a.letto || a.server);
      return { testo: nomeLingua(a.lingua) + (a.canali ? ' ' + canali(a.tv ? Math.min(6, a.canali) : a.canali) : ''),
        piccolo: a.nomeCodec + (conv ? ' · lo converte il server' : a.tv ? ' · lo converte il TV' : a.letto ? (a.nome ? ' · ' + a.nome : '') : ' · il TV non lo legge'),
        attiva: a.num === L.audio, spenta: !a.letto && !L.jf, fn: function () { cambiaAudio(a.num); } };
    }).concat([{ testo: 'Ritardo audio', piccolo: 'non si può col lettore del TV: si potrà dal Mac', spenta: true }]) : [{ testo: 'Nessun audio', spenta: true }] });
    if (L.jf && !L.jf.trailer) {
      var j = L.jf, g = j.g || {};
      var vociQ = QUALITA_JF.slice(), mo = g.modo || j.modo, lim = j.lim && j.lim.serve, mb = tettoMac(j);
      if (lim) vociQ.splice(1, 0, { id: 'nolim', nome: 'Originale senza limitatore', piccolo: 'il file vero, coi picchi' });
      // un film HDR: le qualita' convertite escono in SDR (coi colori adattati dal Mac); l'HDR resta solo nell'originale
      var hdrFilm = !!(L.info && L.info.video && L.info.video.hdr);
      cols.push({ titolo: 'Qualità', voci: vociQ.map(function (q) {
        var nome = q.id === 'orig' && lim && !j.noLim ? 'Originale con limitatore ai picchi' : q.nome;
        // si converte (e l'HDR si perde) solo se il film ha piu' Mbps di quella qualita'; l'Automatica lo sa quando e' scelta
        var converte = q.mbps ? !g.mbps || g.mbps > q.mbps : q.id === 'auto' && j.q === 'auto' && mo === 'converti';
        var senzaHdr = hdrFilm && converte ? ' · senza HDR' : '';
        return { testo: nome, piccolo: q.id === 'nolim' ? q.piccolo : q.id === 'orig' ? (j.modo === 'mac' ? 'dal Mac, sotto ' + mb + ' Mbps' : lim && !j.noLim ? 'il Mac lo prepara: picchi oltre ' + mb + ' Mbps' :
          (g.mbps ? String(g.mbps).replace('.', ',') + ' Mbps · ' : '') + (mo === 'diretto' || mo === 'file' ? 'il file vero' : mo === 'copia' ? 'video originale' : 'convertito')) :
          (q.id === 'auto' && j.mbps ? 'la rete fa ' + j.mbps + ' Mbps' + (j.q === 'auto' && g.qualita ? ' · ' + nomeQualita(g.qualita) : '') : q.piccolo) + senzaHdr,
          attiva: q.id === 'nolim' ? !!j.noLim : q.id === 'orig' ? j.q === 'orig' && !j.noLim : j.q === q.id,
          fn: function () { cambiaQualita(q.id); } };
      }) });
    } else if (L.voce.tvDi || L.tvAltro) {
      // la chiavetta con la versione TV accanto: quale si guarda
      var vx = L.voce, tvSi = !!vx.tvDi;
      cols.push({ titolo: 'Versione', voci: [
        { testo: 'Versione TV', piccolo: 'senza i picchi', attiva: tvSi, fn: function () { if (!tvSi) passaVersione(false); } },
        { testo: 'Originale', piccolo: 'il file vero, coi picchi', attiva: !tvSi, fn: function () { if (tvSi) passaVersione(true); } }] });
    }
    var sv = [{ testo: 'Nessuno', attiva: !L.sotto, fn: function () { impostaSotto(null, true); } }];
    i.sotto.forEach(function (s) {
      sv.push({ testo: nomeLingua(s.lingua) + (s.forzata ? ' · forzati' : ''), piccolo: s.nomeCodec + (s.nome ? ' · ' + s.nome : '') + (s.leggibile ? '' : ' · l\'app non li disegna ancora'),
        attiva: !!(L.sotto && L.sotto.tipo === 'interna' && L.sotto.num === s.num), spenta: !s.leggibile,
        fn: function () { if (s.leggibile) impostaSotto({ tipo: 'interna', num: s.num }, true); } });
    });
    esterniDi(L).forEach(function (e) {
      sv.push({ testo: nomeLingua(e.lingua) + (e.forzata ? ' · forzati' : ''), piccolo: 'File ' + e.nome,
        attiva: !!(L.sotto && L.sotto.tipo === 'esterna' && L.sotto.p === e.p), fn: function () { impostaSotto({ tipo: 'esterna', p: e.p }, true); } });
    });
    var dims = { piccoli: 'Piccoli', medi: 'Medi', grandi: 'Grandi' }, alt = ['In basso', 'Più su', 'Ancora più su', 'A metà'];
    sv.push({ testo: 'Dimensione: ' + dims[prefs.dimSotto || 'medi'], tieni: true, fn: function () {
      prefs.dimSotto = prefs.dimSotto === 'piccoli' ? 'medi' : prefs.dimSotto === 'medi' ? 'grandi' : 'piccoli';
      salvaPrefs();
      $('sottotitoli').removeAttribute('data-firma');
      disegnaSotto(v.currentTime);
    } });
    sv.push({ testo: 'Posizione: ' + alt[prefs.posSotto || 0], tieni: true, fn: function () { prefs.posSotto = ((prefs.posSotto || 0) + 1) % ALTEZZE.length; salvaPrefs(); posSotto(); } });
    sv.push({ testo: 'Prima di 0,1 s', piccolo: 'ritardo ' + testoRitardo(L.ritardo), tieni: true, fn: function () { L.ritardo = Math.round((L.ritardo - 0.1) * 10) / 10; sottoMostrato = null; $('sottotitoli').removeAttribute('data-firma'); disegnaSotto(v.currentTime); } });
    sv.push({ testo: 'Dopo di 0,1 s', piccolo: 'ritardo ' + testoRitardo(L.ritardo), tieni: true, fn: function () { L.ritardo = Math.round((L.ritardo + 0.1) * 10) / 10; sottoMostrato = null; $('sottotitoli').removeAttribute('data-firma'); disegnaSotto(v.currentTime); } });
    cols.push({ titolo: 'Sottotitoli', voci: sv });
    cols.push({ titolo: 'Velocità', stretta: true, voci: [0.75, 1, 1.25, 1.5, 2].map(function (r) {
      return { testo: String(r).replace('.', ',') + '×' + (r === 1 ? ' normale' : ''), attiva: (L.velocita || 1) === r, fn: function () { cambiaVelocita(r); } };
    }) });
    cols.push({ titolo: 'Schermo', voci: SCHERMI.map(function (s) {
      return { testo: s.nome, attiva: (prefs.schermo || 'adatta') === s.id, fn: function () { prefs.schermo = s.id; salvaPrefs(); applicaSchermo(); } };
    }) });
    if (i.capitoli && i.capitoli.length > 1) {
      cols.push({ titolo: 'Capitoli', larga: !!i.capitoli[0].img || (i.capitoli[1] && !!i.capitoli[1].img), voci: i.capitoli.map(function (c, k) {
        return { testo: c.nome || 'Capitolo ' + (k + 1), piccolo: tempo(c.t), attiva: false, img: c.img || null, fn: function () { vai(c.t); chiudiPannello(); } };
      }) });
    }
    cols.push({ titolo: 'Info', info: true, voci: [] });
    pan = { colonne: cols, c: vecchio && vecchio.c !== undefined ? Math.min(vecchio.c, cols.length - 1) : 0, r: [] };
    for (var k = 0; k < cols.length; k++) {
      var a = 0;
      for (var j = 0; j < cols[k].voci.length; j++) if (cols[k].voci[j].attiva) a = j;
      if (vecchio && vecchio.c === k && vecchio.r !== undefined) a = Math.min(vecchio.r, cols[k].voci.length - 1);
      pan.r.push(a);
    }
    $('salta').hidden = true;
    disegnaPannello();
    mostraOsd(true);
    // solo la memoria del servizio (un errore qui non scollega Jellyfin)
    if (!vecchio) chiedi('jf/stato').then(function (r) { if (jf.stato && r.servizio) { jf.stato.servizio = r.servizio; if (pan) disegnaPannello(); } }, function () {});
  }
  function disegnaPannello() {
    var fuori = $('pannello');
    svuota(fuori);
    fuori.hidden = false;
    var box = el('div');
    box.id = 'pannello-dentro';
    fuori.appendChild(box);
    var liste = [];
    for (var c = 0; c < pan.colonne.length; c++) {
      var col = pan.colonne[c], d = el('div', 'col' + (c === pan.c ? ' sel' : '') + (col.info || col.larga ? ' larga' : col.stretta ? ' stretta' : ''));
      d.appendChild(el('h3', '', col.titolo));
      var lista = el('div', 'elenco');
      if (col.info) {
        lista.appendChild(infoRighe());
      } else {
        for (var r = 0; r < col.voci.length; r++) {
          var x = col.voci[r], e = el('div', 'v' + (x.attiva ? ' attiva' : '') + (x.spenta ? ' spenta' : '') + (r === pan.r[c] ? ' sel' : '') + (x.img ? ' con-img' : ''));
          e.appendChild(icona(ICONE.spunta));
          // l'immagine del capitolo (Jellyfin): solo nella colonna scelta, vicino alla voce scelta
          if (x.img) { var mi = el('div', 'mini'); e.appendChild(mi); if (c === pan.c && Math.abs(r - pan.r[c]) < 6) mettiImg(mi, '', x.img, 248, 140); }
          e.appendChild(document.createTextNode(x.testo));
          if (x.piccolo) e.appendChild(el('small', '', x.piccolo));
          lista.appendChild(e);
        }
        liste.push({ lista: lista, r: pan.r[c] });
      }
      d.appendChild(lista);
      box.appendChild(d);
    }
    // la voce scelta resta in vista (si misura dopo averla messa nella pagina)
    for (var q = 0; q < liste.length; q++) {
      var sel = liste[q].lista.children[liste[q].r];
      if (sel) liste[q].lista.scrollTop = Math.max(0, sel.offsetTop - liste[q].lista.clientHeight / 2);
    }
    // la colonna scelta sempre in vista: la fila scorre (si vedono 4-5 colonne)
    var scelta = box.children[pan.c], largo = fuori.clientWidth, sposta = 0;
    if (scelta) {
      var destra = scelta.offsetLeft + scelta.offsetWidth + 24;
      if (destra > largo) sposta = destra - largo;
      if (scelta.offsetLeft - sposta < 0) sposta = scelta.offsetLeft;
    }
    box.style.transform = 'translateX(' + (-sposta) + 'px)';
  }
  function infoRighe() {
    var i = L.info, box = el('div', 'info-righe'), vv = i.video;
    function r(a, b) { var x = el('div'); x.appendChild(document.createTextNode(a + ' ')); x.appendChild(el('b', '', b)); box.appendChild(x); }
    r('File', L.voce.nome);
    r('Peso', peso(i.dim) + (i.mbps ? ' · ' + String(i.mbps).replace('.', ',') + ' Mbps di media' : ''));
    if (vv) r('Video', vv.nomeCodec + ' · ' + vv.largh + '×' + vv.alt + (vv.hdr ? ' · ' + (vv.hdr === 'DV' ? 'Dolby Vision (' + notaDv(vv.dv) + ')' : vv.hdr) : ''));
    var a = i.audio.filter(function (t) { return t.num === L.audio; })[0];
    r('Audio', sconosciuto(i) ? 'quello del file (lo sceglie il lettore del TV)' : a ? nomeLingua(a.lingua) + ' · ' + a.nomeCodec + (a.canali ? ' ' + canali(a.canali) : '') : 'nessuno che il TV legga');
    r('Contenitore', String(i.formato || '').toUpperCase());
    if (L.jf) {
      var st = jf.stato && jf.stato.server ? jf.stato.server.nome : 'Jellyfin', g = L.jf.g || {};
      r('Da', st + ' · ' + (L.jf.modo === 'diretto' ? 'il file vero (come da una chiavetta)' : L.jf.modo === 'file' ? 'il file vero, cosi\' com\'e\'' :
        L.jf.modo === 'copia' ? 'video originale, audio o contenitore dal server' : 'convertito dal server'));
      if (g.motivi && g.motivi.length && L.jf.modo !== 'diretto') r('Perché', g.motivi.map(motivoBello).join(', '));
    }
    if (L.ritardo) r('Sottotitoli', 'ritardo ' + testoRitardo(L.ritardo));
    var avv = avvisoDi(i);
    if (avv) r('Nota', avv);
    // il servizio del TV: la sua memoria (si aggiorna a ogni apertura del pannello)
    var sv = jf.stato && jf.stato.servizio;
    if (sv) r('Servizio del TV', sv.memoria + ' MB di memoria · Node ' + String(sv.node || '').replace(/^v/, ''));
    return box;
  }
  function chiudiPannello() { pan = null; $('pannello').hidden = true; nascondiOsdPresto(); }
  function tastoPannello(a) {
    var col = pan.colonne[pan.c];
    if (a === 'left' || a === 'right') {
      var c = pan.c + (a === 'left' ? -1 : 1);
      if (c >= 0 && c < pan.colonne.length) pan.c = c;
      disegnaPannello();
      return;
    }
    if (a === 'up' || a === 'down') {
      if (col.info) { if (a === 'up') chiudiPannello(); return; }
      var r = pan.r[pan.c] + (a === 'up' ? -1 : 1);
      if (r < 0) { chiudiPannello(); return; }
      if (r < col.voci.length) pan.r[pan.c] = r;
      disegnaPannello();
      return;
    }
    if (a === 'ok') {
      var x = col.voci[pan.r[pan.c]];
      if (!x || !x.fn) return;
      var tieni = { c: pan.c, r: x.tieni ? pan.r[pan.c] : undefined }, prima = pan;
      x.fn();
      // la voce ha chiuso il pannello (un capitolo): niente altro; se no si ridisegna (la scelta resta sulla voce se serve)
      if (!pan || pan !== prima) return;
      if (L) apriPannello(tieni);
      return;
    }
    if (a === 'play') playPausa();
  }

  /* ---------------------------------------------------------- pulsanti (Su): Ricomincia, Prossimo episodio */

  function prossimoDi(x) {
    if (x && x.jf) { var n0 = x.jf.prossimo; return n0 ? { jf: n0, nome: n0.Name, d: '', p: 'jf:' + n0.Id, dim: 0 } : null; }
    if (!x || !x.vicini) return null;
    var t = titoloDi(x.voce.nome);
    if (!t.episodio) return null;
    var nomi = x.vicini.map(function (z) { return z.nome; }), k = nomi.indexOf(x.voce.nome);
    if (k === -1 || k + 1 >= nomi.length) return null;
    var n = x.vicini[k + 1], tn = titoloDi(n.nome);
    if (!tn.episodio) return null;
    return { d: x.voce.d, p: (x.cartella ? x.cartella + '/' : '') + n.nome, nome: n.nome, dim: n.dim };
  }
  function apriChip() {
    if (!L) return;
    var l = [{ testo: 'Ricomincia da capo', fn: function () { vai(0); } }], n = prossimoDi(L);
    if (n) l.push({ testo: 'Prossimo episodio', fn: function () { vaiA(n); } });
    L.chip = { voci: l, k: l.length - 1 };
    $('salta').hidden = true;
    disegnaChip();
    mostraOsd(true);
  }
  function disegnaChip() {
    var box = $('osd-chip');
    svuota(box);
    if (!L || !L.chip) return;
    for (var i = 0; i < L.chip.voci.length; i++) box.appendChild(el('span', 'chip' + (i === L.chip.k ? ' sel' : ''), L.chip.voci[i].testo));
  }
  function chiudiChip() { if (L) L.chip = null; disegnaChip(); nascondiOsdPresto(); }
  function tastoChip(a) {
    var c = L.chip;
    if (a === 'left' && c.k > 0) c.k--;
    else if (a === 'right' && c.k < c.voci.length - 1) c.k++;
    else if (a === 'ok') { var f = c.voci[c.k].fn; chiudiChip(); f(); return; }
    else if (a === 'down' || a === 'up') { chiudiChip(); return; }
    disegnaChip();
  }
  function vaiA(voce) {
    salvaPunto(true);
    var x = L;
    if (x && x.jf) fineDirettoJf(x.jf);
    apriVideo(voce, { vicini: x ? x.vicini : null, cartella: x ? x.cartella : null, sotto: x ? x.esterni : [], ritorno: x ? x.ritorno : 'inizio' });
  }

  /* ---------------------------------------------------------- fine, punto, uscita */

  var contoTimer = null;
  function finito() {
    var x = L;
    salvaPunto(true, true);
    var n = prossimoDi(x);
    if (!n) { chiudiLettore(); return; }
    x.fineConto = 10;
    (function conta() {
      if (L !== x || !x.fineConto) return;
      x.chip = { voci: [{ testo: 'Prossimo episodio tra ' + x.fineConto, fn: function () { vaiA(n); } }], k: 0 };
      disegnaChip();
      mostraOsd(true);
      if (--x.fineConto <= 0) { x.fineConto = 0; vaiA(n); return; }
      contoTimer = setTimeout(conta, 1000);
    })();
  }
  // il punto: nella memoria dell'app (Continua a guardare qui) e nel servizio (Continua a guardare della home)
  function salvaPunto(subito, fine, chiuso) {
    var x = L;
    if (!x || !x.info || !x.partito) return;
    var d = x.info.durata || v.duration || 0, t = fine ? d : v.currentTime - (x.spost || 0);
    if (!d || !isFinite(t)) return;
    if (x.jf) { puntoJf(x, t, d, fine, chiuso); return; }
    var finitoOra = fine || t >= d - Math.max(90, d * 0.05), vo = x.voce.tvDi || x.voce;
    punti[chiaveDi(vo.p, vo.dim)] = { d: vo.d, p: vo.p, dim: vo.dim, nome: vo.nome, t: Math.round(t), dur: Math.round(d), quando: Date.now(), finito: finitoOra };
    salvaPunti();
    var tt = titoloDi(vo.nome), s = schedaNota(vo.d, vo.p);
    if (s && s.titolo) {
      // il titolo vero (dal .nfo) per Continua a guardare della home
      tt = s.tipo === 'puntata' ? { titolo: (s.serie && s.serie.titolo) || tt.titolo, anno: 0, stagione: s.stagione, episodio: s.episodio } : { titolo: s.titolo, anno: s.anno, stagione: 0, episodio: 0 };
    }
    chiedi('punto', null, { d: vo.d, p: vo.p, dim: vo.dim, nome: vo.nome, titolo: tt.titolo,
      anno: tt.anno, stagione: tt.stagione, episodio: tt.episodio, posizione: Math.round(t), durata: Math.round(d),
      guardato: Math.round(x.guardato), inPausa: v.paused, chiuso: !!chiuso, app: String(location.href).split('#')[0] }).then(null, function () {});
  }
  // niente resti del video di prima: pulsanti, avvisi, sottotitoli, salto in corso
  function pulisciLettore() {
    clearTimeout(contoTimer);
    fineSalto();
    svuota($('osd-chip'));
    $('avviso-lettore').hidden = true;
    $('osd-meta').hidden = true;
    anteprimaBarra(-1, 0); // (nascosta, e via i fogli di tessere)
    $('salta').hidden = true;
    if (pgs) pgs.azzera();
    $('pgs').hidden = true;
    sottoMostrato = null;
    $('sottotitoli').textContent = '';
    $('sottotitoli').removeAttribute('data-firma');
  }
  function chiudiLettore() {
    var x = L;
    clearInterval(salvaTimer);
    if (x) salvaPunto(true, false, true);
    if (x) mandaDiario(x);
    L = null;
    if (dopoPlay) { v.removeEventListener('playing', dopoPlay); dopoPlay = null; }
    try { v.pause(); } catch (e) {}
    v.removeAttribute('src');
    try { v.load(); } catch (e) {}
    pulisciLettore();
    chiudiPannello();
    $('osd').className = '';
    attesa(false);
    var r = x ? x.ritorno : 'inizio';
    if (x && x.jf) {
      fermaConversione(x.jf);
      fineDirettoJf(x.jf);
      jf.caricato = 0;
      // la barra e il segno di visto anche nelle file tenute 10 minuti (collezioni, Film, Serie)
      aggiornaVoceLenti(x.jf.id);
      if (x.jf.it && x.jf.it.SeriesId) aggiornaVoceLenti(x.jf.it.SeriesId);
    }
    if (typeof r === 'function') { r(); return; }
    if (r === 'esci') { HomeTV.esci(); if (!DAL_MAC) apriInizio(); return; }
    if (r === 'scheda' && sch) { tornaAllaScheda(); return; }
    if (r === 'libreria' && x) { apriLibreria(x.voce.d, x.cartella || '', x.voce.p.split('/').pop()); return; }
    apriInizio('tieni');
  }

  /* ============================================================ tasti */

  function tastoLettore(a) {
    if (pan) { tastoPannello(a); return true; }
    if (L.fineConto) {
      if (a === 'ok') { var n = prossimoDi(L); L.fineConto = 0; if (n) vaiA(n); return true; }
      L.fineConto = 0; chiudiChip();
    }
    if (L.chip) { tastoChip(a); return true; }
    switch (a) {
      case 'ok': if (salto.attivo) confermaSalto(); else if (!saltaSigla()) playPausa(); return true;
      case 'play': playPausa(); return true;
      case 'left': salta(-10); return true;
      case 'right': salta(10); return true;
      case 'rew': salta(-30); return true;
      case 'ff': salta(30); return true;
      case 'down':
        if (Date.now() < L.riprendiFino) { L.riprendiFino = 0; vai(0); avvisoLettore('Da capo', 2000); return true; }
        apriPannello();
        return true;
      case 'up': apriChip(); return true;
      case 'red': rossoSotto(); return true;
      case 'yellow': prossimoAudio(); return true;
      case 'stop': chiudiLettore(); return true;
    }
    return true;
  }
  HomeTV.tasti(function (a) {
    if (fermoAperto()) return false; // i pulsanti del messaggio: la navigazione di serie
    if (schermo === 'inizio') vetrinaTimer(); // il banner non cambia mentre ci si muove
    if (schermo === 'lettore') return L ? tastoLettore(a) : true;
    if (schermo === 'libreria') return tastoLibreria(a);
    if (schermo === 'scheda' && a === 'play') { if (sch && sch.guarda) sch.guarda(); return true; }
    if (schermo === 'inizio' || schermo === 'scheda' || schermo === 'cerca' || schermo === 'collega') return tastoPagina(a);
    return false;
  });
  // la barra del video sul telefono
  if (HomeTV.video) HomeTV.video(function (c) {
    if (!L) return;
    if (c.azione === 'play' || c.azione === 'pausa') playPausa(c.azione);
    else if (c.azione === 'scorri') scorriA(+c.secondi);
    else if (c.azione === 'salta') salta(c.secondi);
    else if (c.azione === 'vai') { fineSalto(); vai(Math.max(0, Math.min(((L.info && L.info.durata) || v.duration || Infinity) - 1, c.secondi))); mostraOsd(); }
  });
  HomeTV.indietro(function () {
    if (fermoAperto()) { var ultimo = fermoAzioni[fermoAzioni.length - 1]; if (ultimo) ultimo.fn(); else chiudiFermo(); return true; }
    if (schermo === 'lettore') {
      if (pan) { chiudiPannello(); return true; }
      if (L && L.chip) { if (L.fineConto) L.fineConto = 0; chiudiChip(); return true; }
      if (salto.attivo) { annullaSalto(); return true; }
      chiudiLettore();
      return true;
    }
    if (schermo === 'scheda') { if (sch && sch.jf) { schGiro++; sch.indietro(); } else indietroScheda(); return true; }
    if (schermo === 'libreria') { lib.giro++; if (lib.jf) lib.indietro(); else indietroLibreria(); return true; }
    if (schermo === 'cerca') { cerca.giro++; (cerca.indietro || tornaInizio)(); return true; }
    if (schermo === 'collega') { coll.giro++; clearTimeout(coll.timer); (coll.indietro || tornaInizio)(); return true; }
    if (schermo === 'inizio') {
      // il binario aperto si chiude; giu' nelle file della vetrina si torna in cima; dal banner si esce dall'app
      if (bin.aperto) { chiudiBinario(); return true; }
      if (pag && pag.disponi && pag.r > 0) { pag.r = 0; evidenzia(); return true; }
    }
    return false; // dall'inizio: si esce dall'app
  });
  // la pagina non scorre mai da sola (tutto si muove con transform)
  window.addEventListener('scroll', function () { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); });
  window.addEventListener('resize', function () {
    if (schermo === 'libreria') disegnaLibreria();
    else if (pag) evidenzia();
  });

  /* ============================================================ partenza */

  function orologio() {
    var d = new Date();
    $('ora').textContent = d.getHours() + ':' + due(d.getMinutes());
    setTimeout(orologio, (60 - d.getSeconds()) * 1000 + 50);
  }
  $('vuoto-riprova').addEventListener('click', function () { caricaDischi(true); });
  HomeTV.pronto(function () {
    leggiMemoria();
    orologio();
    setTimeout(function () { attesaFinita = true; if (schermo === 'inizio') $('inizio-corpo').style.visibility = ''; }, 1500);
    // aperta da Continua a guardare della home: #/v/<percorso>?d=&dim= (chiavetta e dimensione), piu' t=<secondi> (il
    // punto della scheda) o dacapo=1; con Indietro si torna alla home
    var m = /#\/v\/([^?]*)\?(.*)$/.exec(location.hash), mj = /#\/jf\/([0-9a-f]{32})(?:\?(.*))?$/.exec(location.hash);
    // da Real4K dal Mac, una chiavetta: #/d/<id> (Real4K del TV si apre gia' su di lei)
    var md = DAL_MAC ? null : /^#\/d\/([A-Za-z0-9%._-]{1,200})(?=$|[?&])/.exec(location.hash);
    prendiPermesso().then(function () {
      segnaPasso('r4k-permesso');
      apriInizio(null, true);
      // all'apertura solo quello che serve alle file (31/10: il TV chiudeva il servizio entro un secondo dall'apertura di Real4K):
      // il limitatore del Mac e il tetto del TV dopo 4 s, e le loro carte in Altro si aggiornano da sole. Un film che parte
      // subito (dalla home) li vuole subito
      if (m || mj) { macCaricaStato(); caricaTetto(); } else setTimeout(function () { macCaricaStato(aggiornaAltro); caricaTetto(aggiornaAltro); }, 4000);
      // Jellyfin: lo stato (server, utente, i codec del TV) e le file dell'inizio; dalla home un film di Jellyfin riparte subito
      jfCaricaStato(function () {
        segnaPasso('r4k-dati');
        // Real4K dal Mac: la scelta di questo TV per la sua carta in Altro (dal TV dopo 4 s, come il limitatore: all'apertura
        // solo quello che serve alle file)
        // (spenta, nessuna domanda al Mac: la carta dice "spento" dalle preferenze, e il primo tocco chiede il resto)
        if (jf.stato && (jf.stato.dalMac || (jf.stato.real4kMac && !prefs.real4kMacNo))) setTimeout(leggiReal4kMac, DAL_MAC ? 0 : 4000);
        // le chiavette: senza Jellyfin sono la pagina, subito; con Jellyfin dopo 3,5 s (poi ogni 15 s)
        if (jfAttivo()) setTimeout(function () { caricaDischi(true); }, 3500); else caricaDischi(true);
        jfCaricaInizio('tutto');
        disegnaInizio('tieni');
        if (!mj) return;
        var q = {}, coppie = String(mj[2] || '').split('&');
        for (var i = 0; i < coppie.length; i++) { var kv = coppie[i].split('='); if (kv[0]) q[kv[0]] = decodeURIComponent(kv[1] || ''); }
        if (!jfAttivo()) { messaggio('Collega Jellyfin per riprendere questo film (Altro › Collega Jellyfin)', 6000); return; }
        guardaJf({ Id: mj[1], Name: '' }, { ritorno: 'esci', daCapo: q.dacapo === '1', t: q.t !== undefined && isFinite(+q.t) ? +q.t : undefined, daHome: true });
      });
      if (m) {
        var q = {}, coppie = m[2].split('&');
        for (var i = 0; i < coppie.length; i++) { var kv = coppie[i].split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); }
        var p = decodeURIComponent(m[1]), nome = p.split('/').pop();
        var x = { d: q.d || '', p: p, nome: nome, dim: +q.dim || 0, daCapo: q.dacapo === '1', t: q.t !== undefined && isFinite(+q.t) ? +q.t : -1 };
        // prima le chiavette: se la lettera e' cambiata, il film si cerca anche sulle altre
        chiedi('dischi').then(function (r) { dischi = r.dischi || []; riprendi(x, 'esci'); }, function () { riprendi(x, 'esci'); });
      }
      if (md) {
        chiedi('dischi').then(function (r) {
          var id = '';
          try { id = decodeURIComponent(md[1]); } catch (e) { id = ''; }
          dischi = r.dischi || [];
          if (dischi.some(function (d) { return d.id === id; })) apriLibreria(id, ''); else messaggio('Questa chiavetta non c\'è più', 5000);
        }, function () {});
      }
    }, function (e) { dischiErrore = e; jf.stato = { server: null, utente: null, errore: e.codice }; apriInizio(); });
  });
})();
