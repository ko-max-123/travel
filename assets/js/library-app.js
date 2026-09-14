(function () {
  "use strict";

  const app = document.querySelector("#app");
  const dialogRoot = document.querySelector("#dialog-root");
  const store = window.CollectionStore;
  const { colors, regions } = window.COLLECTION_LIBRARY_DATA;
  const allPrefectures = regions.flatMap((region) => region.prefectures);
  const numerals = ["壱", "弐", "参", "四", "五", "六", "七", "八"];
  const tutorialStorageKey = "collection-notebooks-tutorial-v1";
  let renderToken = 0;
  let activeObjectUrls = [];
  let saveTimer = 0;
  let previousRoute = null;
  let turnDirection = "none";
  let turnTimer = 0;
  let photoObserver = null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function rubyMarkup(text, reading) {
    const safeText = escapeHtml(text);
    return reading ? `<ruby>${safeText}<rt>${escapeHtml(reading)}</rt></ruby>` : safeText;
  }

  function routeHref(...parts) {
    return `#${parts.map((part) => encodeURIComponent(part)).join("/")}`;
  }

  function readRoute() {
    const raw = window.location.hash.replace(/^#\/?/, "");
    if (!raw) return ["shelf"];
    try {
      return raw.split("/").map(decodeURIComponent);
    } catch {
      return ["shelf"];
    }
  }

  function routeDepth(route) {
    return { shelf: 0, book: 1, map: 2, region: 3, prefecture: 4, entry: 5 }[route?.[0]] ?? 0;
  }

  function pageTurnDirection(from, to) {
    if (!from) return "none";
    return routeDepth(to) < routeDepth(from) ? "back" : "forward";
  }

  function reducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }

  async function turnPageOut(direction) {
    window.clearTimeout(turnTimer);
    app.className = "";
    if (direction === "none" || reducedMotion() || !app.firstElementChild) return;
    app.classList.add(`page-turn-out-${direction}`);
    await new Promise((resolve) => window.setTimeout(resolve, 170));
    app.className = "";
  }

  function setAppHtml(markup) {
    app.className = "";
    app.innerHTML = markup;
    if (turnDirection === "none" || reducedMotion()) return;
    void app.offsetWidth;
    const className = `page-turn-in-${turnDirection}`;
    app.classList.add(className);
    turnTimer = window.setTimeout(() => app.classList.remove(className), 560);
  }

  function bindMapRegions(book) {
    const mapObject = app.querySelector("[data-map-object]");
    if (!mapObject) return;

    const bindLinks = () => {
      let documentInMap;
      try {
        documentInMap = mapObject.contentDocument;
      } catch {
        return;
      }
      documentInMap?.querySelectorAll(".region-link").forEach((link) => {
        if (link.dataset.collectionBound === "true") return;
        const rawHref = link.getAttribute("href") || link.getAttribute("xlink:href") || link.getAttributeNS("http://www.w3.org/1999/xlink", "href") || "";
        const match = rawHref.match(/[?&]region=([^&#]+)/);
        const regionId = match ? decodeURIComponent(match[1]) : "";
        if (!regions.some((region) => region.id === regionId)) return;
        link.dataset.collectionBound = "true";
        link.addEventListener("click", (event) => {
          event.preventDefault();
          window.location.hash = routeHref("region", book.id, regionId);
        });
      });
    };

    mapObject.addEventListener("load", bindLinks, { once: true });
    try {
      if (mapObject.contentDocument?.readyState === "complete") bindLinks();
    } catch {
      // file:// などでSVG内部へアクセスできなくても、地方名リンクは利用できる。
    }
  }

  function formatDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日` : "日付未記入";
  }

  function recordName(book) {
    if (book.template === "pokefuta") return "ポケフタ";
    if (book.template === "ichinomiya") return "神社";
    return "記録";
  }

  function recordUnit(book) {
    if (book.template === "pokefuta") return "枚";
    if (book.template === "ichinomiya") return "社";
    return "件";
  }

  function templateLabel(book) {
    if (book.template === "pokefuta") return "ポケフタ用テンプレート";
    if (book.template === "ichinomiya") return "一宮用テンプレート";
    return "自分で作った収集帳";
  }

  function isVisited(entry) {
    return entry.catalog ? Boolean(entry.visited) : true;
  }

  function entryStats(book, entries) {
    const visited = entries.filter(isVisited);
    return {
      total: entries.length,
      visited: visited.length,
      prefectures: new Set(visited.map((entry) => entry.prefecture)).size,
      isTemplate: book.template === "pokefuta" || book.template === "ichinomiya"
    };
  }

  function templateCountText(book, entries) {
    const stats = entryStats(book, entries);
    return stats.isTemplate
      ? `${stats.visited} / ${stats.total}${recordUnit(book)}`
      : `${stats.prefectures}都道府県・${stats.total}${recordName(book)}`;
  }

  function setTheme(color = "#5c4935") {
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
  }

  function releaseObjectUrls() {
    activeObjectUrls.forEach((url) => URL.revokeObjectURL(url));
    activeObjectUrls = [];
  }

  function makeObjectUrl(file) {
    const url = URL.createObjectURL(file);
    activeObjectUrls.push(url);
    return url;
  }

  function paperShell(content, book, extraClass = "") {
    const color = book?.color || "#5c4935";
    return `<div class="paper-shell ${extraClass}" style="--book-color:${escapeHtml(color)}"><span class="page-binding" aria-hidden="true"></span>${content}</div>`;
  }

  function hasSeenTutorial() {
    try {
      return window.localStorage.getItem(tutorialStorageKey) === "done";
    } catch {
      return false;
    }
  }

  function rememberTutorial() {
    try {
      window.localStorage.setItem(tutorialStorageKey, "done");
    } catch {
      // 保存できない環境でも、現在の利用はそのまま続ける。
    }
  }

  function openTutorial() {
    const pages = [
      {
        mark: "壱",
        eyebrow: "この手帳について",
        title: "旅の記録を、自分のために",
        body: `
          <p>訪れた場所の写真や言葉を、都道府県ごとの頁に残す個人用の収集手帳です。</p>
          <ul>
            <li>ポケフタと一宮は、地名や件数が入った状態で使えます。</li>
            <li>自分で作る帳には、好きな収集テーマを記録できます。</li>
            <li>写真・場所・日付・メモをひとつの頁にまとめられます。</li>
          </ul>`
      },
      {
        mark: "弐",
        eyebrow: "利用できる範囲",
        title: "帳と写真の制限",
        body: `
          <ul>
            <li>自分で追加できる帳は、デフォルトの2冊とは別に3冊までです。</li>
            <li>帳の名前は1〜12文字で、表紙は16色から選びます。</li>
            <li>写真は最大1500枚規模を想定して軽量化しますが、実際に保存できる枚数は端末の空き容量によって変わります。</li>
          </ul>`
      },
      {
        mark: "参",
        eyebrow: "大切な注意事項",
        title: "記録は、この端末の中だけ",
        body: `
          <ul>
            <li>帳・文章・軽量化した写真はサーバーへ送られず、この端末のブラウザ内に保存されます。</li>
            <li>アカウント同期やバックアップ機能はありません。別の端末へ自動では引き継がれません。</li>
            <li>ブラウザのサイトデータを削除すると、記録や写真も消えます。</li>
          </ul>
          <p class="tutorial-caution">端末の「データを消去」は行わず、大切な元写真は写真アプリにも残してください。</p>`
      }
    ];
    let pageIndex = 0;

    dialogRoot.innerHTML = `
      <dialog class="book-dialog tutorial-dialog" aria-labelledby="tutorial-title">
        <div class="dialog-sheet tutorial-sheet">
          <div class="tutorial-progress" aria-label="案内の進み具合">
            ${pages.map((_, index) => `<span data-tutorial-dot="${index}">${index + 1}</span>`).join("")}
          </div>
          <div class="tutorial-page" data-tutorial-page></div>
          <div class="tutorial-actions">
            <button class="tutorial-back" type="button" data-tutorial-back>前へ</button>
            <button class="primary-button tutorial-next" type="button" data-tutorial-next>次へ</button>
          </div>
        </div>
      </dialog>`;

    const dialog = dialogRoot.querySelector("dialog");
    const page = dialogRoot.querySelector("[data-tutorial-page]");
    const backButton = dialogRoot.querySelector("[data-tutorial-back]");
    const nextButton = dialogRoot.querySelector("[data-tutorial-next]");

    const renderPage = () => {
      const current = pages[pageIndex];
      page.innerHTML = `
        <span class="tutorial-seal" aria-hidden="true">${current.mark}</span>
        <p class="eyebrow">${current.eyebrow}</p>
        <h2 id="tutorial-title">${current.title}</h2>
        <div class="tutorial-copy">${current.body}</div>`;
      dialogRoot.querySelectorAll("[data-tutorial-dot]").forEach((dot, index) => {
        dot.classList.toggle("is-current", index === pageIndex);
      });
      backButton.hidden = pageIndex === 0;
      nextButton.textContent = pageIndex === pages.length - 1 ? "手帳をはじめる" : "次へ";
      nextButton.focus();
    };

    dialog.addEventListener("cancel", (event) => event.preventDefault());
    backButton.addEventListener("click", () => {
      if (pageIndex > 0) {
        pageIndex -= 1;
        renderPage();
      }
    });
    nextButton.addEventListener("click", () => {
      if (pageIndex < pages.length - 1) {
        pageIndex += 1;
        renderPage();
        return;
      }
      rememberTutorial();
      dialog.close();
    });
    dialog.addEventListener("close", () => { dialogRoot.innerHTML = ""; }, { once: true });

    dialog.showModal();
    renderPage();
  }

  function confirmDeletion(message, confirmLabel = "削除する") {
    return new Promise((resolve) => {
      dialogRoot.innerHTML = `
        <dialog class="book-dialog confirm-dialog" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-message">
          <div class="dialog-sheet confirm-sheet">
            <p class="eyebrow">大切な記録の確認</p>
            <h2 id="delete-confirm-title">本当に削除しますか</h2>
            <p class="confirm-message" id="delete-confirm-message">${escapeHtml(message)}</p>
            <div class="confirm-actions">
              <button class="confirm-cancel" type="button" data-confirm-cancel>削除しない</button>
              <button class="confirm-delete" type="button" data-confirm-delete>${escapeHtml(confirmLabel)}</button>
            </div>
          </div>
        </dialog>`;

      const dialog = dialogRoot.querySelector("dialog");
      const cancelButton = dialogRoot.querySelector("[data-confirm-cancel]");
      const deleteButton = dialogRoot.querySelector("[data-confirm-delete]");

      const closeDialog = (confirmed) => {
        dialog.returnValue = confirmed ? "delete" : "cancel";
        dialog.close();
      };

      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeDialog(false);
      });
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) closeDialog(false);
      });
      dialog.addEventListener("close", () => {
        const confirmed = dialog.returnValue === "delete";
        dialogRoot.innerHTML = "";
        resolve(confirmed);
      }, { once: true });
      cancelButton?.addEventListener("click", () => closeDialog(false));
      deleteButton?.addEventListener("click", () => closeDialog(true));

      dialog.showModal();
      cancelButton?.focus();
    });
  }

  function folioHead({ backHref, backLabel, eyebrow, title, intro, seal = "集", actions = "" }) {
    return `
      <header class="folio-head">
        <div class="folio-nav">
          <a class="folio-back" href="${backHref}">← ${escapeHtml(backLabel)}</a>
          ${actions}
        </div>
        <div class="folio-title-row">
          <div>
            <p class="eyebrow">${escapeHtml(eyebrow)}</p>
            <h1>${escapeHtml(title)}</h1>
            <p class="page-intro">${escapeHtml(intro)}</p>
          </div>
          <span class="page-seal" aria-hidden="true">${escapeHtml(seal)}</span>
        </div>
      </header>`;
  }

  async function requestPersistentStorage() {
    try {
      if (navigator.storage?.persist) await navigator.storage.persist();
    } catch {
      // 保存可否はブラウザに委ね、操作自体は続行する。
    }
  }

  async function renderShelf(token) {
    setTheme();
    document.title = "わたしの収集手帳";
    const books = await store.getBooks();
    const booksWithCounts = await Promise.all(books.map(async (book) => ({
      book,
      entries: await store.getEntries(book.id)
    })));
    if (token !== renderToken) return;
    const customBookCount = books.filter((book) => book.template === "custom").length;
    const canCreateBook = customBookCount < 3;

    setAppHtml(`
      <section class="shelf-page">
        <header class="shelf-heading">
          <p>端末に綴る、わたしだけの記録</p>
          <h1>収集手帳</h1>
          <span>開く帳を選ぶ</span>
        </header>
        <div class="book-shelf" aria-label="収集手帳の本棚">
          ${booksWithCounts.map(({ book, entries }) => {
            return `
              <a class="shelf-book" href="${routeHref("book", book.id)}" style="--cover:${escapeHtml(book.color)}">
                <span class="shelf-cover">
                  <span class="shelf-binding" aria-hidden="true"></span>
                  <span class="shelf-label"><small>${escapeHtml(templateLabel(book))}</small><strong>${escapeHtml(book.name)}</strong><i aria-hidden="true">集</i></span>
                  <span class="shelf-count">${escapeHtml(templateCountText(book, entries))}</span>
                </span>
              </a>`;
          }).join("")}
          <button class="shelf-book guide-book" type="button" data-action="open-guide" style="--cover:#544d43">
            <span class="shelf-cover">
              <span class="shelf-binding" aria-hidden="true"></span>
              <span class="shelf-label"><small>この手帳について</small><strong>使い方・注意</strong><i aria-hidden="true">案</i></span>
              <span class="shelf-count">いつでも読めます</span>
            </span>
          </button>
          <button class="new-book" type="button" data-action="new-book" ${canCreateBook ? "" : "disabled"}>
            <span aria-hidden="true">${canCreateBook ? "＋" : "三"}</span>
            <strong>${canCreateBook ? "新しい帳" : "3冊作成済み"}</strong>
            <small>${canCreateBook ? `あと${3 - customBookCount}冊作れます` : "新しい帳は3冊まで"}</small>
          </button>
        </div>
        <footer class="shelf-foot">
          <p>文字と帳は、この端末の中だけに保存されます。</p>
        </footer>
      </section>`);

    if (canCreateBook) app.querySelector('[data-action="new-book"]')?.addEventListener("click", () => openBookDialog());
    app.querySelector('[data-action="open-guide"]')?.addEventListener("click", openTutorial);
  }

  async function renderCover(bookId, token) {
    const [book, entries] = await Promise.all([store.getBook(bookId), store.getEntries(bookId)]);
    if (!book) return renderMissing("帳が見つかりません。", "#", "本棚へ戻る");
    if (token !== renderToken) return;
    const stats = entryStats(book, entries);
    setTheme(book.color);
    document.title = `${book.name}｜表紙`;

    setAppHtml(`
      <section class="book-cover-page" style="--cover:${escapeHtml(book.color)};--book-color:${escapeHtml(book.color)}">
        <a class="book-cover-back" href="#">← 本棚へ戻る</a>
        <div class="book-cover-object" aria-label="${escapeHtml(book.name)}の表紙">
          <span class="shelf-binding" aria-hidden="true"></span>
          <span class="shelf-label">
            <small>${escapeHtml(templateLabel(book))}</small>
            <strong>${escapeHtml(book.name)}</strong>
            <i aria-hidden="true">集</i>
          </span>
          <span class="shelf-count">${escapeHtml(templateCountText(book, entries))}</span>
        </div>
        <div class="book-cover-actions">
          <a class="book-open-button" href="${routeHref("map", book.id)}">この帳を開く</a>
          <button type="button" data-action="edit-book">表紙を整える</button>
          ${stats.isTemplate ? "" : `<button class="danger-link" type="button" data-action="delete-book">この帳を削除</button>`}
        </div>
      </section>`);

    app.querySelector('[data-action="edit-book"]')?.addEventListener("click", () => openBookDialog(book));
    app.querySelector('[data-action="delete-book"]')?.addEventListener("click", async () => {
      if (!await confirmDeletion(`「${book.name}」と中の記録をすべて削除します。この操作は取り消せません。`, "帳を削除する")) return;
      await store.deleteBook(book.id);
      window.location.hash = "";
      await renderRoute();
    });
  }

  async function renderBook(bookId, token) {
    const book = await store.getBook(bookId);
    if (!book) return renderMissing("帳が見つかりません。", "#", "本棚へ戻る");
    const entries = await store.getEntries(bookId);
    if (token !== renderToken) return;
    setTheme(book.color);
    document.title = `${book.name}｜収集手帳`;
    const stats = entryStats(book, entries);
    const visited = new Set(entries.filter(isVisited).map((entry) => entry.prefecture));
    const intro = stats.isTemplate
      ? `${stats.total}${recordUnit(book)}のうち、${stats.visited}${recordUnit(book)}を訪問。`
      : `47都道府県のうち、${stats.prefectures}都道府県に${stats.total}件の記録。`;
    setAppHtml(paperShell(`
      <article class="folio-page">
        ${folioHead({ backHref: routeHref("book", book.id), backLabel: "表紙", eyebrow: templateLabel(book), title: book.name, intro, seal: "帳" })}
        <section class="map-spread">
          <figure class="map-sheet">
            <div class="map-graphic">
              <object data-map-object data="assets/images/japan-regions-blank.svg" type="image/svg+xml" aria-label="地方ごとに色分けした日本地図" width="570" height="755">
                <img src="assets/images/japan-regions-blank.svg" alt="地方ごとに色分けした日本地図" width="570" height="755">
              </object>
              ${regions.map((region) => `<a class="map-hit map-hit-${region.id}" href="${routeHref("region", book.id, region.id)}">${escapeHtml(region.name)}</a>`).join("")}
            </div>
            <figcaption>地方を押して、都道府県を選ぶ。</figcaption>
          </figure>
          <nav class="region-index" aria-label="地方を選択">
            <p class="region-index-title">地方目次</p>
            ${regions.map((region, index) => {
              const regionEntries = entries.filter((entry) => region.prefectures.includes(entry.prefecture));
              const count = stats.isTemplate ? regionEntries.filter(isVisited).length : region.prefectures.filter((prefecture) => visited.has(prefecture)).length;
              const total = stats.isTemplate ? regionEntries.length : region.prefectures.length;
              return `<a href="${routeHref("region", book.id, region.id)}"><span>${numerals[index]}</span><strong>${escapeHtml(region.name)}</strong><small>${count} / ${total}</small></a>`;
            }).join("")}
          </nav>
        </section>
      </article>`, book, "book-page"));

    bindMapRegions(book);

  }

  async function renderRegion(bookId, regionId, token) {
    const [book, entries] = await Promise.all([store.getBook(bookId), store.getEntries(bookId)]);
    if (!book) return renderMissing("帳が見つかりません。", "#", "本棚へ戻る");
    const region = regions.find((item) => item.id === regionId) || regions[0];
    if (token !== renderToken) return;
    setTheme(book.color);
    document.title = `${region.name}｜${book.name}`;
    const stats = entryStats(book, entries);
    const regionEntries = entries.filter((entry) => region.prefectures.includes(entry.prefecture));
    const regionIntro = stats.isTemplate
      ? `${regionEntries.length}${recordUnit(book)}を、都道府県ごとに収録しています。`
      : `${region.prefectures.length}都道府県から、記録する場所を選びます。`;

    setAppHtml(paperShell(`
      <article class="folio-page">
        ${folioHead({ backHref: routeHref("map", book.id), backLabel: "日本地図", eyebrow: "都道府県を選ぶ", title: region.name, intro: regionIntro, seal: region.mark })}
        <section class="folio-body">
          <div class="prefecture-grid">
            ${region.prefectures.map((prefecture) => {
              const prefectureEntries = entries.filter((entry) => entry.prefecture === prefecture);
              const visitedCount = prefectureEntries.filter(isVisited).length;
              const label = stats.isTemplate
                ? `${visitedCount} / ${prefectureEntries.length}`
                : (prefectureEntries.length ? `${prefectureEntries.length}件` : "未記録");
              return `<a class="prefecture-ticket ${visitedCount ? "has-record" : ""}" href="${routeHref("prefecture", book.id, prefecture)}"><strong>${escapeHtml(prefecture)}</strong><span>${escapeHtml(label)}</span></a>`;
            }).join("")}
          </div>
        </section>
      </article>`, book, "book-page"));
  }

  async function renderPrefecture(bookId, prefecture, token) {
    const book = await store.getBook(bookId);
    if (!book) return renderMissing("帳が見つかりません。", "#", "本棚へ戻る");
    const safePrefecture = allPrefectures.includes(prefecture) ? prefecture : "東京都";
    const entries = await store.getEntries(bookId, safePrefecture);
    const region = regions.find((item) => item.prefectures.includes(safePrefecture));
    if (token !== renderToken) return;
    setTheme(book.color);
    document.title = `${safePrefecture}｜${book.name}`;
    const noun = recordName(book);
    const stats = entryStats(book, entries);
    const intro = stats.isTemplate
      ? `${entries.length}${recordUnit(book)}のうち、${stats.visited}${recordUnit(book)}を訪問。`
      : (entries.length ? `${entries.length}件の${noun}を綴じています。` : `この都道府県の${noun}はまだありません。`);
    const addLabel = stats.isTemplate ? `登録外の${noun}を追加` : `${noun}を追加`;

    setAppHtml(paperShell(`
      <article class="folio-page">
        ${folioHead({ backHref: routeHref("region", book.id, region.id), backLabel: region.name, eyebrow: `${book.name}の記録`, title: safePrefecture, intro, seal: "記" })}
        <section class="folio-body">
          <div class="page-command"><button class="primary-button" type="button" data-action="new-entry">＋ ${escapeHtml(addLabel)}</button></div>
          <div class="entry-grid">
            ${entries.length ? entries.map((entry) => `
              <article class="entry-card ${isVisited(entry) ? "is-visited" : "is-unvisited"}">
                <a href="${routeHref("entry", book.id, entry.id)}">
                  <div class="entry-photo" data-entry-photo="${escapeHtml(entry.id)}"><span>写真はまだありません</span></div>
                  <div class="entry-card-copy">
                    <p>${rubyMarkup(entry.catalogMeta || safePrefecture, entry.catalogMetaReading)}</p>
                    <h2>${rubyMarkup(entry.title, entry.titleReading)}</h2>
                    ${entry.catalog && entry.location ? `<small class="entry-address">${escapeHtml(entry.location)}</small>` : ""}
                    <time datetime="${escapeHtml(entry.visitedOn)}">${escapeHtml(isVisited(entry) ? formatDate(entry.visitedOn) : "未訪問")}</time>
                  </div>
                </a>
              </article>`).join("") : `<p class="empty-note">最初の${escapeHtml(noun)}を、この頁に追加できます。</p>`}
          </div>
        </section>
      </article>`, book, "book-page"));

    app.querySelector('[data-action="new-entry"]')?.addEventListener("click", () => openEntryDialog(book, safePrefecture));
    hydrateEntryPhotos(entries, token);
  }

  async function mediaFile(media, askPermission) {
    if (!media) return { file: null, needsPermission: false };
    if (media.blob instanceof Blob) return { file: media.blob, needsPermission: false };
    if (media.mode === "reference" && media.handle?.getFile) {
      try {
        let permission = "granted";
        if (media.handle.queryPermission) permission = await media.handle.queryPermission({ mode: "read" });
        if (permission !== "granted" && askPermission && media.handle.requestPermission) {
          permission = await media.handle.requestPermission({ mode: "read" });
        }
        if (permission === "granted") return { file: await media.handle.getFile(), needsPermission: false };
        return { file: null, needsPermission: true };
      } catch {
        return { file: null, needsPermission: true };
      }
    }
    return { file: null, needsPermission: false };
  }

  async function optimizeStoredMedia(media, file) {
    if (!media || media.optimized || !(file instanceof Blob)) return media;
    const optimized = await optimizePhoto(file);
    const nextMedia = {
      ...media,
      ...optimized,
      fileName: media.fileName || file.name || "photo",
      originalBytes: media.originalBytes || file.size
    };
    try {
      return await store.saveMedia(nextMedia);
    } catch {
      try {
        return await store.saveMedia({
          entryId: media.entryId,
          mode: "copy",
          ...optimized,
          fileName: media.fileName || file.name || "photo",
          originalBytes: media.originalBytes || file.size
        });
      } catch {
        return media;
      }
    }
  }

  function hydrateEntryPhotos(entries, token) {
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));
    const frames = [...app.querySelectorAll("[data-entry-photo]")];

    const loadFrame = async (frame) => {
      if (frame.dataset.photoLoaded === "true") return;
      frame.dataset.photoLoaded = "true";
      const entry = entryById.get(frame.dataset.entryPhoto);
      if (!entry) return;
      const media = await store.getMedia(entry.id);
      if (token !== renderToken || !frame.isConnected) return;
      const preview = media?.thumbnailBlob instanceof Blob ? media.thumbnailBlob : null;
      if (preview) {
        const url = makeObjectUrl(preview);
        frame.classList.add("has-photo");
        frame.innerHTML = `<img src="${url}" alt="${escapeHtml(entry.title)}の写真" loading="lazy" decoding="async">`;
      } else if (media) {
        frame.innerHTML = "<span>詳細を開くと画像を軽量化します</span>";
      }
    };

    photoObserver?.disconnect();
    if ("IntersectionObserver" in window) {
      photoObserver = new IntersectionObserver((observed) => {
        observed.forEach((item) => {
          if (!item.isIntersecting) return;
          photoObserver?.unobserve(item.target);
          loadFrame(item.target);
        });
      }, { rootMargin: "320px 0px" });
      frames.forEach((frame) => photoObserver.observe(frame));
    } else {
      frames.forEach(loadFrame);
    }
  }

  async function renderEntry(bookId, entryId, token) {
    const [book, entry, storedMedia] = await Promise.all([
      store.getBook(bookId),
      store.getEntry(entryId),
      store.getMedia(entryId)
    ]);
    if (!book || !entry || entry.bookId !== book.id) return renderMissing("記録が見つかりません。", "#", "本棚へ戻る");
    let media = storedMedia;
    let image = await mediaFile(media, false);
    if (image.file && media && !media.optimized) {
      media = await optimizeStoredMedia(media, image.file);
      image = { file: media.blob instanceof Blob ? media.blob : image.file, needsPermission: false };
    }
    if (token !== renderToken) return;
    setTheme(book.color);
    document.title = `${entry.title}｜${book.name}`;
    const photoMarkup = image.file
      ? `<img src="${makeObjectUrl(image.file)}" alt="${escapeHtml(entry.title)}の写真">`
      : `<div class="detail-photo-empty"><span aria-hidden="true">写</span><strong>${image.needsPermission ? "写真を開くには許可が必要です" : "写真はまだありません"}</strong><small>${escapeHtml(media?.fileName || "端末内の写真を選べます")}</small></div>`;
    const hasReferencePreview = media?.mode === "reference" && (media?.blob instanceof Blob || image.file instanceof Blob);
    const storageText = hasReferencePreview
      ? "元の画像を参照し、再表示用の軽量データもこの端末内だけに保持しています。"
      : media?.mode === "reference"
        ? "元の画像ファイルを参照しています。表示できない場合は、一度だけアクセスを許可してください。"
        : media?.mode === "copy"
          ? "画像はアップロードせず、軽量化してこの端末の手帳内だけに保存しています。"
          : "スマホでは端末の写真から選べます。画像はアップロードされません。";
    const photoPickerLabel = useSystemPhotoLibrary()
      ? (media ? "フォトから選び直す" : "フォトから選ぶ")
      : (media ? "写真を選び直す" : "写真を選ぶ");

    setAppHtml(paperShell(`
      <article class="detail-page">
        <section class="detail-photo-panel">
          <a class="folio-back" href="${routeHref("prefecture", book.id, entry.prefecture)}">← ${escapeHtml(entry.prefecture)}</a>
          <span class="photo-tape" aria-hidden="true"></span>
          <div class="detail-photo-frame">${photoMarkup}</div>
          <div class="photo-controls">
            ${image.needsPermission ? `<button type="button" data-action="grant-photo">写真を表示</button>` : ""}
            <button type="button" data-action="choose-photo">${photoPickerLabel}</button>
            ${media ? `<button class="danger-link" type="button" data-action="remove-photo">写真を外す</button>` : ""}
          </div>
          <p class="storage-note">${escapeHtml(storageText)}</p>
        </section>
        <section class="detail-editor">
          <p class="eyebrow">${escapeHtml(book.name)}・${escapeHtml(entry.prefecture)}</p>
          ${entry.catalogMeta ? `<p class="catalog-meta"><strong>${entry.catalogKind === "ichinomiya" ? "旧国名" : "登場するポケモン"}</strong>${rubyMarkup(entry.catalogMeta, entry.catalogMetaReading)}</p>` : ""}
          ${entry.titleReading ? `<p class="catalog-meta"><strong>神社名の読み</strong>${escapeHtml(entry.titleReading)}</p>` : ""}
          ${entry.deity ? `<p class="catalog-meta"><strong>御祭神</strong>${escapeHtml(entry.deity)}${entry.deityReading ? `<small>読み：${escapeHtml(entry.deityReading)}</small>` : ""}</p>` : ""}
          <form class="entry-form" data-entry-form>
            ${entry.catalog ? `<label class="visit-field"><input name="visited" type="checkbox" ${entry.visited ? "checked" : ""}><span>訪問済みにする</span></label>` : ""}
            <label><span>記録の名前</span><input name="title" value="${escapeHtml(entry.title)}" required maxlength="80"></label>
            <label><span>場所</span><input name="location" value="${escapeHtml(entry.location)}" maxlength="120" placeholder="市町村、施設名など"></label>
            <label><span>日付</span><input name="visitedOn" type="date" value="${escapeHtml(entry.visitedOn)}"></label>
            <label class="note-field"><span>この頁に残すこと</span><textarea name="note" rows="10" placeholder="見つけたときのこと、印象、また訪れたい理由など">${escapeHtml(entry.note)}</textarea></label>
            <p class="save-status" role="status" data-save-status>入力内容はこの端末に自動保存されます</p>
          </form>
          ${entry.catalog
            ? `<button class="delete-entry" type="button" data-action="clear-entry">訪問記録を消す</button>`
            : `<button class="delete-entry" type="button" data-action="delete-entry">この記録を削除</button>`}
        </section>
      </article>`, book, "detail-book-page"));

    bindEntryEditor(entry);
    app.querySelector('[data-action="choose-photo"]')?.addEventListener("click", () => choosePhoto(entry));
    app.querySelector('[data-action="grant-photo"]')?.addEventListener("click", async () => {
      const result = await mediaFile(media, true);
      if (result.file) {
        await optimizeStoredMedia(media, result.file);
        await renderRoute();
      }
    });
    app.querySelector('[data-action="remove-photo"]')?.addEventListener("click", async () => {
      if (!await confirmDeletion("この記録から写真を外します。端末にある元の画像ファイルは削除されません。", "写真を外す")) return;
      await store.deleteMedia(entry.id);
      await renderRoute();
    });
    app.querySelector('[data-action="clear-entry"]')?.addEventListener("click", async () => {
      if (!await confirmDeletion(`「${entry.title}」の訪問日・写真・メモを消します。この操作は取り消せません。`, "訪問記録を消す")) return;
      await Promise.all([
        store.updateEntry(entry.id, { visited: false, visitedOn: "", note: "" }),
        store.deleteMedia(entry.id)
      ]);
      await renderRoute();
    });
    app.querySelector('[data-action="delete-entry"]')?.addEventListener("click", async () => {
      if (!await confirmDeletion(`「${entry.title}」を削除します。この操作は取り消せません。`, "記録を削除する")) return;
      await store.deleteEntry(entry.id);
      window.location.hash = routeHref("prefecture", book.id, entry.prefecture);
    });
  }

  function bindEntryEditor(entry) {
    const form = app.querySelector("[data-entry-form]");
    const status = app.querySelector("[data-save-status]");
    if (!form || !status) return;

    const save = async () => {
      const formData = new FormData(form);
      const title = String(formData.get("title") || "").trim();
      if (!title) {
        status.textContent = "記録の名前を入力してください";
        return;
      }
      status.textContent = "保存しています…";
      await store.updateEntry(entry.id, {
        title,
        location: String(formData.get("location") || "").trim(),
        visitedOn: String(formData.get("visitedOn") || ""),
        note: String(formData.get("note") || ""),
        visited: entry.catalog ? formData.get("visited") === "on" : true
      });
      await requestPersistentStorage();
      status.textContent = "この端末に保存しました";
    };

    form.addEventListener("input", () => {
      window.clearTimeout(saveTimer);
      status.textContent = "入力中…";
      saveTimer = window.setTimeout(save, 500);
    });
    form.addEventListener("change", () => {
      window.clearTimeout(saveTimer);
      save();
    });
    form.addEventListener("submit", (event) => event.preventDefault());
  }

  async function decodePhoto(file) {
    if ("createImageBitmap" in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
      } catch {
        try {
          const bitmap = await createImageBitmap(file);
          return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
        } catch {
          // Image要素での読み込みへ切り替える。
        }
      }
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.addEventListener("load", () => resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        release: () => URL.revokeObjectURL(url)
      }), { once: true });
      image.addEventListener("error", () => {
        URL.revokeObjectURL(url);
        reject(new Error("画像を読み込めませんでした。"));
      }, { once: true });
      image.src = url;
    });
  }

  function drawPhoto(source, sourceWidth, sourceHeight, maxDimension) {
    const ratio = Math.min(1, maxDimension / Math.max(sourceWidth, sourceHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(sourceWidth * ratio));
    canvas.height = Math.max(1, Math.round(sourceHeight * ratio));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("画像を加工できませんでした。");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function canvasBlob(canvas, type, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  }

  async function resizedPhoto(source, width, height, maxDimension, targetBytes) {
    const dimensions = [1, .86, .74];
    const qualities = [.74, .66, .58, .5, .44];
    let smallest = null;

    for (const dimension of dimensions) {
      const canvas = drawPhoto(source, width, height, Math.round(maxDimension * dimension));
      for (const type of ["image/webp", "image/jpeg"]) {
        let supported = true;
        for (const quality of qualities) {
          const blob = await canvasBlob(canvas, type, quality);
          if (!blob || blob.type !== type) {
            supported = false;
            break;
          }
          const candidate = { blob, width: canvas.width, height: canvas.height };
          if (!smallest || blob.size < smallest.blob.size) smallest = candidate;
          if (blob.size <= targetBytes) {
            canvas.width = 1;
            canvas.height = 1;
            return candidate;
          }
        }
        if (supported) break;
      }
      canvas.width = 1;
      canvas.height = 1;
    }

    if (!smallest) throw new Error("画像を圧縮できませんでした。");
    return smallest;
  }

  async function optimizePhoto(file) {
    let decoded;
    try {
      decoded = await decodePhoto(file);
      const detail = await resizedPhoto(decoded.source, decoded.width, decoded.height, 1280, 360 * 1024);
      const thumbnail = await resizedPhoto(decoded.source, decoded.width, decoded.height, 360, 55 * 1024);
      return {
        blob: detail.blob,
        thumbnailBlob: thumbnail.blob,
        mimeType: detail.blob.type,
        optimized: true,
        compressionVersion: 1,
        width: detail.width,
        height: detail.height,
        originalBytes: file.size,
        storedBytes: detail.blob.size + thumbnail.blob.size
      };
    } catch {
      return {
        blob: file,
        thumbnailBlob: null,
        mimeType: file.type,
        optimized: "passthrough",
        compressionVersion: 1,
        originalBytes: file.size,
        storedBytes: file.size
      };
    } finally {
      decoded?.release();
    }
  }

  function useSystemPhotoLibrary() {
    if (navigator.userAgentData?.mobile === true) return true;
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "")) return true;
    return Boolean(window.matchMedia?.("(pointer: coarse)").matches && navigator.maxTouchPoints > 0);
  }

  async function choosePhoto(entry) {
    const pickerButton = app.querySelector('[data-action="choose-photo"]');
    const idleLabel = pickerButton?.textContent || "写真を選ぶ";
    if (pickerButton) {
      pickerButton.disabled = true;
      pickerButton.textContent = "フォトを開いています…";
    }
    try {
      let file;
      let handle = null;
      if (!useSystemPhotoLibrary() && "showOpenFilePicker" in window) {
        [handle] = await window.showOpenFilePicker({
          id: "collection-photo",
          multiple: false,
          types: [{
            description: "写真",
            accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"] }
          }]
        });
        file = await handle.getFile();
      } else {
        file = await fallbackFilePicker();
      }
      if (!file) return;
      if (pickerButton?.isConnected) pickerButton.textContent = "画像を軽量化しています…";

      const optimized = await optimizePhoto(file);
      const media = {
        entryId: entry.id,
        mode: handle ? "reference" : "copy",
        ...(handle ? { handle } : {}),
        ...optimized,
        fileName: file.name || "photo",
        originalBytes: file.size
      };

      if (handle) {
        try {
          await store.saveMedia(media);
        } catch {
          const copyMedia = { ...media, mode: "copy" };
          delete copyMedia.handle;
          await store.saveMedia(copyMedia);
        }
      } else {
        await store.saveMedia(media);
      }
      await requestPersistentStorage();
      await renderRoute();
    } catch (error) {
      if (error?.name === "QuotaExceededError") {
        window.alert("端末の保存容量が不足しています。不要な写真を外すか、端末の空き容量を確認してください。");
      } else if (error?.name !== "AbortError") {
        window.alert("写真を読み込めませんでした。別の画像を選んでください。");
      }
    } finally {
      if (pickerButton?.isConnected) {
        pickerButton.disabled = false;
        pickerButton.textContent = idleLabel;
      }
    }
  }

  function fallbackFilePicker() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.tabIndex = -1;
      input.setAttribute("aria-hidden", "true");
      input.style.position = "fixed";
      input.style.inset = "auto auto 0 -9999px";
      document.body.append(input);
      const finish = (file) => {
        input.remove();
        resolve(file || null);
      };
      input.addEventListener("change", () => finish(input.files?.[0]), { once: true });
      input.addEventListener("cancel", () => finish(null), { once: true });
      input.click();
    });
  }

  function openBookDialog(book = null) {
    const selectedColor = book?.color || "";
    dialogRoot.innerHTML = `
      <dialog class="book-dialog">
        <form method="dialog" class="dialog-sheet" data-book-form>
          <button class="dialog-close" type="button" data-close aria-label="閉じる">×</button>
          <p class="eyebrow">${book ? "帳を整える" : "新しい一冊"}</p>
          <h2>${book ? "名前と色を変える" : "どんな帳にしますか"}</h2>
          <label class="dialog-field"><span>帳の名前（1〜12文字）</span><input name="name" value="${escapeHtml(book?.name || "")}" required minlength="1" maxlength="12" placeholder="例：城めぐり帖"></label>
          <fieldset class="color-field">
            <legend>表紙の色・16色（必須）</legend>
            <div class="color-grid">
              ${colors.map((color, index) => `<label title="${escapeHtml(color.name)}"><input type="radio" name="color" value="${escapeHtml(color.value)}" ${index === 0 ? "required" : ""} ${color.value === selectedColor ? "checked" : ""}><span style="--swatch:${escapeHtml(color.value)}"><b>${escapeHtml(color.name)}</b></span></label>`).join("")}
            </div>
          </fieldset>
          <button class="primary-button dialog-submit" type="button" data-save-book>${book ? "この表紙に変える" : "手帳を新しく作る"}</button>
        </form>
      </dialog>`;
    const dialog = dialogRoot.querySelector("dialog");
    const form = dialogRoot.querySelector("[data-book-form]");
    const nameInput = form.querySelector("input[name=name]");
    const saveButton = form.querySelector("[data-save-book]");
    dialog.showModal();
    nameInput?.focus();
    dialogRoot.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { dialogRoot.innerHTML = ""; });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
    });
    nameInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") event.preventDefault();
    });
    saveButton?.addEventListener("click", async () => {
      const name = String(nameInput?.value || "").trim();
      nameInput?.setCustomValidity(name.length >= 1 && name.length <= 12 ? "" : "名前は1文字以上12文字以下で入力してください。");
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const values = {
        name,
        color: String(formData.get("color"))
      };
      saveButton.disabled = true;
      try {
        const saved = book ? await store.updateBook(book.id, values) : await store.createBook(values);
        await requestPersistentStorage();
        dialog.close();
        const coverHref = routeHref("book", saved.id);
        if (window.location.hash === coverHref) await renderRoute();
        else window.location.hash = coverHref;
      } catch (error) {
        window.alert(error?.message || "帳を作成できませんでした。");
      } finally {
        saveButton.disabled = false;
      }
    });
  }

  function openEntryDialog(book, prefecture) {
    const noun = recordName(book);
    dialogRoot.innerHTML = `
      <dialog class="book-dialog">
        <form method="dialog" class="dialog-sheet" data-entry-create-form>
          <button class="dialog-close" type="button" data-close aria-label="閉じる">×</button>
          <p class="eyebrow">${escapeHtml(prefecture)}の頁</p>
          <h2>${escapeHtml(noun)}を追加する</h2>
          <label class="dialog-field"><span>${escapeHtml(noun)}の名前</span><input name="title" required maxlength="80" placeholder="${book.template === "ichinomiya" ? "例：神社名" : book.template === "pokefuta" ? "例：場所やポケモンの名前" : "例：集めたものの名前"}"></label>
          <label class="dialog-field"><span>場所</span><input name="location" maxlength="120" placeholder="市町村、施設名など"></label>
          <label class="dialog-field"><span>日付</span><input name="visitedOn" type="date"></label>
          <button class="primary-button dialog-submit" type="submit">詳細の頁を作る</button>
        </form>
      </dialog>`;
    const dialog = dialogRoot.querySelector("dialog");
    const form = dialogRoot.querySelector("[data-entry-create-form]");
    dialog.showModal();
    form.querySelector("input[name=title]")?.focus();
    dialogRoot.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { dialogRoot.innerHTML = ""; });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const entry = await store.createEntry({
        bookId: book.id,
        prefecture,
        title: formData.get("title"),
        location: formData.get("location"),
        visitedOn: formData.get("visitedOn")
      });
      await requestPersistentStorage();
      dialog.close();
      window.location.hash = routeHref("entry", book.id, entry.id);
    });
  }

  function renderMissing(message, href, label) {
    setTheme();
    setAppHtml(paperShell(`<section class="missing-page"><span class="page-seal" aria-hidden="true">空</span><h1>${escapeHtml(message)}</h1><a href="${href}">${escapeHtml(label)}</a></section>`, null, "book-page"));
  }

  function renderFailure(error) {
    console.error(error);
    setAppHtml(paperShell(`<section class="missing-page"><span class="page-seal" aria-hidden="true">困</span><h1>手帳を開けませんでした</h1><p>端末の保存領域を確認して、もう一度開いてください。</p><button class="primary-button" type="button" onclick="location.reload()">もう一度開く</button></section>`, null, "book-page"));
  }

  async function renderRoute() {
    const token = ++renderToken;
    window.clearTimeout(saveTimer);
    photoObserver?.disconnect();
    photoObserver = null;
    const nextRoute = readRoute();
    turnDirection = pageTurnDirection(previousRoute, nextRoute);
    previousRoute = nextRoute;
    await turnPageOut(turnDirection);
    if (token !== renderToken) return;
    releaseObjectUrls();
    const [page, first, second] = nextRoute;
    window.scrollTo({ top: 0, behavior: "instant" });

    try {
      if (page === "book" && first) return await renderCover(first, token);
      if (page === "map" && first) return await renderBook(first, token);
      if (page === "region" && first && second) return await renderRegion(first, second, token);
      if (page === "prefecture" && first && second) return await renderPrefecture(first, second, token);
      if (page === "entry" && first && second) return await renderEntry(first, second, token);
      return await renderShelf(token);
    } catch (error) {
      if (token === renderToken) renderFailure(error);
    }
  }

  window.addEventListener("hashchange", renderRoute);
  store.ready().then(async () => {
    await renderRoute();
    if (!hasSeenTutorial()) openTutorial();
  }).catch(renderFailure);
})();
