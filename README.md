# Sushi Counter 🍣

Web app para el iPhone para contar el sushi que coméis, guardar cada comida y puntuar cada plato de 1 a 5, para acordaros de lo que os gusta y de lo que no.

Viene con la **carta completa de Sushitokyo Príncipe Pío** precargada (138 platos con su número, piezas, suplementos y los recomendados de la casa).

## Qué hace

- **Contador (食 Hoy)**: empezad la comida y tocad cada plato al pedirlo. Se puede buscar por número (como en la tablet del restaurante) o por nombre. Cada plato se apunta a uno de los dos o como compartido, y el contador grande suma las piezas de sushi (貫).
- **Rondas**: en el menú Infinity se pueden pedir 4 platos por persona y ronda; la barra de ronda muestra cuántos lleváis.
- **Resumen**: al terminar, puntuad la comida y cada plato (cada uno su nota), añadid notas y mirad una estimación de la cuenta (menú × 2 + suplementos + bebidas).
- **Historial (記)**: todas las comidas por mes, con piezas, duración y nota.
- **Gustos (好)**: por restaurante, el top de platos, los que hay que evitar, los que quedan por probar y los que dividen opiniones.
- **Sitios (店)**: cread restaurantes nuevos con sus tarifas y su carta (plato a plato o pegando una lista).
- Funciona **sin conexión** y en modo claro y oscuro.

## Ponerla en el iPhone

1. Activa GitHub Pages en este repositorio: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, elige la rama donde está la app y la carpeta `/ (root)`. Guarda.
2. Al cabo de un minuto estará en `https://jaime-otero.github.io/sushi-counter/`.
3. Abre esa dirección en **Safari** en el iPhone, toca **Compartir** y luego **Añadir a pantalla de inicio**.

Se abrirá a pantalla completa como una app normal.

## Los datos

Todo se guarda en el propio iPhone (no hay servidor ni cuentas). En **Ajustes** podéis:

- **Exportar copia**: genera un `.json` que podéis guardar en Archivos o iCloud Drive.
- **Importar copia**: restaura un `.json` (sirve también para pasar los datos a otro móvil).
- **Restaurar carta original** de Sushitokyo si se borra algún plato por error (mantiene notas e historial).

## La carta de Sushitokyo Príncipe Pío

Sacada de la carta digital oficial enlazada desde [sushitokyoprincipepio.com](https://sushitokyoprincipepio.com/) (menú de noche, consultada el 20/10/2026).

- Menú Infinity (cartel del local, octubre 2026): mediodía de lunes a viernes 17,80 €, cena de lunes a jueves 23,90 €, fin de semana (viernes noche a domingo, festivos y vísperas) 25,90 € por adulto. Bebida y postre aparte, mínimo una bebida por persona.
- Máximo 4 platos por persona y ronda; 5 € de penalización por plato que no se consuma.
- Las piezas de la Barca (18) y del Sushi mixto (16) son una estimación a partir de la descripción de la carta. Se pueden editar desde la carta del restaurante.

## Desarrollo

Es HTML, CSS y JavaScript sin dependencias ni compilación.

```sh
python3 -m http.server 8080   # y abre http://localhost:8080
```

- `index.html`, `styles.css`: estructura y estilos.
- `js/app.js`: vistas y lógica; `js/store.js`: guardado; `js/seed.js`: carta de Sushitokyo.
- `sw.js`: caché para usarla sin conexión. **Sube `CACHE` (`sushi-counter-v2`, …) cada vez que cambies archivos** para que el iPhone descargue la versión nueva.
- `tools/make_icons.py`: genera los iconos; `tools/build_preview.py`: crea un HTML único para vistas previas.
