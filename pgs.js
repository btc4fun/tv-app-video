/*
 * Video - SOTTOTITOLI PGS (quelli a immagini dei Blu-ray), disegnati su un <canvas> sopra il video.
 * Nel Matroska ogni blocco e' una "display set": segmenti tipo(1) lunghezza(2) dati. Palette (0x14), oggetti (0x15,
 * immagini compresse a corse), composizione (0x16: quali oggetti e dove), finestre (0x17), fine (0x80).
 * Palette e oggetti restano validi nella stessa "epoca": una composizione puo' riusarli senza ripeterli.
 *
 *   var p = PGS.crea(canvas);  p.mostra(base64)  p.pulisci()  p.azzera() (dopo un salto)
 * Solo JavaScript ES5.
 */
var PGS = (function () {
  'use strict';

  function daBase64(s) {
    var bin = atob(s), b = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    return b;
  }
  function u16(b, i) { return (b[i] << 8) | b[i + 1]; }
  // le misure scritte nel file: al massimo 4K (una tela o un'immagine enorme fermerebbe la pagina, e con lei la home)
  var MAX_L = 3840, MAX_A = 2160;
  function u24(b, i) { return (b[i] << 16) | (b[i + 1] << 8) | b[i + 2]; }
  function stringe(x) { return x < 0 ? 0 : x > 255 ? 255 : x; }

  // colori della palette: YCbCr (gamma TV) -> RGBA, coefficienti BT.709
  function colore(y, cr, cb, a) {
    var yy = 1.164 * (y - 16), r = yy + 1.793 * (cr - 128), g = yy - 0.213 * (cb - 128) - 0.533 * (cr - 128), bl = yy + 2.112 * (cb - 128);
    return [stringe(Math.round(r)), stringe(Math.round(g)), stringe(Math.round(bl)), a];
  }

  // l'immagine di un oggetto: corse di colori (RLE) -> ImageData
  function decodifica(ctx, rle, w, h, palette) {
    var img = ctx.createImageData(w, h), px = img.data, x = 0, y = 0, i = 0, n = rle.length;
    while (i < n && y < h) {
      var c = rle[i++], corsa = 1, col = c;
      if (c === 0) {
        var f = rle[i++];
        if (f === 0) { x = 0; y++; continue; } // fine della riga
        if ((f & 0xc0) === 0x00) { corsa = f & 0x3f; col = 0; }
        else if ((f & 0xc0) === 0x40) { corsa = ((f & 0x3f) << 8) | rle[i++]; col = 0; }
        else if ((f & 0xc0) === 0x80) { corsa = f & 0x3f; col = rle[i++]; }
        else { corsa = ((f & 0x3f) << 8) | rle[i++]; col = rle[i++]; }
      }
      var p = palette[col];
      if (p && p[3]) {
        for (var k = 0; k < corsa && x < w; k++, x++) {
          var o = (y * w + x) * 4;
          px[o] = p[0]; px[o + 1] = p[1]; px[o + 2] = p[2]; px[o + 3] = p[3];
        }
      } else x += corsa;
    }
    return img;
  }

  function crea(canvas) {
    var ctx = canvas.getContext('2d');
    var palette = {}, oggetti = {}, parziali = {};

    function azzera() { palette = {}; oggetti = {}; parziali = {}; pulisci(); }
    function pulisci() { ctx.clearRect(0, 0, canvas.width, canvas.height); }

    function mostra(b64) {
      var d;
      try { d = daBase64(b64); } catch (e) { return; }
      var i = 0, pcs = null;
      while (i + 3 <= d.length) {
        var tipo = d[i], lun = u16(d, i + 1), s = d.subarray ? d.subarray(i + 3, i + 3 + lun) : d.slice(i + 3, i + 3 + lun);
        i += 3 + lun;
        if (tipo === 0x16 && s.length >= 11) {
          pcs = { w: u16(s, 0), h: u16(s, 2), stato: s[7], soloPalette: s[8] === 0x80, paletteId: s[9], oggetti: [] };
          if (pcs.stato & 0x80) { palette = {}; oggetti = {}; parziali = {}; } // inizio di una nuova epoca
          var k = 11;
          for (var o = 0; o < s[10] && k + 8 <= s.length; o++) {
            var ob = { id: u16(s, k), x: u16(s, k + 4), y: u16(s, k + 6), taglio: null };
            if (s[k + 3] & 0x80 && k + 16 <= s.length) { ob.taglio = { x: u16(s, k + 8), y: u16(s, k + 10), w: u16(s, k + 12), h: u16(s, k + 14) }; k += 16; }
            else k += 8;
            pcs.oggetti.push(ob);
          }
        } else if (tipo === 0x14 && s.length >= 2) {
          var pal = palette[s[0]] = {};
          for (var j = 2; j + 5 <= s.length; j += 5) pal[s[j]] = colore(s[j + 1], s[j + 2], s[j + 3], s[j + 4]);
        } else if (tipo === 0x15 && s.length >= 4) {
          var id = u16(s, 0), seq = s[3];
          if (seq & 0x80) {
            if (s.length < 11) continue;
            if (u16(s, 7) > MAX_L || u16(s, 9) > MAX_A || u16(s, 7) * u16(s, 9) > 2100000) { delete parziali[id]; continue; }
            parziali[id] = { w: u16(s, 7), h: u16(s, 9), parti: [s.subarray ? s.subarray(11) : s.slice(11)] };
          } else if (parziali[id]) parziali[id].parti.push(s.subarray ? s.subarray(4) : s.slice(4));
          if (seq & 0x40 && parziali[id]) {
            var pz = parziali[id], tot = 0, q;
            for (q = 0; q < pz.parti.length; q++) tot += pz.parti[q].length;
            var rle = new Uint8Array(tot), at = 0;
            for (q = 0; q < pz.parti.length; q++) { rle.set(pz.parti[q], at); at += pz.parti[q].length; }
            oggetti[id] = { w: pz.w, h: pz.h, rle: rle };
            delete parziali[id];
          }
        }
      }
      if (!pcs || pcs.w > MAX_L || pcs.h > MAX_A) return;
      if (canvas.width !== pcs.w || canvas.height !== pcs.h) { canvas.width = pcs.w || 1920; canvas.height = pcs.h || 1080; }
      pulisci();
      var pl = palette[pcs.paletteId] || {}, pixel = 0;
      for (var m = 0; m < pcs.oggetti.length && m < 4; m++) {
        var c = pcs.oggetti[m], og = oggetti[c.id];
        if (!og || !og.w || !og.h || og.w > canvas.width || og.h > canvas.height) continue;
        pixel += og.w * og.h;
        if (pixel > 4200000) break; // un'immagine fatta apposta: il resto non si disegna
        var img = decodifica(ctx, og.rle, og.w, og.h, pl);
        if (c.taglio) ctx.putImageData(img, c.x - c.taglio.x, c.y - c.taglio.y, c.taglio.x, c.taglio.y, c.taglio.w, c.taglio.h);
        else ctx.putImageData(img, c.x, c.y);
      }
    }
    return { mostra: mostra, pulisci: pulisci, azzera: azzera };
  }

  return { crea: crea };
})();
