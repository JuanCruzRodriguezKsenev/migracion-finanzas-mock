---
name: marcas-sin-brandfetch
description: Decisiones del 2026-10-09 sobre eliminar Brandfetch (APIs con límites), cómo se mide nombre→ícono en el sandbox, y la confusión nombre→dominio vs dominio→ícono
metadata:
  type: project
---

**Brandfetch se elimina** (el usuario no usa APIs con límites). Decidido el 2026-10-09:
- Logo en la app: resolutor propio (`/api/brand/identidad`, plan 37) con caché global en tabla; ruta de imagen. Plan de producción = **plan 41, aún sin escribir**.
- Si no se encuentra el sitio, el usuario **pega la URL** (red de seguridad; el autocompletado es comodidad).
- Plan 40 reescrito (commit bóveda `88a5d62`): laboratorio sin Brandfetch, batería «nombre → ícono» con consultas como las tipea el usuario (`consultas.ts`), estrategia nueva `verificados` (candidatos + DNS + título del sitio), y batería por dominio con la fuente usada pintada. Ejecuta `obra` tras el 39.

**Why:** el usuario se enojó (*"QUIEN CARAJO USAMOS PARA PASAR DE MARCA A URL???"*) porque mezclé las dos pruebas del sandbox y propuse un catálogo propio sin evidencia. Nombre→dominio (4 estrategias: brandfetch-search, wikidata, duckduckgo, candidatos) ≠ dominio→ícono (sitio → google-s2). Mi catálogo no salía del sandbox.

**How to apply:** antes de proponer una fuente, medirla con las consultas reales (hecho el 2026-10-09: Wikidata solo falla en `galicia`→xunta.gal, `coto`/`baxar`→vacío; Brandfetch Search acertaba todo; candidatos adivinan pero sin `.ar` ni señal del sitio). No inventar alternativas fuera de lo medido; decir qué está medido y qué no. DuckDuckGo desde datacenter = 202 antibot, descartado. Los esperados de Baxar/Coto son hipótesis.
