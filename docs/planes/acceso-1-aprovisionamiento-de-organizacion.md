# Plan — Acceso 1/5: el aprovisionamiento de una organización deja de vivir en el seed

**Rama:** `feat/acceso-1-aprovisionamiento` (sale de la punta de `fix/resumenes-mensuales`, **después** de que ese plan se ejecute y se verifique) · **Escrito:** 2026-10-06
**Spec:** [`../specs/acceso-con-google/spec.md`](../specs/acceso-con-google/spec.md) — implementa **RN-18**; prepara **AC-12** y **AC-13** (el alta completa de una organización es el plan 4).
**Serie:** 0 `fix-resumenes-mensuales` → **1 este** → 2 `acceso-2-membresias` → 3 `acceso-3-google-e-invitaciones` → 4 `acceso-4-miembros-y-selector` → 4b `acceso-4b-rol-de-solo-lectura` → 5 `acceso-5-despliegue-vercel-neon`.

No hay RFC y no hace falta: no cambia el modelo ni agrega tablas. **Mueve código que ya existe** de un
script a un servicio reutilizable. Contrato: **§4 de [`.agents/AGENTS.md`](../../.agents/AGENTS.md)** (estilo) y **§8**
(centavos, `organizationId`, Debe = Haber). **No cambia ningún comportamiento observable**: el seed tiene que
dejar la misma base que antes.

---

## 0. Por qué existe este plan

La spec permite que un usuario cree organizaciones nuevas (RN-17). **Ningún camino de producción crea una
organización hoy**: sólo `seed.ts` y los tests insertan en `organizations`. Y una organización vacía no sirve:

- Sin las categorías y sus cuentas, el formulario de movimientos no tiene qué elegir.
- Sin una cuenta de tipo `equity`, **no se puede dar de alta una cuenta con saldo inicial**:
  `accountingActions.ts:224`, `cardsActions.ts:112` y `loansActions.ts:112` la buscan por código `3.1.01.01`
  o, si no, por tipo, y hoy sólo el seed la crea (`seed.ts:372-383`).

**Lo que NO es parte del aprovisionamiento** (contraste, no suposición):
- La hoja `General` (`.99`). Nace sobre demanda: `categoryRepository.resolveToLeaf` (`:208`) llama a
  `findOrCreateTypeGeneralLeaf` / `findOrCreateGeneralLeaf` cuando falta. **No hay que sembrarla.**
- Las cuentas por moneda de contrapartida (`5.1.01.99-USD`, `3.3.01-<MONEDA>`): las crea
  `obtenerCuentaPorMoneda` (`transactionsActions.ts:70`) cuando hacen falta.
- Entidades financieras, cuentas bancarias, tarjetas y movimientos del seed: son **datos demo**, siguen en `seed.ts`.

---

## 1. Radio de impacto

| Archivo | Qué hacer |
| :--- | :--- |
| `src/features/accounting/services/organizationProvisioningService.ts` | **Nuevo.** `provisionarOrganizacion( organizationId , tx )` |
| `src/shared/db/seed.ts` | Reemplaza el bucle del catálogo (`:162-230`) y el `insert` de `3.1.01.01` (`:372-383`) por la llamada. Sigue usando lo que devuelve para las variables `subSueldos`, `ctaIngSueldo`, etc. |
| `src/features/accounting/services/organizationProvisioningService.test.ts` | **Nuevo** |
| `docs/trabajo-en-vuelo.md` | Rama y próximo paso, **en el mismo commit** |

**Quién más lee `INITIAL_CATEGORIES_CATALOG`:** sólo `seed.ts` y `categoryIcons.test.ts`
(`grep -rn INITIAL_CATEGORIES_CATALOG src/`). **Quién busca la cuenta `3.1.01.01`:** las tres acciones de
arriba, sin cambios.

---

## 2. Qué hace el código que se mueve (reusos explicados)

El bucle de `seed.ts:162-230`, por cada raíz del catálogo (12 de gasto y 6 de ingreso, 18 en total):
1. Inserta la categoría padre en `categories` con `accountCode = catDef.code` e `isSystemLeaf: false`.
2. Inserta su cuenta en `accounts`: código `${code}-ARS`, nombre `${name} (ARS)`, mismo `type`, balance 0, `currency: "ARS"`.
3. Inserta el vínculo en `category_accounts` con `currency: "ARS"`.
4. Repite 1-3 para cada subcategoría, con `parentId` del padre; el ícono y el color caen al del padre si la sub no los trae.

**Es lo que hay que conservar tal cual.** Tres cosas del seed que **no** se mueven y que hay que dejar donde están:
las asignaciones de `subSueldos`/`ctaIngSueldo`/`subAlquiler`/… por código (`:213-226`), que son lógica de
datos demo; el `subCatByCode` si el seed lo sigue usando más abajo; y cualquier cosa que cite `org.id`.

**Contrapartida a respetar:** `isSystemLeaf` queda en `false` para todo el catálogo. Una hoja de sistema sólo
la crea el repositorio al resolver (`categoryRepository.ts:151` y `:189`).

