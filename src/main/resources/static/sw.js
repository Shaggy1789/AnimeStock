const NOMBRE_CACHE = "animestock-v12";
const ESTRATEGIA = "cache-only";
const RECURSO_PRUEBA = "mensaje.txt";

console.log("ServiceWorker cargado", NOMBRE_CACHE, "Estrategia:", ESTRATEGIA);

self.addEventListener("install", function (evento) {
    console.log("Evento install del Service Worker");

    evento.waitUntil(
        caches.open(NOMBRE_CACHE)
            .then(function (cache) {
                return cache.addAll([
                    "./",
                    "./manifest.webmanifest",
                    "./mensaje.txt"
                ]);
            })
    );

    // Tomar el control apenas se instala la nueva version.
    evento.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (evento) => {

    console.log("Evento activate del Service Worker");

    evento.waitUntil(
        caches.keys()
            .then(function (nombreCaches){
                return Promise.all(
                    nombreCaches.map(function(nombreCache){
                        if(nombreCache !== NOMBRE_CACHE){
                            return caches.delete(nombreCache)
                        }
                    })
                )
            })
            .then(function () { return self.clients.claim(); })
    )
});

function cacheOnly(peticion) {
    return caches.match(peticion);
}

function cacheFirst(peticion) {
    return caches.match(peticion).then(function (respuesta) {
        if (respuesta) {
            return respuesta;
        }
        return fetch(peticion).then(function (respuestaRed) {
            const copia = respuestaRed.clone();
            caches.open(NOMBRE_CACHE).then(function (cache) {
                cache.put(peticion, copia);
            });
            return respuestaRed;
        });
    });
}

function networkFirst(peticion) {
    return fetch(peticion)
        .then(function (respuestaRed) {
            const copia = respuestaRed.clone();
            caches.open(NOMBRE_CACHE).then(function (cache) {
                cache.put(peticion, copia);
            });
            return respuestaRed;
        })
        .catch(function () {
            return caches.match(peticion);
        });
}

function staleWhileRevalidate(peticion) {
    return caches.open(NOMBRE_CACHE).then(function (cache) {
        return cache.match(peticion).then(function (enCache) {
            const promesaRed = fetch(peticion)
                .then(function (respuestaRed) {
                    cache.put(peticion, respuestaRed.clone());
                    return respuestaRed;
                })
                .catch(function () {
                    return enCache;
                });
            return enCache || promesaRed;
        });
    });
}

function networkOnly(peticion) {
    return fetch(peticion);
}

const ESTRATEGIAS = {
    "cache-only": cacheOnly,
    "cache-first": cacheFirst,
    "network-first": networkFirst,
    "swr": staleWhileRevalidate,
    "network-only": networkOnly
};

self.addEventListener("fetch", function (evento) {
    const url = new URL(evento.request.url);

    if (
        evento.request.method === "GET" &&
        url.pathname.endsWith(RECURSO_PRUEBA) &&
        ESTRATEGIAS[ESTRATEGIA]
    ) {
        evento.respondWith(ESTRATEGIAS[ESTRATEGIA](evento.request));
        return;
    }

    evento.respondWith(
        caches.match(evento.request)
            .then(function (respuesta) {
                if (respuesta) {
                    return respuesta;
                }
                return fetch(evento.request).then(function (respuestaRed) {
                    // Guardar paginas y recursos estaticos para poder recargarlos sin red.
                    // Las respuestas /api/ no se cachean: las datos offline viven en IndexedDB.
                    if (
                        evento.request.method === "GET" &&
                        url.origin === self.location.origin &&
                        url.pathname.indexOf("/api/") !== 0 &&
                        respuestaRed.ok
                    ) {
                        const copia = respuestaRed.clone();
                        evento.waitUntil(
                            caches.open(NOMBRE_CACHE).then(function (cache) {
                                return cache.put(evento.request, copia);
                            })
                        );
                    }
                    return respuestaRed;
                }).catch(function () {
                    // Nunca enmascarar un fallo de red como una respuesta vacia exitosa.
                    if (url.pathname.indexOf("/api/") === 0) {
                        return new Response(JSON.stringify({ message: "Sin conexión con el servidor." }), {
                            status: 503,
                            headers: { "Content-Type": "application/json; charset=utf-8" }
                        });
                    }
                    return new Response("Sin conexión", {
                        status: 503,
                        headers: { "Content-Type": "text/plain; charset=utf-8" }
                    });
                });
            })
    );
});