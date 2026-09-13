(function () {
  "use strict";

  const data = window.ICHINOMIYA_DATA;
  const page = document.body.dataset.page;
  const root = document.querySelector("[data-page-root]");
  const query = new URLSearchParams(window.location.search);
  const visitedKey = "ichinomiya-junrei-visits";

  function getVisits() {
    try { return JSON.parse(localStorage.getItem(visitedKey)) || {}; } catch (_) { return {}; }
  }

  function saveVisits(visits) {
    try { localStorage.setItem(visitedKey, JSON.stringify(visits)); } catch (_) {}
  }

  function visitValue(shrine) {
    const visits = getVisits();
    if (Object.prototype.hasOwnProperty.call(visits, shrine.id)) return visits[shrine.id];
    return shrine.visited ? (shrine.worshipped || true) : false;
  }

  function isVisited(shrine) {
    return Boolean(visitValue(shrine));
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function rubyMarkup(value, reading) {
    if (!reading) return escapeHtml(value);
    return `<ruby>${escapeHtml(value)}<rp>（</rp><rt>${escapeHtml(reading)}</rt><rp>）</rp></ruby>`;
  }

  function provinceReading(province) {
    return data.shrines.find((shrine) => shrine.province === province)?.provinceReading || "";
  }

  function currentPrefectures(shrines) {
    return [...new Set(shrines.map((shrine) => shrine.prefecture).filter(Boolean))];
  }

  function renderHeader() {
    const header = document.querySelector("[data-site-header]");
    if (header) header.hidden = true;
  }

  function renderFooter() {
    const footer = document.querySelector("[data-site-footer]");
    if (footer) footer.hidden = true;
  }

  function pageShell(content, extraClass = "") {
    return `<div id="top" class="page-shell ${extraClass}"><span class="binding" aria-hidden="true"></span>${content}</div>`;
  }

  function folioHeading({ number, eyebrow, title, titleReading = "", intro, backHref, backLabel, seal }) {
    return `
      <header class="folio-head">
        <a class="folio-back" href="${backHref}">← ${escapeHtml(backLabel)}</a>
        <div class="folio-title-row">
          <div>
            <p class="folio-number">第 ${escapeHtml(number)} 頁</p>
            <p class="eyebrow">${escapeHtml(eyebrow)}</p>
            <h1 class="page-title">${rubyMarkup(title, titleReading)}</h1>
            <p class="page-intro">${escapeHtml(intro)}</p>
          </div>
          <span class="big-seal" aria-hidden="true">${escapeHtml(seal)}</span>
        </div>
      </header>`;
  }

  function folioNext(href, label) {
    return `<nav class="folio-next" aria-label="次の頁"><a href="${href}">${escapeHtml(label)} <span aria-hidden="true">›</span></a></nav>`;
  }

  function photoFrame(shrine) {
    const filename = shrine.photo ? shrine.photo.split("/").pop() : `ichinomiya-${shrine.id}.jpg`;
    return `
      <div class="photo-frame" data-filename="${escapeHtml(filename)}">
        <span class="photo-empty">写真はまだありません<small>${escapeHtml(filename)}</small></span>
        ${shrine.photo ? `<img data-photo src="${escapeHtml(shrine.photo)}" alt="${escapeHtml(shrine.name)}の参拝写真">` : ""}
      </div>`;
  }

  function shrineCard(shrine) {
    const visited = isVisited(shrine);
    return `
      <article class="spot-card ${visited ? "is-visited" : ""}">
        ${visited ? '<span class="mini-stamp" aria-label="参拝済み">参拝済</span>' : ""}
        <a href="shrines/${shrine.id}.html">
          ${photoFrame(shrine)}
          <div class="spot-card-body">
            <p class="kicker">${escapeHtml(shrine.prefecture)}・${rubyMarkup(shrine.province, shrine.provinceReading)}</p>
            <h3>${rubyMarkup(shrine.name, shrine.nameReading)}</h3>
            <p class="spot-address">${escapeHtml(shrine.address)}</p>
          </div>
        </a>
      </article>`;
  }

  function bindPhotoFallbacks(scope) {
    scope.querySelectorAll("img[data-photo]").forEach((img) => {
      const frame = img.closest(".photo-frame");
      const markLoaded = () => frame?.classList.add("has-photo");
      const markMissing = () => {
        frame?.classList.add("is-missing");
        img.remove();
      };
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markMissing, { once: true });
      if (img.complete) img.naturalWidth ? markLoaded() : markMissing();
    });
  }

  function renderCover() {
    root.innerHTML = `
      <section class="cover-stage" aria-labelledby="cover-title">
        <a class="book-cover" href="map.html" aria-label="一宮巡礼帖をひらく">
          <span class="cover-binding" aria-hidden="true"></span>
          <span class="cover-corner cover-corner-top" aria-hidden="true"></span>
          <span class="cover-corner cover-corner-bottom" aria-hidden="true"></span>
          <span class="cover-label">
            <small>いちのみや</small>
            <strong id="cover-title">一宮巡礼帖</strong>
            <i aria-hidden="true">詣</i>
          </span>
          <span class="cover-owner">わたしの巡拝記録</span>
        </a>
        <a class="cover-open" href="map.html">表紙をひらく <span aria-hidden="true">›</span></a>
        <a class="books-home" href="../archive.html">以前の三冊へ</a>
      </section>`;
  }

  function renderMap() {
    const pageNumbers = ["壱", "弐", "参", "四", "五", "六", "七", "八"];
    return `
      <div class="map-wrap map-spread">
        <figure class="map-sheet">
          <span class="map-sheet-label" aria-hidden="true">諸国一宮</span>
          <div class="map-graphic">
            <object type="image/svg+xml" data="assets/images/japan-regions-blank.svg" aria-label="地方を選べる日本地図">
              <img src="assets/images/japan-regions-blank.svg" alt="地方ごとに色分けした日本地図" width="570" height="755">
            </object>
          </div>
          <figcaption>色のついた地方を押すと、一宮巡礼の頁がひらく。</figcaption>
        </figure>
        <nav class="region-index" aria-label="地方を選択">
          <p class="region-index-title">巡礼目次</p>
          ${data.regions.map((region, index) => {
            const shrines = data.shrines.filter((shrine) => shrine.region === region.id);
            const visited = shrines.filter(isVisited).length;
            return `
              <a href="region.html?region=${region.id}">
                <span class="region-index-number">${pageNumbers[index]}</span>
                <span class="region-index-copy"><strong>${escapeHtml(region.name)}</strong><small>${escapeHtml(region.note)}</small></span>
                <span class="region-index-count"><b>${visited}</b> / ${shrines.length}</span>
              </a>`;
          }).join("")}
        </nav>
      </div>`;
  }

  function renderMapPage() {
    root.innerHTML = pageShell(`
      <article class="folio-page folio-map">
        ${folioHeading({ number: "一", eyebrow: "巡礼の目次", title: "一宮を巡る", intro: "諸国の一宮へ、御朱印と記憶を重ねる。", backHref: "index.html", backLabel: "表紙", seal: "宮" })}
        ${renderMap()}
        ${folioNext("list.html", "全国の一宮を見る")}
      </article>`, "book-page");
  }

  function renderList() {
    const visited = data.shrines.filter(isVisited).length;
    root.innerHTML = pageShell(`
      <article class="folio-page">
        ${folioHeading({ number: "二", eyebrow: "諸国一宮", title: "全国の一宮", intro: `${data.shrines.length}社のうち、${visited}社を参拝。`, backHref: "map.html", backLabel: "日本地図", seal: "詣" })}
        <section class="folio-body">
          <div class="card-grid folio-collection">${data.shrines.map(shrineCard).join("")}</div>
        </section>
      </article>`, "book-page");
  }

  function renderRegion() {
    const region = data.regions.find((item) => item.id === query.get("region")) || data.regions[0];
    const shrines = data.shrines.filter((shrine) => shrine.region === region.id);
    const provinces = [...new Set(shrines.map((shrine) => shrine.province))];
    const visited = shrines.filter(isVisited).length;
    document.title = `${region.name}の一宮｜一宮巡礼帖`;
    root.innerHTML = pageShell(`
      <article class="folio-page">
        ${folioHeading({ number: "三", eyebrow: "地方の頁", title: region.name, intro: `${shrines.length}社のうち、${visited}社を参拝。`, backHref: "map.html", backLabel: "日本地図", seal: region.short })}
        <section class="folio-body">
          <div class="prefecture-grid folio-prefectures">
            ${provinces.map((province) => {
              const provinceShrines = shrines.filter((shrine) => shrine.province === province);
              const provinceVisited = provinceShrines.filter(isVisited).length;
              const present = currentPrefectures(provinceShrines).join("・");
              return `<a class="prefecture-ticket" href="province.html?province=${encodeURIComponent(province)}"><span class="province-ticket-name">${rubyMarkup(province, provinceReading(province))}</span><span class="province-ticket-meta"><small>${escapeHtml(present)}</small><b>${provinceVisited} / ${provinceShrines.length} 参拝</b></span></a>`;
            }).join("")}
          </div>
        </section>
      </article>`, "book-page");
  }

  function renderProvince() {
    const requested = query.get("province")?.replace("大隈国", "大隅国");
    const province = data.shrines.some((shrine) => shrine.province === requested) ? requested : data.shrines[0].province;
    const shrines = data.shrines.filter((shrine) => shrine.province === province);
    const region = data.regions.find((item) => item.id === shrines[0].region);
    const visited = shrines.filter(isVisited).length;
    const percent = Math.round((visited / shrines.length) * 100);
    const present = currentPrefectures(shrines).join("・");
    document.title = `${province}の一宮｜一宮巡礼帖`;
    root.innerHTML = pageShell(`
      <article class="folio-page">
        ${folioHeading({ number: "四", eyebrow: `${region.name}・旧国`, title: province, titleReading: provinceReading(province), intro: `${visited} / ${shrines.length}社を参拝。`, backHref: `region.html?region=${region.id}`, backLabel: region.name, seal: "国" })}
        <section class="folio-body">
          <p class="current-place"><span>鎮座地</span>${escapeHtml(present)}</p>
          <div class="pref-progress" aria-label="${visited}社参拝、全${shrines.length}社"><span style="width:${percent}%"></span><p><strong>${percent}%</strong> 参拝済み</p></div>
          <div class="card-grid folio-collection">${shrines.map(shrineCard).join("")}</div>
        </section>
      </article>`, "book-page");
  }

  function renderShrine() {
    const shrineId = document.body.dataset.shrineId || query.get("id");
    const shrine = data.shrines.find((item) => item.id === shrineId) || data.shrines[0];
    const currentVisit = visitValue(shrine);
    document.title = `${shrine.name}｜一宮巡礼帖`;
    root.innerHTML = pageShell(`
      <article class="spot-detail">
        <div class="detail-photo">
          <a class="folio-back detail-back" href="province.html?province=${encodeURIComponent(shrine.province)}">← ${rubyMarkup(shrine.province, shrine.provinceReading)}</a>
          <span class="photo-tape" aria-hidden="true"></span>
          ${photoFrame(shrine)}
        </div>
        <div class="detail-side">
          <p class="eyebrow"><span class="current-prefecture">${escapeHtml(shrine.prefecture)}</span>・${rubyMarkup(shrine.province, shrine.provinceReading)}一の宮</p>
          <h1>${rubyMarkup(shrine.name, shrine.nameReading)}</h1>
          ${shrine.deity ? `<div class="deity-list"><span>御祭神</span><p>${escapeHtml(shrine.deity)}</p>${shrine.deityReading ? `<small>読み：${escapeHtml(shrine.deityReading)}</small>` : ""}</div>` : ""}
          ${shrine.benefit ? `<p class="official-notice"><strong>御神徳</strong>${escapeHtml(shrine.benefit)}</p>` : ""}
          ${shrine.memo ? `<p class="detail-note">${escapeHtml(shrine.memo)}</p>` : ""}
          <div class="location-box">
            <p class="location-label">鎮座地</p>
            <p class="location-address">${escapeHtml(shrine.address)}</p>
            ${shrine.access ? `<p class="access-note">${escapeHtml(shrine.access)}</p>` : ""}
            <a class="map-link" href="${escapeHtml(shrine.map)}" target="_blank" rel="noopener noreferrer">地図で場所を確認する ↗</a>
          </div>
          <div class="visit-mark">
            <button id="visit-button" class="stamp-button" type="button" aria-pressed="${Boolean(currentVisit)}">${currentVisit ? "参拝済み" : "参拝の印を押す"}</button>
            <p>${typeof currentVisit === "string" ? `${escapeHtml(currentVisit)}　参拝` : (shrine.worshipped ? `${escapeHtml(shrine.worshipped)}　参拝` : "")}</p>
          </div>
          <p class="source-note">鎮座地などは<a href="${escapeHtml(shrine.source)}" target="_blank" rel="noopener noreferrer">全国一の宮巡拝会</a>および<a href="${escapeHtml(shrine.currentSource)}" target="_blank" rel="noopener noreferrer">一の宮公開情報</a>をもとに記載しています。参拝前に最新情報をご確認ください。</p>
        </div>
      </article>`, "book-page detail-book-page");

    document.getElementById("visit-button").addEventListener("click", () => {
      const visits = getVisits();
      if (isVisited(shrine)) {
        visits[shrine.id] = false;
      } else {
        const now = new Date();
        visits[shrine.id] = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
      }
      saveVisits(visits);
      renderShrine();
      bindPhotoFallbacks(root);
    });
  }

  function bindPageTurns() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http:") || href.startsWith("https:") || href.startsWith("mailto:")) return;
      event.preventDefault();
      document.body.classList.add("page-leaving");
      const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 360;
      const destination = link.href;
      window.setTimeout(() => { window.location.href = destination; }, delay);
    });
  }

  renderHeader();
  renderFooter();
  const renderers = { cover: renderCover, map: renderMapPage, list: renderList, region: renderRegion, province: renderProvince, shrine: renderShrine };
  (renderers[page] || renderCover)();
  bindPhotoFallbacks(root);
  bindPageTurns();
}());
