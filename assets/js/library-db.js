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
    const marker = await getRecord("meta", "defaults-v1");
    if (marker) return;

    const database = await databasePromise;
    const transaction = database.transaction(["books", "meta"], "readwrite");
    const books = transaction.objectStore("books");
    const now = new Date().toISOString();

    books.put({
      id: "template-pokefuta",
      name: "ポケフタ旅帖",
      color: "#264c4b",
      template: "pokefuta",
      createdAt: now,
      updatedAt: now
    });
    books.put({
      id: "template-ichinomiya",
      name: "一宮巡礼帖",
      color: "#96352b",
      template: "ichinomiya",
      createdAt: now,
      updatedAt: now
    });
    transaction.objectStore("meta").put({ key: "defaults-v1", value: true });
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
    return putRecord("books", {
      id: makeId("book"),
      name: String(name).trim(),
      color,
      template: "custom",
      createdAt: now,
      updatedAt: now
    });
  }

  async function updateBook(id, changes) {
    const current = await getRecord("books", id);
    if (!current) throw new Error("帳が見つかりません。");
    return putRecord("books", {
      ...current,
      ...changes,
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
    return entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
