---
name: decision-eventos-app-aparte
description: Los eventos de reparto de gastos salen de la app de finanzas a una app satelital integrada por API (RFC 012); el RFC 003 quedó SUPERSEDED y /contacts no muestra importes.
metadata:
  type: project
---

# Los eventos no se construyen acá (decisión del usuario, 2026-09-21)

`docs/proposals/003-event-splitting.md` quedó **`SUPERSEDED`**, con el fundamento completo en su
§0 bis. **Cero tablas nuevas en finanzas.**

**Why:** un evento tiene dominio propio —participantes, exclusiones por `splitTag`, simplificación de
deudas— que no es contabilidad, y meterlo acá costaba cinco tablas en el libro mayor para sostener
una calculadora de reparto. Lo único que el libro necesita de un evento es **un asiento, el recupero
al cobrar**. Y lo que el usuario quería y acá era imposible —que participen otras personas con cuenta
en la app— deja de chocar contra el aislamiento multi-tenant si el evento vive en una app propia:
ahí el evento es un objeto compartido por diseño y cada uno manda el asiento a *su* libro.

**How to apply:** si alguien pide «la feature de eventos» o «dividir gastos», **no se planifica
código de dominio acá**. Lo que puede tocar a esta app es la integración, y es otra cosa.

## El RFC 012 es la puerta, y está escrita sin construir

`docs/proposals/012-integrations-and-api-keys.md` figura **`APPROVED` desde el 2026-06-23 y no tiene
una sola línea de código** — verificado el 2026-09-21 contra el esquema y contra la base real: no
existen `src/app/api/v1/`, ni la tabla `api_keys`, ni `integrations`. Las únicas rutas de API son
`auth` y `brand`.

Su §1 lleva la doctrina que hace válida toda esta decisión, y conviene citarla textual cuando el tema
vuelva: «mantener separada la lógica específica de otros negocios en sus propias aplicaciones mantiene
nuestro núcleo financiero limpio, mientras que la integración vía API unifica la contabilidad». Su
ejemplo es una app de pastelería que manda asientos por `POST /api/v1/transactions` con API key
hasheada en SHA-256 y scopes.

**Trampa: es anterior al core contable (018), a `bigint` (019) y a la clasificación unificada (022).**
Su §3 asienta contra `4.1.01.01` como si fuera hoja, y desde el 022 eso resuelve por `resolveToLeaf()`
a la hoja `.99 General`. **Necesita el mismo contraste que recibieron el 008, el 010 y el 003 antes de
que nadie escriba ese endpoint** — es el cuarto RFC de junio aprobado sin implementar que aparece.

**Websockets: se evaluó y no.** No hay nada en tiempo real; hay «cuando se movió plata, avisá», que es
un POST. El 012 ya lo especifica.

## `/contacts` es la libreta y nada más

**Sin saldos, sin deudas, sin netos.** Los importes van en las pantallas que son sobre plata. Cancela
el ítem «el neto por contacto», que estaba encolado desde el §9 del RFC 008.

**No hubo nada que deshacer:** `/contacts` no muestra un solo importe hoy —cero coincidencias de
saldo, deuda, balance o `formatCurrency` en sus cinco componentes—, así que la decisión sólo cancela
trabajo futuro.

**El §9 del RFC 008 lo sigue prometiendo y no se edita, porque está `APPROVED`.** La discrepancia
queda advertida en el §0 bis del 003 y en `trabajo-en-vuelo.md`. Ver [[ciclo-de-trabajo]], que ya
lleva la regla de no editar texto aprobado.

## Lo que se conserva del 003 y no hay que volver a derivar

Su **§4** —balance neto por participante, exclusiones, simplificación iterativa de deudas, reparto
del resto de a un centavo— y su **§3** como modelo de datos son **herencia para la app nueva**. Por
eso el archivo no se borró.
