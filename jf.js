/*
 * Video - i dati di Jellyfin per l'app: dalla scheda di Jellyfin (BaseItemDto) a quella dell'app, le immagini alla misura
 * giusta, le anteprime della barra del tempo (trickplay), sigla e titoli di coda (segmenti), le insegne del file.
 * Niente pagina qui dentro: si prova anche in Node (prove/test_jf_app.js). Le domande passano dal ponte del servizio del TV
 * (/api/video/g/<gettone>/jf/p/...): il token di Jellyfin l'app non lo vede mai. Solo JavaScript ES5.
 */
var JF = (function () {
  'use strict';

  var TICK = 1e7; // Jellyfin conta il tempo in decimi di microsecondo
  function sec(ticks) { return (+ticks || 0) / TICK; }
  function ticks(s) { return Math.max(0, Math.round((+s || 0) * TICK)); }

  // un'immagine di Jellyfin come riferimento dell'app: p (la chiave, unica) e jf (cosa chiedere)
  function ref(id, tipo, tag, n) {
    if (!id || !tag) return null;
    return { p: 'jf/' + id + '/' + tipo + '/' + (n || 0) + '/' + tag, jf: { id: id, tipo: tipo, tag: tag, n: n || 0 } };
  }
  // i colori di un'immagine dal suo BlurHash (Jellyfin lo manda con la scheda: poche lettere, niente da scaricare), dall'alto in
  // basso e mediati in larghezza: n colori CSS, o null se il testo non e' un BlurHash. La carta li mostra mentre l'immagine arriva
  var B83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';
  function b83(s, da, a) {
    for (var v = 0, i = da; i < a; i++) { var d = B83.indexOf(s.charAt(i)); if (d < 0) return -1; v = v * 83 + d; }
    return v;
  }
  function lineare(c) { var v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function srgb(v) {
    v = Math.max(0, Math.min(1, v));
    return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055) * 255);
  }
  function coloriBlur(h, n) {
    h = String(h || '');
    var dim = h.length >= 6 && b83(h, 0, h.length) >= 0 ? b83(h, 0, 1) : -1, nx = dim % 9 + 1, ny = Math.floor(dim / 9) + 1;
    if (dim < 0 || h.length !== 4 + 2 * nx * ny || n < 1) return null;
    var max = (b83(h, 1, 2) + 1) / 166, dc = b83(h, 2, 6), righe = [[lineare(dc >> 16), lineare((dc >> 8) & 255), lineare(dc & 255)]], j, k;
    if (dc < 0 || max <= 0) return null;
    // solo le componenti della prima colonna (frequenza 0 in larghezza): la media di ogni riga
    for (j = 1; j < ny; j++) {
      var v = b83(h, 4 + 2 * j * nx, 6 + 2 * j * nx);
      if (v < 0) return null;
      righe.push([Math.floor(v / 361), Math.floor(v / 19) % 19, v % 19].map(function (q) { var x = (q - 9) / 9; return (x < 0 ? -1 : 1) * x * x * max; }));
    }
    var out = [];
    for (k = 0; k < n; k++) {
      var t = n === 1 ? 0.5 : 0.05 + 0.9 * k / (n - 1), c = [0, 0, 0];
      for (j = 0; j < ny; j++) { var b = Math.cos(Math.PI * t * j); c[0] += righe[j][0] * b; c[1] += righe[j][1] * b; c[2] += righe[j][2] * b; }
      out.push('rgb(' + srgb(c[0]) + ',' + srgb(c[1]) + ',' + srgb(c[2]) + ')');
    }
    return out;
  }
  // la domanda per l'immagine, alla misura che serve (Jellyfin la riduce: al TV arriva piccola). tutta = logo (proporzioni sue)
  function percorsoImmagine(r, w, h, tutta) {
    var j = r.jf, q = 'tag=' + encodeURIComponent(j.tag) + '&quality=' + (w * h > 400000 ? 80 : 85);
    q += tutta ? '&maxWidth=' + w + '&maxHeight=' + h : '&fillWidth=' + w + '&fillHeight=' + h;
    return 'jf/p/Items/' + j.id + '/Images/' + j.tipo + (j.tipo === 'Backdrop' || j.tipo === 'Chapter' ? '/' + (j.n || 0) : '') + '?' + q;
  }

  var TIPI = { Movie: 'film', Series: 'serie', Season: 'stagione', Episode: 'puntata', BoxSet: 'collezione', Person: 'persona',
    CollectionFolder: 'libreria', Folder: 'cartella', UserView: 'libreria', Video: 'film', MusicVideo: 'film', Trailer: 'film', Genre: 'genere' };
  function nomi(l, tipo) {
    return (l || []).filter(function (p) { return p && p.Type === tipo; }).map(function (p) { return String(p.Name || ''); }).filter(Boolean);
  }
  // la scheda dell'app (come quella delle chiavette: le stesse funzioni la disegnano)
  function scheda(it) {
    it = it || {};
    var tipo = TIPI[it.Type] || 'film', tag = it.ImageTags || {}, img = {};
    if (tipo === 'puntata') {
      // la puntata: la sua immagine e' un fotogramma (orizzontale); il poster e' quello della serie
      if (tag.Primary) img.landscape = ref(it.Id, 'Primary', tag.Primary);
      if (it.SeriesPrimaryImageTag) img.poster = ref(it.SeriesId, 'Primary', it.SeriesPrimaryImageTag);
    } else if (tag.Primary) img.poster = ref(it.Id, 'Primary', tag.Primary);
    if (tag.Logo) img.logo = ref(it.Id, 'Logo', tag.Logo);
    else if (it.ParentLogoItemId && it.ParentLogoImageTag) img.logo = ref(it.ParentLogoItemId, 'Logo', it.ParentLogoImageTag);
    if (it.BackdropImageTags && it.BackdropImageTags.length) img.fanart = ref(it.Id, 'Backdrop', it.BackdropImageTags[0], 0);
    else if (it.ParentBackdropItemId && it.ParentBackdropImageTags && it.ParentBackdropImageTags.length) img.fanart = ref(it.ParentBackdropItemId, 'Backdrop', it.ParentBackdropImageTags[0], 0);
    if (!img.landscape) {
      if (tag.Thumb) img.landscape = ref(it.Id, 'Thumb', tag.Thumb);
      else if (it.ParentThumbItemId && it.ParentThumbImageTag) img.landscape = ref(it.ParentThumbItemId, 'Thumb', it.ParentThumbImageTag);
    }
    // il BlurHash di ogni immagine (per tipo e tag: c'e' anche quello del poster della serie di una puntata)
    var bh = it.ImageBlurHashes || {};
    [img.poster, img.landscape, img.fanart].forEach(function (r) {
      var l = r && bh[r.jf.tipo];
      if (l && typeof l[r.jf.tag] === 'string') r.jf.blur = l[r.jf.tag].slice(0, 200);
    });
    var ud = it.UserData || {}, people = it.People || [];
    var s = {
      tipo: tipo, id: it.Id, titolo: String(it.Name || ''), anno: +it.ProductionYear || 0, durata: sec(it.RunTimeTicks) / 60,
      voto: it.CommunityRating ? Math.round(it.CommunityRating * 10) / 10 : 0, critica: +it.CriticRating || 0,
      classificazione: String(it.OfficialRating || ''), generi: (it.Genres || []).slice(0, 6), trama: String(it.Overview || ''),
      slogan: it.Taglines && it.Taglines.length ? String(it.Taglines[0]) : '', registi: nomi(people, 'Director'),
      scrittori: nomi(people, 'Writer'), studi: (it.Studios || []).map(function (x) { return String(x.Name || ''); }).filter(Boolean).slice(0, 3),
      cast: people.filter(function (p) { return p && (p.Type === 'Actor' || p.Type === 'GuestStar'); }).slice(0, 30).map(function (p) {
        return { nome: String(p.Name || ''), ruolo: String(p.Role || ''), id: p.Id, foto: p.PrimaryImageTag ? ref(p.Id, 'Primary', p.PrimaryImageTag) : null };
      }),
      img: img, stagione: it.ParentIndexNumber !== undefined && it.ParentIndexNumber !== null ? +it.ParentIndexNumber : (tipo === 'stagione' ? +it.IndexNumber || 0 : 0),
      episodio: tipo === 'puntata' && it.IndexNumber !== undefined && it.IndexNumber !== null ? +it.IndexNumber : -1,
      serie: it.SeriesName ? { titolo: String(it.SeriesName), id: it.SeriesId, img: { logo: img.logo, fanart: img.fanart } } : null,
      visto: !!ud.Played, preferito: !!ud.IsFavorite, punto: sec(ud.PlaybackPositionTicks), percento: +ud.PlayedPercentage || 0,
      nonVisti: +ud.UnplayedItemCount || 0, ultimaVolta: ud.LastPlayedDate ? Date.parse(ud.LastPlayedDate) || 0 : 0,
      aggiunto: it.DateCreated ? Date.parse(it.DateCreated) || 0 : 0, figli: +it.ChildCount || 0,
      trailer: +it.LocalTrailerCount || 0, nascita: it.PremiereDate ? String(it.PremiereDate).slice(0, 10) : '',
      luogo: it.ProductionLocations && it.ProductionLocations.length ? String(it.ProductionLocations[0]) : '',
      morte: it.EndDate ? String(it.EndDate).slice(0, 10) : '', jf: true
    };
    if (tipo === 'puntata' && s.serie) s.collezione = '';
    return s;
  }

  // l'anteprima della barra del tempo: quale foglio di tessere e dove, al secondo t. La larghezza piu' piccola dalle 240 in
  // su (il TV decodifica un foglio intero: piu' e' piccolo, meno memoria)
  function trickplay(it, msid) {
    var tp = it && it.Trickplay, l = tp ? tp[msid] || tp[Object.keys(tp)[0]] : null, best = null;
    if (!l) return null;
    for (var w in l) {
      if (!Object.prototype.hasOwnProperty.call(l, w)) continue;
      var x = l[w];
      if (!x || !(x.TileWidth > 0) || !(x.TileHeight > 0) || !(x.Interval > 0) || !(x.Width > 0)) continue;
      if (!best || (x.Width >= 240 && (best.Width < 240 || x.Width < best.Width)) || (best.Width < 240 && x.Width > best.Width)) best = x;
    }
    if (!best) return null;
    return { larg: best.Width, alt: best.Height, col: best.TileWidth, righe: best.TileHeight, quante: best.ThumbnailCount || 0, passo: best.Interval };
  }
  function tessera(tp, t) {
    var k = Math.floor(Math.max(0, t) * 1000 / tp.passo);
    if (tp.quante) k = Math.min(k, tp.quante - 1);
    var perFoglio = tp.col * tp.righe, n = k % perFoglio;
    return { foglio: Math.floor(k / perFoglio), x: (n % tp.col) * tp.larg, y: Math.floor(n / tp.col) * tp.alt, w: tp.larg, h: tp.alt,
      W: tp.col * tp.larg, H: tp.righe * tp.alt };
  }

  // sigla, riassunto, titoli di coda: dai segmenti di Jellyfin (gli stessi testi dei capitoli)
  var SEGMENTI = { Intro: { testo: 'Salta sigla' }, Recap: { testo: 'Salta riassunto' }, Preview: { testo: 'Salta anticipazioni' },
    Commercial: { testo: 'Salta pubblicita\'' }, Outro: { testo: 'Salta titoli di coda', fine: true } };
  function segmenti(r) {
    var l = r && Array.isArray(r.Items) ? r.Items : Array.isArray(r) ? r : [];
    return l.map(function (x) {
      var k = SEGMENTI[x && x.Type];
      return k ? { da: sec(x.StartTicks), a: sec(x.EndTicks), testo: k.testo, ultima: !!k.fine } : null;
    }).filter(function (x) { return x && x.a - x.da >= 3; }).sort(function (a, b) { return a.da - b.da; });
  }

  // le insegne del file: risoluzione, HDR, video, audio (con "lo converte il server" se il TV non lo legge)
  var NOMI_AUDIO = { EAC3: 'Dolby Digital Plus', AC3: 'Dolby Digital', TRUEHD: 'Dolby TrueHD', DTS: 'DTS', AAC: 'AAC', FLAC: 'FLAC',
    OPUS: 'Opus', MP3: 'MP3', PCM: 'PCM', VORBIS: 'Vorbis', MP2: 'MPEG audio' };
  var NOMI_VIDEO = { HEVC: 'HEVC', AVC: 'H.264', AV1: 'AV1', VP9: 'VP9', VP8: 'VP8', MPEG2: 'MPEG-2', MPEG4: 'MPEG-4', VC1: 'VC-1' };
  var FAM = { hevc: 'HEVC', h265: 'HEVC', h264: 'AVC', av1: 'AV1', vp9: 'VP9', vp8: 'VP8', mpeg2video: 'MPEG2', mpeg4: 'MPEG4', vc1: 'VC1',
    eac3: 'EAC3', ac3: 'AC3', truehd: 'TRUEHD', mlp: 'TRUEHD', dts: 'DTS', dca: 'DTS', aac: 'AAC', mp3: 'MP3', mp2: 'MP2', flac: 'FLAC',
    opus: 'OPUS', vorbis: 'VORBIS' };
  function famiglia(c) { c = String(c || '').toLowerCase(); return FAM[c] || (/^pcm/.test(c) ? 'PCM' : c.toUpperCase()); }
  function sorgente(it) { return it && it.MediaSources && it.MediaSources[0] ? it.MediaSources[0] : null; }
  function flussi(ms, tipo) { return ((ms && ms.MediaStreams) || []).filter(function (s) { return s && s.Type === tipo; }); }
  function nomeAudio(s) {
    var f = famiglia(s.Codec), p = String(s.Profile || '');
    if (f === 'DTS' && /MA|HD/.test(p)) return /MA/.test(p) ? 'DTS-HD MA' : 'DTS-HD';
    if (f === 'DTS' && /X/.test(p)) return 'DTS:X';
    return (NOMI_AUDIO[f] || f) + (/atmos/i.test(String(s.DisplayTitle || '') + p) ? ' Atmos' : '');
  }
  function canali(n) { return n === 6 ? '5.1' : n === 8 ? '7.1' : n === 2 ? 'stereo' : n === 1 ? 'mono' : n ? n + ' canali' : ''; }
  function badge(it, letti) {
    var ms = sorgente(it), out = [];
    if (!ms) return out;
    var v = flussi(ms, 'Video')[0], a = flussi(ms, 'Audio'), s = flussi(ms, 'Subtitle');
    if (v) {
      var w = +v.Width || 0, rng = String(v.VideoRangeType || v.VideoRange || '');
      out.push({ t: w >= 3200 ? '4K' : w >= 1900 ? 'HD 1080' : w >= 1200 ? 'HD 720' : 'SD', forte: w >= 3200 });
      if (/DOVI/i.test(rng)) out.push({ t: 'DOLBY VISION', nota: 'il TV usa HDR10' });
      else if (/HDR10Plus/i.test(rng)) out.push({ t: 'HDR10+', forte: true });
      else if (/HDR10|HDR/i.test(rng)) out.push({ t: 'HDR10', forte: true });
      else if (/HLG/i.test(rng)) out.push({ t: 'HLG', forte: true });
      out.push({ t: (NOMI_VIDEO[famiglia(v.Codec)] || String(v.Codec || '').toUpperCase()) + (+v.BitDepth > 8 && famiglia(v.Codec) === 'AVC' ? ' 10 bit' : ''),
        no: letti ? !videoOk(v, letti) : false });
    }
    var d = a.filter(function (x) { return x.IsDefault; })[0] || a[0];
    if (d) {
      var legge = !letti || letti.audio[famiglia(d.Codec)] === true;
      out.push({ t: nomeAudio(d) + (d.Channels ? ' ' + canali(+d.Channels) : ''), conv: !legge });
    }
    if (s.length) out.push({ t: 'SOTTOTITOLI' });
    return out;
  }
  // il decoder del TV legge questo video? (le stesse regole del ponte: H.264 solo 8 bit, HEVC fino a 10, Dolby Vision solo con
  // la base HDR10)
  function videoOk(v, letti) {
    if (!v || !letti) return false;
    var f = famiglia(v.Codec), pr = String(v.Profile || '').toLowerCase(), b = +v.BitDepth || 8;
    if (!letti.video[f]) return false;
    if (f === 'AVC' && (b > 8 || /10|422|444|4:2:2|4:4:4/.test(pr))) return false;
    if (f === 'HEVC' && (b > 10 || /rext|444|4:4:4|scc|12/.test(pr))) return false;
    if (f === 'AV1' && b > 10) return false;
    return String(v.VideoRangeType || '') !== 'DOVI';
  }
  // la strada prevista per il TV (prima di chiedere al server): diretta, audio convertito o video convertito
  function strada(it, letti) {
    var ms = sorgente(it);
    if (!ms || !letti) return '';
    var v = flussi(ms, 'Video')[0], a = flussi(ms, 'Audio');
    var est = (/\.([a-z0-9]{2,5})$/i.exec(String(ms.Path || '')) || ['', ''])[1].toLowerCase(), c = String(ms.Container || '').toLowerCase();
    var contenitore = /^(mkv|webm|mp4|m4v|mov|mk3d|ts|m2ts|mts)$/.test(est) || /(^|,)(mkv|matroska|webm|mp4|mov|m4v|ts|mpegts|m2ts)(,|$)/.test(c);
    if (!videoOk(v, letti) || !contenitore) return 'converti';
    if (a.length && !a.some(function (x) { return letti.audio[famiglia(x.Codec)] === true; })) return 'audio';
    return 'diretta';
  }
  // il nome del video: HEVC, H.264 (con "10 bit" se lo e': il TV non lo legge), AV1...
  function nomeVideo(v) {
    var f = famiglia(v && v.Codec);
    return (NOMI_VIDEO[f] || String((v && v.Codec) || '').toUpperCase()) + (+(v && v.BitDepth) > 8 && f === 'AVC' ? ' 10 bit' : '');
  }
  // le etichette semplici della scheda (come nei servizi di streaming): 4K, HD o SD, l'HDR, i canali dell'audio, i sottotitoli.
  // I nomi dei codec e i Mbps stanno nelle informazioni, in fondo alla scheda
  function etichette(it) {
    var ms = sorgente(it), out = [];
    if (!ms) return out;
    var v = flussi(ms, 'Video')[0], a = flussi(ms, 'Audio'), s = flussi(ms, 'Subtitle'), mx = 0, atmos = false;
    if (v) {
      var w = +v.Width || 0, h = +v.Height || 0, rng = String(v.VideoRangeType || v.VideoRange || '');
      out.push(w >= 3200 || h >= 2000 ? '4K' : w >= 1260 || h >= 700 ? 'HD' : 'SD');
      if (/DOVI/i.test(rng)) out.push('Dolby Vision');
      else if (/HDR10Plus/i.test(rng)) out.push('HDR10+');
      else if (/HDR10|HDR|PQ/i.test(rng)) out.push('HDR10');
      else if (/HLG/i.test(rng)) out.push('HLG');
    }
    a.forEach(function (x) { mx = Math.max(mx, +x.Channels || 0); if (/atmos/i.test(String(x.DisplayTitle || '') + String(x.Profile || ''))) atmos = true; });
    if (atmos) out.push('Atmos');
    else if (mx >= 6) out.push(canali(mx));
    if (s.length) out.push('Sottotitoli');
    return out;
  }
  // le collezioni (il contratto con l'app del Mac, mac/home-tv-film/LEGGIMI.md): quelle fatte sul Mac hanno un numero davanti al
  // nome per ordinare ("01 MCU", che Jellyfin salva come "0000000001 mcu") e vengono prima, nel loro ordine; le automatiche di
  // TheMovieDb (ProviderIds.Tmdb o TmdbCollection) dopo, per nome; quelle col tag "hometv-nascosta" non si mostrano. Senza
  // ProviderIds (Jellyfin vecchi) un numero che e' anche l'inizio del nome vero ("300 - Collezione") non conta
  function automatica(it) { var p = (it && it.ProviderIds) || {}; return !!(p.Tmdb || p.TmdbCollection); }
  function nascosta(it) { return ((it && it.Tags) || []).indexOf('hometv-nascosta') !== -1; }
  function numeroCollezione(it) {
    if (!it || automatica(it)) return -1;
    var m = /^\s*(\d{1,10})[\s._-]/.exec(String(it.SortName || it.ForcedSortName || ''));
    if (!m) return -1;
    var n = +m[1];
    if (String(it.Name || '').replace(/^\s+/, '').indexOf(String(n)) === 0) return -1;
    return n;
  }
  function ordinaCollezioni(l) {
    return (l || []).filter(function (it) { return it && !nascosta(it); }).map(function (it, i) {
      return { it: it, n: numeroCollezione(it), nome: String(it.Name || '').toLowerCase(), i: i };
    }).sort(function (a, b) {
      if (a.n >= 0 && b.n >= 0 && a.n !== b.n) return a.n - b.n;
      if ((a.n >= 0) !== (b.n >= 0)) return a.n >= 0 ? -1 : 1;
      return a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : a.i - b.i;
    }).map(function (x) { return x.it; });
  }
  // i capitoli dell'app (con l'immagine di Jellyfin, se c'e')
  function capitoli(it) {
    return (it && it.Chapters || []).map(function (c, k) {
      return { t: sec(c.StartPositionTicks), nome: String(c.Name || ''), img: c.ImageTag ? ref(it.Id, 'Chapter', c.ImageTag, k) : null };
    });
  }
  // i campi da chiedere nelle liste (pochi: il TV ha poca memoria)
  var CAMPI = 'PrimaryImageAspectRatio,Overview,Genres,OfficialRating,CommunityRating,ChildCount,DateCreated';
  var IMMAGINI = 'EnableImageTypes=Primary,Backdrop,Thumb,Logo&ImageTypeLimit=1&EnableUserData=true';

  return { TICK: TICK, sec: sec, ticks: ticks, ref: ref, coloriBlur: coloriBlur, percorsoImmagine: percorsoImmagine, scheda: scheda, trickplay: trickplay,
    tessera: tessera, segmenti: segmenti, badge: badge, etichette: etichette, nomeVideo: nomeVideo, ordinaCollezioni: ordinaCollezioni, strada: strada, videoOk: videoOk, capitoli: capitoli, famiglia: famiglia, nomeAudio: nomeAudio,
    sorgente: sorgente, flussi: flussi, CAMPI: CAMPI, IMMAGINI: IMMAGINI };
})();
