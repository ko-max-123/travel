(() => {
  if (!("serviceWorker" in navigator)) return;
  if (!/^https?:$/.test(window.location.protocol)) return;

  const script = document.currentScript;
  if (!script?.src) return;

  const siteRoot = new URL("../../", script.src);
  const serviceWorkerUrl = new URL("service-worker.js", siteRoot);
  const hadControllerAtStartup = Boolean(navigator.serviceWorker.controller);
  let refreshing = false;
  let registration;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadControllerAtStartup || refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const updateServiceWorker = async () => {
    if (!registration) return;

    try {
      await registration.update();
    } catch (error) {
      console.warn("PWAの更新確認に失敗しました。", error);
    }
  };

  window.addEventListener("load", async () => {
    try {
      registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
        scope: siteRoot.pathname,
        updateViaCache: "none"
      });
      await updateServiceWorker();
    } catch (error) {
      console.warn("PWAの準備に失敗しました。", error);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") updateServiceWorker();
  });
})();
