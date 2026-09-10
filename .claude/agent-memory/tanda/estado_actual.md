---
name: estado-actual
description: Dónde quedó el trabajo de FinanzIA al cerrar la última ronda — ramas sin consolidar, qué está verificado y qué está en vuelo. Contrastar con git antes de usar.
metadata:
  type: project
---

# Estado al cerrar la ronda del 2026-09-10

**Verificar con `git log` antes de actuar: esto se desactualiza rápido.**

## Ramas

```
master                        2ae7186   pusheado, CI verde
  └─ feat/bandeja-recurrencias  +3       dd7388d  RFC 023 — verde, SIN consolidar
       └─ fix/cabos-rfc023...     +5     df53f56  verde, SIN consolidar
```

Historia lineal, cero merge commits, todo fast-forwardeable. **El merge lo decide el usuario.**

*   **`df53f56` verificado en verde** por batería independiente: **393 tests / 53 suites**,
    `eslint . --max-warnings 0` sin warnings, `tsc --noEmit` 0 errores, build exitoso.
*   Del RFC 023 **no hay que rehacer nada**: `limpiarBase()`, la guarda releída bajo bloqueo, el
    backfill `0026` y el factory `makeSubscription` están correctos y verificados.

## En cola — dos planes escritos, ninguno ejecutado

1.  **`docs/planes/alinear-lint-y-refresh-de-tarjetas.md`**, en la rama actual. Los dos hallazgos que
    dejó `obra`: alinear el script `lint` con el flag de la compuerta (más las cuatro notas de doc que
    advierten lo contrario) y sacar el `window.location.reload()` de `CardsContainer`.
2.  **`docs/planes/page-header-unico-por-pagina.md`**, en rama nueva, después de consolidar.

**Van secuenciados a propósito:** los dos tocan `CardsContainer`, en bloques distintos del archivo.

### El doble encabezado (plan 2), porque el diagnóstico costó la ronda

`shared/ui/layout/Header/Header.tsx:50-74` decide su título **sniffeando el `pathname`** con ternarios
que conocen cuatro rutas; el resto cae en un `else` con el saludo del dashboard. Afecta a **4 de 8
rutas**: `/sandbox` repite el título, y `/cards`, `/contacts` y `/settings` reciben "Hola, {nombre}".
El mismo vicio decide el selector de mes (`:55`), que hoy sale en seis rutas **por descarte**.

Decidido con el usuario: el layout deja de dibujar encabezado y **cada página compone un `PageHeader`
compartido con `title` obligatoria**; el selector queda sólo en dashboard y transacciones. Dos cabos
que el cambio destapa y el plan nombra: `Header.module.css:138` **oculta el título en móvil**, que
pasaría a ser el único, y el botón hamburguesa pierde su `onMenuClick` al salir del `AppShell`.

Datos que no hay que volver a averiguar: `.globalHeader` es `position: relative`, **no sticky**; y los
tres providers (`Session`, `Profile`, `Notifications`) viven en `[lang]/layout.tsx:105-111`, **por
encima** de `(main)`, así que un componente instanciado dentro de la página los sigue teniendo.

## Sobre la mesa después

*   Suscripciones al libro mayor (**RFC 004**).
*   Las propuestas que faltan del §7 del doc de diseño — ver [[decisiones-modelo-clasificacion]].
*   La página de estadísticas (**sin RFC**): es donde van el Patrimonio Neto y las categorías.
*   [[idea-pagina-proyecciones]], sin discutir.

## Convenciones asentadas

*   Los segmentos de ruta van **en inglés** (`ARCHITECTURE.md` §4).
*   **`/accounts` es el directorio por entidad** (2026-09-09): se entra por Galicia y se ven sus
    cuentas, tarjetas y préstamos. `/cards`, `/debts` y patrimonio van aparte.
*   **Nada de `kind` en `financial_entities`.** La especie (banco/billetera/tarjeta) es del
    instrumento, no de la institución: ya vive en `contact_payment_methods.type`.
*   **Cotizaciones (RFC 015, `DRAFT`):** `exchange_rates` para los cierres, cotización del día cacheada
    para saldos vivos, `RATE_SCALE = 1_000_000`; las transacciones de cambio **no** guardan cotización,
    se deduce del cociente (`patterns.md:38`).

## Pendiente de mantenimiento

**El artifact de la hoja de ruta** (2026-09-10, *Cierre RFC 022*) **no refleja el RFC 023 ni estas dos
rondas.** Releerlo entero con `action: "read"` antes de editarlo — son 1211 líneas — y republicarlo
con su `url`, sin crear uno nuevo.
