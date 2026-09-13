(function () {
  "use strict";

  const DB_NAME = "my-collection-notebooks";
  const DB_VERSION = 1;

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.addEventListener("success", () => resolve(request.result), { once: true });
      request.addEventListener("error", () => reject(request.error), { once: true });
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.addEventListener("complete", resolve, { once: true });
      transaction.addEventListener("abort", () => reject(transaction.error), { once: true });
      transaction.addEventListener("error", () => reject(transaction.error), { once: true });
    });
  }

  const databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains("books")) {
        database.createObjectStore("books", { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains("entries")) {
        const entries = database.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("bookId", "bookId", { unique: false });
        entries.createIndex("bookPrefecture", ["bookId", "prefecture"], { unique: false });
      }

      if (!database.objectStoreNames.contains("media")) {
        database.createObjectStore("media", { keyPath: "entryId" });
      }

      if (!database.objectStoreNames.contains("meta")) {
        database.createObjectStore("meta", { keyPath: "key" });
      }
    });

    request.addEventListener("success", () => resolve(request.result), { once: true });
    request.addEventListener("error", () => reject(request.error), { once: true });
  });

  function makeId(prefix) {
    if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function validateBookDetails(name, color) {
    const normalizedName = String(name || "").trim();
    const normalizedColor = String(color || "");
    const nameLength = Array.from(normalizedName).length;
    if (nameLength < 1 || nameLength > 12) throw new Error("帳の名前は1文字以上12文字以下で入力してください。");
    if (!/^#[0-9a-f]{6}$/i.test(normalizedColor)) throw new Error("表紙の色を選んでください。");
    return { name: normalizedName, color: normalizedColor };
  }

  async function getRecord(storeName, key) {
    const database = await databasePromise;
    const transaction = database.transaction(storeName, "readonly");
    return requestResult(transaction.objectStore(storeName).get(key));
  }

  async function putRecord(storeName, value) {
    const database = await databasePromise;
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(value);
    await transactionDone(transaction);
    return value;
  }

  async function deleteRecord(storeName, key) {
    const database = await databasePromise;
    const transaction = database.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).delete(key);
    await transactionDone(transaction);
  }

  async function seedDefaults() {
    const [pokefutaBook, ichinomiyaBook] = await Promise.all([
      getRecord("books", "template-pokefuta"),
      getRecord("books", "template-ichinomiya")
    ]);
    if (pokefutaBook && ichinomiyaBook) return;

    const database = await databasePromise;
    const transaction = database.transaction(["books", "meta"], "readwrite");
    const books = transaction.objectStore("books");
    const now = new Date().toISOString();

    if (!pokefutaBook) {
      books.put({
        id: "template-pokefuta",
        name: "ポケフタ旅帖",
        color: "#264c4b",
        template: "pokefuta",
        createdAt: now,
        updatedAt: now
      });
    }
    if (!ichinomiyaBook) {
      books.put({
        id: "template-ichinomiya",
        name: "一宮巡礼帖",
        color: "#96352b",
        template: "ichinomiya",
        createdAt: now,
        updatedAt: now
      });
    }
    transaction.objectStore("meta").put({ key: "defaults-v1", value: true });
    await transactionDone(transaction);
  }

  async function seedTemplateCatalog() {
    const marker = await getRecord("meta", "template-catalog-v1");
    if (marker) return;

    const [pokefutaBook, ichinomiyaBook] = await Promise.all([
      getRecord("books", "template-pokefuta"),
      getRecord("books", "template-ichinomiya")
    ]);
    const pokefutaData = window.POKEFUTA_DATA;
    const ichinomiyaData = window.ICHINOMIYA_DATA;
    const now = new Date().toISOString();
    const catalogEntries = [];

    if (pokefutaBook && Array.isArray(pokefutaData?.spots)) {
      const prefectureNames = new Map((pokefutaData.prefectures || []).map((item) => [item.id, item.name]));
      pokefutaData.spots.forEach((spot, index) => {
        const prefecture = spot.prefectureName || prefectureNames.get(spot.prefecture);
        if (!prefecture) return;
        catalogEntries.push({
          id: `catalog-pokefuta-${spot.id}`,
          bookId: pokefutaBook.id,
          prefecture,
          title: spot.area || spot.city || spot.title,
          location: spot.address || spot.city || "",
          visitedOn: "",
          note: "",
          visited: false,
          catalog: true,
          catalogKind: "pokefuta",
          catalogOrder: index,
          catalogMeta: Array.isArray(spot.pokemon) ? spot.pokemon.join("・") : "",
          source: spot.source || "",
          map: spot.officialMap || "",
          createdAt: now,
          updatedAt: now
        });
      });
    }

    if (ichinomiyaBook && Array.isArray(ichinomiyaData?.shrines)) {
      ichinomiyaData.shrines.forEach((shrine, index) => {
        if (!shrine.prefecture) return;
        catalogEntries.push({
          id: `catalog-ichinomiya-${shrine.id}`,
          bookId: ichinomiyaBook.id,
          prefecture: shrine.prefecture,
          title: shrine.name,
          location: shrine.address || "",
          visitedOn: "",
          note: "",
          visited: false,
          catalog: true,
          catalogKind: "ichinomiya",
          catalogOrder: index,
          catalogMeta: shrine.province || "",
          catalogMetaReading: shrine.provinceReading || "",
          titleReading: shrine.nameReading || "",
          deity: shrine.deity || "",
          deityReading: shrine.deityReading || "",
          source: shrine.source || shrine.currentSource || "",
          map: shrine.map || "",
          createdAt: now,
          updatedAt: now
        });
      });
    }

    const database = await databasePromise;
    const transaction = database.transaction(["entries", "meta"], "readwrite");
    const entries = transaction.objectStore("entries");
    catalogEntries.forEach((entry) => entries.put(entry));
    transaction.objectStore("meta").put({ key: "template-catalog-v1", value: catalogEntries.length });
    await transactionDone(transaction);
  }

  async function getBooks() {
    const database = await databasePromise;
    const transaction = database.transaction("books", "readonly");
    const books = await requestResult(transaction.objectStore("books").getAll());
    return books.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function createBook({ name, color }) {
    const now = new Date().toISOString();
    const details = validateBookDetails(name, color);
    return putRecord("books", {
      id: makeId("book"),
      ...details,
      template: "custom",
      createdAt: now,
      updatedAt: now
    });
  }

  async function updateBook(id, changes) {
    const current = await getRecord("books", id);
    if (!current) throw new Error("帳が見つかりません。");
    const details = validateBookDetails(changes.name ?? current.name, changes.color ?? current.color);
    return putRecord("books", {
      ...current,
      ...changes,
      ...details,
      id,
      updatedAt: new Date().toISOString()
    });
  }

  async function getEntries(bookId, prefecture) {
    const database = await databasePromise;
    const transaction = database.transaction("entries", "readonly");
    const store = transaction.objectStore("entries");
    const request = prefecture
      ? store.index("bookPrefecture").getAll([bookId, prefecture])
      : store.index("bookId").getAll(bookId);
    const entries = await requestResult(request);
    return entries.sort((a, b) => {
      if (Boolean(a.catalog) !== Boolean(b.catalog)) return a.catalog ? 1 : -1;
      if (a.catalog && b.catalog) return (a.catalogOrder || 0) - (b.catalogOrder || 0);
      return b.updatedAt.localeCompare(a.updatedAt);
    });
  }

  async function createEntry({ bookId, prefecture, title, location, visitedOn }) {
    const now = new Date().toISOString();
    return putRecord("entries", {
      id: makeId("entry"),
      bookId,
      prefecture,
      title: String(title).trim(),
      location: String(location || "").trim(),
      visitedOn: String(visitedOn || ""),
      note: "",
      visited: true,
      createdAt: now,
      updatedAt: now
    });
  }

  async function updateEntry(id, changes) {
    const current = await getRecord("entries", id);
    if (!current) throw new Error("記録が見つかりません。");
    return putRecord("entries", {
      ...current,
      ...changes,
      id,
      updatedAt: new Date().toISOString()
    });
  }

  async function deleteEntry(id) {
    const database = await databasePromise;
    const transaction = database.transaction(["entries", "media"], "readwrite");
    transaction.objectStore("entries").delete(id);
    transaction.objectStore("media").delete(id);
    await transactionDone(transaction);
  }

  async function deleteBook(id) {
    const entries = await getEntries(id);
    const database = await databasePromise;
    const transaction = database.transaction(["books", "entries", "media"], "readwrite");
    transaction.objectStore("books").delete(id);
    entries.forEach((entry) => {
      transaction.objectStore("entries").delete(entry.id);
      transaction.objectStore("media").delete(entry.id);
    });
    await transactionDone(transaction);
  }

  async function saveMedia(media) {
    return putRecord("media", {
      ...media,
      updatedAt: new Date().toISOString()
    });
  }

  window.CollectionStore = {
    ready: async () => {
      await databasePromise;
      await seedDefaults();
      await seedTemplateCatalog();
    },
    getBooks,
    getBook: (id) => getRecord("books", id),
    createBook,
    updateBook,
    deleteBook,
    getEntries,
    getEntry: (id) => getRecord("entries", id),
    createEntry,
    updateEntry,
    deleteEntry,
    getMedia: (entryId) => getRecord("media", entryId),
    saveMedia,
    deleteMedia: (entryId) => deleteRecord("media", entryId)
  };
})();
