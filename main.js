/* =========================================================
   YZU CSE Redesign — 漸進強化腳本
   原則：沒有 JavaScript 時所有內容仍可閱讀；JS 只負責
   主題切換、手機選單、搜尋篩選、月曆換月、目錄定位、回到頂端。
   ========================================================= */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");

  /* ---------- 安全的 localStorage ---------- */
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---------- 1. 主題切換：自動 → 淺色 → 深色 ---------- */
  var themeBtn = document.querySelector("[data-theme-toggle]");
  var themes = ["auto", "light", "dark"];
  var themeLabels = { auto: "主題：跟隨系統", light: "主題：淺色", dark: "主題：深色" };
  var themeShort = { auto: "◐ 自動", light: "☀ 淺色", dark: "☾ 深色" };

  function applyTheme(t) {
    if (root.hasAttribute("data-plan")) return; // 方案頁固定自己的色盤
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
    else root.removeAttribute("data-theme");
    if (themeBtn) {
      themeBtn.textContent = themeShort[t];
      themeBtn.setAttribute("aria-label", themeLabels[t] + "（按一下切換）");
    }
  }
  var savedTheme = store("cse-theme") || "auto";
  applyTheme(savedTheme);
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var next = themes[(themes.indexOf(savedTheme) + 1) % themes.length];
      savedTheme = next;
      store("cse-theme", next === "auto" ? null : next);
      applyTheme(next);
      announce(themeLabels[next]);
    });
  }

  /* ---------- 螢幕閱讀器即時訊息 ---------- */
  var live = document.createElement("div");
  live.className = "visually-hidden";
  live.setAttribute("aria-live", "polite");
  document.body.appendChild(live);
  function announce(msg) { live.textContent = ""; setTimeout(function () { live.textContent = msg; }, 50); }

  /* ---------- 2. 手機選單 ---------- */
  var navBtn = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");
  if (navBtn && nav) {
    navBtn.addEventListener("click", function () {
      var open = navBtn.getAttribute("aria-expanded") === "true";
      navBtn.setAttribute("aria-expanded", String(!open));
      navBtn.textContent = open ? "選單" : "關閉選單";
      nav.classList.toggle("is-open", !open);
      if (!open) { var first = nav.querySelector("a"); if (first) first.focus(); }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        navBtn.click();
        navBtn.focus();
      }
    });
  }

  /* ---------- 3. 回到頂端 ---------- */
  var topBtn = document.querySelector(".back-to-top");
  if (topBtn) {
    var onScroll = function () { topBtn.classList.toggle("is-visible", window.scrollY > 600); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---------- 4. 頁內目錄：標示目前閱讀的段落 ---------- */
  var tocLinks = document.querySelectorAll(".toc a[href^='#']");
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (a) { map[a.getAttribute("href").slice(1)] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          tocLinks.forEach(function (a) { a.classList.remove("is-active"); a.removeAttribute("aria-current"); });
          map[en.target.id].classList.add("is-active");
          map[en.target.id].setAttribute("aria-current", "location");
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Object.keys(map).forEach(function (id) { var el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- 5. 通用搜尋／篩選 ----------
     <form data-filter="#list">：input[name=q] 關鍵字、select[name=cat] 分類
     清單項目需有 data-cat 與可搜尋文字；結果數寫入 [data-count]，無結果顯示 [data-empty] */
  document.querySelectorAll("form[data-filter]").forEach(function (form) {
    var list = document.querySelector(form.getAttribute("data-filter"));
    if (!list) return;
    var items = Array.prototype.slice.call(list.querySelectorAll("[data-cat]"));
    var count = document.querySelector(form.getAttribute("data-count"));
    var empty = document.querySelector(form.getAttribute("data-empty"));
    var q = form.querySelector("[name=q]");
    var cat = form.querySelector("[name=cat]");
    var timer;

    function run(silent) {
      var term = (q && q.value || "").trim().toLowerCase();
      var c = cat ? cat.value : "all";
      var shown = 0;
      items.forEach(function (it) {
        var okCat = c === "all" || (" " + it.getAttribute("data-cat") + " ").indexOf(" " + c + " ") > -1;
        var okText = !term || it.textContent.toLowerCase().indexOf(term) > -1;
        var ok = okCat && okText;
        it.hidden = !ok;
        if (ok) shown++;
      });
      var msg = "共 " + items.length + " 筆，目前顯示 " + shown + " 筆";
      if (term) msg += "（關鍵字：「" + term + "」）";
      if (count) count.textContent = msg;
      if (empty) empty.hidden = shown !== 0;
      if (!silent) announce(msg);
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); run(); });
    form.addEventListener("reset", function () { setTimeout(function () { run(); if (q) q.focus(); }, 0); });
    if (q) q.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 250); });
    if (cat) cat.addEventListener("change", function () { run(); });
    run(true);
  });

  /* ---------- 6. 月曆換月 ---------- */
  var cal = document.querySelector("[data-calendar]");
  if (cal) {
    var months = Array.prototype.slice.call(cal.querySelectorAll("[data-month]"));
    var out = cal.querySelector("output");
    var prev = cal.querySelector("[data-prev]");
    var next = cal.querySelector("[data-next]");
    var idx = 0;
    function show(i) {
      idx = Math.max(0, Math.min(months.length - 1, i));
      months.forEach(function (m, k) { m.hidden = k !== idx; });
      if (out) out.textContent = months[idx].getAttribute("data-month");
      if (prev) prev.disabled = idx === 0;
      if (next) next.disabled = idx === months.length - 1;
    }
    if (prev) prev.addEventListener("click", function () { show(idx - 1); announce("目前顯示 " + out.textContent); });
    if (next) next.addEventListener("click", function () { show(idx + 1); announce("目前顯示 " + out.textContent); });
    show(0);
  }

  /* ---------- 7. 水平卡片：鍵盤方向鍵捲動 ---------- */
  document.querySelectorAll(".scroll-cards[tabindex]").forEach(function (box) {
    box.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      var card = box.firstElementChild;
      var step = card ? card.getBoundingClientRect().width + 16 : 300;
      box.scrollBy({ left: e.key === "ArrowRight" ? step : -step, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  });

  /* ---------- 8. 複製按鈕（設計說明頁） ---------- */
  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var src = document.querySelector(btn.getAttribute("data-copy"));
      if (!src) return;
      var text = src.textContent;
      var done = function () { var old = btn.textContent; btn.textContent = "已複製 ✓"; announce("已複製到剪貼簿"); setTimeout(function () { btn.textContent = old; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { announce("無法複製，請手動選取文字"); });
    });
  });

  /* ---------- 9. 頁尾年份 ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
