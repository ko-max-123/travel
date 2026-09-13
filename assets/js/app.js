(function () {
  "use strict";

  const data = window.POKEFUTA_DATA;
  const page = document.body.dataset.page;
  const root = document.querySelector("[data-page-root]");
  const query = new URLSearchParams(window.location.search);
  const visitedKey = "futain-tabicho-visits";

  const byId = (items, id) => items.find((item) => item.id === id);
  const prefectureOf = (spot) => byId(data.prefectures, spot.prefecture);

  function getVisits() {
    try { return JSON.parse(localStorage.getItem(visitedKey)) || {}; } catch (_) { return {}; }
  }

  function saveVisits(visits) {
    try { localStorage.setItem(visitedKey, JSON.stringify(visits)); } catch (_) {}
  }

  function visitValue(spot) {
    const visits = getVisits();
    if (Object.prototype.hasOwnProperty.call(visits, spot.id)) return visits[spot.id];
    return spot.visited ? (spot.photographed || true) : false;
  }

  function isVisited(spot) {
    return Boolean(visitValue(spot));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderHeader() {
    const header = document.querySelector("[data-site-header]");
    header.hidden = true;
  }

  function renderFooter() {
    const footer = document.querySelector("[data-site-footer]");
    footer.hidden = true;
  }

  function renderMap() {
    const pageNumbers = ["壱", "弐", "参", "四", "五", "六", "七", "八"];

    return `
      <div class="map-wrap map-spread">
        <figure class="map-sheet">
          <span class="map-sheet-label" aria-hidden="true">日本列島</span>
          <div class="map-graphic">
            <object type="image/svg+xml" data="assets/images/japan-regions-blank.svg" aria-label="地域を選べる日本地図">
              <img src="assets/images/japan-regions-blank.svg" alt="都道府県境と地域色を記した日本地図" width="570" height="755">
            </object>
          </div>
          <figcaption>色のついた地域を押すと、その地方の旅の頁がひらく。</figcaption>
        </figure>
        <nav class="region-index" aria-label="地域を選択">
          <p class="region-index-title">地方目次</p>
          ${data.regions.map((region, index) => {
            const regionSpots = data.spots.filter((spot) => region.prefectures.includes(spot.prefecture));
            const visited = regionSpots.filter(isVisited).length;
            return `
              <a href="region.html?region=${region.id}">
                <span class="region-index-number">${pageNumbers[index]}</span>
                <span class="region-index-copy">
                  <strong>${escapeHtml(region.name)}</strong>
                  <small>${escapeHtml(region.note)}</small>
                </span>
                <span class="region-index-count"><b>${visited}</b> / ${regionSpots.length}</span>
              </a>`;
          }).join("")}
        </nav>
      </div>`;
  }

  function photoFrame(spot) {
    const filename = spot.photo ? spot.photo.split("/").pop() : `pokefuta-${spot.id}.jpg`;
    return `
      <div class="photo-frame" data-filename="${escapeHtml(filename)}">
        <span class="photo-empty">写真はまだありません<small>${escapeHtml(filename)}</small></span>
        ${spot.photo ? `<img data-photo src="${escapeHtml(spot.photo)}" alt="${escapeHtml(spot.title)}の撮影写真">` : ""}
      </div>`;
  }

  function spotCard(spot) {
    const pref = prefectureOf(spot);
    const visited = isVisited(spot);
    return `
      <article class="spot-card ${visited ? "is-visited" : ""}">
        ${visited ? '<span class="mini-stamp" aria-label="訪問済み">訪問済</span>' : ""}
        <a href="spots/${spot.id}.html">
          ${photoFrame(spot)}
          <div class="spot-card-body">
            <p class="kicker">${escapeHtml(pref.name)}・${escapeHtml(spot.city)}</p>
            <h3>${escapeHtml(spot.area)}</h3>
            <p class="spot-address">${escapeHtml(spot.address)}</p>
          </div>
        </a>
      </article>`;
  }

  function bindPhotoFallbacks(scope) {
    scope.querySelectorAll("img[data-photo]").forEach((img) => {
      const markLoaded = () => img.closest(".photo-frame")?.classList.add("has-photo");
      const markMissing = () => {
        img.closest(".photo-frame")?.classList.add("is-missing");
        img.remove();
      };
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markMissing, { once: true });
      if (img.complete) {
        if (img.naturalWidth) markLoaded(); else markMissing();
      }
    });
  }

  function pageShell(content, extraClass = "") {
    return `<div id="top" class="page-shell ${extraClass}"><span class="binding" aria-hidden="true"></span>${content}</div>`;
  }

  function folioHeading({ number, eyebrow, title, intro, backHref, backLabel, seal }) {
    return `
      <header class="folio-head">
        <a class="folio-back" href="${backHref}">← ${escapeHtml(backLabel)}</a>
        <div class="folio-title-row">
          <div>
            <p class="folio-number">第 ${escapeHtml(number)} 頁</p>
            <p class="eyebrow">${escapeHtml(eyebrow)}</p>
            <h1 class="page-title">${escapeHtml(title)}</h1>
            <p class="page-intro">${escapeHtml(intro)}</p>
          </div>
          ${seal ? `<div class="big-seal" aria-hidden="true">${escapeHtml(seal)}</div>` : ""}
        </div>
      </header>`;
  }

  function folioNext(href, label) {
    return `<nav class="folio-next" aria-label="次の頁"><a href="${href}">${escapeHtml(label)} <span aria-hidden="true">›</span></a></nav>`;
  }

  function renderCover() {
    root.innerHTML = `
      <section id="top" class="cover-stage" aria-labelledby="cover-title">
        <a class="book-cover" href="map.html" aria-label="蓋印旅帖を開く">
          <span class="cover-binding" aria-hidden="true"></span>
          <span class="cover-corner cover-corner-top" aria-hidden="true"></span>
          <span class="cover-corner cover-corner-bottom" aria-hidden="true"></span>
          <span class="cover-label">
            <small>ぽけふた</small>
            <strong id="cover-title">蓋印旅帖</strong>
            <i aria-hidden="true">旅</i>
          </span>
          <span class="cover-owner">わたしの旅の記録</span>
        </a>
        <a class="cover-open" href="map.html">表紙をひらく <span aria-hidden="true">›</span></a>
        <a class="books-home" href="archive.html">以前の三冊へ</a>
      </section>`;
  }

  function renderMapPage() {
    root.innerHTML = pageShell(`
      <article class="folio-page folio-map">
        ${folioHeading({ number: "一", eyebrow: "旅の目次", title: "ポケフタ旅", intro: "行きたい地方を選ぶ。", backHref: "pokefuta.html", backLabel: "表紙", seal: "道" })}
        ${renderMap()}
        ${folioNext("list.html", "全国の蓋を見る")}
      </article>`, "book-page");
  }

  function renderList() {
    root.innerHTML = pageShell(`
      <article class="folio-page">
        ${folioHeading({ number: "二", eyebrow: "集めた記録", title: "全国の蓋", intro: `${data.spots.length}枚の旅のしるし。`, backHref: "map.html", backLabel: "日本地図", seal: "蓋" })}
        <section class="folio-body">
          <div class="card-grid folio-collection">${data.spots.map(spotCard).join("")}</div>
        </section>
      </article>`, "book-page");
  }

  function renderRegion() {
    const region = byId(data.regions, query.get("region")) || byId(data.regions, "tohoku");
    const prefs = data.prefectures.filter((pref) => pref.region === region.id);
    document.title = `${region.name}の旅｜蓋印旅帖`;
    root.innerHTML = pageShell(`
      <article class="folio-page">
        ${folioHeading({ number: "三", eyebrow: "地方の頁", title: region.name, intro: region.note, backHref: "map.html", backLabel: "日本地図", seal: region.short })}
        <section class="folio-body">
          <div class="prefecture-grid folio-prefectures">
            ${prefs.map((pref) => {
              const prefSpots = data.spots.filter((spot) => spot.prefecture === pref.id);
              const visited = prefSpots.filter(isVisited).length;
              return `<a class="prefecture-ticket ${prefSpots.length ? "" : "is-empty"}" href="prefecture.html?pref=${pref.id}">${pref.name}<span>${prefSpots.length ? `${visited} / ${prefSpots.length} 訪問` : "設置なし"}</span></a>`;
            }).join("")}
          </div>
        </section>
      </article>`, "book-page");
  }

  function renderPrefecture() {
    const pref = byId(data.prefectures, query.get("pref")) || byId(data.prefectures, "miyagi");
    const region = byId(data.regions, pref.region);
    const spots = data.spots.filter((spot) => spot.prefecture === pref.id);
    const visited = spots.filter(isVisited).length;
    const percent = spots.length ? Math.round((visited / spots.length) * 100) : 0;
    document.title = `${pref.name}のポケふた｜蓋印旅帖`;
    root.innerHTML = pageShell(`
      <article class="folio-page">
        ${folioHeading({ number: "四", eyebrow: region.name, title: pref.name, intro: spots.length ? `${visited} / ${spots.length}枚を訪問。` : "現在、公式の設置情報はありません。", backHref: `region.html?region=${region.id}`, backLabel: region.name, seal: pref.name.replace(/[都道府県]/g, "") })}
        <section class="folio-body">
          ${spots.length ? `<div class="pref-progress" aria-label="${visited}件訪問、全${spots.length}件"><span style="width:${percent}%"></span><p><strong>${percent}%</strong> 訪問済み</p></div>` : ""}
          <div class="card-grid folio-collection">${spots.length ? spots.map(spotCard).join("") : `<div class="empty-note">まだ写真を貼っていません。</div>`}</div>
        </section>
      </article>`, "book-page");
  }

  function renderSpot() {
    const spotId = document.body.dataset.spotId || query.get("id");
    const spot = byId(data.spots, spotId) || data.spots[0];
    const pref = prefectureOf(spot);
    const currentVisit = visitValue(spot);
    const mapUrl = spot.officialMap || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(spot.address)}`;
    const note = spot.memo || spot.about;
    document.title = `${spot.title}｜蓋印旅帖`;
    root.innerHTML = pageShell(`
      <article class="spot-detail">
        <div class="detail-photo">
          <a class="folio-back detail-back" href="prefecture.html?pref=${pref.id}">← ${escapeHtml(pref.name)}</a>
          <span class="photo-tape" aria-hidden="true"></span>
          ${photoFrame(spot)}
        </div>
        <div class="detail-side">
          <p class="eyebrow">${escapeHtml(pref.name)}・${escapeHtml(spot.city)}</p>
          <h1>${escapeHtml(spot.city)}</h1>
          ${spot.pokemon?.length ? `<p class="pokemon-list">${spot.pokemon.map(escapeHtml).join("・")}</p>` : ""}
          ${spot.notice ? `<p class="official-notice">${escapeHtml(spot.notice)}</p>` : ""}
          ${note ? `<p class="detail-note">${escapeHtml(note)}</p>` : ""}
          <div class="location-box">
            <p class="location-label">設置場所</p>
            <p class="location-address">${escapeHtml(spot.address)}</p>
            <a class="map-link" href="${mapUrl}" target="_blank" rel="noopener noreferrer">地図で場所を確認する ↗</a>
          </div>
          <div class="visit-mark">
            <button id="visit-button" class="stamp-button" type="button" aria-pressed="${Boolean(currentVisit)}">${currentVisit ? "訪問済み" : "訪問の印を押す"}</button>
            <p>${typeof currentVisit === "string" ? `${escapeHtml(currentVisit)}　訪問` : (spot.photographed ? `${escapeHtml(spot.photographed)}　撮影` : "")}</p>
          </div>
          <p class="source-note">設置場所は<a href="${escapeHtml(spot.source)}" target="_blank" rel="noopener noreferrer">ポケふた公式情報</a>をもとに記載しています。訪問前に最新情報をご確認ください。</p>
        </div>
      </article>`, "book-page detail-book-page");

    document.getElementById("visit-button").addEventListener("click", () => {
      const visits = getVisits();
      if (isVisited(spot)) {
        visits[spot.id] = false;
      } else {
        const now = new Date();
        visits[spot.id] = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
      }
      saveVisits(visits);
      renderSpot();
      bindPhotoFallbacks(root);
    });
  }

  renderHeader();
  renderFooter();

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

  const renderers = { cover: renderCover, map: renderMapPage, list: renderList, region: renderRegion, prefecture: renderPrefecture, spot: renderSpot };
  (renderers[page] || renderCover)();
  bindPhotoFallbacks(root);
  bindPageTurns();
}());
