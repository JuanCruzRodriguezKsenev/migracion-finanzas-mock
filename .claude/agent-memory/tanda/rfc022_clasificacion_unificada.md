---
name: rfc022-clasificacion-unificada
description: Cómo quedó implementado el RFC 022 (categoría = cuenta contable) en sus dos tajadas, y los cabos sueltos que dejó
metadata:
  type: project
---

# RFC 022 — Clasificación unificada, implementado en dos tajadas

`docs/proposals/022-unified-classification.md`, `APPROVED`. Es la bajada a código de la sesión de
diseño de septiembre 2026 (ver [[decisiones-modelo-clasificacion]]).

**Primera tajada** (`6d365ba`, rama `feat/clasificacion-unificada`): todo el backend — tabla
`categories` jerárquica con `account_code`, `is_system_leaf`, `archived_at`; cinco Server Actions;
imputación real por categoría en `transactionsActions`; catálogo inicial de 67 categorías
(`accounting/constants/initialCatalog.ts`). **Ninguna pantalla.**

**Segunda tajada** (`a71d439`, rama `feat/gestion-categorias`): selector jerárquico con `<optgroup>`
en `TransactionFormModal` + alta al vuelo, pantalla `/settings`, mapa de emoji
(`accounting/utils/categoryIcons.ts`, sin dependencias nuevas), y migración `0024` que reemplaza
`subscriptions.category` (enum de 7) por `categoryId` con FK.

## Reglas del modelo que hay que conocer antes de tocarlo

*   **El usuario nunca ve el código contable** (RFC §2). En `/settings` no se muestra `5.1.03`; se
    muestra *Supermercado*. Verificado por test.
*   **Cada padre tiene una hoja `General` (`<código>.99`) con `isSystemLeaf: true`**, creada bajo
    demanda por `categoryRepository.findOrCreateGeneralLeaf`. **Nunca se lista en los selectores**:
    la opción `"Sin detallar"` la cubre. Además hay una hoja raíz por tipo
    (`findOrCreateTypeGeneralLeaf`: `5.1.01.99` Gastos Generales / `4.1.01.99` Ingresos Varios).
*   **`categoryId` puede apuntar a un padre: el backend lo resuelve a hoja.** Si el padre tiene hijas
    reales, se imputa a su `General`; si no, al padre mismo. La lógica está **duplicada literal en
    dos bloques** de `transactionsActions.ts` (~:150 gasto, ~:188 ingreso) en vez de vivir en el
    repositorio. Cuando suscripciones vaya al libro (RFC 004) va a ser el tercer duplicado:
    extraerlo antes.
*   **Archivar un padre archiva sus hojas en cascada** (`categoryRepository.archive`), pero
    **`unarchive` NO las devuelve**: desarchivar un padre lo deja vacío. Sin test de cascada.
*   La cuenta contable por categoría y divisa se crea perezosa
    (`findOrCreateAccountForCurrency`), no en el alta de la categoría.

## Cabos sueltos que dejó la segunda tajada

*   `SubscriptionCategory` quedó definido y exportado en `subscriptions/types.ts:23` **sin ningún
    consumidor**; el lint no lo marca porque está exportado.
*   `TransactionsContainer.tsx:17` y `CategoriesSettingsContainer.tsx:23` importan `CategoryTreeNode`
    **desde el repositorio** (`repositories/categoryRepository`), siendo componentes cliente. La
    misma tanda movió el tipo a `accounting/types.ts` justamente para evitarlo, y
    `TransactionFormModal.tsx:19` sí lo importa de ahí.
*   `CategoriesSettingsContainer` recibe una prop `lang` que nunca usa, y `/settings` es la única
    ruta nueva que no llama a `getDictionary` (6 páginas sí lo hacen).
*   La migración `0024` tiene un fallback que manda los valores residuales al **padre** `5.1.09`, que
    no es hoja; y su backfill sólo funciona si la organización ya tiene el catálogo sembrado — una
    org sin catálogo pierde el dato cuando la migración dropea `category`.
