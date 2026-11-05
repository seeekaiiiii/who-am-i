(function () {
  "use strict";
  var DATA = window.SITE_DATA || { site: {}, songs: [] };
  function $(sel) { return document.querySelector(sel); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function hashCode(str) {
    var h = 0;
    str = String(str || "x");
    for (var i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  function gradOf(key) {
    var G = [
    ["#dceafe", "#f4f9ff"],
    ["#dff3e8", "#f3fbf6"],
    ["#fde3ee", "#fff6fa"],
    ["#e2e9ff", "#eef4ff"],
    ["#e0f2ee", "#effaf6"],
    ["#f9e8f1", "#fdf3f8"]
    ];
    return G[hashCode(key) % G.length];
  }
  function bgCss(item, key) {
    if (item.cover) return 'url("' + esc(item.cover) + '") center / cover no-repeat';
    var g = gradOf(key);
    return "linear-gradient(135deg, " + g[0] + ", " + g[1] + ")";
  }
  function neteaseSrc(id) {
    return "https://music.163.com/outchain/player?type=2&id=" +
    encodeURIComponent(id) + "&auto=0&height=96";
  }
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var allSongs = (DATA.songs || []).filter(function (s) { return s && s.id; })
  .map(function (s) { return { item: s, kind: "song" }; });
  function renderChrome() {
    var site = DATA.site || {};
    var name = site.name || "私藏歌单";
    document.title = site.title || name;
  }
  function switchView(v) {
    var m = document.querySelector(".main");
    if (m) m.scrollTop = 0;
    ["home", "shelf"].forEach(function (k) {
      $("#view-" + k).classList.toggle("active", k === v);
    });
    Array.prototype.forEach.call($("#mb-nav").children, function (b) {
      b.classList.toggle("active", b.dataset.view === v);
    });
    if (v === "shelf") layoutWall();
  }
  function initViewnav() {
    $("#mb-nav").addEventListener("click", function (e) {
      var btn = e.target.closest(".mbtn");
      if (btn) switchView(btn.dataset.view);
    });
  }
  // 滚到第二屏才把答案放出来
  function renderHome() {
    var answer = $(".home-answer");
    if (!answer) return;
    if (REDUCED || !("IntersectionObserver" in window)) {
      answer.classList.add("revealed");
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          answer.classList.add("revealed");
          io.disconnect();
        }
      });
    }, { threshold: 0.35 });
    io.observe(answer);
  }
  // 封面墙：全部歌铺开，拖动看
  var strip, zone;
  var cards = [];
  var cardW = 160, gap = 16, cols = 1;
  var wallW = 0, wallH = 0;
  var panX = 0, panY = 0;
  var dragging = false, dragMoved = false;
  var sx = 0, sy = 0, spx = 0, spy = 0;
  function buildWall() {
    cards = [];
    strip.innerHTML = allSongs.map(function (p, i) {
      var it = p.item;
      var img = it.cover
      ? '<img src="' + esc(it.cover) + '" alt="" loading="lazy" referrerpolicy="no-referrer" />'
      : '<span class="wc-fallback">♪</span>';
      return (
      '<div class="wall-card" data-idx="' + i + '">' +
      img +
      (it.vip ? '<span class="vip-badge">VIP</span>' : "") +
      '<div class="wc-scrim"></div>' +
      '<div class="wc-name">' + esc(it.title || "") + "</div>" +
      "</div>"
      );
    }).join("");
    cards = Array.prototype.slice.call(strip.querySelectorAll(".wall-card"));
    layoutWall();
  }
  function layoutWall() {
    if (!cards.length || !zone) return;
    cardW = window.innerWidth < 720 ? 120 : 160;
    gap = 16;
    var zw = zone.clientWidth || window.innerWidth;
    cols = Math.max(1, Math.floor((zw + gap) / (cardW + gap)));
    var rows = Math.ceil(cards.length / cols);
    wallW = cols * (cardW + gap) - gap;
    wallH = rows * (cardW + gap) - gap;
    cards.forEach(function (card, i) {
      var col = i % cols, row = Math.floor(i / cols);
      card.style.left = (col * (cardW + gap)) + "px";
      card.style.top = (row * (cardW + gap)) + "px";
      card.style.width = cardW + "px";
      card.style.height = cardW + "px";
    });
    clampPan();
    applyPan();
  }
  function clampPan() {
    panX = clamp(panX, 0, Math.max(0, wallW - (zone ? zone.clientWidth : 0)));
    panY = clamp(panY, 0, Math.max(0, wallH - (zone ? zone.clientHeight : 0)));
  }
  function applyPan() {
    strip.style.transform = "translate3d(" + (-panX) + "px," + (-panY) + "px, 0)";
  }
  function initWall() {
    strip = $("#shelf-strip");
    zone = $("#shelf-zone");
    zone.addEventListener("wheel", function (e) {
      if (stageEl.classList.contains("open")) return;
      e.preventDefault();
      panX += (e.deltaX || 0);
      panY += (e.deltaY || 0);
      clampPan();
      applyPan();
    }, { passive: false });
    zone.addEventListener("pointerdown", function (e) {
      if (stageEl.classList.contains("open")) return;
      dragging = true; dragMoved = false;
      sx = e.clientX; sy = e.clientY;
      spx = panX; spy = panY;
      zone.classList.add("dragging");
      try { zone.setPointerCapture(e.pointerId); } catch (err) {  }
    });
    zone.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) dragMoved = true;
      if (!dragMoved) return;
      panX = clamp(spx - dx, 0, Math.max(0, wallW - zone.clientWidth));
      panY = clamp(spy - dy, 0, Math.max(0, wallH - zone.clientHeight));
      applyPan();
    });
    zone.addEventListener("pointerup", function (e) {
      var moved = dragMoved;
      dragging = false;
      zone.classList.remove("dragging");
      if (!moved && e && e.clientX !== undefined) handleTap(e);
    });
    zone.addEventListener("pointercancel", function () {
      dragging = false;
      zone.classList.remove("dragging");
    });
    document.addEventListener("keydown", function (e) {
      if (stageEl.classList.contains("open")) { if (e.key === "Escape") closeStage(); return; }
      if (!$("#view-shelf").classList.contains("active")) return;
      var step = cardW + gap;
      if (e.key === "ArrowUp") panY = clamp(panY - step, 0, Math.max(0, wallH - zone.clientHeight));
      else if (e.key === "ArrowDown") panY = clamp(panY + step, 0, Math.max(0, wallH - zone.clientHeight));
      else if (e.key === "ArrowLeft") panX = clamp(panX - step, 0, Math.max(0, wallW - zone.clientWidth));
      else if (e.key === "ArrowRight") panX = clamp(panX + step, 0, Math.max(0, wallW - zone.clientWidth));
      else return;
      applyPan();
    });
    window.addEventListener("resize", layoutWall);
  }
  // 拖动距离小于阈值就算点击
  function handleTap(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var card = el && el.closest ? el.closest(".wall-card") : null;
    if (!card) return;
    var i = +card.dataset.idx;
    var p = allSongs[i];
    if (!p) return;
    openStage(p.item);
  }
  var stageEl = $("#stage");
  // alt 链接自动认平台，认不出给跳转按钮
  function altBlock(item) {
    if (!item.alt) return "";
    var m;
    if ((m = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/.exec(item.alt))) {
      return '<div class="alt-embed"><iframe src="https://www.youtube.com/embed/' + m[1] +
      '" allowfullscreen referrerpolicy="no-referrer"></iframe><span class="alt-tag">YouTube</span></div>';
    }
    if ((m = /open\.spotify\.com\/(track|album|playlist)\/([\w]+)/.exec(item.alt))) {
      return '<div class="alt-embed"><iframe src="https://open.spotify.com/embed/' + m[1] + '/' + m[2] +
      '" allow="encrypted-media" referrerpolicy="no-referrer"></iframe><span class="alt-tag">Spotify</span></div>';
    }
    if ((m = /bilibili\.com\/video\/(BV[\w]+)/.exec(item.alt))) {
      return '<div class="alt-embed"><iframe src="https://player.bilibili.com/player.html?bvid=' + m[1] +
      '&autoplay=0&danmaku=0&high_quality=1" scrolling="no" frameborder="no" allowfullscreen="true" ' +
      'referrerpolicy="no-referrer"></iframe><span class="alt-tag">B站</span></div>';
    }
    return '<a class="link-btn" href="' + esc(item.alt) +
    '" target="_blank" rel="noopener noreferrer">前往备用平台 ↗</a>';
  }
  function openStage(item) {
    if (!item) return;
    $("#stage-bg").style.background = bgCss(item, item.title);
    $("#stage-cover").style.background = bgCss(item, item.title);
    $("#stage-title").textContent = item.title || "";
    $("#stage-artist").textContent = item.artist || "";
    $("#stage-lyric").textContent = item.lyric ? "「" + item.lyric + "」" : "";
    var playerBox = $("#stage-player");
    // 自己放的音频直接播
    if (item.src) {
      playerBox.innerHTML =
      '<div class="audio-embed"><audio controls src="' + esc(item.src) + '"></audio></div>';
      stageEl.classList.add("open");
      stageEl.setAttribute("aria-hidden", "false");
      return;
    }
    // VIP 播不了，给个去别处的引导
    if (item.vip) {
      var kw = encodeURIComponent(((item.title || "") + " " + (item.artist || "")).trim());
      var buttons =
      '<a href="https://music.163.com/#/song?id=' + item.id +
      '" target="_blank" rel="noopener noreferrer">网易云原页 ↗</a>' +
      '<a href="https://search.bilibili.com/all?keyword=' + kw +
      '" target="_blank" rel="noopener noreferrer">B站搜索 ↗</a>';
      playerBox.innerHTML =
      '<div class="vip-note">这是一首 VIP / 需购买的歌曲，匿名访客无法在线播放。<br>换平台搜一搜，或用你有会员的账号收听：<br>' +
      buttons +
      (item.alt ? '<a href="' + esc(item.alt) + '" target="_blank" rel="noopener noreferrer">我的备用链接 ↗</a>' : "") +
      "</div>" + altBlock(item);
      stageEl.classList.add("open");
      stageEl.setAttribute("aria-hidden", "false");
      return;
    }
    // 网易云外链，96 的高度刚好放下进度条
    if (item.id) {
      playerBox.innerHTML =
      '<div class="song-embed"><iframe src="' + neteaseSrc(item.id) +
      '" frameborder="no" border="0" marginwidth="0" marginheight="0" ' +
      'allow="autoplay; encrypted-media" referrerpolicy="no-referrer"></iframe></div>' + altBlock(item);
    } else if (item.alt) {
      playerBox.innerHTML = altBlock(item);
    }
    stageEl.classList.add("open");
    stageEl.setAttribute("aria-hidden", "false");
  }
  function closeStage() {
    stageEl.classList.remove("open");
    stageEl.setAttribute("aria-hidden", "true");
    setTimeout(function () {
      if (!stageEl.classList.contains("open")) $("#stage-player").innerHTML = "";
    }, 320);
  }
  function initOverlays() {
    $("#stage-close").addEventListener("click", closeStage);
    stageEl.addEventListener("click", function (e) {
      if (e.target === stageEl) closeStage();
    });
  }
  // 启动
  [renderChrome, initViewnav, renderHome,
  function () { initWall(); buildWall(); },
  initOverlays,
  function () { switchView("home"); }
  ].forEach(function (f) { try { f(); } catch (e) {} });
  window.__APP__ = {
    switchView: switchView,
    openStage: openStage,
    closeStage: closeStage,
    allSongs: function () { return allSongs; },
    getPan: function () { return { x: panX, y: panY }; },
  };
})();
