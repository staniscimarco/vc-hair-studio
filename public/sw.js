const STATIC = "vc-static-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((cache) => cache.addAll(["/offline.html", "/brand/vale.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const personal = ["/api", "/admin", "/i-miei-appuntamenti", "/profilo", "/auth"].some((path) => url.pathname.startsWith(path));
  if (personal) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
    return;
  }
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/brand") || url.pathname.startsWith("/icons")) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const cached = await cache.match(event.request);
        try {
          const fresh = await fetch(event.request);
          if (fresh.ok) await cache.put(event.request, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "VC Hair Studio", body: event.data ? event.data.text() : "" };
  }
  const url = data.url || "/";
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "VC Hair Studio", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        lang: "it",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        data: { url },
      }),
      // Avvisa l'app aperta: aggiorna subito stati, contatori e liste.
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
        for (const client of clients) client.postMessage({ type: "push", url });
      }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  const target = new URL(url, self.location.origin);
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = clients.find((client) => client.url.startsWith(self.location.origin));
      if (open) {
        // L'app è aperta: la porta in primo piano e le chiede di aprire la pagina giusta.
        await open.focus().catch(() => undefined);
        open.postMessage({ type: "apri", url: target.pathname + target.search });
        return;
      }
      // App chiusa: la apre direttamente sulla pagina giusta.
      target.searchParams.set("da_notifica", "1");
      await self.clients.openWindow(target.href);
    })(),
  );
});
