# RFC 026: Integraciones salientes — sincronización bancaria, cotizaciones y mercados

*   **ID de la Propuesta:** 026
*   **Título:** `integrations`, credenciales de terceros y el problema del cifrado reversible
*   **Estado:** `DRAFT` — **no habilita código hasta que el usuario lo apruebe.** Escisión, no reescritura.
*   **Fecha de Creación:** 2026-09-21
*   **Autor:** `tanda`
*   **Origen:** escindido del [RFC 012](012-integrations-and-api-keys.md) el 2026-09-21, por decisión del usuario. La versión de junio de 2026 de aquel RFC metía en un mismo documento las integraciones entrantes y las salientes.
*   **Bloqueante conocido:** el repositorio **no puede cifrar credenciales hoy**. Ver §3.

---

## 1. Por qué se escindió

«Integración» nombra dos cosas que no comparten nada salvo la palabra: **recibir** asientos de una aplicación propia, y **traer** datos de un servicio de terceros. Difieren en dirección, en modelo de seguridad, en frecuencia y en forma de fallar.

Y hay una razón práctica que decidió la escisión: **lo saliente arrastra un problema sin resolver que habría bloqueado lo entrante**, que sí se puede construir hoy. Es el mismo criterio con el que el RFC 008 escindió las cuotas al 025 y el RFC 010 escindió inquilinos e incidencias.

**Este documento no está terminado.** Es el lugar donde el trabajo de relevamiento de junio queda guardado con su problema declarado, para que no se pierda como le pasó al RFC 006. Antes de aprobarse necesita el contraste que recibieron el 008, el 010, el 003 y el 012.

---

## 2. Lo que la versión de junio traía, y se conserva

El relevamiento de proveedores, que sigue siendo el punto de partida:

*   **Sincronización bancaria (Open Banking):** Belvo, Prometeo.
*   **Cotizaciones de divisa:** dolarapi.
*   **Mercados:** yfinance.

Y la forma general de la tabla `integrations`: una fila por conexión de una organización, con `type`, `provider`, credenciales, `status` y marca de última sincronización.

**Lo que hay que rehacer antes de aprobarla** es lo mismo que el §0 del RFC 012 encontró en su mitad: `text()` donde el esquema usa `varchar( … , {length: N} )`, `timestamp()` sin `{withTimezone: true}`, y baja lógica con `archivedAt` en vez de un `status` que mezcla estado de conexión con estado de vida.

---

## 3. El bloqueante: no hay cifrado reversible

La versión de junio declaraba que las credenciales van «cifradas» y guardaba `credentials: jsonb` **en plano, sin especificar mecanismo alguno**.

**El repositorio no puede cumplir esa promesa hoy.** El único uso de `crypto` es `scrypt` en [`authService.ts`](../../src/features/auth/services/authService.ts), que es una derivación **de una sola vía**: sirve para verificar una contraseña, no para recuperar un token que hay que volver a mandarle al banco. No hay utilidad de cifrado simétrico, no hay gestión de claves, y no hay decisión tomada sobre dónde vive la clave maestra.

**Esto no es un detalle de implementación: es el corazón de la propuesta.** Un `access_token` de Open Banking en texto plano en la base es una credencial bancaria del usuario expuesta a cualquiera que lea una fila.

Lo que hay que resolver antes de escribir una línea:

*   **Con qué se cifra** (AES-256-GCM es lo razonable con el `crypto` nativo de Node).
*   **Dónde vive la clave maestra** y qué pasa cuando rota. Una clave en una variable de entorno es un principio, no una respuesta.
*   **Qué pasa cuando la clave se pierde:** las credenciales se vuelven ilegibles y hay que reconectar todas las integraciones. Eso es aceptable, pero tiene que estar escrito.
*   **Si conviene no guardarlas.** Algunos agregadores permiten flujos donde el token vive del lado del proveedor y la aplicación sólo guarda un identificador. **Es la alternativa que hace desaparecer el problema entero, y hay que descartarla explícitamente antes de construir una bóveda.**

---

## 4. Lo que este RFC no es

*   **No es la API de ingreso de asientos.** Eso es el [RFC 012](012-integrations-and-api-keys.md), que ya no depende de esto.
*   **No es el motor de cotizaciones para el patrimonio.** El [RFC 010](010-wealth-assets-management.md) §8 deja abierta la valuación en una divisa distinta de la de compra; si esta propuesta se implementa, es una fuente posible para aquello, pero la decisión contable de cómo se convierte es del 010, no de acá.

---

## 5. Lo que hay que hacer para que esto sea aprobable

1.  **Contrastar contra el código real**, como se hizo con el 008, el 010, el 003 y el 012.
2.  **Resolver el §3**, que es una decisión de seguridad del usuario, no una preferencia de implementación.
3.  **Decidir el alcance.** Las tres familias de proveedores —bancos, cotizaciones, mercados— tienen poco en común más allá de la tabla. Puede que convenga escindirlas de nuevo.
