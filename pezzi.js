/*
 * Real4K - il LETTORE A PEZZI, per Real4K dal Mac: i film che Jellyfin prepara (l'audio DTS o TrueHD convertito, le qualita'
 * piu' leggere) arrivano a pezzi fMP4 e si danno al <video> con le Media Source Extensions.
 * Perche': dalla pagina http del ponte del Mac il lettore del TV non apre l'HLS (sonda del 31/10/2026: errore 3 subito, anche
 * col master di Jellyfin), ma MSE c'e'. Cosa regge il Q80B (sonda dei pezzi, 31/10): HEVC 4K HDR10 60 fps a 70 Mbps si'; video e
 * audio insieme in un solo posto solo con l'AAC; AC3 ed E-AC3 si', ma in un posto a parte. Quindi due modi:
 *  - "insieme": un SourceBuffer per video e audio (quando il TV dice di si' al tipo intero, per esempio HEVC con AAC);
 *  - "divisi": un SourceBuffer per il video e uno per l'audio (HEVC con AC3 o E-AC3, cioe' il Dolby per la soundbar). I pezzi di
 *    Jellyfin hanno video e audio nello stesso frammento: qui si riscrivono solo le intestazioni (moof e mdat di ogni traccia) e
 *    i dati passano cosi' come arrivano, a blocchi, senza tenere in memoria il pezzo intero.
 * Come: la playlist di Jellyfin (master con CODECS, poi la lista dei pezzi con #EXT-X-MAP), prima il pezzo del punto di
 * partenza e poi il segmento iniziale (cosi' Jellyfin comincia la conversione da li'), poi un pezzo alla volta, letto a blocchi e
 * dato al <video> man mano. Poca memoria sul TV: davanti al punto al massimo 40 s e 96 MB; il TV tiene circa 90 MB di video
 * (10 s di 4K a 70 Mbps): quando dice "pieno" (QuotaExceededError) si impara quanto ci sta e si tiene il buffer il piu' pieno
 * possibile, dando i blocchi man mano che il film consuma. Dietro al punto 12 s (coi film pesanti libera il TV, che tiene il gruppo di
 * fotogrammi in corso; il lettore non taglia mai dentro il pezzo prima di quello che si guarda). I tempi dentro i pezzi sono
 * quelli veri del film (Jellyfin usa -copyts): un salto chiede il pezzo che contiene quel punto e il <video> sa dove metterlo. I
 * pezzi di una copia non MKV sono tagliati sui fotogrammi chiave e cominciano fino a un gruppo prima o dopo la playlist: restano
 * dove sono. Solo un server coi tempi lontani da quelli della playlist (oltre 12 s: un server che riparte da zero) si riconosce dal
 * primo frammento (tfdt) e si sposta (timestampOffset).
 *   Pezzi.possibile()                                    MSE c'e'
 *   var p = Pezzi.crea(video, { url, da, log, errore })  url = la playlist (master o lista), da = il secondo da cui partire.
 *                                                        Il <video> si aggancia subito: dopo si puo' chiamare video.play()
 *   p.ferma()   p.stato()                                errore(codice, testo): formato, lista, rete, accesso, append, quota
 * Solo JavaScript ES5.
 */
