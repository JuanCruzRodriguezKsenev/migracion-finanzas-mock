---
name: i18n-panel-de-categorias
description: Lo que la investigación de i18n de CategoriesSettingsContainer dejó verificado — el patrón real de traducción del repo, el límite de alcance que fijó el usuario, y el doc que miente.
metadata:
  type: project
---

# i18n en FinanzIA: cómo se traduce de verdad

Verificado el 2026-09-20 al planificar `docs/planes/feat-i18n-categorias.md`.

## El patrón, en tres hechos

*   **No hay helper de i18n y no hay que escribir uno.** La interpolación del repo es
    `dict.x.y.replace( "{clave}" , String( valor ) )`, a mano. Sólo existe en dos lugares:
    `LoansContainer.tsx:350-351` y `PendingLoanSettlementsInbox.tsx:150`. Los placeholders son
    literales con llaves dentro del JSON, no sintaxis de ninguna librería.
*   **El molde de la prop es `LedgerAuditPanel.tsx:23-26`:**
    `dict: Awaited< ReturnType< typeof getDictionary > >`, con `import type { getDictionary }`.
*   **Las claves se anidan por pantalla**: `loansPage.settlement`, `cardsPage.installments`, y ahora
    `settingsPage.categories`. No se aplanan en la raíz de la sección.

## `dict` sí, `lang` no — y el doc dice otra cosa

`patterns.md` §12.1 dice «`dict` como prop obligatoria (**y `lang` correspondiente**)». Pero
`LedgerAuditPanel` recibe sólo `dict`, y es correcto: `lang` hace falta únicamente cuando el
componente formatea números o fechas. **Seguir el precedente del código, no la lectura literal del
doc.** Un componente que no llama a `formatCurrency` ni a `Intl` no necesita `lang`.

## El límite de alcance que fijó el usuario (2026-09-20)

**Los mensajes de error del servidor quedan fuera de toda tanda de i18n**, hasta que haya RFC.

**Why:** `fail()` devuelve una **frase humana en español**, no un código, y la UI la pinta cruda en
`FormError`. Son **23 en `categoryActions.ts`** y **201 en 13 archivos** de todo el repo. Traducirlos
exige cambiar el contrato de `Result.error`, que es refactor transversal sobre contabilidad,
préstamos, tarjetas y suscripciones. El usuario eligió declarar la deuda en vez de abrir una
excepción local en un solo archivo, que el próximo lector copiaría o «corregiría».

**How to apply:** es el mismo límite con el que se internacionalizó `/cards` en la tanda 2 del RFC
025. Cuando aparezca otra pantalla a traducir, el alcance se corta en el componente. La deuda queda
anotada en `TECHNICAL_DEBT.md` §3.

## El doc que miente (y se arregla solo)

`docs/patterns.md:363` cita a `CategoriesSettingsContainer.test.tsx` como **ejemplo de referencia**
del patrón i18n, diciendo que «carga `getDictionary( "es" )` en `beforeAll`». **Hoy es falso**: ese
test no importa `getDictionary` y el componente ni siquiera recibe `dict`. La tanda planificada lo
vuelve verdadero, así que **no hay que editar `patterns.md`**. Los ejemplos reales del patrón, hoy,
son `SettingsContainer.test.tsx:85-104` y `LedgerAuditPanel.test.tsx:1-14`.

Es el cuarto caso seguido de doc desactualizado al cerrar una ronda. Ver [[ciclo-de-trabajo]].

## Hallazgo que quedó sin enrutar a código

`handleConfirmArchive` y `handleUnarchive` (`CategoriesSettingsContainer.tsx:129-152`) **descartan el
`Result`** de sus acciones: llaman `await archiveCategoryAction( … )` sin mirar `res.success`. Si el
servidor rechaza, la UI cierra el modal y refresca el árbol como si hubiera funcionado. Es defecto
**preexistente**, no lo introduce la i18n, y se dejó fuera del plan a propósito para no mezclarlo con
una tanda de traducción. **Candidato a la próxima ronda de cabos.**
