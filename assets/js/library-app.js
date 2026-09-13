(function () {
  "use strict";

  const app = document.querySelector("#app");
  const dialogRoot = document.querySelector("#dialog-root");
  const store = window.CollectionStore;
  const { colors, regions } = window.COLLECTION_LIBRARY_DATA;
  const allPrefectures = regions.flatMap((region) => region.prefectures);
  const numerals = ["壱", "弐", "参", "四", "五", "六", "七", "八"];
  let renderToken = 0;
  let activeObjectUrls = [];
  let saveTimer = 0;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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

  function formatDate(value) {
    const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${Number(match[1])}年${Number(match[2])}月${Number(match[3])}日` : "日付未記入";
  }

  function recordName(book) {
    if (book.template === "pokefuta") return "ポケフタ";
    if (book.template === "ichinomiya") return "神社";
    return "記録";
  }

  function templateLabel(book) {
    if (book.template === "pokefuta") return "ポケフタ用テンプレート";
    if (book.template === "ichinomiya") return "一宮用テンプレート";
    return "自分で作った収集帳";
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

    app.innerHTML = `
      <section class="shelf-page">
        <header class="shelf-heading">
          <p>端末に綴る、わたしだけの記録</p>
          <h1>収集手帳</h1>
          <span>開く帳を選ぶ</span>
        </header>
        <div class="book-shelf" aria-label="収集手帳の本棚">
          ${booksWithCounts.map(({ book, entries }) => {
            const prefectures = new Set(entries.map((entry) => entry.prefecture)).size;
            return `
              <a class="shelf-book" href="${routeHref("book", book.id)}" style="--cover:${escapeHtml(book.color)}">
                <span class="shelf-cover">
                  <span class="shelf-binding" aria-hidden="true"></span>
                  <span class="shelf-label"><small>${escapeHtml(templateLabel(book))}</small><strong>${escapeHtml(book.name)}</strong><i aria-hidden="true">集</i></span>
                  <span class="shelf-count">${prefectures}都道府県・${entries.length}${escapeHtml(recordName(book))}</span>
                </span>
              </a>`;
          }).join("")}
          <button class="new-book" type="button" data-action="new-book">
            <span aria-hidden="true">＋</span>
            <strong>新しい帳</strong>
            <small>名前と色を決める</small>
          </button>
        </div>
        <footer class="shelf-foot">
          <p>文字と帳は、この端末の中だけに保存されます。</p>
          <a href="archive.html">以前のポケフタ・一宮・都道府県の旅帖を見る</a>
        </footer>
      </section>`;

    app.querySelector('[data-action="new-book"]')?.addEventListener("click", () => openBookDialog());
  }

  async function renderBook(bookId, token) {
    const book = await store.getBook(bookId);
    if (!book) return renderMissing("帳が見つかりません。", "#", "本棚へ戻る");
    const entries = await store.getEntries(bookId);
    if (token !== renderToken) return;
    setTheme(book.color);
    document.title = `${book.name}｜収集手帳`;
    const visited = new Set(entries.map((entry) => entry.prefecture));
    const actions = `
      <span class="folio-actions">
        <button type="button" data-action="edit-book">帳を整える</button>
        <button class="danger-link" type="button" data-action="delete-book">帳を削除</button>
      </span>`;

    app.innerHTML = paperShell(`
      <article class="folio-page">
        ${folioHead({ backHref: "#", backLabel: "本棚", eyebrow: templateLabel(book), title: book.name, intro: `47都道府県のうち、${visited.size}都道府県に${entries.length}件の記録。`, seal: "帳", actions })}
        <section class="map-spread">
          <figure class="map-sheet">
            <div class="map-graphic">
              <img src="assets/images/japan-regions-blank.svg" alt="地方ごとに色分けした日本地図" width="570" height="755">
              ${regions.map((region) => `<a class="map-hit map-hit-${region.id}" href="${routeHref("region", book.id, region.id)}">${escapeHtml(region.name)}</a>`).join("")}
            </div>
            <figcaption>地方を押して、都道府県を選ぶ。</figcaption>
          </figure>
          <nav class="region-index" aria-label="地方を選択">
            <p class="region-index-title">地方目次</p>
            ${regions.map((region, index) => {
              const count = region.prefectures.filter((prefecture) => visited.has(prefecture)).length;
              return `<a href="${routeHref("region", book.id, region.id)}"><span>${numerals[index]}</span><strong>${escapeHtml(region.name)}</strong><small>${count} / ${region.prefectures.length}</small></a>`;
            }).join("")}
          </nav>
        </section>
      </article>`, book, "book-page");

    app.querySelector('[data-action="edit-book"]')?.addEventListener("click", () => openBookDialog(book));
    app.querySelector('[data-action="delete-book"]')?.addEventListener("click", async () => {
      if (!window.confirm(`「${book.name}」と中の記録をすべて削除しますか？`)) return;
      await store.deleteBook(book.id);
      window.location.hash = "";
      await renderRoute();
    });
  }

  async function renderRegion(bookId, regionId, token) {
    const [book, entries] = await Promise.all([store.getBook(bookId), store.getEntries(bookId)]);
    if (!book) return renderMissing("帳が見つかりません。", "#", "本棚へ戻る");
    const region = regions.find((item) => item.id === regionId) || regions[0];
    if (token !== renderToken) return;
    setTheme(book.color);
    document.title = `${region.name}｜${book.name}`;

    app.innerHTML = paperShell(`
      <article class="folio-page">
        ${folioHead({ backHref: routeHref("book", book.id), backLabel: book.name, eyebrow: "都道府県を選ぶ", title: region.name, intro: `${region.prefectures.length}都道府県から、記録する場所を選びます。`, seal: region.mark })}
        <section class="folio-body">
          <div class="prefecture-grid">
            ${region.prefectures.map((prefecture) => {
              const count = entries.filter((entry) => entry.prefecture === prefecture).length;
              return `<a class="prefecture-ticket ${count ? "has-record" : ""}" href="${routeHref("prefecture", book.id, prefecture)}"><strong>${escapeHtml(prefecture)}</strong><span>${count ? `${count}件` : "未記録"}</span></a>`;
            }).join("")}
          </div>
        </section>
      </article>`, book, "book-page");
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

    app.innerHTML = paperShell(`
      <article class="folio-page">
        ${folioHead({ backHref: routeHref("region", book.id, region.id), backLabel: region.name, eyebrow: `${book.name}の記録`, title: safePrefecture, intro: entries.length ? `${entries.length}件の${noun}を綴じています。` : `この都道府県の${noun}はまだありません。`, seal: "記" })}
        <section class="folio-body">
          <div class="page-command"><button class="primary-button" type="button" data-action="new-entry">＋ ${escapeHtml(noun)}を追加</button></div>
          <div class="entry-grid">
            ${entries.length ? entries.map((entry) => `
              <article class="entry-card">
                <a href="${routeHref("entry", book.id, entry.id)}">
                  <div class="entry-photo" data-entry-photo="${escapeHtml(entry.id)}"><span>写真はまだありません</span></div>
                  <div class="entry-card-copy">
                    <p>${escapeHtml(entry.location || safePrefecture)}</p>
                    <h2>${escapeHtml(entry.title)}</h2>
                    <time datetime="${escapeHtml(entry.visitedOn)}">${escapeHtml(formatDate(entry.visitedOn))}</time>
                  </div>
                </a>
              </article>`).join("") : `<p class="empty-note">最初の${escapeHtml(noun)}を、この頁に追加できます。</p>`}
          </div>
        </section>
      </article>`, book, "book-page");

    app.querySelector('[data-action="new-entry"]')?.addEventListener("click", () => openEntryDialog(book, safePrefecture));
    hydrateEntryPhotos(entries, token);
  }

  async function mediaFile(media, askPermission) {
    if (!media) return { file: null, needsPermission: false };
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
    if (media.blob instanceof Blob) return { file: media.blob, needsPermission: false };
    return { file: null, needsPermission: false };
  }

  async function hydrateEntryPhotos(entries, token) {
    await Promise.all(entries.map(async (entry) => {
      const frame = app.querySelector(`[data-entry-photo="${CSS.escape(entry.id)}"]`);
      if (!frame) return;
      const media = await store.getMedia(entry.id);
      const result = await mediaFile(media, false);
      if (token !== renderToken || !frame.isConnected) return;
      if (result.file) {
        const url = makeObjectUrl(result.file);
        frame.classList.add("has-photo");
        frame.innerHTML = `<img src="${url}" alt="${escapeHtml(entry.title)}の写真">`;
      } else if (result.needsPermission) {
        frame.innerHTML = "<span>詳細画面で写真を開く</span>";
      }
    }));
  }

  async function renderEntry(bookId, entryId, token) {
    const [book, entry, media] = await Promise.all([
      store.getBook(bookId),
      store.getEntry(entryId),
      store.getMedia(entryId)
    ]);
    if (!book || !entry || entry.bookId !== book.id) return renderMissing("記録が見つかりません。", "#", "本棚へ戻る");
    const image = await mediaFile(media, false);
    if (token !== renderToken) return;
    setTheme(book.color);
    document.title = `${entry.title}｜${book.name}`;
    const photoMarkup = image.file
      ? `<img src="${makeObjectUrl(image.file)}" alt="${escapeHtml(entry.title)}の写真">`
      : `<div class="detail-photo-empty"><span aria-hidden="true">写</span><strong>${image.needsPermission ? "写真を開くには許可が必要です" : "写真はまだありません"}</strong><small>${escapeHtml(media?.fileName || "端末内の写真を選べます")}</small></div>`;
    const storageText = media?.mode === "reference" ? "元の画像ファイルを参照しています" : media?.mode === "copy" ? "画像をこの端末の手帳内に保存しています" : "対応端末では元の画像ファイルを参照します";

    app.innerHTML = paperShell(`
      <article class="detail-page">
        <section class="detail-photo-panel">
          <a class="folio-back" href="${routeHref("prefecture", book.id, entry.prefecture)}">← ${escapeHtml(entry.prefecture)}</a>
          <span class="photo-tape" aria-hidden="true"></span>
          <div class="detail-photo-frame">${photoMarkup}</div>
          <div class="photo-controls">
            ${image.needsPermission ? `<button type="button" data-action="grant-photo">写真を表示</button>` : ""}
            <button type="button" data-action="choose-photo">${media ? "写真を選び直す" : "写真を選ぶ"}</button>
            ${media ? `<button class="danger-link" type="button" data-action="remove-photo">写真を外す</button>` : ""}
          </div>
          <p class="storage-note">${escapeHtml(storageText)}。画像が移動・削除されると表示できなくなる場合があります。</p>
        </section>
        <section class="detail-editor">
          <p class="eyebrow">${escapeHtml(book.name)}・${escapeHtml(entry.prefecture)}</p>
          <form class="entry-form" data-entry-form>
            <label><span>記録の名前</span><input name="title" value="${escapeHtml(entry.title)}" required maxlength="80"></label>
            <label><span>場所</span><input name="location" value="${escapeHtml(entry.location)}" maxlength="120" placeholder="市町村、施設名など"></label>
            <label><span>日付</span><input name="visitedOn" type="date" value="${escapeHtml(entry.visitedOn)}"></label>
            <label class="note-field"><span>この頁に残すこと</span><textarea name="note" rows="10" placeholder="見つけたときのこと、印象、また訪れたい理由など">${escapeHtml(entry.note)}</textarea></label>
            <p class="save-status" role="status" data-save-status>入力内容はこの端末に自動保存されます</p>
          </form>
          <button class="delete-entry" type="button" data-action="delete-entry">この記録を削除</button>
        </section>
      </article>`, book, "detail-book-page");

    bindEntryEditor(entry);
    app.querySelector('[data-action="choose-photo"]')?.addEventListener("click", () => choosePhoto(entry));
    app.querySelector('[data-action="grant-photo"]')?.addEventListener("click", async () => {
      const result = await mediaFile(media, true);
      if (result.file) await renderRoute();
    });
    app.querySelector('[data-action="remove-photo"]')?.addEventListener("click", async () => {
      if (!window.confirm("この記録から写真を外しますか？ 元の画像ファイルは削除されません。")) return;
      await store.deleteMedia(entry.id);
      await renderRoute();
    });
    app.querySelector('[data-action="delete-entry"]')?.addEventListener("click", async () => {
      if (!window.confirm(`「${entry.title}」を削除しますか？`)) return;
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
        note: String(formData.get("note") || "")
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

  async function choosePhoto(entry) {
    try {
      if ("showOpenFilePicker" in window) {
        const [handle] = await window.showOpenFilePicker({
          id: "collection-photo",
          multiple: false,
          types: [{
            description: "写真",
            accept: { "image/*": [".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif"] }
          }]
        });
        try {
          await store.saveMedia({
            entryId: entry.id,
            mode: "reference",
            handle,
            fileName: handle.name
          });
        } catch {
          const file = await handle.getFile();
          await store.saveMedia({ entryId: entry.id, mode: "copy", blob: file, fileName: file.name, mimeType: file.type });
        }
      } else {
        const file = await fallbackFilePicker();
        if (!file) return;
        await store.saveMedia({ entryId: entry.id, mode: "copy", blob: file, fileName: file.name, mimeType: file.type });
      }
      await requestPersistentStorage();
      await renderRoute();
    } catch (error) {
      if (error?.name !== "AbortError") window.alert("写真を読み込めませんでした。別の画像を選んでください。");
    }
  }

  function fallbackFilePicker() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true });
      input.click();
    });
  }

  function openBookDialog(book = null) {
    const selectedColor = book?.color || colors[0].value;
    dialogRoot.innerHTML = `
      <dialog class="book-dialog">
        <form method="dialog" class="dialog-sheet" data-book-form>
          <button class="dialog-close" type="button" data-close aria-label="閉じる">×</button>
          <p class="eyebrow">${book ? "帳を整える" : "新しい一冊"}</p>
          <h2>${book ? "名前と色を変える" : "どんな帳にしますか"}</h2>
          <label class="dialog-field"><span>帳の名前</span><input name="name" value="${escapeHtml(book?.name || "")}" required maxlength="40" placeholder="例：城めぐり帖"></label>
          <fieldset class="color-field">
            <legend>表紙の色・16色</legend>
            <div class="color-grid">
              ${colors.map((color) => `<label title="${escapeHtml(color.name)}"><input type="radio" name="color" value="${escapeHtml(color.value)}" ${color.value === selectedColor ? "checked" : ""}><span style="--swatch:${escapeHtml(color.value)}"><b>${escapeHtml(color.name)}</b></span></label>`).join("")}
            </div>
          </fieldset>
          <button class="primary-button dialog-submit" type="submit">${book ? "この表紙に変える" : "この帳を作る"}</button>
        </form>
      </dialog>`;
    const dialog = dialogRoot.querySelector("dialog");
    const form = dialogRoot.querySelector("[data-book-form]");
    dialog.showModal();
    form.querySelector("input[name=name]")?.focus();
    dialogRoot.querySelector("[data-close]")?.addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener("close", () => { dialogRoot.innerHTML = ""; });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const values = {
        name: String(formData.get("name") || "").trim(),
        color: String(formData.get("color") || colors[0].value)
      };
      const saved = book ? await store.updateBook(book.id, values) : await store.createBook(values);
      await requestPersistentStorage();
      dialog.close();
      window.location.hash = routeHref("book", saved.id);
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
    app.innerHTML = paperShell(`<section class="missing-page"><span class="page-seal" aria-hidden="true">空</span><h1>${escapeHtml(message)}</h1><a href="${href}">${escapeHtml(label)}</a></section>`, null, "book-page");
  }

  function renderFailure(error) {
    console.error(error);
    app.innerHTML = paperShell(`<section class="missing-page"><span class="page-seal" aria-hidden="true">困</span><h1>手帳を開けませんでした</h1><p>端末の保存領域を確認して、もう一度開いてください。</p><button class="primary-button" type="button" onclick="location.reload()">もう一度開く</button></section>`, null, "book-page");
  }

  async function renderRoute() {
    const token = ++renderToken;
    window.clearTimeout(saveTimer);
    releaseObjectUrls();
    const [page, first, second] = readRoute();
    window.scrollTo({ top: 0, behavior: "instant" });

    try {
      if (page === "book" && first) return await renderBook(first, token);
      if (page === "region" && first && second) return await renderRegion(first, second, token);
      if (page === "prefecture" && first && second) return await renderPrefecture(first, second, token);
      if (page === "entry" && first && second) return await renderEntry(first, second, token);
      return await renderShelf(token);
    } catch (error) {
      if (token === renderToken) renderFailure(error);
    }
  }

  window.addEventListener("hashchange", renderRoute);
  store.ready().then(renderRoute).catch(renderFailure);
})();
