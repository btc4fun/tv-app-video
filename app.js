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
    // barre sotto un tetto: i picchi tagliati (il limitatore del Mac)
    picchi: 'M4 9h40v3H4zM6 30h4v10H6zM12 22h4v18h-4zM18 15h4v25h-4zM24 15h4v25h-4zM30 24h4v16h-4zM36 31h4v9h-4z',
    mac: 'M9 9h30a2 2 0 0 1 2 2v20H7V11a2 2 0 0 1 2-2zm2 4v14h26V13zM3 34h42v2a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z',
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
    testo: 'M4 10h40v28H4zm4 4v20h32V14zm4 12h10v4H12zm14 0h10v4H26zm-14-6h24v4H12z',
    cerca: 'M20 6a14 14 0 0 1 11.1 22.5l10.7 10.7-2.8 2.8-10.7-10.7A14 14 0 1 1 20 6zm0 4a10 10 0 1 0 0 20 10 10 0 0 0 0-20z',
    jellyfin: 'M24 6c-5 0-21 29-18.6 33.6S42.6 44.2 42.6 39.6 29 6 24 6zm0 9c3 0 11 17.5 9.8 20S15.4 37.5 14.2 35 21 15 24 15zm0 7c-1.6 0-5.3 9.6-4.6 11s8.6 1.4 9.2 0S25.6 22 24 22z',
    cuore: 'M24 42l-3-2.7C10.4 29.8 4 24 4 16.8 4 11 8.5 6.5 14.2 6.5c3.3 0 6.5 1.6 8.6 4 .5.6 1.9.6 2.4 0 2.1-2.4 5.3-4 8.6-4C39.5 6.5 44 11 44 16.8c0 7.2-6.4 13-17 22.5z',
    trailer: 'M6 10h36v28H6zm14 7v14l11-7z',
    ingranaggio: 'M27 4l1.2 5.1a15 15 0 0 1 3.6 2.1l5-1.6 3 5.2-3.8 3.6a15 15 0 0 1 0 4.2l3.8 3.6-3 5.2-5-1.6a15 15 0 0 1-3.6 2.1L27 44h-6l-1.2-5.1a15 15 0 0 1-3.6-2.1l-5 1.6-3-5.2 3.8-3.6a15 15 0 0 1 0-4.2L8.2 21.8l3-5.2 5 1.6a15 15 0 0 1 3.6-2.1L21 4zm-3 13a7 7 0 1 0 0 14 7 7 0 0 0 0-14z'
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
  function chiedi(via, param, corpo, riprovato, metodo) {
    return (serv.gettone ? Promise.resolve() : prendiPermesso()).then(function () {
      return new Promise(function (ok, ko) {
        var x = new XMLHttpRequest(), q = query(param || {});
        x.open(metodo || (corpo ? 'POST' : 'GET'), serv.base + '/api/video/g/' + serv.gettone + '/' + via + (q ? '?' + q : ''), true);
        x.timeout = 20000;
        x.onload = function () {
          var r = null;
          try { r = JSON.parse(x.responseText); } catch (e) {}
          if ((x.status === 200 && r) || x.status === 204 || (x.status >= 200 && x.status < 300 && metodo)) { ok(r || {}); return; }
          ko(erroreCon(r && r.codice ? r.codice : x.status === 403 ? 'gettone' : x.status === 401 ? 'accesso' : 'servizio', r && r.error));
        };
        x.onerror = function () { ko(erroreCon('servizio')); };
        x.ontimeout = function () { ko(erroreCon('lento')); };
        if (corpo) x.setRequestHeader('Content-Type', 'text/plain');
        x.send(corpo ? JSON.stringify(corpo) : null);
      });
    }).then(null, function (e) {
      if (e.codice === 'gettone' && !riprovato) { serv.gettone = ''; return chiedi(via, param, corpo, true, metodo); }
      // Jellyfin non riconosce piu' l'accesso (password cambiata, accesso tolto): si torna a collegarlo
      if (e.codice === 'accesso' && jf.stato && jf.stato.utente) { jf.stato.utente = null; jf.dati = null; }
      throw e;
    });
  }
  // una domanda a Jellyfin, dal ponte del servizio: percorso di Jellyfin e parametri (il token lo mette il servizio)
  function chiediJf(percorso, param, corpo, metodo) { return chiedi('jf/p/' + percorso, param, corpo, false, metodo); }
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

  var prefs = { lingue: ['ita', 'eng'], sottoAuto: true, dimSotto: 'medi', posSotto: 0, schermo: 'adatta', qualita: 'orig', anteprime: true };
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
  var memInizio = null;
  function mostra(nome) {
    if (schermo === 'inizio' && nome !== 'inizio' && pag && pag.corpo === $('inizio-corpo')) memInizio = pag;
    schermo = nome;
    $('schermo-inizio').hidden = nome !== 'inizio';
    $('schermo-libreria').hidden = nome !== 'libreria';
    $('schermo-scheda').hidden = nome !== 'scheda';
    $('schermo-lettore').hidden = nome !== 'lettore';
    $('schermo-cerca').hidden = nome !== 'cerca';
    $('schermo-collega').hidden = nome !== 'collega';
    $('sfondo').hidden = nome === 'lettore';
    // il trailer dietro la scheda: solo li' (e mai insieme al lettore: un decoder alla volta)
    if (nome !== 'scheda') fermaTrailer();
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
    var sch0 = pag.corpo.parentNode;
    if (sch0 && sch0.classList) { if (y > 0) sch0.classList.add('scorso'); else sch0.classList.remove('scorso'); }
    if (R.quando) R.quando(e, R.k);
    caricaVicine();
  }
  function tastoPagina(a) {
    if (!pag || !pag.righe.length) return a === 'up' || a === 'down' || a === 'left' || a === 'right';
    var R = pag.righe[pag.r];
    if (a === 'left' || a === 'right') {
      var k = R.k + (a === 'left' ? -1 : 1);
      if (k >= 0 && k < R.voci.length) { R.k = k; pag.mosso = true; evidenzia(); }
      return true;
    }
    if (a === 'up' || a === 'down') {
      pag.mosso = true;
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
    jfCaricaInizio(false);
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
    var vecchia = pag && pag.corpo === $('inizio-corpo') ? pag : memInizio, l = continuaTutti();
    // la fila Continua a guardare (chiavette e Jellyfin)
    var fc = $('fila-continua');
    svuota(fc);
    $('sez-continua').hidden = !l.length;
    l.forEach(function (c) {
      if (!c.jf) { cartaContinua(c.x, fc); return; }
      cartaJf(c.jf, 'orizzontale', fc, { sotto: 'Mancano ' + tempo(Math.max(0, c.s.durata * 60 - c.s.punto)),
        apri: function () { guardaJf(c.jf, { ritorno: tornaInizio, t: c.s.punto }); } });
    });
    var righeJf = disegnaRigheJf();
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
    disegnaVuoto(l.length || jfAttivo());
    disegnaAltro();
    // il film grande: l'ultimo da riprendere (poi quello scelto nella fila); senza, l'ultimo arrivato su Jellyfin
    var primo = l[0] || (jf.dati && jf.dati.aggiunti[0] ? { jf: jf.dati.aggiunti[0].voci[0] } : null);
    $('eroe').hidden = !primo;
    if (primo) mostraEroeDi(primo);
    // le righe: i pulsanti del film grande, Continua, Jellyfin, chiavette (o "Controlla di nuovo"), Altro
    nuovaPagina($('inizio-corpo'));
    if (primo) aggiungiRiga($('eroe-pulsanti'), vociDi($('eroe-pulsanti')), { sezione: $('eroe'), chiave: 'eroe' });
    if (l.length) aggiungiRiga(fc, vociDi(fc), { sezione: $('sez-continua'), chiave: 'continua', quando: function (e, k) { mostraEroeDi(l[k]); } });
    righeJf.forEach(function (R) { aggiungiRiga(R.box, vociDi(R.box), { sezione: R.sezione, chiave: R.chiave, quando: R.quando }); });
    if (dischi.length) aggiungiRiga(fd, vociDi(fd), { sezione: $('sez-dischi'), chiave: 'dischi' });
    if (!dischi.length) aggiungiRiga($('vuoto'), [$('vuoto-riprova')], { sezione: $('vuoto'), chiave: 'vuoto' });
    aggiungiRiga($('fila-altro'), vociDi($('fila-altro')), { sezione: $('sez-altro'), chiave: 'altro' });
    // la scelta resta dov'era (stessa riga, stessa voce); all'inizio sul film grande o sulle chiavette
    if (vecchia && vecchia.mosso && scegli === 'tieni') {
      pag.mosso = true;
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
  function caricaTetto() { chiedi('tv/tetto').then(function (r) { if (r && r.mbps > 0) tettoTv = r; }, function () {}); }
  function macAttivo() { return !!(mac.stato && mac.stato.collegato); }
  function macCaricaStato(poi) {
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

  // le file dell'inizio, tutte insieme (una domanda per fila, al massimo ogni minuto); si ridisegna quando arrivano
  function jfCaricaInizio(forza) {
    if (!jfAttivo()) { jf.dati = null; return; }
    if (!forza && jf.dati && Date.now() - jf.caricato < 60000) return;
    var giro = ++jf.giro, u = uid(), d = { riprendi: [], prossimi: [], viste: [], aggiunti: [], generi: [], collezioni: [], preferiti: [] };
    jf.caricato = Date.now();
    function no(e) { return e; }
    Promise.all([
      chiediJf('UserItems/Resume', conCampi({ Limit: 12, MediaTypes: 'Video' })).then(function (r) { d.riprendi = voci(r); }, no),
      chiediJf('Shows/NextUp', conCampi({ UserId: u, Limit: 16, EnableResumable: false })).then(function (r) { d.prossimi = voci(r); }, no),
      chiediJf('UserViews', { userId: u }).then(function (r) {
        d.viste = voci(r).filter(function (x) { return /^(movies|tvshows|homevideos|boxsets|mixed)$/.test(x.CollectionType || 'mixed'); });
        var film = d.viste.filter(function (x) { return x.CollectionType === 'movies'; })[0];
        var dopo = d.viste.filter(function (x) { return x.CollectionType !== 'boxsets'; }).slice(0, 4).map(function (vista) {
          return chiediJf('Items/Latest', conCampi({ ParentId: vista.Id, Limit: 16, GroupItems: true })).then(function (r2) {
            if (voci(r2).length) d.aggiunti.push({ vista: vista, voci: voci(r2) });
          }, no);
        });
        if (film) dopo.push(chiediJf('Genres', { ParentId: film.Id, UserId: u, SortBy: 'SortName', Limit: 30 }).then(function (r3) {
          d.generi = voci(r3).map(function (g) { return { nome: String(g.Name || ''), vista: film.Id }; }).filter(function (g) { return g.nome; });
        }, no));
        return Promise.all(dopo);
      }, no),
      chiediJf('Items', conCampi({ IncludeItemTypes: 'BoxSet', Recursive: true, SortBy: 'SortName', Limit: 20 })).then(function (r) { d.collezioni = voci(r); }, no),
      chiediJf('Items', conCampi({ Filters: 'IsFavorite', IncludeItemTypes: 'Movie,Series,Episode', Recursive: true, SortBy: 'DatePlayed,SortName',
        SortOrder: 'Descending', Limit: 20 })).then(function (r) { d.preferiti = voci(r); }, no)
    ]).then(function (r) {
      if (giro !== jf.giro) return;
      d.aggiunti.sort(function (a, b) { return d.viste.indexOf(a.vista) - d.viste.indexOf(b.vista); });
      var rete = r.filter(function (x) { return x && (x.codice === 'rete' || x.codice === 'servizio' || x.codice === 'lento'); }).length;
      jf.errore = rete >= 3 ? 'rete' : '';
      if (r.some(function (x) { return x && x.codice === 'accesso'; })) { jf.dati = null; if (jf.stato) jf.stato.utente = null; }
      else if (jf.errore) { jf.dati = null; jf.caricato = 0; }
      else jf.dati = d;
      if (schermo === 'inizio') disegnaInizio('tieni');
      // il Mac spento: si riprova da soli ogni 30 secondi finche' si sta all'inizio
      clearTimeout(jf.riprova);
      if (jf.errore) jf.riprova = setTimeout(function () { if (schermo === 'inizio' && jfAttivo()) jfCaricaInizio(true); }, 30000);
    });
  }
  // Continua a guardare: le chiavette (la memoria dell'app) e Jellyfin (il punto lo tiene il server), i piu' recenti prima
  function continuaTutti() {
    var l = continua().map(function (x) { return { x: x, quando: x.quando }; });
    if (jf.dati) jf.dati.riprendi.forEach(function (it) { var s = JF.scheda(it); l.push({ jf: it, s: s, quando: s.ultimaVolta }); });
    return l.sort(function (a, b) { return b.quando - a.quando; }).slice(0, 16);
  }
  // una carta di Jellyfin: poster (2:3) o orizzontale (16:9); l'immagine quando la fila si avvicina (vedi caricaVicine)
  function cartaJf(it, forma, fila, opz) {
    opz = opz || {};
    var s = JF.scheda(it), poster = forma === 'poster', c = el('div', 'carta' + (poster ? ' poster' : '')), q = el('div', 'quadro');
    var titolo = s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo;
    c.setAttribute('data-chiave', 'jf:' + it.Id);
    c.setAttribute('data-tv', '');
    q.appendChild(finta(titolo, s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio : s.anno || '', s.tipo === 'puntata' || s.tipo === 'serie' ? 'serie' : 'film'));
    if (s.visto && s.tipo !== 'serie') { var vs = el('div', 'vista'); vs.appendChild(icona(ICONE.spunta)); q.appendChild(vs); }
    else if (s.percento > 0 && s.percento < 100) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.round(s.percento) + '%'; b.appendChild(f); q.appendChild(b); }
    else if (s.tipo === 'serie' && s.nonVisti) q.appendChild(el('div', 'num', String(s.nonVisti)));
    if (opz.fonte) q.appendChild(el('div', 'fonte', opz.fonte));
    c.appendChild(q);
    c.appendChild(el('div', 'nome', opz.nome || titolo));
    c.appendChild(el('div', 'sotto', opz.sotto !== undefined ? opz.sotto : sottoJf(s)));
    c.addEventListener('click', function () { if (opz.apri) opz.apri(it); else apriJf(it, { indietro: tornaInizio }); });
    var ref = poster ? s.img.poster : opz.ref || s.img.landscape || s.img.fanart || s.img.poster;
    c.carica = function () {
      if (ref) mettiImg(q, '', ref, poster ? 220 : 448, poster ? 330 : 252, false, function (si) { var f0 = q.querySelector('.finta'); if (si && f0) f0.style.opacity = '0'; });
    };
    c.scheda = s;
    fila.appendChild(c);
    return c;
  }
  // le immagini delle file vicine a quella scelta (le altre quando ci si arriva): l'inizio parte leggero
  function caricaVicine() {
    if (!pag) return;
    for (var r = Math.max(0, pag.r - 1); r <= Math.min(pag.righe.length - 1, pag.r + 2); r++) {
      var R = pag.righe[r];
      for (var k = Math.max(0, R.k - 2); k < Math.min(R.voci.length, R.k + 9); k++) {
        var c = R.voci[k];
        if (c && c.carica) { var f = c.carica; c.carica = null; f(); }
      }
    }
  }
  function tornaInizio() { apriInizio('tieni'); }
  // le file di Jellyfin dentro l'inizio: [{ box, sezione, chiave, quando }]
  function disegnaRigheJf() {
    var box = $('jf-righe'), out = [], d = jf.dati;
    svuota(box);
    if (!d && jf.errore === 'rete' && jfAttivo()) {
      // il server non risponde: una riga sola, col perche' e un pulsante per riprovare
      var sz = el('section', 'sezione jf-giu'), pp = el('div', 'pulsanti');
      sz.appendChild(el('h2', '', 'Jellyfin'));
      sz.appendChild(el('p', 'trama', (jf.stato.server.nome || 'Jellyfin') + ' non risponde: il Mac e\' acceso e Jellyfin e\' aperto? Riprovo da solo.'));
      pp.appendChild(pulsante('Riprova adesso', 'ripeti', function () { messaggio('Riprovo…'); jfCaricaInizio(true); }));
      sz.appendChild(pp);
      box.appendChild(sz);
      out.push({ box: pp, sezione: sz, chiave: 'jf:giu' });
      return out;
    }
    if (!d) return out;
    function sezione(titolo, chiave, forma, lista, opz) {
      if (!lista.length) return;
      var sz = el('section', 'sezione'), fila = el('div', 'fila');
      sz.appendChild(el('h2', '', titolo));
      sz.appendChild(fila);
      box.appendChild(sz);
      lista.forEach(function (x) { if (opz && opz.carta) opz.carta(x, fila); else cartaJf(x, forma, fila, opz); });
      out.push({ box: fila, sezione: sz, chiave: chiave, quando: function (e) { if (e.scheda) sfondo('', e.scheda.img.fanart || e.scheda.img.poster, false); } });
    }
    sezione('Prossimi episodi', 'jf:prossimi', 'orizzontale', d.prossimi, { sotto: undefined });
    d.aggiunti.forEach(function (a) { sezione('Aggiunti di recente · ' + a.vista.Name, 'jf:aggiunti:' + a.vista.Id, 'poster', a.voci); });
    sezione('Le tue librerie', 'jf:viste', 'orizzontale', d.viste, { sotto: '', carta: cartaVista });
    sezione('Generi', 'jf:generi', '', d.generi, { carta: cartaGenere });
    sezione('Collezioni', 'jf:collezioni', 'poster', d.collezioni);
    sezione('Preferiti', 'jf:preferiti', 'poster', d.preferiti);
    return out;
  }
  function cartaVista(vista, fila) {
    var c = cartaJf(vista, 'orizzontale', fila, { sotto: vista.CollectionType === 'tvshows' ? 'Serie' : vista.CollectionType === 'boxsets' ? 'Collezioni' : 'Film',
      apri: function () { apriLibreriaJf({ titolo: vista.Name, vista: vista, indietro: tornaInizio }); } });
    return c;
  }
  function cartaGenere(g, fila) {
    var c = el('div', 'carta genere'), q = el('div', 'quadro'), h = tinta(g.nome);
    c.setAttribute('data-tv', '');
    c.setAttribute('data-chiave', 'genere:' + g.nome);
    q.style.backgroundImage = 'linear-gradient(135deg, hsl(' + h + ',55%,38%) 0%, hsl(' + ((h + 48) % 360) + ',60%,16%) 100%)';
    q.appendChild(el('div', 'gn', g.nome));
    c.appendChild(q);
    c.addEventListener('click', function () {
      apriLibreriaJf({ titolo: g.nome, query: { ParentId: g.vista, Genres: g.nome, IncludeItemTypes: 'Movie', Recursive: true }, indietro: tornaInizio });
    });
    fila.appendChild(c);
    return c;
  }
  // la fila "Altro": cerca, Jellyfin (collegare o vedere com'e' collegato), anteprime nella scheda
  function disegnaAltro() {
    var f = $('fila-altro');
    svuota(f);
    function carta(chiave, ic, nome, stato, fn) {
      var c = el('div', 'carta altro'), q = el('div', 'quadro');
      c.setAttribute('data-tv', '');
      c.setAttribute('data-chiave', 'altro:' + chiave);
      q.appendChild(icona(ICONE[ic]));
      if (stato) q.appendChild(el('div', 'stato', stato));
      c.appendChild(q);
      c.appendChild(el('div', 'nome', nome));
      c.addEventListener('click', fn);
      f.appendChild(c);
    }
    if (jfAttivo()) carta('cerca', 'cerca', 'Cerca', 'film, serie, persone', function () { apriCerca(tornaInizio); });
    var st = jf.stato || {};
    if (!st.errore || st.server) {
      carta('jellyfin', 'jellyfin', jfAttivo() ? 'Jellyfin · ' + (st.server.nome || 'server') : 'Collega Jellyfin',
        jfAttivo() ? (jf.errore === 'rete' ? 'non risponde' : 'collegato come ' + st.utente.nome) : 'film e serie dal Mac', function () { apriCollega(tornaInizio); });
    }
    if (jfAttivo()) carta('mac', 'mac', macAttivo() ? 'Senza picchi · Mac' : 'Collega il Mac', macAttivo() ? 'collegato' : 'toglie i picchi dei remux',
      function () { apriCollegaMac(tornaInizio); });
    carta('tetto', 'picchi', 'Tetto del TV', tettoTv.mbps + ' Mbps' + (tettoTv.scelta === 'prova' ? ' · misurato' : ''), apriTetto);
    carta('velocita', 'ingranaggio', 'Velocità del TV', 'per l\'audio DTS', misuraVelocita);
    carta('anteprime', 'trailer', 'Anteprime nella scheda', prefs.anteprime ? 'accese' : 'spente', function () {
      prefs.anteprime = !prefs.anteprime;
      salvaPrefs();
      messaggio(prefs.anteprime ? 'Anteprime accese: il trailer parte da solo, senza audio' : 'Anteprime spente');
      disegnaInizio('tieni');
    });
  }
  // il tetto: 80 (finche' non si prova sul TV), 150, o misurato dal TV col video a scalini del Mac
  function apriTetto() {
    var indietro = function () { chiudiFermo(); disegnaInizio('tieni'); };
    function scegli(corpo, detto) {
      chiedi('tv/tetto', null, corpo).then(function (r) { tettoTv = r; chiudiFermo(); messaggio(detto(r)); apriTetto(); },
        function () { messaggio('Non riesco a salvare: riprova'); });
    }
    var prossima = tettoTv.unione === 10 ? 30 : tettoTv.unione === 30 ? 60 : 10;
    fermo('Tetto del TV · ' + tettoTv.mbps + ' Mbps', 'Quanti Mbps il TV regge senza scatti. Sopra il tetto l\'app avvisa (chiavetta) e il Mac toglie i picchi ' +
      '(Jellyfin). Finché non lo proviamo sul tuo TV, 80 è la scelta sicura.\nGiunture: il Mac unisce i tratti da rifare vicini meno di ' + tettoTv.unione +
      ' s. Se il TV scatta dove il Mac ha rifatto un pezzo, unisci di più: meno giunture.', [
      { testo: '80 Mbps' + (tettoTv.scelta === '80' ? ' ✓' : ''), fn: function () { scegli({ scelta: '80' }, function (r) { return 'Tetto del TV: ' + r.mbps + ' Mbps'; }); } },
      { testo: '150 Mbps' + (tettoTv.scelta === '150' ? ' ✓' : ''), fn: function () { scegli({ scelta: '150' }, function (r) { return 'Tetto del TV: ' + r.mbps + ' Mbps'; }); } },
      { testo: 'Giunture: ' + tettoTv.unione + ' s', fn: function () { scegli({ unione: prossima }, function (r) { return 'Giunture: il Mac unisce i tratti vicini meno di ' + r.unione + ' s'; }); } },
      { testo: 'Indietro', fn: indietro }]);
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
          '; il TrueHD Atmos il ' + q2 + '%.\nNode ' + r.node + ' · ' + r.arch + ' · worker_threads ' + (r.workerThreads ? 'sì' : 'no') +
          '\nWebAssembly: fir ' + r.wasm.fir + ' ms, quant ' + r.wasm.quant + ' ms · JavaScript: fir ' + r.js.fir + ' ms, quant ' + r.js.quant + ' ms';
      }
      fermo('Velocità del TV', t, indietro);
    }, function (e) {
      if (fermoAperto()) fermo('Velocità del TV', e.codice === 'assente' || e.codice === 'vecchio' ? 'Il servizio di questo TV è vecchio: riavvia il TV.' : 'Non riesco a misurare: riprova.', indietro);
    });
  }
  // il film grande in cima, da Jellyfin: logo, anno, durata, trama, Riprendi o Guarda
  function mostraEroeJf(it) {
    if (!it) return;
    eroeDi = it;
    var s = JF.scheda(it), logo = $('eroe-logo'), titolo = s.tipo === 'puntata' && s.serie ? s.serie.titolo : s.titolo;
    svuota(logo);
    logo.appendChild(el('h1', '', titolo));
    if (s.img.logo) mettiImg(logo, '', s.img.logo, 680, 260, true, function (si) { if (si && eroeDi === it) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    metaDi($('eroe-meta'), s, null, s.tipo === 'puntata' ? 'S' + s.stagione + ' E' + s.episodio + (s.titolo ? ' · ' + s.titolo : '') : '');
    $('eroe-trama').textContent = s.trama;
    var pp = $('eroe-pulsanti'), ripr = riprendibileJf(s);
    svuota(pp);
    pp.appendChild(pulsante(ripr ? 'Riprendi' : 'Guarda', 'play', function () { guardaJf(it, { ritorno: tornaInizio, t: ripr ? s.punto : 0 }); },
      ripr ? tempo(s.punto) + ' di ' + tempo(s.durata * 60) : ''));
    if (ripr) pp.appendChild(pulsante('Dall\'inizio', 'ripeti', function () { guardaJf(it, { ritorno: tornaInizio, daCapo: true }); }));
    pp.appendChild(pulsante('Scheda', '', function () { apriJf(it, { indietro: tornaInizio }); }));
    if (pag && pag.righe[0] && pag.righe[0].chiave === 'eroe') { pag.righe[0].voci = vociDi(pp); if (pag.r === 0) evidenzia(); }
    sfondo('', s.img.fanart || s.img.landscape || s.img.poster, true);
  }
  function mostraEroeDi(c) { if (!c) return; if (c.jf) mostraEroeJf(c.jf); else mostraEroe(c.x); }

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
    ['sez-stagioni', 'sez-puntate', 'sez-cast', 'sez-simili'].forEach(function (id) { $(id).hidden = true; });
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
    if (!x.logoFatto) {
      x.logoFatto = true;
      svuota(logo);
      logo.appendChild(el('h1', '', titolo));
      if (s.img.logo) mettiImg(logo, '', s.img.logo, 680, 260, true, function (si) { if (si && x.giro === schGiro) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    }
    metaDi($('sc-meta'), s, null, '');
    if (s.durata) $('sc-meta').appendChild(el('span', '', finisceAlle(s.durata * 60 - (riprendibileJf(s) ? s.punto : 0))));
    var badge = $('sc-badge');
    svuota(badge);
    JF.badge(it, L0).forEach(function (b) {
      badge.appendChild(el('span', 'badge' + (b.forte ? ' forte' : '') + (b.no ? ' no' : '') + (b.conv ? ' conv' : ''), b.t + (b.conv ? ' · convertito' : '')));
    });
    $('sc-slogan').textContent = s.slogan;
    $('sc-trama').textContent = s.trama;
    var pp = $('sc-pulsanti'), ripr = riprendibileJf(s);
    svuota(pp);
    x.guarda = function () { guardaJf(it, { ritorno: riapriScheda(x), t: ripr ? s.punto : 0 }); };
    pp.appendChild(pulsante(ripr ? 'Riprendi' : 'Guarda', 'play', x.guarda, ripr ? 'da ' + tempo(s.punto) : ''));
    if (ripr) pp.appendChild(pulsante('Dall\'inizio', 'ripeti', function () { guardaJf(it, { ritorno: riapriScheda(x), daCapo: true }); }));
    if (s.trailer) pp.appendChild(pulsante('Trailer', 'trailer', function () { guardaTrailerJf(x); }));
    pp.appendChild(pulsanteStato(s.preferito, 'cuore', 'Preferito', function (b) { cambiaPreferito(x, b); }));
    pp.appendChild(pulsanteStato(s.visto, 'spunta', 'Visto', function (b) { cambiaVisto(x, b); }));
    var righe = $('sc-righe');
    svuota(righe);
    function riga(a, b) { if (!b) return; var r = el('div'); r.appendChild(document.createTextNode(a + '  ')); r.appendChild(el('b', '', b)); righe.appendChild(r); }
    riga('Regia', s.registi.join(', '));
    riga('Scritto da', s.scrittori.join(', '));
    riga('Studio', s.studi.join(', '));
    var strada = JF.strada(it, L0);
    if (ms) riga('File', String(ms.Path || ms.Name || '').split(/[\/\\]/).pop() + (ms.Size ? ' · ' + peso(ms.Size) : '') +
      (ms.Bitrate ? ' · ' + String(Math.round(ms.Bitrate / 1e5) / 10).replace('.', ',') + ' Mbps' : ''));
    riga('Al TV', strada === 'diretta' ? 'il file vero, come da una chiavetta' : strada === 'audio' ? 'video originale, audio convertito dal server' :
      strada === 'converti' ? 'convertito dal server' : '');
    var avv = '';
    if (strada === 'converti') avv = 'Il TV non legge questo video cosi\' com\'e\': lo converte Jellyfin (il Mac lavora, la qualita\' cala un po\').';
    else if (strada === 'audio') avv = 'L\'audio di questo film il TV non lo legge: Jellyfin lo converte in Dolby Digital Plus, il video resta l\'originale.';
    else if (ms && ms.Bitrate > 80e6) avv = 'File molto pesante (' + Math.round(ms.Bitrate / 1e6) + ' Mbps): su alcuni TV Samsung del 2022 oltre 80 Mbps il video puo\' scattare. Nel pannello del lettore c\'e\' la qualita\'.';
    $('sc-avviso').textContent = avv;
    $('sc-avviso').hidden = !avv;
    sfondo('', s.img.fanart || s.img.landscape || s.img.poster, true, true);
    disegnaCast(x);
    disegnaSimili(x);
    righeScheda(x);
  }
  // un pulsante acceso/spento (preferito, visto)
  function pulsanteStato(acceso, ic, testo, fn) {
    var b = pulsante(testo, ic, function () { fn(b); });
    if (acceso) b.className += ' acceso';
    return b;
  }
  function cambiaPreferito(x, b) {
    var si = !/\bacceso\b/.test(b.className);
    b.className = b.className.replace(/\s*\bacceso\b/, '') + (si ? ' acceso' : '');
    chiediJf('UserFavoriteItems/' + x.id, { userId: uid() }, si ? {} : null, si ? 'POST' : 'DELETE').then(function () {
      x.s.preferito = si;
      jf.caricato = 0;
      messaggio(si ? 'Nei preferiti' : 'Tolto dai preferiti');
    }, function () { messaggio('Jellyfin non risponde: riprova'); });
  }
  function cambiaVisto(x, b) {
    var si = !/\bacceso\b/.test(b.className);
    b.className = b.className.replace(/\s*\bacceso\b/, '') + (si ? ' acceso' : '');
    chiediJf('UserPlayedItems/' + x.id, { userId: uid() }, si ? {} : null, si ? 'POST' : 'DELETE').then(function () {
      x.s.visto = si;
      jf.caricato = 0;
      messaggio(si ? 'Segnato come visto' : 'Segnato da vedere');
    }, function () { messaggio('Jellyfin non risponde: riprova'); });
  }
  function disegnaSimili(x) {
    var f = $('fila-simili');
    svuota(f);
    $('sez-simili').hidden = !x.simili.length;
    x.simili.forEach(function (it) { var c = cartaJf(it, 'poster', f, { apri: function () { apriJf(it, { indietro: riapriScheda(x) }); } }); c.carica(); c.carica = null; });
  }
  // le righe della scheda col telecomando (la scelta resta dov'era: tornando da una persona o dal lettore)
  function righeScheda(x) {
    var vecchia = pag && pag.corpo === $('scheda-corpo') ? pag : null, R0 = vecchia ? vecchia.righe[vecchia.r] : null;
    var voluta = R0 ? { chiave: R0.chiave, k: R0.k } : x.opz.riga || null;
    x.opz.riga = null;
    nuovaPagina($('scheda-corpo'));
    var pp = $('sc-pulsanti');
    aggiungiRiga(pp, vociDi(pp), { sezione: $('sc-sopra'), chiave: 'pulsanti' });
    if (!$('sez-stagioni').hidden) aggiungiRiga($('fila-stagioni'), vociDi($('fila-stagioni')), { sezione: $('sez-stagioni'), k: x.k, chiave: 'stagioni' });
    if (!$('sez-puntate').hidden) aggiungiRiga($('fila-puntate'), vociDi($('fila-puntate')), { sezione: $('sez-puntate'), chiave: 'puntate', k: x.kPuntata || 0 });
    if (!$('sez-cast').hidden) aggiungiRiga($('fila-cast'), vociDi($('fila-cast')), { sezione: $('sez-cast'), chiave: 'cast' });
    if (!$('sez-simili').hidden) aggiungiRiga($('fila-simili'), vociDi($('fila-simili')), { sezione: $('sez-simili'), chiave: 'simili' });
    if (voluta) {
      for (var r = 0; r < pag.righe.length; r++) {
        if (pag.righe[r].chiave === voluta.chiave) { pag.r = r; pag.righe[r].k = Math.min(voluta.k, Math.max(0, pag.righe[r].voci.length - 1)); }
      }
    }
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
    if (s.img.logo) mettiImg(logo, '', s.img.logo, 680, 260, true, function (si) { if (si && x.giro === schGiro) { var h = logo.querySelector('h1'); if (h) logo.removeChild(h); } });
    $('sc-sopratitolo').textContent = 'Serie' + (x.stagioni.length ? ' · ' + x.stagioni.length + (x.stagioni.length === 1 ? ' stagione' : ' stagioni') : '');
    metaDi($('sc-meta'), s, null, '');
    $('sc-trama').textContent = s.trama;
    sfondo('', s.img.fanart || s.img.poster, true, true);
    disegnaCast(x);
    var fs = $('fila-stagioni');
    svuota(fs);
    $('sez-stagioni').hidden = x.stagioni.length < 2;
    x.stagioni.forEach(function (st, i) {
      var ss = JF.scheda(st), c = el('div', 'stagione' + (i === x.k ? ' attiva' : '')), cop = el('div', 'copertina');
      cop.appendChild(finta(ss.titolo, '', 'stagione'));
      c.appendChild(cop);
      c.appendChild(el('div', 'nome', ss.titolo));
      c.setAttribute('data-tv', '');
      c.addEventListener('click', function () { x.k = i; x.stagioneId = st.Id; puntateJf(x); });
      fs.appendChild(c);
      if (ss.img.poster) mettiImg(cop, '', ss.img.poster, 192, 288);
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
    $('sez-puntate').hidden = !x.puntate.length;
    $('puntate-titolo').textContent = (st ? JF.scheda(st).titolo : 'Puntate') + ' · ' + x.puntate.length + (x.puntate.length === 1 ? ' puntata' : ' puntate');
    x.kPuntata = 0;
    x.puntate.forEach(function (ep, j) {
      var s = JF.scheda(ep), c = el('div', 'carta puntata'), q = el('div', 'quadro');
      q.appendChild(finta(s.titolo, 'S' + s.stagione + ' E' + s.episodio, 'puntata'));
      q.appendChild(el('div', 'num', 'E' + (s.episodio >= 0 ? s.episodio : j + 1)));
      if (s.visto) { var vs = el('div', 'vista'); vs.appendChild(icona(ICONE.spunta)); q.appendChild(vs); }
      else if (s.percento > 0) { var b = el('div', 'barra'), f = el('i'); f.style.width = Math.round(s.percento) + '%'; b.appendChild(f); q.appendChild(b); }
      if (x.prossima && x.prossima.Id === ep.Id) x.kPuntata = j;
      c.appendChild(q);
      c.appendChild(el('div', 'nome', (s.episodio >= 0 ? s.episodio + '. ' : '') + s.titolo));
      c.appendChild(el('div', 'trama-p', s.trama));
      c.setAttribute('data-tv', '');
      c.addEventListener('click', function () { guardaJf(ep, { ritorno: riapriScheda(x), t: riprendibileJf(s) ? s.punto : 0 }); });
      fp.appendChild(c);
      if (s.img.landscape) mettiImg(q, '', s.img.landscape, 403, 227);
    });
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
    pp.appendChild(pulsanteStato(x.s.preferito, 'cuore', 'Preferito', function (b) { cambiaPreferito(x, b); }));
    disegnaSimili(x);
    righeScheda(x);
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
    if (!prefs.anteprime || !x.it || x.it.Type === 'Series') return;
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
      messaggio(e.codice === 'indirizzo' ? 'Indirizzo non valido' : e.codice === 'jellyfin' ? 'A quell\'indirizzo non risponde Jellyfin' :
        e.codice === 'troppe' ? 'Troppi indirizzi provati: riprova tra qualche minuto' :
        e.codice === 'certificato' ? 'Il TV non accetta il certificato https di quel server: prova con http://' + indirizzo.replace(/^https?:\/\//i, '') :
        e.codice === 'rete' ? 'Il server non risponde: e\' acceso?' : 'Non riesco a collegarmi', 5000);
      $('collega-testo').textContent = 'Riprova, o scrivi un altro indirizzo.';
    });
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
      $('qc-codice').textContent = r.codice;
      $('qc-codice').hidden = false;
      collegaPagina('Collega ' + nome, 'Sul telefono apri Jellyfin, tocca il tuo profilo, poi Quick Connect, e scrivi questo codice.\n' +
        'Dal computer: la tua immagine in alto a destra › Quick Connect.', altri);
      (function controlla() {
        coll.timer = setTimeout(function () {
          if (giro !== coll.giro || schermo !== 'collega') return;
          chiedi('jf/qc').then(function (s) {
            if (giro !== coll.giro || schermo !== 'collega') return;
            if (s.stato === 'fatto') { collegato(); return; }
            if (s.stato === 'scaduto') { collegaCodice(); return; }
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
  function collegaPassword() {
    coll.giro++;
    HomeTV.chiediTesto({ titolo: 'Nome utente di Jellyfin', valore: '' }).then(function (nome) {
      if (!nome) { collegaCodice(); return; }
      HomeTV.chiediTesto({ titolo: 'Password di ' + nome, valore: '' }).then(function (pw) {
        if (pw === null || pw === undefined) { collegaCodice(); return; }
        chiedi('jf/accedi', null, { nome: nome, password: pw }).then(function () { collegato(); }, function (e) {
          messaggio(e.codice === 'password' ? 'Nome o password sbagliati' : 'Non riesco a entrare', 5000);
          collegaCodice();
        });
      });
    });
  }
  function collegato() {
    coll.giro++;
    jfCaricaStato(function () {
      messaggio(jfAttivo() ? 'Jellyfin collegato: ciao ' + jf.stato.utente.nome + '!' : 'Jellyfin collegato', 4000);
      jfCaricaInizio(true);
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
    if (s.img.poster) mettiImg(cop, '', s.img.poster, m.pw, m.ph, false, function (si) { var f0 = cop.querySelector('.finta'); if (si && f0) f0.style.opacity = '0'; });
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
      sfondo('', v.s.img.fanart || v.s.img.poster || null, false);
      return;
    }
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
    // il TV non sente questo film: lo stesso su Jellyfin si sente (il Mac converte l'audio)
    if (info && info.avvisi.indexOf('audio') !== -1) {
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
      if (c.foto) mettiImg(f, x.d || '', c.foto, 180, 180);
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
    if (a) out.push({ t: a.nomeCodec + (a.canali ? ' ' + canali(a.canali) : '') + (a.server ? ' · convertito' : ''), conv: !!a.server });
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
      x.audio = o.audio || (i.scelta && i.scelta.audio) || 0;
      scegliSottotitoliIniziali(x, o.sottoScelto);
      disegnaBadgeOsd();
      if (i.avvisi.indexOf('audio') !== -1) avvisoLettore(avvisoDi(i), 9000);
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
      salvaTimer = setInterval(function () {
        if (L !== x) return;
        if (!v.paused) salvaPunto(false);
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
    if (dopoPlay) { v.removeEventListener('playing', dopoPlay); dopoPlay = null; }
    if (restaInPausa) {
      dopoPlay = function () { v.removeEventListener('playing', dopoPlay); dopoPlay = null; v.pause(); };
      v.addEventListener('playing', dopoPlay);
    }
    v.src = x.jf ? urlJf(x) : urlFile(x.voce.d, x.voce.p, x.voce.nome, x.audio);
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
    // l'HLS del limitatore ha i tempi del film +10 s: se il lettore del TV li mostra cosi' (durata = film + 10), si toglie
    var dd = L.info && L.info.durata, sp = L.jf && L.jf.modo === 'mac' && dd && v.duration - dd > 8 && v.duration - dd < 12 ? 10 : 0;
    L.spost = sp;
    if (L.daQui || sp) { try { v.currentTime = (L.daQui || 0) + sp; } catch (e) {} }
    L.daQui = 0;
  });
  v.addEventListener('playing', function () {
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
    anteprimaBarra(salto.tot ? t : -1, f);
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
    badgeDi(L.info, L.audio).forEach(function (x) { b.appendChild(el('span', 'badge' + (x.forte ? ' forte' : '') + (x.no ? ' no' : '') + (x.conv ? ' conv' : ''), x.t)); });
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

  /* ---------------------------------------------------------- il lettore con Jellyfin
   * La strada la sceglie il servizio (jf/guarda): "diretto" = il file vero passa dal "vuoto" come una chiavetta (tracce,
   * capitoli e sottotitoli li legge il servizio); "copia" = HLS di Jellyfin col video originale e l'audio convertito;
   * "converti" = HLS rifatto dal server. Il punto lo tiene Jellyfin (Sessions/Playing, Progress, Stopped). */

  var QUALITA_JF = [{ id: 'orig', nome: 'Originale' }, { id: 'auto', nome: 'Automatica', piccolo: 'misura la rete' },
    { id: '4k', nome: '4K', piccolo: 'fino a 80 Mbps' }, { id: '1080', nome: '1080p', piccolo: '20 Mbps' }, { id: '720', nome: '720p', piccolo: '8 Mbps' }];
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
    apriVideo({ jf: it, nome: String(it.Name || ''), d: '', p: 'jf:' + it.Id, dim: 0 }, { ritorno: o.ritorno || tornaInizio, t: o.t, daCapo: o.daCapo, trailer: o.trailer });
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
    var it = x.voce.jf, j = x.jf = { id: it.Id, it: it, q: o.trailer ? 'orig' : prefs.qualita || 'orig', mbps: 0, segmenti: [], tp: null, sessione: '', modo: '',
      ms: '', url: '', g: null, partito: false, prossimo: null, trailer: !!o.trailer };
    // la scheda intera (capitoli, anteprime della barra, serie) se si e' partiti da una voce corta
    var pieno = it.Chapters !== undefined && it.MediaSources ? Promise.resolve(it) : chiediJf('Items/' + it.Id, { userId: uid() });
    return pieno.then(function (itp) {
      j.it = itp;
      x.voce.nome = String(itp.Name || x.voce.nome);
      if (L === x) $('osd-titolo').textContent = titoloJf(itp);
      var s = JF.scheda(itp);
      x.jfDa = o.daCapo ? 0 : o.t > 0 ? o.t : riprendibileJf(s) ? s.punto : 0;
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
    return chiedi('jf/guarda/' + j.id, q).then(function (g) {
      j.g = g;
      j.modo = g.modo;
      j.url = g.url;
      j.ms = g.ms;
      j.sessione = g.sessione;
      j.partito = false;
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
    if (j.modo !== 'diretto') return b + j.url;
    // il nome col suo tipo nell'indirizzo, come per le chiavette
    var ms = JF.sorgente(j.it), nome = String(ms && ms.Path || 'video.mkv').split(/[\/\\]/).pop().replace(/[?#%]/g, '_');
    return b + 'jf/file/' + j.id + '/' + encodeURIComponent(nome) + '?ms=' + j.ms + '&a=' + (x.audio || 0);
  }
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
    chiediJf(evento === 'inizio' ? 'Sessions/Playing' : evento === 'fine' ? 'Sessions/Playing/Stopped' : 'Sessions/Playing/Progress', null, corpo).then(null, function () {});
  }
  // la home mostra anche i film di Jellyfin in Continua a guardare (la scheda li riapre qui, con l'ancora #/jf/<id>)
  function puntoJf(x, t, d, fine, chiuso) {
    riportaJf(fine || chiuso ? 'fine' : 'avanti', fine ? d : t);
    if (x.jf.trailer) return;
    var s = JF.scheda(x.jf.it), puntata = s.tipo === 'puntata';
    chiedi('punto', null, { jf: x.jf.id, titolo: puntata && s.serie ? s.serie.titolo : s.titolo, anno: puntata ? 0 : s.anno, stagione: puntata ? s.stagione : 0,
      episodio: puntata ? s.episodio : 0, posizione: Math.round(fine ? d : t), durata: Math.round(d), guardato: Math.round(x.guardato), inPausa: v.paused,
      chiuso: !!chiuso || !!fine, app: String(location.href).split('#')[0] }).then(null, function () {});
  }
  // una conversione del server che non serve piu' (si cambia qualita' o audio, si esce): si ferma subito
  function fermaConversione(j) {
    if (!j || j.modo === 'diretto' || j.modo === 'file' || !j.sessione) return;
    chiediJf('Videos/ActiveEncodings', { PlaySessionId: j.sessione }, null, 'DELETE').then(null, function () {});
  }
  // stesso film, altra strada (audio o qualita' cambiati): dallo stesso punto, in pausa se lo era
  function ricaricaJf(opz) {
    var x = L;
    if (!x || !x.jf) return;
    var t = v.currentTime || x.daQui || 0, pausa = v.paused, vecchio = { modo: x.jf.modo, sessione: x.jf.sessione };
    riportaJf('fine', t);
    attesa(true);
    stradaJf(x, t, opz.a).then(function (info) {
      if (L !== x) return;
      fermaConversione(vecchio);
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
      '3) nel Terminale scrivi: node mac/limitatore/limitatore.js versione-tv "/Volumes/<nome della chiavetta>/' + voce.p + '" ' + tetto + ' --accanto\n' +
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
    chiedi('jf/veloce').then(function (r) {
      if (L !== x) return;
      x.jf.mbps = r.mbps;
      ricaricaJf({ testo: 'Qualità automatica: la rete fa ' + r.mbps + ' Mbps' });
    }, function () { messaggio('Non riesco a misurare la rete: resto sull\'originale', 4000); x.jf.q = 'orig'; });
  }
  // l'anteprima sopra la barra mentre si salta (le tessere di Jellyfin: un foglio alla volta, ridotto con un transform)
  function anteprimaBarra(t, f) {
    var an = $('osd-anteprima'), tp = L && L.jf ? L.jf.tp : null;
    if (t < 0 || !tp) { if (!an.hidden) an.hidden = true; return; }
    var ts = JF.tessera(tp, t), h = window.innerHeight * 0.135, sc = h / ts.h, w = Math.round(ts.w * sc), te = $('osd-tessera');
    var url = serv.base + '/api/video/g/' + serv.gettone + '/jf/p/Videos/' + L.jf.id + '/Trickplay/' + tp.larg + '/' + ts.foglio + '.jpg?MediaSourceId=' + L.jf.ms;
    if (te.getAttribute('data-u') !== url) { te.style.backgroundImage = 'url(' + url + ')'; te.setAttribute('data-u', url); }
    te.style.width = ts.W + 'px';
    te.style.height = ts.H + 'px';
    te.style.transform = 'scale(' + sc + ') translate(' + (-ts.x) + 'px,' + (-ts.y) + 'px)';
    an.style.width = w + 'px';
    an.style.marginLeft = (-Math.round(w / 2)) + 'px';
    an.style.left = 'calc(5vw + ' + Math.max(6, Math.min(84, f * 90)) + 'vw)';
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
    messaggio('Audio: ' + nomeLingua(a.lingua) + ' · ' + a.nomeCodec);
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
      return { testo: nomeLingua(a.lingua) + (a.canali ? ' ' + canali(a.canali) : ''), piccolo: a.nomeCodec + (conv ? ' · lo converte il server' : a.letto ? (a.nome ? ' · ' + a.nome : '') : ' · il TV non lo legge'),
        attiva: a.num === L.audio, spenta: !a.letto && !L.jf, fn: function () { cambiaAudio(a.num); } };
    }).concat([{ testo: 'Ritardo audio', piccolo: 'non si può col lettore del TV: si potrà dal Mac', spenta: true }]) : [{ testo: 'Nessun audio', spenta: true }] });
    if (L.jf && !L.jf.trailer) {
      var j = L.jf, g = j.g || {};
      var vociQ = QUALITA_JF.slice(), mo = g.modo || j.modo, lim = j.lim && j.lim.serve, mb = tettoMac(j);
      if (lim) vociQ.splice(1, 0, { id: 'nolim', nome: 'Originale senza limitatore', piccolo: 'il file vero, coi picchi' });
      cols.push({ titolo: 'Qualità', voci: vociQ.map(function (q) {
        var nome = q.id === 'orig' && lim && !j.noLim ? 'Originale con limitatore ai picchi' : q.nome;
        return { testo: nome, piccolo: q.id === 'nolim' ? q.piccolo : q.id === 'orig' ? (j.modo === 'mac' ? 'dal Mac, sotto ' + mb + ' Mbps' : lim && !j.noLim ? 'il Mac lo prepara: picchi oltre ' + mb + ' Mbps' :
          (g.mbps ? String(g.mbps).replace('.', ',') + ' Mbps · ' : '') + (mo === 'diretto' || mo === 'file' ? 'il file vero' : mo === 'copia' ? 'video originale' : 'convertito')) :
          q.id === 'auto' && j.mbps ? 'la rete fa ' + j.mbps + ' Mbps' : q.piccolo, attiva: q.id === 'nolim' ? !!j.noLim : q.id === 'orig' ? j.q === 'orig' && !j.noLim : j.q === q.id,
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
    if (vv) r('Video', vv.nomeCodec + ' · ' + vv.largh + '×' + vv.alt + (vv.hdr ? ' · ' + (vv.hdr === 'DV' ? 'Dolby Vision (il TV usa HDR10)' : vv.hdr) : ''));
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
    clearTimeout(salto.timer);
    salto.tot = 0;
    svuota($('osd-chip'));
    $('avviso-lettore').hidden = true;
    $('osd-meta').hidden = true;
    $('osd-anteprima').hidden = true;
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
    if (x && x.jf) { fermaConversione(x.jf); jf.caricato = 0; }
    if (typeof r === 'function') { r(); return; }
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
    if (schermo === 'inizio' || schermo === 'scheda' || schermo === 'cerca' || schermo === 'collega') return tastoPagina(a);
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
    if (schermo === 'scheda') { if (sch && sch.jf) { schGiro++; sch.indietro(); } else indietroScheda(); return true; }
    if (schermo === 'libreria') { lib.giro++; if (lib.jf) lib.indietro(); else indietroLibreria(); return true; }
    if (schermo === 'cerca') { cerca.giro++; (cerca.indietro || tornaInizio)(); return true; }
    if (schermo === 'collega') { coll.giro++; clearTimeout(coll.timer); (coll.indietro || tornaInizio)(); return true; }
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
    var m = /#\/v\/([^?]*)\?(.*)$/.exec(location.hash), mj = /#\/jf\/([0-9a-f]{32})(?:\?(.*))?$/.exec(location.hash);
    prendiPermesso().then(function () {
      apriInizio();
      macCaricaStato();
      caricaTetto();
      // Jellyfin: lo stato (server, utente, i codec del TV) e le file dell'inizio; dalla home un film di Jellyfin riparte subito
      jfCaricaStato(function () {
        jfCaricaInizio(true);
        disegnaInizio('tieni');
        if (!mj) return;
        var q = {}, coppie = String(mj[2] || '').split('&');
        for (var i = 0; i < coppie.length; i++) { var kv = coppie[i].split('='); if (kv[0]) q[kv[0]] = decodeURIComponent(kv[1] || ''); }
        if (!jfAttivo()) { messaggio('Collega Jellyfin per riprendere questo film (Altro › Collega Jellyfin)', 6000); return; }
        guardaJf({ Id: mj[1], Name: '' }, { ritorno: 'esci', daCapo: q.dacapo === '1', t: q.t !== undefined && isFinite(+q.t) ? +q.t : undefined });
      });
      if (m) {
        var q = {}, coppie = m[2].split('&');
        for (var i = 0; i < coppie.length; i++) { var kv = coppie[i].split('='); q[kv[0]] = decodeURIComponent(kv[1] || ''); }
        var p = decodeURIComponent(m[1]), nome = p.split('/').pop();
        var x = { d: q.d || '', p: p, nome: nome, dim: +q.dim || 0, daCapo: q.dacapo === '1', t: q.t !== undefined && isFinite(+q.t) ? +q.t : -1 };
        // prima le chiavette: se la lettera e' cambiata, il film si cerca anche sulle altre
        chiedi('dischi').then(function (r) { dischi = r.dischi || []; riprendi(x, 'esci'); }, function () { riprendi(x, 'esci'); });
      }
    }, function (e) { dischiErrore = e; jf.stato = { server: null, utente: null, errore: e.codice }; apriInizio(); });
  });
})();