---

## 3. Pasos

### Paso 1 — El servicio

`provisionarOrganizacion( organizationId: string , tx: DBOrTx ): Promise< ResultadoAprovisionamiento >`.

- **Recibe `tx` y no abre transacción propia.** La abre quien crea la organización (plan 4, y el seed). Es lo
  que hace posible el AC-13: si algo falla después, el `ROLLBACK` se lleva todo.
- Hace el recorrido del §2 y además inserta la cuenta de Patrimonio Neto: `code: "3.1.01.01"`,
  `name: "Patrimonio Neto Inicial"`, `type: "equity"`, balance 0, `currency: "ARS"` (idéntica a `seed.ts:372-383`).
- Devuelve `{ categoriasPorCodigo: Map<string , Category> , cuentasPorCodigo: Map<string , Account> , cuentaPatrimonio: Account }`,
  indexadas por el **código de catálogo** (`5.1.01.01`, no `5.1.01.01-ARS`). Es lo que el seed necesita para seguir
  asignando sus variables sin releer.
- **No es idempotente y no debe serlo:** una segunda llamada sobre la misma organización choca con la unicidad
  `(organization_id, code)` y **lanza**. No agregar `onConflictDoNothing`: ocultaría una doble creación.
- Estilo: encabezado `@file`, JSDoc de `@param`/`@returns`, imports agrupados con comentario
  (`// Librerías externas` / `// Shared` / `// Feature: Accounting`) y alineados por columnas, `return( … ) ;`.

### Paso 2 — El seed usa el servicio

En `seed.ts`: dentro de la transacción o en el flujo lineal que ya tiene, llamar al servicio con el `org.id` y
usar el mapa devuelto. Se borra el bucle y el `insert` de patrimonio. **El resto del seed no se toca.**
Si el seed corre sin transacción, pasarle `db` como `tx` — `DBOrTx` lo admite (`client.ts:41`).

> El plan 0 reescribió partes de `seed.ts` (limpieza, `occurredAt`, doce meses). Este paso va **después** y
> trabaja sobre esa versión. Si el número de línea de acá no coincide, vale el nombre del bloque, no la línea.

### Paso 3 — Tests

`organizationProvisioningService.test.ts`, de integración contra la base real (como las demás suites
—`limpiarBase()` en `beforeEach`, ver `testCleanup.ts`—). Casos:

1. **Conteo exacto.** Después de aprovisionar: `categories` = 18 + total de subcategorías del catálogo;
   `accounts` = esas mismas + 1 (patrimonio); `category_accounts` = las categorías. Calcular los esperados
   **desde `INITIAL_CATEGORIES_CATALOG`**, no con números a mano.
2. **Cada categoría tiene su cuenta.** Para cada fila de `categories`, existe `${accountCode}-ARS` con el mismo
   `type`, y un `category_accounts` que las une con `currency = "ARS"`.
3. **Patrimonio.** Existe `3.1.01.01` de tipo `equity`, balance 0.
4. **Ninguna `isSystemLeaf`.** `select count(*) … where is_system_leaf` = 0.
5. **No es idempotente.** Una segunda llamada lanza.
6. **Rollback (AC-13).** Dentro de `db.transaction`, aprovisionar y después lanzar un error: al terminar, la
   organización no tiene ninguna categoría ni cuenta.
7. **Aislamiento (AC-15).** Dos organizaciones aprovisionadas: no colisionan y cada una ve sólo las suyas
   (`select count(*) … where organization_id = …` da lo mismo en las dos).

---

## 4. Verificación literal

```bash
git status --short                                   # limpio antes de empezar
pnpm test                                            # anotar suites y tests exactos; esperá +1 suite
pnpm exec eslint . --max-warnings 0
pnpm exec tsc --noEmit ; pnpm exec tsc --noEmit | grep -c "error TS"   # 0
pnpm build
pnpm db:seed                                         # tiene que terminar sin error
podman exec postgres-dev psql -U postgres -d finanzas_db -tc \
  "select (select count(*) from categories) c, (select count(*) from accounts) a, (select count(*) from category_accounts) ca"
git diff --stat                                      # seed.ts pierde líneas, el servicio las gana
```

Pegar la salida cruda, no describirla. **Criterio de aceptación de «no cambia nada»:** los conteos de
`categories` y `category_accounts` del seed son los mismos que antes de la rama (anotarlos **antes** de tocar).

---

## 5. Lo que NO hay que construir

| No | Por qué |
| :--- | :--- |
| Una acción o pantalla para crear organizaciones | Es el plan 4. Acá sólo el servicio |
| `onConflictDoNothing` en el servicio | Ocultaría una doble creación |
| Sembrar la hoja `General` o cuentas en dólares | Nacen sobre demanda |
| Optimizar los inserts por lotes | No es el objetivo; si lo hacés, el resultado tiene que ser idéntico fila a fila |

## 6. Reportá

Los **hallazgos** (cosas que viste y el plan no nombró) en una lista aparte, para que la próxima ronda los enrute.