var Pezzi = (function () {
  'use strict';

  var AVANTI_S = 40, AVANTI_BYTE = 96 << 20, MIN_BYTE = 12 << 20, DIETRO_S = 12, BLOCCO = 2 << 20, CODA_MAX = 8 << 20;
  // le attese tra un tentativo e l'altro di un pezzo che non arriva (Jellyfin che riparte, il Wi-Fi che cade un attimo)
  var ATTESE = [1000, 2000, 4000, 8000];
  // senza un byte: il primo blocco di un pezzo puo' tardare (la conversione 4K che parte), i successivi no; le playlist poco
  var TEMPO_PRIMO = 90000, TEMPO_BLOCCO = 30000, TEMPO_LISTA = 30000, MAX_PEZZI = 50000, MAX_LISTA = 8 << 20, MAX_INIT = 4 << 20, MAX_MOOF = 4 << 20;
  // un buco tra i dati (un pezzo che comincia poco dopo il punto chiesto): si salta se e' al massimo di 4 s
  var BUCO = 4;
  // i tempi del primo pezzo lontani da quelli della playlist piu' di cosi': si sposta tutto. Meno e' il taglio sui fotogrammi chiave
  // di una copia (al massimo un gruppo, anche 10 s); per leggere il tempo bastano i primi byte del pezzo, dove c'e' il moof intero
  var SPOSTA = 12, TESTA = 256 << 10;
  var AUDIO = /^(ac-3|ec-3|mp4a|opus|flac|fLaC|alac)/;

  function possibile() {
    return !!(window.MediaSource && typeof MediaSource.isTypeSupported === 'function' && window.Uint8Array && window.URL && URL.createObjectURL);
  }
  // come dare i pezzi al <video>, da CODECS del master: { modo: 'insieme'|'divisi', tipi: [...] }, null se il TV non li legge.
  // Insieme se il TV dice di si' al tipo intero (o c'e' solo il video); se no divisi, se dice di si' al video e all'audio da soli.
  // Un Dolby Vision che il TV non dichiara si prova come HEVC (la base HDR10). dividi: divisi comunque (le prove)
  function modoMse(codecs, dividi) {
    var c = String(codecs || '').replace(/[^A-Za-z0-9.,-]/g, '');
    if (!c) return null;
    function prova(x) {
      var l = x.split(','), v = [], a = [];
      for (var i = 0; i < l.length; i++) if (l[i]) (AUDIO.test(l[i]) ? a : v).push(l[i]);
      if (v.length !== 1 || a.length > 1) return null;
      var tv = 'video/mp4; codecs="' + v[0] + '"', ta = a.length ? 'audio/mp4; codecs="' + a[0] + '"' : '', ti = 'video/mp4; codecs="' + v[0] + (a.length ? ',' + a[0] : '') + '"';
      if (!a.length) return MediaSource.isTypeSupported(tv) ? { modo: 'insieme', tipi: [tv] } : null;
      if (!dividi && MediaSource.isTypeSupported(ti)) return { modo: 'insieme', tipi: [ti] };
      return MediaSource.isTypeSupported(tv) && MediaSource.isTypeSupported(ta) ? { modo: 'divisi', tipi: [tv, ta] } : null;
    }
    var m = prova(c);
    if (m) return m;
    var hevc = c.replace(/\bdv(h1|he)\.[0-9.]+/g, 'hvc1.2.4.L153.B0');
    return hevc !== c ? prova(hevc) : null;
  }

  /* ---------------------------------------------------------- le playlist */

  function risolvi(u, base) { try { return new URL(u, base).href; } catch (e) { return ''; } }
  // gli attributi di una riga #EXT-X-...: NOME=valore, i valori tra virgolette possono avere virgole
  function attributi(s) {
    var o = {}, re = /([A-Z0-9-]+)=("[^"]*"|[^,]*)/g, m;
    while ((m = re.exec(s))) o[m[1]] = m[2].charAt(0) === '"' ? m[2].slice(1, -1) : m[2];
    return o;
  }
  // il master: la prima variante (il ponte lascia solo quella: con l'HDR e' quella col video copiato). null se non e' un master
  function leggiMaster(testo, base) {
    var r = String(testo).split(/\r?\n/), att = null;
    for (var i = 0; i < r.length; i++) {
      var x = r[i].replace(/^\s+|\s+$/g, '');
      if (/^#EXT-X-STREAM-INF:/.test(x)) att = attributi(x.slice(18));
      else if (att && x && x.charAt(0) !== '#') {
        var u = risolvi(x, base);
        return u ? { url: u, codecs: att.CODECS || '', gamma: att['VIDEO-RANGE'] || '' } : null;
      }
    }
    return null;
  }
  // la lista dei pezzi: il segmento iniziale (#EXT-X-MAP) e i pezzi con inizio e durata (da #EXTINF). null se non va
  function leggiLista(testo, base) {
    var r = String(testo).split(/\r?\n/), init = '', pezzi = [], dur = -1, t = 0, fine = false, m;
    for (var i = 0; i < r.length; i++) {
      var x = r[i].replace(/^\s+|\s+$/g, '');
      if ((m = /^#EXT-X-MAP:(.*)$/.exec(x))) init = risolvi(attributi(m[1]).URI || '', base);
      else if ((m = /^#EXTINF:\s*([0-9]+(?:\.[0-9]+)?)/.exec(x))) dur = +m[1];
      else if (/^#EXT-X-ENDLIST\b/.test(x)) fine = true;
      else if (x && x.charAt(0) !== '#' && dur >= 0) {
        var u = risolvi(x, base);
        if (!u || pezzi.length >= MAX_PEZZI) return null;
        pezzi.push({ url: u, inizio: t, durata: dur });
        t += dur;
        dur = -1;
      }
    }
    return init && pezzi.length && t > 0 ? { init: init, pezzi: pezzi, durata: t, fine: fine } : null;
  }

  /* ---------------------------------------------------------- le scatole MP4 (solo quel poco che serve) */

  function u32(b, i) { return b[i] * 16777216 + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]; }
  function s32(b, i) { var x = u32(b, i); return x >= 2147483648 ? x - 4294967296 : x; }
  function scriviU32(b, i, x) { b[i] = (x >>> 24) & 255; b[i + 1] = (x >>> 16) & 255; b[i + 2] = (x >>> 8) & 255; b[i + 3] = x & 255; }
  function nome4(b, i) { return String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]); }
  // le scatole intere tra a e z: cb(tipo, inizio dei dati, fine, inizio della scatola); se cb risponde false ci si ferma. Una
  // scatola tagliata (i dati non sono ancora arrivati tutti) ferma la lettura
  function scatole(b, a, z, cb) {
    while (a + 8 <= z) {
      var n = u32(b, a), h = 8;
      if (n === 1) { if (a + 16 > z) return; n = u32(b, a + 8) * 4294967296 + u32(b, a + 12); h = 16; }
      else if (n === 0) n = z - a;
      if (n < h || a + n > z) return;
      if (cb(nome4(b, a + 4), a + h, a + n, a) === false) return;
      a += n;
    }
  }
  function unisci(l, n) {
    if (n === undefined) { n = 0; for (var j = 0; j < l.length; j++) n += l[j].length; }
    var b = new Uint8Array(n), k = 0;
    for (var i = 0; i < l.length; i++) { b.set(l[i], k); k += l[i].length; }
    return b;
  }
  // una scatola nuova: tipo e figli (Uint8Array)
  function scatola(tipo, parti) {
    var n = 8;
    for (var i = 0; i < parti.length; i++) n += parti[i].length;
    var b = new Uint8Array(n);
    scriviU32(b, 0, n);
    for (var j = 0; j < 4; j++) b[4 + j] = tipo.charCodeAt(j);
    var k = 8;
    for (i = 0; i < parti.length; i++) { b.set(parti[i], k); k += parti[i].length; }
    return b;
  }
  // il segmento iniziale: le tracce (id, scala del tempo, video o audio, misura predefinita dei campioni) e, per ognuna, un
  // segmento iniziale con solo lei (per i due posti del modo "divisi")
  function leggiInit(b) {
    var tracce = [], ftyp = null, mvhd = null, trex = {}, mehd = null, trak = [];
    scatole(b, 0, b.length, function (t, a, z, a0) {
      if (t === 'ftyp') ftyp = b.subarray(a0, z);
      if (t !== 'moov') return true;
      scatole(b, a, z, function (t2, a2, z2, a20) {
        if (t2 === 'mvhd') mvhd = b.subarray(a20, z2);
        if (t2 === 'mvex') {
          scatole(b, a2, z2, function (t3, a3, z3, a30) {
            if (t3 === 'mehd') mehd = b.subarray(a30, z3);
            if (t3 === 'trex' && z3 - a3 >= 24) trex[u32(b, a3 + 4)] = { b: b.subarray(a30, z3), misura: u32(b, a3 + 16) };
            return true;
          });
        }
        if (t2 !== 'trak') return true;
        var tr = { id: 0, scala: 0, video: false, audio: false };
        scatole(b, a2, z2, function (t3, a3, z3) {
          if (t3 === 'tkhd' && z3 - a3 >= 24) tr.id = u32(b, a3 + (b[a3] === 1 ? 20 : 12));
          if (t3 === 'mdia') {
            scatole(b, a3, z3, function (t4, a4, z4) {
              if (t4 === 'mdhd' && z4 - a4 >= 24) tr.scala = u32(b, a4 + (b[a4] === 1 ? 20 : 12));
              if (t4 === 'hdlr' && z4 - a4 >= 12) { tr.video = nome4(b, a4 + 8) === 'vide'; tr.audio = nome4(b, a4 + 8) === 'soun'; }
              return true;
            });
          }
          return true;
        });
        tracce.push(tr);
        trak.push(b.subarray(a20, z2));
        return true;
      });
      return false;
    });
    for (var i = 0; i < tracce.length; i++) {
      var tr = tracce[i], x = trex[tr.id];
      tr.misura = x ? x.misura : 0;
      if (ftyp && mvhd && x) tr.init = unisci([ftyp, scatola('moov', [mvhd, trak[i], scatola('mvex', mehd ? [mehd, x.b] : [x.b])])]);
    }
    return tracce;
  }
  // un Dolby Vision 8.1 ha sotto un HEVC HDR10 normale: se il TV non dichiara il Dolby Vision (il Q80B, sonda dei pezzi del 31/10),
  // nel segmento iniziale le voci dvh1 e dvhe diventano hvc1 e hev1 (4 byte; i dati restano quelli). Torna quante ne ha cambiate
  function senzaDolbyVision(b) {
    var n = 0;
    function dentro(a, z) {
      scatole(b, a, z, function (t, a1, z1) {
        if (/^(moov|trak|mdia|minf|stbl)$/.test(t)) dentro(a1, z1);
        if (t === 'stsd' && z1 - a1 >= 8) {
          scatole(b, a1 + 8, z1, function (t2, a2, z2, a20) {
            if (t2 === 'dvh1' || t2 === 'dvhe') {
              var nuovo = t2 === 'dvh1' ? 'hvc1' : 'hev1';
              for (var i = 0; i < 4; i++) b[a20 + 4 + i] = nuovo.charCodeAt(i);
              n++;
            }
            return true;
          });
        }
        return true;
      });
    }
    dentro(0, b.length);
    return n;
  }
  // il tempo (secondi) del primo frammento che comincia in b: quello del video se c'e'. -1 = non si legge (ancora)
  function tempoFrammento(b, tracce) {
    var out = -1, video = false;
    scatole(b, 0, b.length, function (t, a, z) {
      if (t !== 'moof') return true;
      scatole(b, a, z, function (t2, a2, z2) {
        if (t2 !== 'traf') return true;
        var id = 0, dt = -1;
        scatole(b, a2, z2, function (t3, a3, z3) {
          if (t3 === 'tfhd' && z3 - a3 >= 8) id = u32(b, a3 + 4);
          if (t3 === 'tfdt' && z3 - a3 >= 8) dt = b[a3] === 1 ? (z3 - a3 >= 12 ? u32(b, a3 + 4) * 4294967296 + u32(b, a3 + 8) : -1) : u32(b, a3 + 4);
          return true;
        });
        for (var i = 0; i < tracce.length; i++) {
          var tr = tracce[i];
          if (tr.id === id && tr.scala > 0 && dt >= 0 && (out < 0 || (tr.video && !video))) { out = dt / tr.scala; video = tr.video; }
        }
        return true;
      });
      return false;
    });
    return out;
  }
  // un moof di Jellyfin con piu' tracce -> per ogni traccia un moof con solo lei, e dove stanno i suoi dati (rispetto all'inizio
  // del moof). { tracce: [{ id, moof (con data_offset da completare), offs: [posizioni dei data_offset nel moof nuovo], pezzi: [{ da,
  // n }] }] }, null se non si sa leggere
  function dividiMoof(b, tracce) {
    // (fineDati: dove finiscono i dati del traf di prima, dall'inizio del moof: e' la base di un traf senza base scritta ne' "dal
    // moof", tranne il primo, che parte dal moof)
    var mfhd = null, out = [], rotto = false, fineDati = 0;
    scatole(b, 8, b.length, function (t, a, z, a0) {
      if (t === 'mfhd') mfhd = b.subarray(a0, z);
      if (t !== 'traf') return true;
      var figli = [], id = 0, base = 0, misura = 0, pezzi = [], tfhd = null, dalMoof = 0;
      scatole(b, a, z, function (t2, a2, z2, a20) {
        if (t2 === 'tfhd') {
          var fl = u32(b, a2) & 0xffffff, k = a2 + 8;
          id = u32(b, a2 + 4);
          // (una base scritta per esteso: si toglie e si dice "dal moof", che col moof nuovo e' giusto)
          if (fl & 1) { base = u32(b, k) * 4294967296 + u32(b, k + 4); k += 8; }
          if (fl & 2) k += 4;
          if (fl & 8) k += 4;
          if (fl & 16) misura = u32(b, k);
          var x = b.subarray(a20, z2);
          if (fl & 1) {
            var nuovo = new Uint8Array(x.length - 8);
            nuovo.set(x.subarray(0, 16), 0);
            nuovo.set(x.subarray(24), 16);
            scriviU32(nuovo, 0, nuovo.length);
            scriviU32(nuovo, 8, ((fl & ~1) | 0x020000) | (b[a2] << 24));
            x = nuovo;
          } else {
            base = -1;
            dalMoof = (fl & 0x020000) || !out.length ? 0 : fineDati;
          }
          tfhd = x;
          figli.push(x);
          return true;
        }
        if (t2 === 'trun') {
          var f = u32(b, a2) & 0xffffff, n = u32(b, a2 + 4), q = a2 + 8, off = 0;
          if (!(f & 1)) { rotto = true; return false; }
          off = s32(b, q);
          q += 4;
          if (f & 4) q += 4;
          var tot = 0, passo = ((f & 0x100) ? 4 : 0) + ((f & 0x200) ? 4 : 0) + ((f & 0x400) ? 4 : 0) + ((f & 0x800) ? 4 : 0);
          if (f & 0x200) {
            var ks = q + ((f & 0x100) ? 4 : 0);
            for (var i = 0; i < n; i++) tot += u32(b, ks + i * passo);
          } else {
            var tr0 = null;
            for (var j = 0; j < tracce.length; j++) if (tracce[j].id === id) tr0 = tracce[j];
            var m = misura || (tr0 && tr0.misura) || 0;
            if (!m && n) { rotto = true; return false; }
            tot = m * n;
          }
          var da = (base >= 0 ? base : dalMoof) + off;
          pezzi.push({ da: da, n: tot, assoluto: base >= 0 });
          if (base < 0) fineDati = da + tot;
          figli.push(b.subarray(a20, z2));
          return true;
        }
        figli.push(b.subarray(a20, z2));
        return true;
      });
      if (rotto || !tfhd) { rotto = true; return false; }
      out.push({ id: id, figli: figli, pezzi: pezzi });
      return true;
    });
    if (rotto || !mfhd || !out.length) return null;
    // il moof nuovo di ogni traccia: mfhd + traf (coi suoi figli); i data_offset dei trun puntano ai suoi dati, messi di seguito
    // in un mdat che viene subito dopo
    for (var i = 0; i < out.length; i++) {
      var x = out[i], traf = scatola('traf', x.figli), moof = scatola('moof', [mfhd, traf]), dove = 8 + mfhd.length + 8, d = 0;
      // (posizione dei trun nel moof nuovo: si ricalcola scorrendo i figli)
      var k = dove, idxTrun = 0;
      for (var j = 0; j < x.figli.length; j++) {
        if (nome4(x.figli[j], 4) === 'trun') { scriviU32(moof, k + 16, moof.length + 8 + d); d += x.pezzi[idxTrun++].n; }
        k += x.figli[j].length;
      }
      x.moof = moof;
      x.dati = d;
    }
    return out;
  }
  function testoDi(b) {
    if (window.TextDecoder) { try { return new TextDecoder('utf-8').decode(b); } catch (e) {} }
    var s = '';
    for (var i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, Math.min(b.length, i + 8192)));
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }
  // il divisore di un pezzo, a flusso: le scatole del pezzo arrivano a blocchi; i moof (piccoli) si leggono interi e si dividono,
  // i dati dei mdat si mandano a ogni traccia man mano (con davanti il suo moof e l'intestazione del suo mdat). emetti(id, byte)
  function divisore(tracce, emetti) {
    var h = new Uint8Array(16), hn = 0, stato = 'testa', resta = 0, moof = null, mpos = 0, pos = 0, ass = 0, moofInizio = 0;
    var pezziMoof = null, partiti = {}, rotto = '';
    // (ass: i byte del pezzo gia' letti prima di questo blocco; la scatola comincia lun byte prima della fine della sua testa)
    function testa(b, i) {
      var i0 = i;
      while (i < b.length && hn < 8) h[hn++] = b[i++];
      if (hn < 8) return i;
      var dim = u32(h, 0), lun = 8;
      if (dim === 1) {
        while (i < b.length && hn < 16) h[hn++] = b[i++];
        if (hn < 16) return i;
        dim = u32(h, 8) * 4294967296 + u32(h, 12);
        lun = 16;
      }
      var tipo = nome4(h, 4), inizio = ass + (i - i0) - lun;
      hn = 0;
      if (tipo === 'moof') {
        if (dim > MAX_MOOF || dim < lun) { rotto = 'moof'; return b.length; }
        moof = new Uint8Array(dim);
        moof.set(h.subarray(0, lun), 0);
        mpos = lun;
        moofInizio = inizio;
        stato = 'moof';
      } else if (tipo === 'mdat') {
        stato = 'mdat';
        resta = dim === 0 ? Infinity : dim - lun;
        pos = inizio + lun;
        partiti = {};
      } else {
        stato = 'salta';
        resta = dim === 0 ? Infinity : dim - lun;
      }
      return i;
    }
    function avanti(b) {
      var i = 0;
      while (i < b.length && !rotto) {
        var prima = i;
        if (stato === 'testa') { i = testa(b, i); ass += i - prima; continue; }
        if (stato === 'moof') {
          var k = Math.min(moof.length - mpos, b.length - i);
          moof.set(b.subarray(i, i + k), mpos);
          mpos += k;
          i += k;
          ass += k;
          if (mpos === moof.length) {
            pezziMoof = dividiMoof(moof, tracce);
            if (!pezziMoof) { rotto = 'traf'; return; }
            stato = 'testa';
          }
          continue;
        }
        var q = Math.min(resta, b.length - i), dati = b.subarray(i, i + q);
        if (stato === 'mdat' && pezziMoof) {
          // i pezzi di ogni traccia che cadono in questo blocco [pos, pos + q) (posizioni dall'inizio del pezzo scaricato)
          for (var t = 0; t < pezziMoof.length; t++) {
            var x = pezziMoof[t];
            for (var p = 0; p < x.pezzi.length; p++) {
              var da = x.pezzi[p].assoluto ? x.pezzi[p].da : moofInizio + x.pezzi[p].da, a = da + x.pezzi[p].n;
              var s = Math.max(da, pos), e = Math.min(a, pos + q);
              if (e <= s) continue;
              if (!partiti[x.id]) {
                partiti[x.id] = true;
                var hm = new Uint8Array(8);
                scriviU32(hm, 0, x.dati + 8);
                hm[4] = 109; hm[5] = 100; hm[6] = 97; hm[7] = 116;
                emetti(x.id, unisci([x.moof, hm]));
              }
              emetti(x.id, dati.subarray(s - pos, e - pos));
            }
          }
        }
        pos += q;
        resta -= q;
        i += q;
        ass += q;
        // (i dati di un moof finiscono col suo mdat: un'altra scatola in mezzo, free o prft, non li chiude)
        if (resta === 0) { if (stato === 'mdat') pezziMoof = null; stato = 'testa'; }
      }
    }
    return { avanti: avanti, rotto: function () { return rotto; } };
  }
  // i confini delle scatole di un pezzo che arriva a blocchi (solo le intestazioni, nessuna copia). intero(): il pezzo e' finito a
  // scatola chiusa (uno tagliato a meta' di un mdat il <video> lo aspetterebbe, prendendo per suoi i byte del pezzo dopo)
  function confini() {
    var h = new Uint8Array(16), hn = 0, resta = 0;
    function avanti(b) {
      var i = 0;
      while (i < b.length) {
        if (resta > 0) { var q = Math.min(resta, b.length - i); resta -= q; i += q; continue; }
        h[hn++] = b[i++];
        if (hn < 8) continue;
        var n = u32(h, 0);
        if (n === 1) {
          if (hn < 16) continue;
          resta = u32(h, 8) * 4294967296 + u32(h, 12) - 16;
        } else resta = n === 0 ? Infinity : n - 8;
        hn = 0;
        if (!(resta >= 0)) resta = 0;
      }
    }
    return { avanti: avanti, intero: function () { return hn === 0 && (resta === 0 || resta === Infinity); } };
  }

  /* ---------------------------------------------------------- le domande: fetch a blocchi (o XHR intera, come riserva) */

  // apri(url, cb, primo): cb.blocco(Uint8Array) -> false per fermarsi finche' non si chiama riprendi(); cb.fine(); cb.errore(stato,
  // 0 = rete o tempo). primo = quanto aspettare il primo byte. Torna { chiudi(), riprendi() }
  function apri(url, cb, primo) {
    var finito = false, timer = null, scade = 0, quando = 0, rd = null, ctl = null, xhr = null, attende = false;
    // il tempo massimo senza un byte: un solo timer, che quando scatta guarda se nel frattempo e' arrivato qualcosa (un timer nuovo
    // per ogni blocco, 150 al secondo col 4K, sul TV peserebbe)
    function tempo(ms) {
      scade = Date.now() + ms;
      if (timer && quando <= scade) return;
      clearTimeout(timer);
      quando = scade;
      timer = setTimeout(scaduto, ms);
    }
    function scaduto() {
      timer = null;
      // (fermi apposta, finche' il <video> non ha preso i blocchi in coda: niente tempo massimo)
      if (finito || attende) return;
      var resta = scade - Date.now();
      if (resta > 0) { quando = scade; timer = setTimeout(scaduto, resta); return; }
      chiudi();
      cb.errore(0);
    }
    function chiudi() {
      if (finito) return;
      finito = true;
      clearTimeout(timer);
      timer = null;
      try { if (ctl) ctl.abort(); } catch (e) {}
      try { if (rd) rd.cancel(); } catch (e) {}
      try { if (xhr) xhr.abort(); } catch (e) {}
    }
    function rotta() { if (!finito) { chiudi(); cb.errore(0); } }
    function letto(r) {
      if (finito) return;
      if (r.done) { finito = true; clearTimeout(timer); timer = null; cb.fine(); return; }
      if (r.value && r.value.length && cb.blocco(r.value) === false) { if (!finito) attende = true; return; }
      if (!finito) { tempo(TEMPO_BLOCCO); rd.read().then(letto, rotta); }
    }
    tempo(primo || TEMPO_PRIMO);
    if (window.fetch && window.AbortController && window.ReadableStream) {
      ctl = new AbortController();
      fetch(url, { signal: ctl.signal, cache: 'no-store', credentials: 'same-origin' }).then(function (r) {
        if (finito) return;
        if (r.status !== 200) { chiudi(); cb.errore(r.status); return; }
        if (!r.body || !r.body.getReader) {
          r.arrayBuffer().then(function (ab) { if (!finito) { finito = true; clearTimeout(timer); timer = null; cb.blocco(new Uint8Array(ab)); cb.fine(); } }, rotta);
          return;
        }
        rd = r.body.getReader();
        tempo(TEMPO_BLOCCO);
        rd.read().then(letto, rotta);
      }, rotta);
    } else {
      xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function () { if (!finito) tempo(TEMPO_BLOCCO); };
      xhr.onload = function () {
        if (finito) return;
        if (xhr.status !== 200) { chiudi(); cb.errore(xhr.status); return; }
        finito = true;
        clearTimeout(timer);
        timer = null;
        cb.blocco(new Uint8Array(xhr.response));
        cb.fine();
      };
      xhr.onerror = rotta;
      xhr.send();
    }
    return { chiudi: chiudi, riprendi: function () { if (attende && !finito && rd) { attende = false; tempo(TEMPO_BLOCCO); rd.read().then(letto, rotta); } } };
  }
  // un file intero e piccolo (playlist, segmento iniziale): cb(Uint8Array) o cb(null, stato). I pezzi letti si lasciano andare
  // appena uniti (la playlist di un film di 3 ore sono 3 MB)
  function tutto(url, max, cb) {
    var parti = [], n = 0, rotto = false;
    var d = apri(url, {
      blocco: function (b) { n += b.length; if (n > max) { rotto = true; parti = null; d.chiudi(); cb(null, 413); return false; } parti.push(b); return true; },
      fine: function () { if (rotto) return; var b = unisci(parti, n); parti = null; cb(b); },
      errore: function (st) { parti = null; if (!rotto) cb(null, st); }
    }, TEMPO_LISTA);
    return d;
  }

  /* ---------------------------------------------------------- il lettore */

  function crea(video, o) {
    o = o || {};
    var log = typeof o.log === 'function' ? o.log : function () {};
    // (un indirizzo relativo vale accanto alla pagina: le playlist dentro si risolvono su quello intero)
    var url0 = risolvi(String(o.url || ''), window.location ? location.href : undefined) || String(o.url || ''), da0 = o.da > 0 ? o.da : 0;
    var st = { pezzi: 0, durata: 0, prossimo: 0, scaricati: 0, aggiunti: 0, secondi: 0, quota: 0, riprove: 0, buchi: 0, salti: 0, offset: 0,
      maxByte: AVANTI_BYTE, fine: false, errore: '', tipo: '', modo: '', ritardo: 0 };
    var lista = null, init = null, tracce = [], ms = null, aperta = false, pronto = false, fermo = false, timer = null, giri = 0, giunto = false;
    // le corsie verso il <video>: una (insieme) o due (divisi: video e audio). { tipo, traccia, sb, init, coda, byte, agg, azzera,
    // offset (da dare), togliDa (dati vecchi da togliere prima dei nuovi) }
    var corsie = [], modo = null, inVolo = null, sospeso = null, codaByte = 0, initDato = false, fineDetta = false, primo = false, initChiesto = false;
    var completi = {}, controlla = true, quotaDa = 0, quotaFerma = false, quotaTimer = null, ultimo = Date.now(), ultimaVeglia = 0, domande = [];

    function errore(c, t) {
      if (fermo) return;
      st.errore = c;
      log('pezzi: ' + c + (t ? ' (' + t + ')' : ''));
      ferma();
      if (typeof o.errore === 'function') o.errore(c, t || '');
    }
    function indice(t) {
      var l = lista.pezzi, a = 0, z = l.length - 1;
      if (!(t > 0)) return 0;
      while (a < z) { var m = (a + z + 1) >> 1; if (l[m].inizio <= t + 0.001) a = m; else z = m - 1; }
      return a;
    }
    // i dati attorno al punto t: { a, z } del tratto che lo contiene, o null (video.buffered: con due corsie e' dove ci sono tutte e due)
    function intorno(t) {
      var b = video.buffered;
      for (var i = 0; i < b.length; i++) if (b.start(i) <= t + 0.05 && b.end(i) > t) return { a: b.start(i), z: b.end(i) };
      return null;
    }
    function inizioDopo(t) {
      var b = video.buffered, s = -1;
      for (var i = 0; i < b.length; i++) if (b.start(i) > t && (s < 0 || b.start(i) < s)) s = b.start(i);
      return s;
    }
    // il pezzo k e' gia' nel <video>? (dati da poco dopo il suo inizio a poco prima della sua fine)
    function presente(k) {
      var p = lista.pezzi[k], b = video.buffered, a = p.inizio + 0.25, z = p.inizio + p.durata - (k === lista.pezzi.length - 1 ? 0.6 : 0.25);
      if (z < a) z = a;
      for (var i = 0; i < b.length; i++) if (b.start(i) <= a && b.end(i) >= z) return true;
      return false;
    }
    function fatto(k) { return (completi[k] || 0) >= corsie.length && presente(k); }
    // byte al secondo del film (dai pezzi gia' arrivati), per stimare quanto pesa quello che c'e' davanti
    function peso() { return st.secondi > 0 ? st.aggiunti / st.secondi : 0; }
    function occupate() { for (var i = 0; i < corsie.length; i++) if (!corsie[i].sb || corsie[i].sb.updating) return true; return false; }
    function inCoda() { for (var i = 0; i < corsie.length; i++) if (corsie[i].coda.length || corsie[i].agg) return true; return false; }
    // il punto del film: quello del <video>, ma prima che ci arrivi (alPunto) quello chiesto. Sul TV, tolta la sorgente, il <video>
    // tiene il punto del film di prima fino ai metadati nuovi (sonda dei pezzi, 31/10)
    function punto() { return giunto ? video.currentTime : da0; }
    // dove cominciano i dati, in tutte le corsie: con due corsie video.buffered e' solo dove ci sono tutte e due, e l'audio rimasto
    // dietro quando il video vecchio l'ha tolto il TV non si vedrebbe. -1 se non c'e' niente
    function primoDato() {
      var s = -1;
      for (var i = 0; i < corsie.length; i++) {
        var b = null;
        try { b = corsie[i].sb ? corsie[i].sb.buffered : null; } catch (e) {}
        if (b && b.length && (s < 0 || b.start(0) < s)) s = b.start(0);
      }
      return s;
    }
    // un pezzo da a a z ancora in arrivo: si scarica, aspetta il segmento iniziale o e' in coda per il <video>
    function inArrivo(a, z) {
      for (var k = a; k <= z; k++) {
        if ((inVolo && inVolo.k === k) || (sospeso && sospeso.k === k)) return true;
        for (var j = 0; j < corsie.length; j++) {
          var c = corsie[j];
          if (c.agg && c.agg.k === k) return true;
          for (var i = 0; i < c.coda.length; i++) if (c.coda[i].k === k) return true;
        }
      }
      return false;
    }

    /* le aggiunte al <video>, corsia per corsia */
    function aggiungi(c, b, k, fine) {
      // (un'aggiunta riapre una sorgente finita, anche quando il TV dice pieno: la fine si dira' di nuovo)
      fineDetta = false;
      st.fine = false;
      try {
        c.sb.appendBuffer(b);
        c.agg = { n: b.length, k: k, fine: fine };
      } catch (e) {
        if (e && e.name === 'QuotaExceededError') { pieno(c, b, k, fine); return; }
        errore('append', e && e.name);
      }
    }
    function appendi() {
      if (fermo || quotaFerma || !init || ms.readyState === 'closed') return;
      // (tutte le corsie, anche se una e' piena: l'audio deve arrivare fin dove c'e' il video, se no il film non consuma)
      for (var i = 0; i < corsie.length && !fermo; i++) {
        var c = corsie[i];
        if (!c.sb || c.sb.updating || c.agg || !c.init) continue;
        // dopo un salto lontano coi film pesanti: prima via i dati vecchi davanti al punto, che tengono il posto dei nuovi
        if (c.togliDa >= 0) {
          var bb = c.sb.buffered, da = c.togliDa, fz = bb.length ? bb.end(bb.length - 1) : 0;
          c.togliDa = -1;
          if (fz > da + 0.1 && togliCorsia(c, da, fz)) continue;
        }
        // pezzi a meta' (un salto, un pezzo da rifare): il lettore ricomincia dal segmento iniziale, da una scatola intera
        if (c.azzera) {
          c.azzera = false;
          try { if (ms.readyState === 'open') c.sb.abort(); } catch (e) {}
          aggiungi(c, c.init, -1, true);
          continue;
        }
        // lo spostamento dei tempi si da' a scatola chiusa (dopo il segmento iniziale, o a pezzo finito). Se il <video> non lo prende
        // (un pezzo lasciato a meta'), si ricomincia dal segmento iniziale, una volta
        if (c.offset !== null) {
          try { c.sb.timestampOffset = c.offset; c.offset = null; }
          catch (e) {
            if (!c.offsetNo) { c.offsetNo = true; c.azzera = true; continue; }
            log('pezzi: lo spostamento dei tempi non entra (' + (e && e.name) + ')');
            c.offset = null;
          }
        }
        if (!c.coda.length) continue;
        var l = [], n = 0, k = c.coda[0].k, fine = false;
        while (c.coda.length && c.coda[0].k === k && (n === 0 || n + c.coda[0].b.length <= BLOCCO)) { var x = c.coda.shift(); l.push(x.b); n += x.b.length; fine = x.fine; }
        c.byte -= n;
        codaByte -= n;
        aggiungi(c, l.length === 1 ? l[0] : unisci(l, n), k, fine);
      }
      if (inVolo && inVolo.attende && codaByte + inVolo.partiN < CODA_MAX / 2) { inVolo.attende = false; inVolo.d.riprendi(); }
    }
    // (ogni updateend di una corsia: un'aggiunta finita, o una pulizia)
    function aggiunto(c) {
      var x = c.agg;
      c.agg = null;
      if (fermo) return;
      if (x) {
        quotaDa = 0;
        ultimo = Date.now();
        if (x.k < 0) c.initFatto = true;
        else {
          st.aggiunti += x.n;
          if (x.fine) completi[x.k] = (completi[x.k] || 0) + 1;
        }
      }
      // il primo segmento iniziale entrato in tutte le corsie: i pezzi possono continuare (la durata la mette pompa)
      if (!initDato && corsie.length && corsie.every(function (z) { return z.initFatto; })) initDato = true;
      pompa();
    }
    // la durata del film (dalla playlist), una volta: si puo' scrivere solo con tutte le corsie ferme (se no il <video> crede il
    // film lungo quanto i dati arrivati, e un salto piu' avanti si fermerebbe li')
    function durata() {
      if (st.durataMessa || !corsie.length || occupate() || ms.readyState !== 'open') return;
      try { if (lista.durata > 0) ms.duration = lista.durata; st.durataMessa = true; } catch (e) {}
    }
    // il TV dice che non c'e' piu' posto in una corsia: via i dati dietro, o quelli vecchi staccati lontano davanti; se non c'e'
    // niente da togliere si impara quanto ci sta e si riprova tra mezzo secondo (2 in pausa), man mano che il film consuma. In
    // pausa, o con dati davanti da guardare, si aspetta e basta; col film che va e niente davanti per 45 s di fila: errore
    function pieno(c, b, k, fine) {
      if (k < 0) c.azzera = true;
      else { c.coda.unshift({ b: b, k: k, fine: fine }); c.byte += b.length; codaByte += b.length; }
      st.quota++;
      var t = punto(), z = intorno(t), davanti = z ? z.z - t : 0;
      if (!quotaDa || video.paused || davanti > 1) quotaDa = Date.now();
      else if (Date.now() - quotaDa > 45000) { errore('quota'); return; }
      var inizio = primoDato(), dietro = taglio(t, 2), buf = video.buffered, ul = buf.length - 1;
      if (inizio >= 0 && dietro - inizio > 1 && togli(inizio, dietro)) return;
      // (un tratto staccato lontano davanti: dati di prima di un salto indietro, che il TV non toglie da solo)
      if (ul >= 0 && buf.start(ul) > (z ? z.z : t) + BUCO && togli(buf.start(ul), buf.end(ul))) return;
      // quanto ci sta: tutto quello che il TV tiene adesso (davanti e dietro: il Q80B ne tiene circa 8 s di 4K a 70 Mbps, sonda dei
      // pezzi del 31/10). Solo se sono almeno 4 s: subito dopo un salto i tratti sono corti e il conto non direbbe niente
      var tot = 0;
      for (var i = 0; i < buf.length; i++) tot += buf.end(i) - buf.start(i);
      if (tot >= 4 && peso() > 0) st.maxByte = Math.max(MIN_BYTE, Math.min(AVANTI_BYTE, Math.floor(tot * peso())));
      if (st.quota <= 3 || st.quota % 50 === 0) log('pezzi: TV pieno (' + st.quota + '), davanti ' + Math.round(davanti) + ' s, ci stanno circa ' + Math.round(st.maxByte / 1048576) + ' MB');
      quotaFerma = true;
      // (un timer solo: con due corsie piene ognuna ne chiederebbe uno, e i giri raddoppierebbero)
      if (!quotaTimer) quotaTimer = setTimeout(function () { quotaTimer = null; quotaFerma = false; pompa(); }, video.paused ? 2000 : 500);
    }
    // via i dati da a a z da una corsia. Su una sorgente finita togliere la riapre: la fine si dira' di nuovo
    function togliCorsia(c, a, z) {
      if (ms.readyState === 'ended') { fineDetta = false; st.fine = false; }
      try { c.sb.remove(a, z); return true; } catch (e) { return false; }
    }
    function togli(a, z) {
      if (!(z > a) || ms.readyState === 'closed' || occupate()) return false;
      for (var i = 0; i < corsie.length; i++) if (!togliCorsia(corsie[i], a, z)) return false;
      // i pezzi toccati non sono piu' completi
      for (var k = indice(a), k1 = indice(z); k <= k1; k++) {
        var p = lista.pezzi[k];
        if (completi[k] !== undefined && p.inizio < z && p.inizio + p.durata > a) delete completi[k];
      }
      return true;
    }
    // fin dove si possono togliere i dati dietro al punto t, tenendone almeno s secondi: mai oltre l'inizio del pezzo prima di quello
    // che contiene t. Tagliando dentro il gruppo di fotogrammi che si sta guardando, MSE toglierebbe anche i fotogrammi che ne
    // dipendono, fino al chiave dopo, e il film si fermerebbe; i pezzi di Jellyfin cominciano col chiave quando li taglia sui chiave
    // (MKV copiati, conversioni), e un pezzo intero in piu' copre anche quelli tagliati a tempo (altri contenitori)
    function taglio(t, s) { return Math.min(t - s, lista.pezzi[Math.max(0, indice(t) - 1)].inizio); }
    // dietro al punto si tengono 12 s, in tutte le corsie; coi film pesanti il posto lo libera il TV da solo quando serve (la sua
    // pulizia tiene il gruppo che si sta guardando). I dati lontani davanti (lasciati da un salto indietro) se ne vanno. A fine detta
    // niente: togliere riaprirebbe la sorgente, e altro posto non serve
    function pulisci() {
      if (fermo || occupate() || ms.readyState !== 'open') return;
      var t = punto(), b = video.buffered, fine = taglio(t, DIETRO_S), s = primoDato(), k0 = indice(fine) - 1;
      // (i pezzi ben dietro al punto non contano piu': coi film pesanti li toglie il TV da solo, e la tabella crescerebbe per tutto
      // il film)
      for (var k in completi) if (Object.prototype.hasOwnProperty.call(completi, k) && +k < k0) delete completi[k];
      if (s >= 0 && s < fine - 1) { togli(s, fine); return; }
      for (var i = 0; i < b.length; i++) if (b.start(i) > t + AVANTI_S + 30) { togli(b.start(i), b.end(i)); return; }
    }

    /* gli scaricamenti */
    function svuota() {
      for (var i = 0; i < corsie.length; i++) { if (corsie[i].coda.length || corsie[i].agg) corsie[i].azzera = true; corsie[i].coda = []; corsie[i].byte = 0; }
      codaByte = 0;
    }
    function interrompi() {
      var x = inVolo;
      inVolo = null;
      sospeso = null;
      if (x && x.d) x.d.chiudi();
      // pezzi a meta' nel lettore o in coda: il lettore ricomincia da una scatola intera
      if (x && x.dati > 0) for (var i = 0; i < corsie.length; i++) corsie[i].azzera = true;
      svuota();
    }
    function scarica(k) {
      var p = lista.pezzi[k], x = { k: k, d: null, dati: 0, parti: [], partiN: 0, finito: false, chiuso: false, attende: false, prove: 0, div: null, conf: null };
      inVolo = x;
      function guasto(stato) {
        if (inVolo !== x || fermo) return;
        if (stato === 401 || stato === 403) { errore('accesso', String(stato)); return; }
        // quello che era gia' passato di questo pezzo non vale piu': si ricomincia dal suo inizio
        if (sospeso === x) sospeso = null;
        if (x.dati > 0) { svuota(); for (var i = 0; i < corsie.length; i++) corsie[i].azzera = true; }
        if (x.prove >= ATTESE.length) { errore('rete', 'pezzo ' + k + ': ' + (stato || 'nessuna risposta')); return; }
        st.riprove++;
        log('pezzi: il pezzo ' + k + ' non arriva ' + (stato === 'tagliato' ? 'intero' : '(' + (stato || 'rete') + ')') + ', riprovo');
        setTimeout(prova, ATTESE[x.prove++]);
      }
      function prova() {
        if (inVolo !== x || fermo) return;
        x.dati = 0;
        x.parti = [];
        x.partiN = 0;
        x.attende = false;
        x.div = null;
        x.conf = confini();
        x.d = apri(p.url, {
          blocco: function (b) {
            if (inVolo !== x || fermo) return false;
            st.scaricati += b.length;
            ultimo = Date.now();
            x.dati += b.length;
            x.conf.avanti(b);
            metti(x, b, false);
            // (in coda per il <video>, o ancora qui ad aspettare il segmento iniziale: oltre 8 MB ci si ferma)
            if (codaByte + x.partiN >= CODA_MAX) { x.attende = true; return false; }
            return true;
          },
          fine: function () {
            if (inVolo !== x || fermo) return;
            // (finito a meta' di una scatola: Jellyfin che l'ha chiuso prima, la rete. Si rifa')
            if (!x.conf.intero()) { guasto('tagliato'); return; }
            inVolo = null;
            if (st.prossimo === k) st.prossimo = k + 1;
            st.secondi += p.durata;
            metti(x, null, true);
            pompa();
          },
          errore: guasto
        });
      }
      prova();
    }
    // i byte di un pezzo per le corsie: insieme, cosi' come sono; divisi, passando dal divisore
    function manda(x, b) {
      if (!b || !b.length) return;
      if (modo.modo === 'insieme') { metticoda(corsie[0], b, x.k); return; }
      if (!x.div) {
        x.div = divisore(tracce, function (id, byte) {
          for (var i = 0; i < corsie.length; i++) if (corsie[i].traccia === id) { metticoda(corsie[i], byte, x.k); return; }
        });
      }
      x.div.avanti(b);
      if (x.div.rotto()) errore('formato', 'pezzo ' + x.k + ' non si divide (' + x.div.rotto() + ')');
    }
    function metticoda(c, b, k) { c.coda.push({ b: b, k: k, fine: false }); c.byte += b.length; codaByte += b.length; }
    // un blocco arrivato (b; fine: il pezzo e' tutto arrivato). I blocchi restano qui (x.parti, senza ricopiarli) finche' non c'e' il
    // segmento iniziale (senza le sue tracce non si sa ne' dividere ne' leggere i tempi: sospeso, si riprende quando arriva) e,
    // dopo un inizio o un salto, finche' non si legge il tempo del primo frammento: se e' lontano da quello della playlist (un
    // server che riparte da zero), si sposta quello che segue
    function metti(x, b, fine) {
      // il primo pezzo e' pronto: ora il segmento iniziale (Jellyfin l'ha gia' scritto partendo da quel pezzo)
      if (!initChiesto) chiediInit();
      if (b && b.length) { x.parti.push(b); x.partiN += b.length; }
      if (fine) x.finito = true;
      if (!tracce.length || !corsie.length || (modo.modo === 'divisi' && !corsie[0].traccia)) { sospeso = x; return; }
      if (sospeso === x) sospeso = null;
      if (controlla && x.parti.length) {
        // (il moof e' all'inizio: bastano i primi byte, senza ricopiare tutto quello che e' arrivato)
        var testa = x.parti[0];
        if (testa.length < TESTA && x.parti.length > 1) {
          var l0 = [], n0 = 0;
          for (var h = 0; h < x.parti.length && n0 < TESTA; h++) { l0.push(x.parti[h]); n0 += x.parti[h].length; }
          testa = unisci(l0, n0);
        }
        var t = tempoFrammento(testa, tracce);
        if (t < 0 && !x.finito && x.partiN < TESTA) return;
        controlla = false;
        var atteso = lista.pezzi[x.k].inizio, dov = t >= 0 ? atteso - t : 0, nuovo = Math.abs(dov) > SPOSTA ? Math.round(dov * 1000) / 1000 : 0;
        if (nuovo !== st.offset) {
          log('pezzi: il pezzo ' + x.k + ' comincia a ' + Math.round(t * 10) / 10 + ' s invece di ' + Math.round(atteso * 10) / 10 + ': sposto di ' + nuovo + ' s');
          st.offset = nuovo;
          for (var i = 0; i < corsie.length; i++) { corsie[i].offset = nuovo; corsie[i].offsetNo = false; }
        }
      }
      var l = x.parti;
      x.parti = [];
      x.partiN = 0;
      for (var j = 0; j < l.length && !fermo; j++) manda(x, l[j]);
      if (fermo) return;
      if (x.finito && !x.chiuso) {
        x.chiuso = true;
        for (var q = 0; q < corsie.length; q++) {
          var c = corsie[q];
          if (c.coda.length && c.coda[c.coda.length - 1].k === x.k) c.coda[c.coda.length - 1].fine = true;
          else if (c.agg && c.agg.k === x.k) c.agg.fine = true;
          else completi[x.k] = (completi[x.k] || 0) + 1;
        }
      }
      appendi();
    }

    /* il giro: cosa dare al <video>, cosa scaricare, quando dire che il film e' tutto dentro */
    function pompa() {
      if (fermo || !lista || !modo) return;
      durata();
      appendi();
      if (inVolo) return;
      // prima del segmento iniziale solo il primo pezzo, quello del punto di partenza: chiesto per primo, Jellyfin comincia la
      // conversione proprio da li' (chiedendo prima il segmento iniziale partirebbe dall'inizio del film, e un punto a 20 s
      // aspetterebbe 20 s di conversione: misurato 2,9 s invece di 7,4 col 4K 15). Il segmento iniziale si chiede appena il
      // pezzo arriva (chiediInit)
      if (!initDato) { if (!primo) { primo = true; scarica(st.prossimo); } return; }
      // (il pezzo dopo solo quando i blocchi di quello di prima sono tutti nel <video>: se no "davanti" non li conta)
      if (occupate() || inCoda()) return;
      // i pezzi vanno in fila, saltando quelli gia' dentro; dove ripartire dopo un salto lo decide cercato. Il punto qui non sposta
      // la fila: i tempi della playlist non sempre sono quelli dei pezzi (copie non MKV tagliate sui fotogrammi chiave)
      var n = lista.pezzi.length, t = punto();
      while (st.prossimo < n && fatto(st.prossimo)) st.prossimo++;
      if (st.prossimo >= n) {
        // tutto dentro fino alla fine: il <video> deve saperlo (se no aspetta altri dati e non arriva mai a "ended"). Basta l'ultimo
        // pezzo entrato intero in tutte le corsie: le tracce possono finire prima della durata scritta nella playlist
        if (!fineDetta && (completi[n - 1] || 0) >= corsie.length && ms.readyState === 'open') {
          fineDetta = true;
          st.fine = true;
          try { ms.endOfStream(); } catch (e) { fineDetta = false; st.fine = false; }
        }
        return;
      }
      var z = intorno(t), davanti = z ? z.z - t : 0;
      if (davanti >= AVANTI_S) return;
      // (il pezzo dopo appena c'e' posto per un blocco: i suoi blocchi entrano man mano che il film consuma)
      if (davanti > 2 && davanti * peso() + BLOCCO > st.maxByte) return;
      scarica(st.prossimo);
    }
    // un salto: se il punto e' gia' dentro si continua da dove mancano i pezzi; se no via quello che si stava scaricando (a meno
    // che sia proprio il pezzo che serve) e si riparte dal pezzo che contiene il punto
    function cercato() {
      if (fermo || !lista) return;
      st.salti++;
      var t = video.currentTime, k = indice(t);
      // (prima del segmento iniziale: si cambia solo il primo pezzo, se il punto e' in un altro)
      if (!initDato) {
        if (!inArrivo(k, k)) { interrompi(); primo = false; }
        st.prossimo = k;
        pompa();
        return;
      }
      if (intorno(t)) {
        var m = k, n = lista.pezzi.length;
        while (m < n && fatto(m)) m++;
        if (inVolo && inVolo.k !== m) interrompi();
        st.prossimo = m;
      } else {
        if (!(inVolo && inVolo.k === k)) {
          interrompi();
          controlla = true;
          // coi film pesanti (il TV e' gia' stato pieno) i dati davanti al punto nuovo, lasciati da un salto indietro, tengono il posto
          // che serve ai pezzi nuovi e il TV non li toglie da solo: via, prima dei nuovi. Con quelli leggeri restano e si raccordano
          if (st.quota > 0) {
            for (var i = 0; i < corsie.length; i++) corsie[i].togliDa = t;
            for (var q in completi) if (Object.prototype.hasOwnProperty.call(completi, q) && +q >= k) delete completi[q];
          }
        }
        st.prossimo = k;
        // dati lontani dal nuovo punto (un salto indietro): via subito, cosi' c'e' posto
        pulisci();
      }
      pompa();
    }
    // ogni mezzo secondo: i buchi piccoli si saltano (un pezzo che comincia poco dopo il punto chiesto, un salto dentro un buco),
    // poi il giro. Un buco si salta solo se nessun pezzo che potrebbe riempirlo e' ancora in arrivo (se no arrivano ancora i suoi
    // dati). Il ritardo del giro (oltre il mezzo secondo) dice quanto e' occupata la pagina sul TV
    function veglia() {
      var ora = Date.now();
      if (ultimaVeglia && ora - ultimaVeglia - 500 > st.ritardo) st.ritardo = ora - ultimaVeglia - 500;
      ultimaVeglia = ora;
      if (fermo || !initDato) return;
      giri++;
      var t = punto();
      if (giunto && (video.seeking || (!video.paused && video.readyState < 3))) {
        var z = intorno(t), g = z ? z.z : t, s = -1;
        if (!z) s = inizioDopo(t);
        else if (z.z - t < 0.3) s = inizioDopo(z.z);
        if (s > t && s - t <= BUCO && !inArrivo(Math.max(0, indice(g) - 1), indice(s))) {
          st.buchi++;
          log('pezzi: buco di ' + Math.round((s - t) * 100) / 100 + ' s a ' + Math.round(t) + ' s, salto');
          try { video.currentTime = s + 0.05; } catch (e) {}
        }
      }
      if (giri % 6 === 0) pulisci();
      pompa();
    }

    // il <video> e la playlist sono pronti tutti e due: un posto per corsia, poi il primo pezzo e il segmento iniziale
    function prepara() {
      if (fermo || !aperta || !lista || corsie.length) return;
      for (var i = 0; i < modo.tipi.length; i++) {
        var c = { tipo: modo.tipi[i], traccia: 0, sb: null, init: null, coda: [], byte: 0, agg: null, azzera: true, offset: null, offsetNo: false, togliDa: -1, initFatto: false };
        try { c.sb = ms.addSourceBuffer(c.tipo); } catch (e) { errore('formato', c.tipo + ': ' + (e && e.name)); return; }
        c.sb.addEventListener('updateend', (function (cc) { return function () { aggiunto(cc); }; })(c));
        c.sb.addEventListener('error', function () { if (!fermo) errore('append', 'il TV non legge un pezzo'); });
        corsie.push(c);
      }
      // la durata subito, con le corsie ancora ferme (se non riesce, ci riprova pompa)
      try { if (lista.durata > 0) { ms.duration = lista.durata; st.durataMessa = true; } } catch (e) {}
      conInit();
      riprendiSospeso();
      pompa();
    }
    // il segmento iniziale arrivato (e il <video> pronto): per corsia il suo (divisi: uno per il video e uno per l'audio)
    function conInit() {
      if (!init || !corsie.length || corsie[0].init) return;
      if (modo.modo === 'insieme') { corsie[0].init = init; appendi(); return; }
      var v = null, a = null;
      for (var i = 0; i < tracce.length; i++) { if (tracce[i].video && !v) v = tracce[i]; else if (tracce[i].audio && !a) a = tracce[i]; }
      if (!v || !a || !v.init || !a.init) { errore('formato', 'il segmento iniziale non si divide'); return; }
      corsie[0].traccia = v.id;
      corsie[0].init = v.init;
      corsie[1].traccia = a.id;
      corsie[1].init = a.init;
      appendi();
    }
    function conLista(testo, base, codecs) {
      lista = leggiLista(testo, base);
      if (!lista) { errore('lista', 'niente segmento iniziale o pezzi'); return; }
      st.pezzi = lista.pezzi.length;
      st.durata = lista.durata;
      modo = modoMse(codecs, o.dividi === true);
      if (!modo) { errore('formato', codecs || 'codec sconosciuti'); return; }
      st.modo = modo.modo;
      st.tipo = modo.tipi.join(' + ');
      st.prossimo = indice(da0);
      // (il segmento iniziale solo col primo blocco del primo pezzo, anche se tarda: chiesto prima, Jellyfin ripartirebbe da zero)
      prepara();
      pompa();
    }
    function chiediInit() {
      if (initChiesto || fermo || !lista) return;
      initChiesto = true;
      domande.push(tutto(lista.init, MAX_INIT, function (b, stato) {
        if (fermo) return;
        if (!b) { errore(stato === 401 || stato === 403 ? 'accesso' : 'rete', 'segmento iniziale: ' + stato); return; }
        init = b;
        if (!MediaSource.isTypeSupported('video/mp4; codecs="dvh1.08.06"') && senzaDolbyVision(init)) log('pezzi: Dolby Vision dato come HEVC (la base HDR10)');
        tracce = leggiInit(init);
        conInit();
        if (fermo) return;
        riprendiSospeso();
        appendi();
      }));
    }
    // il pezzo arrivato prima del segmento iniziale (o del <video> pronto): ora si puo' dare
    function riprendiSospeso() {
      var x = sospeso;
      if (!x || fermo) return;
      metti(x, null, false);
      if (inVolo === x && x.attende && codaByte + x.partiN < CODA_MAX / 2) { x.attende = false; x.d.riprendi(); }
    }
    function avvia() {
      domande.push(tutto(url0, MAX_LISTA, function (b, stato) {
        if (fermo) return;
        if (!b) { errore(stato === 401 || stato === 403 ? 'accesso' : 'lista', 'playlist: ' + stato); return; }
        var testo = testoDi(b), m = leggiMaster(testo, url0);
        if (!m) { conLista(testo, url0, ''); return; }
        domande.push(tutto(m.url, MAX_LISTA, function (b2, s2) {
          if (fermo) return;
          if (!b2) { errore(s2 === 401 || s2 === 403 ? 'accesso' : 'lista', 'lista dei pezzi: ' + s2); return; }
          conLista(testoDi(b2), m.url, m.codecs);
        }));
      }));
    }
    function ferma() {
      if (fermo) return;
      fermo = true;
      clearInterval(timer);
      clearTimeout(quotaTimer);
      video.removeEventListener('seeking', cercato);
      video.removeEventListener('loadedmetadata', alPunto);
      domande.forEach(function (d) { d.chiudi(); });
      domande = [];
      var x = inVolo;
      inVolo = null;
      sospeso = null;
      if (x && x.d) x.d.chiudi();
      for (var i = 0; i < corsie.length; i++) { corsie[i].coda = []; corsie[i].byte = 0; }
      codaByte = 0;
      try { URL.revokeObjectURL(oggetto); } catch (e) {}
    }
    // il punto di partenza: se chi apre non ci porta il <video> (l'app lo fa da se' a loadedmetadata, quando non e' 0), ci si va
    // qui. Senza, il <video> resterebbe dov'era coi dati altrove, e la pulizia butterebbe via quello che arriva: sul TV, tolta la
    // sorgente, il <video> tiene anche il punto del film di prima (sonda dei pezzi, 31/10: un film chiesto da 60 s partito a 120)
    function alPunto() {
      video.removeEventListener('loadedmetadata', alPunto);
      giunto = true;
      if (!fermo && Math.abs(video.currentTime - da0) > 0.5) { try { video.currentTime = da0; } catch (e) {} }
    }

    ms = new MediaSource();
    var oggetto = URL.createObjectURL(ms);
    ms.addEventListener('sourceopen', function () {
      if (fermo || aperta) return;
      aperta = true;
      // (agganciata: l'indirizzo non serve piu', e tenuto terrebbe in memoria la sorgente e tutto il lettore fino alla fine della pagina)
      try { URL.revokeObjectURL(oggetto); } catch (e) {}
      prepara();
    });
    // (chiusa da sola: il <video> ha cambiato sorgente o ha avuto un errore. Ci pensa l'app)
    ms.addEventListener('sourceclose', function () { if (!fermo && corsie.length) { log('pezzi: sorgente chiusa'); ferma(); } });
    video.addEventListener('loadedmetadata', alPunto);
    video.addEventListener('seeking', cercato);
    timer = setInterval(veglia, 500);
    video.src = oggetto;
    pronto = true;
    avvia();
    return {
      ferma: ferma,
      stato: function () {
        var t = punto(), z = lista && corsie.length ? intorno(t) : null;
        return { pronto: pronto, modo: st.modo, pezzi: st.pezzi, prossimo: st.prossimo, scaricatiMB: Math.round(st.scaricati / 104857.6) / 10, quota: st.quota,
          riprove: st.riprove, buchi: st.buchi, salti: st.salti, offset: st.offset, maxMB: Math.round(st.maxByte / 1048576),
          davanti: z ? Math.round((z.z - t) * 10) / 10 : 0, codaMB: Math.round(codaByte / 104857.6) / 10, tipo: st.tipo, errore: st.errore,
          fine: st.fine, fermoDa: Date.now() - ultimo, ritardo: st.ritardo };
      }
    };
  }

  return { crea: crea, possibile: possibile,
    _interni: { leggiMaster: leggiMaster, leggiLista: leggiLista, leggiInit: leggiInit, tempoFrammento: tempoFrammento, attributi: attributi, modoMse: modoMse,
      dividiMoof: dividiMoof, divisore: divisore, senzaDolbyVision: senzaDolbyVision, confini: confini } };
})();
