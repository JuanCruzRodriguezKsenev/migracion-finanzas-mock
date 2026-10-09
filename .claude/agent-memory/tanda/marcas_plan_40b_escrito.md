---
name: marcas-plan-40b-escrito
description: Plan 40b escrito (2026-10-09) tras las baterías del plan 40; decisiones del usuario sobre color extremo y resolución mínima, y lo que NO se arregla
metadata:
  type: project
---

Plan 40b en la bóveda (`Planes/40b - Afinar verificados y el resolutor con la batería.md`, commit bóveda `0fe3269`). Rama `marcas-39b`, árbol limpio. El **plan 41 (producción) sigue reservado y sin escribir**.

- Decisiones del usuario: color con Y ≤ 12 o ≥ 240 → `null` (neutro del tema); resolución 32 px mínima con excepción de 16 px marcada `bajaResolucion`.
- Datos medidos: `verificados` 14/22 en 1.º (17 con fixture arreglado). Falla `banco nacion` (la sigla `bna` no entra a `verificados`, tope 6), `belo` (falta `.app`), `edesur` (apex sin DNS + dominio en venta con `coincide: true`).
- **Edesur sin ícono en el resolutor NO se reprodujo**: el reintento con `www` anda (2 de 3 corridas; una dio timeout por Imperva). Mi primer diagnóstico (reintento condicionado a DNS) estaba mal; lo retracté. El usuario debe reiniciar `pnpm dev` y repetir la fila.
- No entran: decodificar BMP-ICO (Google S2 da los mismos píxeles), Telecentro (ICO con wordmark, causa sin confirmar), `&nbsp;`, 429 de wikidata.
- «Alguna acierta» del resumen cuenta top 3 aunque el esperado no resuelva (se arregla en 40b §3.5).

**Why:** el usuario exige evidencia medida y no hipótesis; un diagnóstico sin reproducir se retracta.
**How to apply:** antes de culpar al código por un resultado del laboratorio, reproducir con el mismo input en un test temporal (escribir a un archivo, `console.log` lo traga el setup) y sospechar de servidor sin recargar.
