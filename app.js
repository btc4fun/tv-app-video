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
  function icona(d, classe) {
    var s = document.createElementNS(NS, 'svg'), p = document.createElementNS(NS, 'path');
    s.setAttribute('viewBox', '0 0 48 48');
    if (classe) s.setAttribute('class', classe);
    p.setAttribute('d', d);
    s.appendChild(p);
    return s;
  }
  var ICONE = {
    disco: 'M8 30h32l-4-18H12zm0 4v6h32v-6zm26 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4z',
    chiavetta: 'M18 4h12v8h4v26a6 6 0 0 1-6 6h-8a6 6 0 0 1-6-6V12h4zm4 4v4h4V8z',
    cartella: 'M4 10a4 4 0 0 1 4-4h11l4 5h17a4 4 0 0 1 4 4v23a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z',
    film: 'M6 8h36v32H6zm4 4v4h4v-4zm0 8v8h4v-8zm0 12v4h4v-4zm24-20v4h4v-4zm0 8v8h4v-8zm0 12v4h4v-4zM18 12v24h12V12z',
    serie: 'M4 12h40v26H4zm4 4v18h32V16zM16 4l8 7 8-7 2 2-7 6h-6l-7-6z',
    play: 'M14 8l26 16-26 16z',
    pausa: 'M12 8h8v32h-8zm16 0h8v32h-8z',
    spunta: 'M9 25l10 10 20-22',
    ripeti: 'M24 8a16 16 0 1 1-15.6 19.6l3.9-.9A12 12 0 1 0 24 12v6l-9-8 9-8z',
    audio: 'M6 18h8l10-8v28l-10-8H6zm24-2a10 10 0 0 1 0 16l-2-3a6 6 0 0 0 0-10zm4-6a18 18 0 0 1 0 28l-2-3a14 14 0 0 0 0-22z',
    testo: 'M4 10h40v28H4zm4 4v20h32V14zm4 12h10v4H12zm14 0h10v4H26zm-14-6h24v4H12z'
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
  function prendiPermesso() {
    if (permessoInCorso) return permessoInCorso;
    var p = window.HomeTV && typeof HomeTV.permesso === 'function' ? HomeTV.permesso('video') : Promise.resolve(null);
    permessoInCorso = p.then(function (x) {
      // fuori da Home TV (sul computer, per provare l'app): #servizio=...&gettone=... con un gettone vero del servizio.
      // Dentro Home TV un no arriva come errore e l'indirizzo non conta
      if (!x && (!window.HomeTV || !HomeTV.info || HomeTV.info().piattaforma === 'browser')) {
        var m = /[#&]servizio=([^&]+)&gettone=([0-9a-f]{64})/.exec(location.hash);
        if (m) x = { servizio: decodeURIComponent(m[1]), gettone: m[2] };
      }
      permessoInCorso = null;
      if (!x || !x.gettone) throw erroreCon('negato');
      serv.base = String(x.servizio || 'http://127.0.0.1:8090').replace(/\/+$/, '');
      serv.gettone = x.gettone;
      return x;
    }, function (e) { permessoInCorso = null; throw e; });
    return permessoInCorso;
  }
  function erroreCon(codice, testo) { var e = new Error(testo || codice); e.codice = codice; return e; }
  function query(o) {
    var l = [];
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k) && o[k] !== undefined && o[k] !== null) l.push(k + '=' + encodeURIComponent(o[k]));
    return l.join('&');
  }
  // una domanda al servizio col gettone; se il gettone non vale piu' (servizio ripartito) se ne chiede uno nuovo, una volta
  function chiedi(via, param, corpo, riprovato) {
    return (serv.gettone ? Promise.resolve() : prendiPermesso()).then(function () {
      return new Promise(function (ok, ko) {
        var x = new XMLHttpRequest();
        x.open(corpo ? 'POST' : 'GET', serv.base + '/api/video/g/' + serv.gettone + '/' + via + '?' + query(param || {}), true);
        x.timeout = 20000;
        x.onload = function () {
          var r = null;
          try { r = JSON.parse(x.responseText); } catch (e) {}
          if (x.status === 200 && r) { ok(r); return; }
          ko(erroreCon(r && r.codice ? r.codice : x.status === 403 ? 'gettone' : 'servizio', r && r.error));
        };
        x.onerror = function () { ko(erroreCon('servizio')); };
        x.ontimeout = function () { ko(erroreCon('lento')); };
        if (corpo) x.setRequestHeader('Content-Type', 'text/plain');
        x.send(corpo ? JSON.stringify(corpo) : null);
      });
    }).then(null, function (e) {
      if (e.codice === 'gettone' && !riprovato) { serv.gettone = ''; return chiedi(via, param, corpo, true); }
      throw e;
    });
  }
  function urlFile(d, p, nome, audio) {
    // il nome (con l'estensione) nell'indirizzo: alcuni lettori dei TV guardano quello
    return serv.base + '/api/video/g/' + serv.gettone + '/file/' + encodeURIComponent(String(nome || 'video').replace(/[\/\\?#]/g, '_')) +
      '?' + query({ d: d, p: p, a: audio || 0 });
  }
  function urlImmagine(d, ref) { return serv.base + '/api/video/g/' + serv.gettone + '/immagine?' + query({ d: d, p: ref.p, k: ref.k }); }

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
  // poi tiene solo la piccola, come dataURL: in memoria al massimo 260 piccole
  var imm = { cache: {}, ordine: [], coda: [], inVolo: false };
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
      imm.ordine.push(x.k);
      while (imm.ordine.length > 260) delete imm.cache[imm.ordine.shift()];
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
          url = c.toDataURL('image/png');
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
    im.src = urlImmagine(x.d, x.ref);
  }
  // un'immagine dentro un riquadro: compare con una dissolvenza quando e' pronta
  function mettiImg(box, d, ref, w, h, tutta, poi) {
    piccola(d, ref, w, h, function (url) {
      if (!url || !box.parentNode) { if (poi) poi(false); return; }
      var im = el('img');
      im.onload = function () { im.className = 'on'; };
      im.src = url;
      box.insertBefore(im, box.firstChild ? box.firstChild.nextSibling : null); // sopra la copertina disegnata, sotto barre e segni
      if (poi) poi(true);
    }, tutta, function () { return !!box.parentNode && document.body.contains(box); });
  }
  // la copertina disegnata: titolo pulito, anno, un colore dal nome (mai un riquadro grigio)
  function finta(titolo, anno, tipo) {
    var c = el('div', 'finta'), h = tinta(titolo);
    c.style.backgroundImage = 'linear-gradient(155deg, hsl(' + h + ',46%,36%) 0%, hsl(' + ((h + 38) % 360) + ',52%,15%) 100%)';
    c.appendChild(icona(tipo === 'cartella' ? ICONE.cartella : tipo === 'serie' || tipo === 'stagione' || tipo === 'puntata' ? ICONE.serie : ICONE.film, 'ico'));
    c.appendChild(el('div', 'ft', titolo));
    if (anno) c.appendChild(el('div', 'fa', String(anno)));
    return c;
  }

  /* ---------------------------------------------------------- lo sfondo */

  var sfondoChiave = null, sfondoA = true, sfondoTimer = null;
  // nitido: il fanart della scheda (960x540); se no la copertina della voce scelta, sfocata (32x18 ingrandita)
  function sfondo(d, ref, nitido, subito) {
    var k = ref ? d + '|' + ref.p + '|' + ref.k + '|' + (nitido ? 1 : 0) : '';
    if (k === sfondoChiave) return;
    sfondoChiave = k;
    clearTimeout(sfondoTimer);
    if (!ref) { mettiSfondo(null, false); return; }
    // con le frecce tenute premute: solo quando ci si ferma
    sfondoTimer = setTimeout(function () {
      piccola(d, ref, nitido ? 960 : 32, nitido ? 540 : 18, function (url) { if (sfondoChiave === k) mettiSfondo(url, nitido); });
    }, subito ? 0 : 280);
  }
  function mettiSfondo(url, nitido) {
    var nuovo = $(sfondoA ? 'sfondo-b' : 'sfondo-a'), vecchio = $(sfondoA ? 'sfondo-a' : 'sfondo-b');
    sfondoA = !sfondoA;
    nuovo.style.backgroundImage = url ? 'url(' + url + ')' : 'none';
    nuovo.className = 'strato' + (url ? ' on' : '') + (nitido ? ' nitido' : '');
    vecchio.className = 'strato' + (/nitido/.test(vecchio.className) ? ' nitido' : '');
  }

  /* ============================================================ memoria (64 KB per app, tenuta dalla home) */

  var prefs = { lingue: ['ita', 'eng'], sottoAuto: true, dimSotto: 'medi', posSotto: 0, schermo: 'adatta' };
  var punti = {}; // chiave -> { d, p, dim, nome, t, dur, quando, finito }
  var cartelle = {}; // "disco|cartella" -> { a: lingua dell'audio, s: lingua dei sottotitoli o 'no', quando }: le puntate
  function leggiMemoria() {
    try { var x = JSON.parse(HomeTV.memoria.leggi('prefs') || '{}'); for (var k in x) if (Object.prototype.hasOwnProperty.call(prefs, k)) prefs[k] = x[k]; } catch (e) {}
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
  function mostra(nome) {
    schermo = nome;
    $('schermo-inizio').hidden = nome !== 'inizio';
    $('schermo-libreria').hidden = nome !== 'libreria';
    $('schermo-scheda').hidden = nome !== 'scheda';
    $('schermo-lettore').hidden = nome !== 'lettore';
    $('sfondo').hidden = nome === 'lettore';
  }
  var fermoAzioni = [];
  function fermo(titolo, testo, pulsanti) {
    $('fermo-titolo').textContent = titolo;
    $('fermo-testo').textContent = testo || '';
    var box = $('fermo-pulsanti');
    svuota(box);
    fermoAzioni = pulsanti || [{ testo: 'Indietro', fn: chiudiFermo }];
    for (var i = 0; i < fermoAzioni.length; i++) {
      var b = el('button', 'pulsante', fermoAzioni[i].testo);
      b.setAttribute('data-tv', '');
      b.addEventListener('click', (function (f) { return function () { f.fn(); }; })(fermoAzioni[i]));
      box.appendChild(b);
      if (!i) HomeTV.scegli(b);
    }
    $('fermo').hidden = false;
  }
  function chiudiFermo() { $('fermo').hidden = true; }
  function fermoAperto() { return !$('fermo').hidden; }

  /* ============================================================ le pagine: righe col telecomando
   * Inizio e scheda sono righe (pulsanti, file di carte): Su e Giu' cambiano riga, Sinistra e Destra la voce. La fila
   * scorre per tenere in vista la voce scelta, la pagina scorre per tenere in vista la riga; tutto con transform. */

  var pag = null; // { corpo, righe: [{ box, voci, k, sezione, quando(el, k) }], r }
  function nuovaPagina(corpo) { pag = { corpo: corpo, righe: [], r: 0 }; return pag; }
  function aggiungiRiga(box, voci, opz) {
    opz = opz || {};
    var R = { box: box, voci: voci, k: Math.max(0, Math.min(opz.k || 0, voci.length - 1)), sezione: opz.sezione || box, quando: opz.quando || null, chiave: opz.chiave || '' };
    pag.righe.push(R);
    return R;
  }
  function vociDi(box) { return Array.prototype.slice.call(box.children); }
  function sceltaPagina() { var R = pag && pag.righe[pag.r]; return R ? R.voci[R.k] || null : null; }
  function altezzaIn(e, corpo) { var y = 0; while (e && e !== corpo) { y += e.offsetTop; e = e.offsetParent; } return y; }
  function evidenzia() {
    var vecchie = document.querySelectorAll('.sel');
    for (var i = 0; i < vecchie.length; i++) if (!vecchie[i].classList.contains('v')) vecchie[i].classList.remove('sel');
    if (!pag) return;
    var R = pag.righe[pag.r];
    if (!R || !R.voci.length) return;
    var e = R.voci[R.k];
    e.classList.add('sel');
    // la fila: la voce scelta a sinistra, ma l'ultima resta attaccata al bordo destro
    if (R.box && /\bfila\b/.test(R.box.className)) {
      var visibile = window.innerWidth * 0.92, tot = R.box.scrollWidth;
      var sposta = Math.max(0, Math.min(e.offsetLeft - window.innerWidth * 0.015, tot - visibile));
      R.box.style.transform = 'translateX(' + (-Math.round(sposta)) + 'px)';
    }
    // la pagina: la prima riga dall'alto; le altre tutte in vista
    var sez = R.sezione, alto = altezzaIn(sez, pag.corpo), h = window.innerHeight;
    var y = pag.r === 0 ? 0 : Math.max(0, alto + sez.offsetHeight - h * 0.93);
    pag.corpo.style.transform = 'translateY(' + (-Math.round(y)) + 'px)';
    if (R.quando) R.quando(e, R.k);
  }
  function tastoPagina(a) {
    if (!pag || !pag.righe.length) return a === 'up' || a === 'down' || a === 'left' || a === 'right';
    var R = pag.righe[pag.r];
    if (a === 'left' || a === 'right') {
      var k = R.k + (a === 'left' ? -1 : 1);
      if (k >= 0 && k < R.voci.length) { R.k = k; evidenzia(); }
      return true;
    }
    if (a === 'up' || a === 'down') {
      var r = pag.r + (a === 'up' ? -1 : 1);
      while (r >= 0 && r < pag.righe.length && !pag.righe[r].voci.length) r += a === 'up' ? -1 : 1;
      if (r >= 0 && r < pag.righe.length) { pag.r = r; evidenzia(); }
      return true;
    }
    if (a === 'ok') { var e = sceltaPagina(); if (e) e.click(); return true; }
    return false;
  }
  function pulsante(testo, ic, fn, piccolo) {
    var b = el('div', 'pulsante');
    if (ic) b.appendChild(icona(ICONE[ic]));
    b.appendChild(document.createTextNode(testo));
    if (piccolo) b.appendChild(el('small', '', piccolo));
    b.addEventListener('click', fn);
    return b;
  }

  /* ============================================================ inizio: il film da riprendere, Continua, chiavette */

  var dischi = [], dischiTimer = null, ultimiDischi = '', dischiErrore = null;
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
  function apriInizio(scegli) {
    mostra('inizio');
    sfondoChiave = null;
    disegnaInizio(scegli || 'tieni');
    caricaDischi(true);
    clearInterval(dischiTimer);
    // una chiavetta appena attaccata compare da sola
    dischiTimer = setInterval(function () { if (schermo === 'inizio' && !fermoAperto()) caricaDischi(false); }, 4000);
  }
  function caricaDischi(primo) {
    chiedi('dischi').then(function (r) {
      dischi = r.dischi || [];
      // un TV dove il servizio non sa ancora dove sono le chiavette (LG, oggi)
      dischiErrore = r.previsto === false ? erroreCon('nonPrevisto') : null;
      var firma = dischi.map(function (d) { return d.id; }).join('|');
      if (!primo && firma === ultimiDischi) return;
      if (!primo && dischi.length > ultimiDischi.split('|').filter(Boolean).length) messaggio('Chiavetta trovata');
      ultimiDischi = firma;
      if (schermo === 'inizio') disegnaInizio('tieni');
    }, function (e) {
      if (!primo && e.codice === 'servizio') return;
      dischi = [];
      ultimiDischi = '';
      dischiErrore = e;
      if (schermo === 'inizio') disegnaInizio('tieni');
    });
  }
  var eroeDi = null;
  function disegnaInizio(scegli) {
    var vecchia = pag && pag.corpo === $('inizio-corpo') ? pag : null, l = continua();
    // la fila Continua a guardare
    var fc = $('fila-continua');
    svuota(fc);
    $('sez-continua').hidden = !l.length;
    l.forEach(function (x) { cartaContinua(x, fc); });
    // chiavette e dischi
    var fd = $('fila-dischi');
    svuota(fd);
    $('sez-dischi').hidden = !dischi.length;
    dischi.forEach(function (d) {
      var c = el('div', 'carta disco'), q = el('div', 'quadro');
      c.setAttribute('data-chiave', 'disco:' + d.id);
      c.setAttribute('data-tv', '');
      q.appendChild(icona(/^USBDrive/i.test(d.id) ? ICONE.chiavetta : ICONE.disco));
      c.appendChild(q);
      c.appendChild(el('div', 'nome', nomeDisco(d.id)));
      c.appendChild(el('div', 'sotto', 'Tutti i video'));
      c.addEventListener('click', function () { apriLibreria(d.id, ''); });
      fd.appendChild(c);
    });
    disegnaVuoto(l.length);
    // il film grande: l'ultimo da riprendere (poi quello scelto nella fila)
    $('eroe').hidden = !l.length;
    if (l.length && (!eroeDi || !continua().some(function (x) { return x === eroeDi; }))) mostraEroe(l[0]);
    // le righe: i pulsanti del film grande, Continua, chiavette (o "Controlla di nuovo")
    nuovaPagina($('inizio-corpo'));
    if (l.length) aggiungiRiga($('eroe-pulsanti'), vociDi($('eroe-pulsanti')), { sezione: $('eroe'), chiave: 'eroe' });
    if (l.length) aggiungiRiga(fc, vociDi(fc), { sezione: $('sez-continua'), chiave: 'continua', quando: function (e, k) { mostraEroe(l[k]); } });
    if (dischi.length) aggiungiRiga(fd, vociDi(fd), { sezione: $('sez-dischi'), chiave: 'dischi' });
    if (!dischi.length) aggiungiRiga($('vuoto'), [$('vuoto-riprova')], { sezione: $('vuoto'), chiave: 'vuoto' });
    // la scelta resta dov'era (stessa riga, stessa voce); all'inizio sul film grande o sulle chiavette
    if (vecchia && scegli === 'tieni') {
      var R0 = vecchia.righe[vecchia.r];
      for (var i = 0; i < pag.righe.length; i++) {
        if (R0 && pag.righe[i].chiave === R0.chiave) {
          var R1 = pag.righe[i], v0 = R0.voci[R0.k], kk = v0 ? v0.getAttribute('data-chiave') : null;
          pag.r = i;
          R1.k = Math.min(R0.k, Math.max(0, R1.voci.length - 1));
          for (var j0 = 0; j0 < R1.voci.length; j0++) if (kk && R1.voci[j0].getAttribute('data-chiave') === kk) R1.k = j0;
        }
      }
    } else if (scegli === 'dischi') {
      for (var j = 0; j < pag.righe.length; j++) if (pag.righe[j].chiave === 'dischi') pag.r = j;
    }
    evidenzia();
  }
  function disegnaVuoto(quantiContinua) {
    var v = $('vuoto');
    v.hidden = !!dischi.length;
    if (dischi.length) return;
    var errore = dischiErrore, t = 'Attacca una chiavetta o un disco USB', x = 'Appena il TV lo vede, i tuoi video compaiono qui.';
    if (errore && errore.codice === 'permesso') { t = 'Il TV non lascia leggere le chiavette'; x = 'Il servizio di Home TV non ha il permesso di aprire le chiavette su questo TV. Si vede in "Questo TV".'; }
    else if (errore && errore.codice === 'nonPrevisto') { t = 'Su questo TV le chiavette non si leggono ancora'; x = 'Arriveranno con un prossimo aggiornamento di Home TV.'; }
    else if (errore && errore.codice === 'vecchio') { t = 'Su questo TV le chiavette non si leggono ancora'; x = 'Riavvia il TV: Home TV si aggiorna. Se resta così, su questo modello arriveranno con un prossimo aggiornamento.'; }
    else if (errore && errore.codice === 'negato') { t = 'Apri Video dalla home di Home TV'; x = 'Le chiavette si leggono solo dentro Home TV, sul TV.'; }
    else if (errore && (errore.codice === 'servizio' || errore.codice === 'lento')) { t = 'Il servizio del TV non risponde'; x = 'Riapri Home TV; se continua, riavvia il TV.'; }
    $('vuoto-titolo').textContent = t;
    $('vuoto-testo').textContent = x;
    // con Continua a guardare il messaggio sta sotto, piccolo (non sopra le carte); se non c'e' altro, grande al centro
    v.className = quantiContinua ? '' : 'solo';
  }
  // una carta di Continua a guardare: la miniatura (o il fanart) del film, il titolo, quanto manca
  function cartaContinua(x, fila) {
    var c = el('div', 'carta'), q = el('div', 'quadro'), t = titoloDi(x.nome), presente = !!trovaDisco(x.d);
    c.setAttribute('data-chiave', 'punto:' + x.p);
    c.setAttribute('data-tv', '');
    if (!presente && dischi.length) c.className += ' manca';
    q.appendChild(finta(t.titolo, t.episodio ? 'S' + t.stagione + ' E' + t.episodio : t.anno, t.episodio ? 'puntata' : 'film'));
    var b = el('div', 'barra'), f = el('i');
    f.style.width = Math.min(100, Math.round(x.t / Math.max(1, x.dur) * 100)) + '%';
    b.appendChild(f);
    q.appendChild(b);
    c.appendChild(q);
    var nome = el('div', 'nome', etichetta(x.nome)), sotto = el('div', 'sotto', presente || !dischi.length ? 'Mancano ' + tempo(Math.max(0, x.dur - x.t)) : 'Attacca la chiavetta di questo film');
    c.appendChild(nome);
    c.appendChild(sotto);
    c.addEventListener('click', function () { riprendi(x, 'inizio'); });
    fila.appendChild(c);
    if (presente) {
      chiediScheda(x.d, x.p, false, function (s) {
        if (!s || !c.parentNode) return;
        nome.textContent = s.tipo === 'puntata' && s.serie ? s.serie.titolo + ' · S' + s.stagione + ' E' + s.episodio : s.titolo + (s.anno ? ' (' + s.anno + ')' : '');
        var ref = s.img.landscape || s.img.fanart || s.img.poster;
        if (ref) mettiImg(q, x.d, ref, 448, 252);
      });
    }
    return c;
  }
  // il film grande in cima all'inizio: logo (o titolo), anno, durata, voto, trama, Riprendi
  function mostraEroe(x) {
    if (!x) return;
    eroeDi = x;
    var t = titoloDi(x.nome), logo = $('eroe-logo'), presente = !!trovaDisco(x.d) || !dischi.length;
    svuota(logo);
    logo.appendChild(el('h1', '', t.titolo));
    $('eroe-meta').textContent = '';
    $('eroe-trama').textContent = '';
    var pp = $('eroe-pulsanti');
    svuota(pp);
    pp.appendChild(pulsante('Riprendi', 'play', function () { riprendi(x, 'inizio'); }, tempo(x.t) + ' di ' + tempo(x.dur)));
    pp.appendChild(pulsante('Dall\'inizio', 'ripeti', function () { var y = {}; for (var k in x) y[k] = x[k]; y.daCapo = true; riprendi(y, 'inizio'); }));
    pp.appendChild(pulsante('Scheda', '', function () { apriScheda(x.d, x.p, { da: 'inizio', video: true }); }));
    if (pag && pag.righe[0] && pag.righe[0].chiave === 'eroe') { pag.righe[0].voci = vociDi(pp); if (pag.r === 0) evidenzia(); }
    if (!presente) { sfondo(null); return; }
    chiediScheda(x.d, x.p, false, function (s) {
      if (!s || eroeDi !== x) return;
      var titolo = s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo;
      svuota(logo);
      logo.appendChild(el('h1', '', titolo));
      if (s.img.logo) mettiImg(logo, x.d, s.img.logo, 680, 260, true, function (si) { if (si && eroeDi === x) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
      metaDi($('eroe-meta'), s, null, s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') : '');
      $('eroe-trama').textContent = s.trama || (s.serie && s.serie.trama) || '';
      sfondo(x.d, s.img.fanart || s.img.landscape || s.img.poster, true);
    });
  }
  // la riga anno · durata · voto · classificazione
  function metaDi(box, s, info, prima) {
    svuota(box);
    function pezzo(t, cl) { if (t) box.appendChild(el('span', cl || '', t)); }
    pezzo(prima);
    pezzo(s.anno ? String(s.anno) : '');
    var min = s.durata || (info && info.durata ? info.durata / 60 : 0) || (s.secondi ? s.secondi / 60 : 0);
    if (min > 2) pezzo(durataBella(min));
    if (s.voto) pezzo('★ ' + String(s.voto).replace('.', ','), 'voto');
    pezzo(s.classificazione, 'cert');
    if (s.generi && s.generi.length) pezzo(s.generi.slice(0, 3).join(', '));
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
      lib = { d: d, p: p, voci: voci, sel: 0, dom: {}, m: null, giro: giro, troppi: !!r.troppi, sotto: r.sotto || [], video: r.video || [] };
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
    var W = window.innerWidth, H = window.innerHeight, col = 7, tw = W * 0.114;
    return { col: col, tw: tw, th: tw * 1.5 + H * 0.105, gx: (W * 0.9 - col * tw) / (col - 1), pw: Math.round(tw * 1.25), ph: Math.round(tw * 1.875) };
  }
  function disegnaLibreria() {
    var g = $('griglia-dentro');
    svuota(g);
    lib.dom = {};
    lib.m = misureGriglia();
    var bric = $('briciole'), parti = lib.p ? lib.p.split('/') : [];
    svuota(bric);
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
    for (var r2 = da; r2 <= a; r2++) for (var c = 0; c < m.col; c++) { i = r2 * m.col + c; if (i < lib.voci.length && !lib.dom[i]) tile(i); }
    $('griglia-dentro').style.transform = 'translateY(' + (-Math.round(rs * m.th)) + 'px)';
    for (var j in lib.dom) if (Object.prototype.hasOwnProperty.call(lib.dom, j)) lib.dom[j].className = 'tile' + (+j === lib.sel ? ' sel' : '');
    sceltaLibreria();
  }
  function tile(i) {
    var v = lib.voci[i], m = lib.m, t = el('div', 'tile'), cop = el('div', 'copertina');
    t.style.left = Math.round((i % m.col) * (m.tw + m.gx)) + 'px';
    t.style.top = Math.round(Math.floor(i / m.col) * m.th) + 'px';
    t.setAttribute('data-tv', '');
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
    if (!v) return;
    var s = v.scheda, tt = titoloDi(v.nome);
    $('ls-titolo').textContent = s && s.titolo ? (s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo) : v.tipo === 'cartella' ? v.nome : tt.titolo;
    if (s) {
      metaDi($('ls-meta'), s, null, s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') : s.tipo === 'serie' ? 'Serie' :
        s.tipo === 'stagione' ? s.titolo : s.tipo === 'cartella' ? 'Cartella' : '');
      $('ls-trama').textContent = s.trama || (s.serie && s.serie.trama) || '';
      sfondo(lib.d, s.img.fanart || s.img.landscape || s.img.poster || (s.serie && s.serie.img && s.serie.img.fanart) || null, false);
    } else {
      svuota($('ls-meta'));
      $('ls-meta').textContent = v.tipo === 'cartella' ? 'Cartella' : (tt.anno ? tt.anno + '   ' : '') + peso(v.dim);
      $('ls-trama').textContent = '';
    }
  }
  function tastoLibreria(a) {
    var m = lib.m;
    if (!m || !lib.voci.length) return a === 'up' || a === 'down' || a === 'left' || a === 'right';
    var i = lib.sel, n = lib.voci.length;
    if (a === 'left') { if (i % m.col > 0) i--; }
    else if (a === 'right') { if (i % m.col < m.col - 1 && i + 1 < n) i++; }
    else if (a === 'up') { if (i - m.col >= 0) i -= m.col; }
    else if (a === 'down') { if (i + m.col < n) i += m.col; else if (Math.floor(i / m.col) < Math.floor((n - 1) / m.col)) i = n - 1; }
    else if (a === 'ok') { apriVoce(i); return true; }
    else if (a === 'play') { var v = lib.voci[i]; if (v && v.tipo === 'video') guardaVoce(v); else apriVoce(i); return true; }
    else return false;
    if (i !== lib.sel) { lib.sel = i; finestraGriglia(); }
    return true;
  }
  // OK su una copertina: la cartella di un film o di una serie apre la sua scheda; un video la sua; le altre si aprono
  function apriVoce(i) {
    var v = lib.voci[i];
    if (!v) return;
    if (v.tipo === 'video') { apriScheda(lib.d, v.p, { da: 'libreria', video: true }); return; }
    function decidi(s) {
      if (s && s.cartellaFilm && s.video) apriScheda(lib.d, unisci(v.p, s.video), { da: 'libreria', cartellaFilm: v.p, video: true });
      else if (s && (s.tipo === 'serie' || s.tipo === 'stagione')) apriScheda(lib.d, v.p, { da: 'libreria', video: false });
      else apriLibreria(lib.d, v.p);
    }
    if (v.scheda) decidi(v.scheda); else chiediScheda(lib.d, v.p, false, decidi);
  }
  function guardaVoce(v) {
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
    ['sez-stagioni', 'sez-puntate', 'sez-cast'].forEach(function (id) { $(id).hidden = true; });
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
  function disegnaScheda(x) {
    var s = x.s, d = x.d, info = x.info, logo = $('sc-logo');
    var titolo = s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo;
    $('sc-sopratitolo').textContent = s.tipo === 'puntata' ? 'Stagione ' + s.stagione + ' · Puntata ' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') :
      s.collezione ? s.collezione : '';
    if (!x.logoFatto) {
      x.logoFatto = true;
      svuota(logo);
      logo.appendChild(el('h1', '', titolo));
      if (s.img.logo) mettiImg(logo, d, s.img.logo, 680, 260, true, function (si) { if (si && x.giro === schGiro) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    }
    metaDi($('sc-meta'), s, info, '');
    if (info && info.durata) $('sc-meta').appendChild(el('span', '', finisceAlle(info.durata - (riprendibile(puntoDi(d, x.p, info.dim), info.durata) ? puntoDi(d, x.p, info.dim).t : 0))));
    var badge = $('sc-badge');
    svuota(badge);
    if (info) badgeDi(info, x.audio).forEach(function (b) { badge.appendChild(el('span', 'badge' + (b.forte ? ' forte' : '') + (b.no ? ' no' : ''), b.t)); });
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
    if (ripr) pp.appendChild(pulsante('Dall\'inizio', 'ripeti', function () { parti(true); }));
    if (info) {
      var buoni = info.audio.filter(function (a) { return a.letto; });
      if (buoni.length > 1) {
        var a = info.audio.filter(function (z) { return z.num === x.audio; })[0];
        pp.appendChild(pulsante('Audio', 'audio', function () {
          var k = 0;
          for (var i = 0; i < buoni.length; i++) if (buoni[i].num === x.audio) k = i;
          x.audio = buoni[(k + 1) % buoni.length].num;
          disegnaScheda(x);
        }, a ? nomeLingua(a.lingua) + ' · ' + a.nomeCodec : ''));
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
    function riga(a, b) { if (!b) return; var r = el('div'); r.appendChild(document.createTextNode(a + '  ')); r.appendChild(el('b', '', b)); righe.appendChild(r); }
    riga('Regia', (s.registi || []).join(', '));
    riga('Scritto da', (s.scrittori || []).join(', '));
    riga('Studio', (s.studi || []).join(', '));
    if (info) riga('File', x.p.split('/').pop() + ' · ' + peso(info.dim) + (info.mbps ? ' · ' + String(info.mbps).replace('.', ',') + ' Mbps' : ''));
    var avv = info ? avvisoDi(info) : '';
    $('sc-avviso').textContent = avv;
    $('sc-avviso').hidden = !avv;
    sfondo(d, s.img.fanart || s.img.landscape || (s.serie && s.serie.img && s.serie.img.fanart) || s.img.poster, true, true);
    // il cast
    disegnaCast(x);
    var k0 = pag && pag.righe[0] ? pag.righe[0].k : 0;
    nuovaPagina($('scheda-corpo'));
    aggiungiRiga(pp, vociDi(pp), { sezione: $('sc-sopra'), k: k0 });
    if (!$('sez-cast').hidden) aggiungiRiga($('fila-cast'), vociDi($('fila-cast')), { sezione: $('sez-cast') });
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
      p.addEventListener('click', function () {});
      fila.appendChild(p);
      if (c.foto) mettiImg(f, x.d, c.foto, 180, 180);
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
    if (loghi) mettiImg(logo, d, loghi, 680, 260, true, function (si) { if (si) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
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
      var c = el('div', 'stagione' + (i === x.k ? ' attiva' : '')), cop = el('div', 'copertina');
      cop.appendChild(finta(st.n ? 'Stagione ' + st.n : st.nome, '', 'stagione'));
      c.appendChild(cop);
      c.appendChild(el('div', 'nome', st.n ? 'Stagione ' + st.n : st.nome));
      c.addEventListener('click', function () { x.k = i; puntateDi(x); });
      fs.appendChild(c);
      if (st.p !== x.cartellaSerie) chiediScheda(d, st.p, false, function (ss) { if (ss && ss.img.poster && c.parentNode) mettiImg(cop, d, ss.img.poster, 192, 288); });
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
    $('sez-puntate').hidden = !x.puntate.length;
    $('puntate-titolo').textContent = st ? (st.n ? 'Stagione ' + st.n : st.nome) + ' · ' + x.puntate.length + (x.puntate.length === 1 ? ' puntata' : ' puntate') : 'Puntate';
    var stg = $('fila-stagioni').children;
    for (var i = 0; i < stg.length; i++) stg[i].className = 'stagione' + (i === x.k ? ' attiva' : '');
    var daRiprendere = null;
    x.puntate.forEach(function (v, j) {
      var c = el('div', 'carta puntata'), q = el('div', 'quadro'), tt = titoloDi(v.nome), pt = puntoDi(d, v.p, v.dim);
      q.appendChild(finta(tt.titolo, 'S' + (tt.stagione || 1) + ' E' + (tt.episodio || j + 1), 'puntata'));
      q.appendChild(el('div', 'num', 'E' + (tt.episodio || j + 1)));
      if (pt && pt.finito) { var vs = el('div', 'vista'); vs.appendChild(icona(ICONE.spunta)); q.appendChild(vs); }
      else if (riprendibile(pt)) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.min(100, Math.round(pt.t / Math.max(1, pt.dur) * 100)) + '%'; b.appendChild(f); q.appendChild(b); if (!daRiprendere) daRiprendere = { v: v, pt: pt }; }
      c.appendChild(q);
      var nome = el('div', 'nome', 'Puntata ' + (tt.episodio || j + 1)), sotto = el('div', 'trama-p', '');
      c.appendChild(nome);
      c.appendChild(sotto);
      c.addEventListener('click', function () { guardaPuntata(x, v); });
      fp.appendChild(c);
      chiediScheda(d, v.p, false, function (s) {
        if (!s || !c.parentNode) return;
        if (s.titolo) nome.textContent = (s.episodio >= 0 ? s.episodio + '. ' : '') + s.titolo;
        sotto.textContent = s.trama || '';
        var ref = s.img.landscape || s.img.fanart;
        if (ref) mettiImg(q, d, ref, 403, 227);
      });
    });
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
    aggiungiRiga(fp, vociDi(fp), { sezione: $('sez-puntate'), chiave: 'puntate', k: daRiprendere ? x.puntate.indexOf(daRiprendere.v) : 0 });
    if (!$('sez-cast').hidden) aggiungiRiga($('fila-cast'), vociDi($('fila-cast')), { sezione: $('sez-cast'), chiave: 'cast' });
    for (var r = 0; r < pag.righe.length; r++) if (chiaveR && pag.righe[r].chiave === chiaveR) { pag.r = r; if (chiaveR === 'stagioni') pag.righe[r].k = x.k; else if (chiaveR !== 'puntate') pag.righe[r].k = Math.min(kp, pag.righe[r].voci.length - 1); }
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

  function badgeDi(info, audio) {
    var out = [], v = info.video;
    if (v) {
      out.push({ t: v.largh >= 3200 ? '4K' : v.largh >= 1900 ? 'HD 1080' : v.largh >= 1200 ? 'HD 720' : 'SD', forte: v.largh >= 3200 });
      if (v.hdr === 'DV') out.push({ t: 'DOLBY VISION', forte: false, nota: 'il TV usa HDR10' });
      else if (v.hdr) out.push({ t: v.hdr, forte: true });
      out.push({ t: v.nomeCodec });
    }
    var a = null, num = audio !== undefined ? audio : (info.scelta || {}).audio;
    for (var i = 0; i < info.audio.length; i++) if (info.audio[i].num === num) a = info.audio[i];
    if (a) out.push({ t: a.nomeCodec + (a.canali ? ' ' + canali(a.canali) : '') });
    else if (info.audio.length) out.push({ t: 'AUDIO NON LETTO', no: true });
    if (info.sotto.length) out.push({ t: 'SOTTOTITOLI' });
    return out;
  }
  function sconosciuto(info) { return info.avvisi.indexOf('sconosciuto') !== -1 || info.avvisi.indexOf('struttura') !== -1; }
  function avvisoDi(info) {
    if (info.avvisi.indexOf('video') !== -1) return 'Il TV non legge il video di questo file (' + (info.video ? info.video.nomeCodec : 'formato sconosciuto') + ').';
    if (info.avvisi.indexOf('audio') !== -1) {
      var nomi = info.audio.map(function (x) { return x.nomeCodec; }).filter(function (x, i, l) { return l.indexOf(x) === i; }).join(' e ');
      return 'L\'audio di questo film (' + nomi + ') il TV non lo legge: il video parte senza audio. Si potrà sentire guardandolo dal Mac, che converte l\'audio.';
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
      ritardo: 0, ritorno: o.ritorno || 'inizio', saltato: {} };
    mostra('lettore');
    $('osd-titolo').textContent = etichetta(voce.nome);
    pulisciLettore();
    attesa(true);
    var info = x.info ? Promise.resolve(x.info) : chiedi('info', { d: voce.d, p: voce.p, lingue: lingueDi(voce) });
    var vicini = x.vicini || !o.conVicini ? Promise.resolve(null) :
      chiedi('cartella', { d: voce.d, p: x.cartella }).then(function (c) { x.vicini = c.video || []; x.esterni = c.sotto || []; }, function () {});
    Promise.all([info, vicini]).then(function (r) {
      var i = r[0];
      if (L !== x) return;
      x.info = i;
      chiediScheda(voce.d, voce.p, false, function (s) { if (L === x && s && s.titolo) $('osd-titolo').textContent = s.tipo === 'puntata' && s.serie ? s.serie.titolo + ' · S' + s.stagione + ' E' + s.episodio + ' · ' + s.titolo : s.titolo + (s.anno ? ' (' + s.anno + ')' : ''); });
      if (i.avvisi.indexOf('video') !== -1) {
        attesa(false);
        fermo('Il TV non legge questo video', avvisoDi(i), [{ testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } }]);
        return;
      }
      x.audio = o.audio || (i.scelta && i.scelta.audio) || 0;
      scegliSottotitoliIniziali(x, o.sottoScelto);
      disegnaBadgeOsd();
      if (i.avvisi.indexOf('audio') !== -1) avvisoLettore(avvisoDi(i), 9000);
      var pt = punti[chiaveDi(voce.p, voce.dim)];
      var da = riprendibile(pt, i.durata) ? pt.t : 0;
      // dalla scheda o dalla home: il punto che si vedeva li'
      if (o.t >= 0) da = o.t > 60 && (!i.durata || o.t < i.durata - 120) ? o.t : 0;
      if (o.daCapo) da = 0;
      carica(da);
      if (da) {
        x.riprendiFino = Date.now() + 9000;
        avvisoLettore('Riprendo da ' + tempo(da) + ' · Giù per ricominciare da capo', 9000);
      }
      clearInterval(salvaTimer);
      salvaTimer = setInterval(function () { if (L === x && !v.paused) salvaPunto(false); }, 10000);
    }, function (e) {
      if (L !== x) return;
      attesa(false);
      fermo('Non riesco ad aprire questo video', e.codice === 'disco' ? 'La chiavetta non c\'è più.' : e.codice === 'permesso' ?
        'Il TV non lascia leggere questo file.' : e.codice === 'lento' || e.codice === 'servizio' ? 'Il servizio del TV non risponde: riprova tra poco.' :
        'Il file non si legge.', [{ testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } }]);
    });
  }
  // il file dal servizio, con la traccia audio scelta, dal secondo "da"
  var dopoPlay = null;
  function carica(da, restaInPausa) {
    var x = L;
    x.partito = false;
    x.daQui = da || 0;
    if (dopoPlay) { v.removeEventListener('playing', dopoPlay); dopoPlay = null; }
    if (restaInPausa) {
      dopoPlay = function () { v.removeEventListener('playing', dopoPlay); dopoPlay = null; v.pause(); };
      v.addEventListener('playing', dopoPlay);
    }
    v.src = urlFile(x.voce.d, x.voce.p, x.voce.nome, x.audio);
    v.playbackRate = 1;
    x.velocita = 1;
    applicaSchermo();
    if (pgs) pgs.azzera();
    try { v.load(); } catch (e) {}
    var p = v.play();
    if (p && p.then) p.then(null, function () {});
    mostraOsd();
  }
  v.addEventListener('loadedmetadata', function () {
    if (!L) return;
    if (L.daQui) { try { v.currentTime = L.daQui; } catch (e) {} }
    L.daQui = 0;
  });
  v.addEventListener('playing', function () {
    attesa(false);
    if (L) { L.partito = true; L.errori = 0; } // riparte: le prove dopo un errore ricominciano da zero
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
  v.addEventListener('ended', function () { if (L) finito(); });
  v.addEventListener('error', function () {
    if (!L || !v.getAttribute('src')) return;
    var codice = v.error ? v.error.code : 0, x = L, t = v.currentTime || x.daQui || 0;
    attesa(false);
    if (codice === 2 && x.errori < 2) {
      // la chiavetta ha rallentato o il servizio si e' fermato un attimo: si riprende da li'
      x.errori++;
      setTimeout(function () { if (L === x) carica(t); }, 1500);
      return;
    }
    fermo('Il TV non riesce a leggere questo video', codice === 4 ? 'Il formato non va bene per il lettore del TV.' : 'La lettura si è fermata.',
      [{ testo: 'Riprova', fn: function () { chiudiFermo(); if (L === x) { x.errori = 0; carica(t); } } }, { testo: 'Indietro', fn: function () { chiudiFermo(); chiudiLettore(); } }]);
  });
  v.addEventListener('timeupdate', function () {
    if (!L) return;
    var t = v.currentTime;
    if (L.ultimoT >= 0 && t > L.ultimoT && t - L.ultimoT < 3) L.guardato += t - L.ultimoT;
    L.ultimoT = t;
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
      if (L && !v.paused && $('pannello').hidden && !L.chip && !salto.tot && !L.fineConto) { $('osd').className = ''; posSotto(); }
    }, 4000);
  }
  function disegnaTempo() {
    if (!L) return;
    var d = (L.info && L.info.durata) || v.duration || 0, t = salto.tot ? anteprima() : v.currentTime;
    var f = d ? Math.max(0, Math.min(1, t / d)) : 0;
    $('osd-fatto').style.transform = 'scaleX(' + f + ')';
    var car = 0;
    try { for (var i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= v.currentTime + 1 && v.buffered.end(i) >= v.currentTime) car = v.buffered.end(i); } catch (e) {}
    $('osd-car').style.transform = 'scaleX(' + (d ? Math.min(1, car / d) : 0) + ')';
    $('osd-testa').style.left = 'calc(5vw + ' + (f * 90) + 'vw)';
    $('osd-ora').textContent = tempo(t);
    var resta = Math.max(0, d - t) / Math.max(0.25, L.velocita || 1);
    $('osd-resta').textContent = d ? '-' + tempo(d - t) + ' · ' + finisceAlle(resta) : '';
    var meta = $('osd-meta');
    if (salto.tot) {
      meta.hidden = false;
      meta.textContent = (salto.tot > 0 ? '+' : '−') + tempo(Math.abs(salto.tot)) + ' · ' + tempo(t);
      meta.style.left = 'calc(5vw + ' + Math.min(f * 90, 80) + 'vw)';
    } else meta.hidden = true;
  }
  function disegnaBadgeOsd() {
    var b = $('osd-badge');
    svuota(b);
    if (!L || !L.info) return;
    badgeDi(L.info, L.audio).forEach(function (x) { b.appendChild(el('span', 'badge' + (x.forte ? ' forte' : '') + (x.no ? ' no' : ''), x.t)); });
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

  // salti: le pressioni vicine si sommano, il salto avviene quando smetti (come il lettore nei siti)
  var salto = { tot: 0, timer: null };
  function anteprima() {
    var d = (L.info && L.info.durata) || v.duration || 0;
    return Math.max(0, Math.min(d ? d - 1 : Infinity, v.currentTime + salto.tot));
  }
  function salta(sec) {
    if (!L) return;
    salto.tot += sec;
    mostraOsd();
    clearTimeout(salto.timer);
    salto.timer = setTimeout(function () {
      var t = anteprima();
      salto.tot = 0;
      vai(t);
      mostraOsd();
    }, 650);
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
    if (solo === 'play' || (solo !== 'pausa' && v.paused)) { var p = v.play(); if (p && p.then) p.then(null, function () {}); centro('play'); }
    else { v.pause(); centro('pausa'); }
    mostraOsd();
  }

  /* ---------------------------------------------------------- Salta sigla: dai capitoli coi nomi giusti */

  var SIGLE = [{ re: /^(intro|opening|op|sigla|sigla iniziale|apertura)\b/i, testo: 'Salta sigla' },
    { re: /^(recap|riassunto|previously|nella puntata precedente|nelle puntate precedenti)\b/i, testo: 'Salta riassunto' },
    { re: /^(ending|ed|credits|end credits|titoli di coda|sigla finale|outro)\b/i, testo: 'Salta titoli di coda', fine: true }];
  function siglaDi(t) {
    var c = L && L.info && L.info.capitoli;
    if (!c || c.length < 2) return null;
    for (var i = 0; i < c.length; i++) {
      var fine = i + 1 < c.length ? c[i + 1].t : ((L.info && L.info.durata) || v.duration || 0);
      if (t >= c[i].t && t < fine - 1) {
        for (var k = 0; k < SIGLE.length; k++) if (SIGLE[k].re.test(String(c[i].nome || '').replace(/^\s+/, ''))) return { i: i, fine: fine, testo: SIGLE[k].testo, ultima: !!SIGLE[k].fine };
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
    var inizio = L.info.capitoli[s.i].t, vedi = t - inizio < 12 || $('osd').className === 'on';
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
    var t = Math.floor(v.currentTime * 1000);
    if (x.completi) return;
    if (!subito && x.chiesto >= 0 && (Date.now() - x.chiestoAlle < (x.pgs ? 8000 : 2500))) return;
    if (x.inVolo) return;
    x.inVolo = true;
    var dopo = !subito && x.chiesto >= 0 && x.eventi.length ? x.eventi[x.eventi.length - 1].t : undefined;
    x.chiesto = t;
    x.chiestoAlle = Date.now();
    var s = x.sotto, quale = s;
    var r = s.tipo === 'esterna' ? chiedi('sotto', { d: x.voce.d, e: s.p }) : chiedi('sotto', { d: x.voce.d, p: x.voce.p, t: s.num, da: t, dopo: dopo });
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
    if (!a.letto) { messaggio('Il TV non legge l\'audio ' + a.nomeCodec + ': scegline un altro', 4000); return; }
    var t = v.currentTime, pausa = v.paused;
    ricordaCartella(L.voce, 'a', a.lingua);
    L.audio = num;
    L.info.scelta = { audio: num };
    carica(t, pausa);
    disegnaBadgeOsd();
    messaggio('Audio: ' + nomeLingua(a.lingua) + ' · ' + a.nomeCodec);
  }
  function prossimoAudio() {
    if (!L || !L.info) return;
    if (sconosciuto(L.info)) { messaggio('L\'audio di questo file lo sceglie il lettore del TV'); return; }
    var buoni = L.info.audio.filter(function (a) { return a.letto; });
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
      return { testo: nomeLingua(a.lingua) + (a.canali ? ' ' + canali(a.canali) : ''), piccolo: a.nomeCodec + (a.letto ? (a.nome ? ' · ' + a.nome : '') : ' · il TV non lo legge'),
        attiva: a.num === L.audio, spenta: !a.letto, fn: function () { cambiaAudio(a.num); } };
    }).concat([{ testo: 'Ritardo audio', piccolo: 'non si può col lettore del TV: si potrà dal Mac', spenta: true }]) : [{ testo: 'Nessun audio', spenta: true }] });
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
      cols.push({ titolo: 'Capitoli', voci: i.capitoli.map(function (c, k) {
        return { testo: c.nome || 'Capitolo ' + (k + 1), piccolo: tempo(c.t), attiva: false, fn: function () { vai(c.t); chiudiPannello(); } };
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
      var col = pan.colonne[c], d = el('div', 'col' + (c === pan.c ? ' sel' : '') + (col.info ? ' larga' : col.stretta ? ' stretta' : ''));
      d.appendChild(el('h3', '', col.titolo));
      var lista = el('div', 'elenco');
      if (col.info) {
        lista.appendChild(infoRighe());
      } else {
        for (var r = 0; r < col.voci.length; r++) {
          var x = col.voci[r], e = el('div', 'v' + (x.attiva ? ' attiva' : '') + (x.spenta ? ' spenta' : '') + (r === pan.r[c] ? ' sel' : ''));
          e.appendChild(icona(ICONE.spunta));
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
    if (vv) r('Video', vv.nomeCodec + ' · ' + vv.largh + '×' + vv.alt + (vv.hdr ? ' · ' + (vv.hdr === 'DV' ? 'Dolby Vision (il TV usa HDR10)' : vv.hdr) : ''));
    var a = i.audio.filter(function (t) { return t.num === L.audio; })[0];
    r('Audio', sconosciuto(i) ? 'quello del file (lo sceglie il lettore del TV)' : a ? nomeLingua(a.lingua) + ' · ' + a.nomeCodec + (a.canali ? ' ' + canali(a.canali) : '') : 'nessuno che il TV legga');
    r('Contenitore', String(i.formato || '').toUpperCase());
    if (L.ritardo) r('Sottotitoli', 'ritardo ' + testoRitardo(L.ritardo));
    var avv = avvisoDi(i);
    if (avv) r('Nota', avv);
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
    var d = x.info.durata || v.duration || 0, t = fine ? d : v.currentTime;
    if (!d || !isFinite(t)) return;
    var finitoOra = fine || t >= d - Math.max(90, d * 0.05);
    punti[chiaveDi(x.voce.p, x.voce.dim)] = { d: x.voce.d, p: x.voce.p, dim: x.voce.dim, nome: x.voce.nome, t: Math.round(t), dur: Math.round(d), quando: Date.now(), finito: finitoOra };
    salvaPunti();
    var tt = titoloDi(x.voce.nome), s = schedaNota(x.voce.d, x.voce.p);
    if (s && s.titolo) {
      // il titolo vero (dal .nfo) per Continua a guardare della home
      tt = s.tipo === 'puntata' ? { titolo: (s.serie && s.serie.titolo) || tt.titolo, anno: 0, stagione: s.stagione, episodio: s.episodio } : { titolo: s.titolo, anno: s.anno, stagione: 0, episodio: 0 };
    }
    chiedi('punto', null, { d: x.voce.d, p: x.voce.p, dim: x.voce.dim, nome: x.voce.nome, titolo: tt.titolo,
      anno: tt.anno, stagione: tt.stagione, episodio: tt.episodio, posizione: Math.round(t), durata: Math.round(d),
      guardato: Math.round(x.guardato), inPausa: v.paused, chiuso: !!chiuso, app: String(location.href).split('#')[0] }).then(null, function () {});
  }
  // niente resti del video di prima: pulsanti, avvisi, sottotitoli, salto in corso
  function pulisciLettore() {
    clearTimeout(contoTimer);
    clearTimeout(salto.timer);
    salto.tot = 0;
    svuota($('osd-chip'));
    $('avviso-lettore').hidden = true;
    $('osd-meta').hidden = true;
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
    if (r === 'esci') { HomeTV.esci(); apriInizio(); return; }
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
      case 'ok': if (!saltaSigla()) playPausa(); return true;
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
    if (schermo === 'lettore') return L ? tastoLettore(a) : true;
    if (schermo === 'libreria') return tastoLibreria(a);
    if (schermo === 'scheda' && a === 'play') { if (sch && sch.guarda) sch.guarda(); return true; }
    if (schermo === 'inizio' || schermo === 'scheda') return tastoPagina(a);
    return false;
  });
  // la barra del video sul telefono
  if (HomeTV.video) HomeTV.video(function (c) {
    if (!L) return;
    if (c.azione === 'play' || c.azione === 'pausa') playPausa(c.azione);
    else if (c.azione === 'salta') salta(c.secondi);
    else if (c.azione === 'vai') { vai(Math.max(0, Math.min(((L.info && L.info.durata) || v.duration || Infinity) - 1, c.secondi))); mostraOsd(); }
  });
  HomeTV.indietro(function () {
    if (fermoAperto()) { var ultimo = fermoAzioni[fermoAzioni.length - 1]; if (ultimo) ultimo.fn(); else chiudiFermo(); return true; }
    if (schermo === 'lettore') {
      if (pan) { chiudiPannello(); return true; }
      if (L && L.chip) { if (L.fineConto) L.fineConto = 0; chiudiChip(); return true; }
      if (salto.tot) { clearTimeout(salto.timer); salto.tot = 0; disegnaTempo(); return true; }
      chiudiLettore();
      return true;
    }
    if (schermo === 'scheda') { indietroScheda(); return true; }
    if (schermo === 'libreria') { lib.giro++; indietroLibreria(); return true; }
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
    // aperta da Continua a guardare della home: #/v/<percorso>?d=&dim= (chiavetta e dimensione), piu' t=<secondi> (il
    // punto della scheda) o dacapo=1; con Indietro si torna alla home
    var m = /#\/v\/([^?]*)\?(.*)$/.exec(location.hash);
    prendiPermesso().then(function () {
      apriInizio();
      if (m) {
        var q = {}, coppie = m[2].split('&');
        for (var i = 0; i < coppie.length; i++) { var kv = coppie[i].split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); }
        var p = decodeURIComponent(m[1]), nome = p.split('/').pop();
        var x = { d: q.d || '', p: p, nome: nome, dim: +q.dim || 0, daCapo: q.dacapo === '1', t: q.t !== undefined && isFinite(+q.t) ? +q.t : -1 };
        // prima le chiavette: se la lettera e' cambiata, il film si cerca anche sulle altre
        chiedi('dischi').then(function (r) { dischi = r.dischi || []; riprendi(x, 'esci'); }, function () { riprendi(x, 'esci'); });
      }
    }, function (e) { dischiErrore = e; apriInizio(); });
  });
})();
