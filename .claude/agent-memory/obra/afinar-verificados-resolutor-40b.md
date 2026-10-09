---
name: afinar-verificados-resolutor-40b
description: Plan 40b afinación de estrategia verificados (siglas, venta, fallback www, TLDS_PRODUCTO), umbrales del resolutor (64, 32, 16 con bajaResolucion) y exclusión de colores extremos
metadata:
  type: execution-lessons
---

# Plan 40b: Afinar verificados y el resolutor con la batería

## Resumen de ejecución
- **Alcance cumplido:**
  - `consultas.ts`: añadidos dominios esperados para Brubank, Netflix y Spotify.
  - `estrategiasDominio.ts`: siglas para bancos/entidades, `titulaDominioEnVenta`, reintento con `www` en apex sin DNS (sin prefijo en resultado), concurrencia 4 y segunda pasada en `TLDS_PRODUCTO` condicional.
  - `bateriaVista.ts`: `posicionEsperado` excluye dominios con `resuelve === false`.
  - `resolutorIdentidad.ts`: umbrales nítido (64), mínimo (32) y piso (16) con flag `bajaResolucion`; motivo `"menor a 16 px"`.
  - `colorMarca.ts`: exclusión de colores extremos (luminancia $Y \le 12$ o $Y \ge 240$) vía `esColorExtremo`.
  - UI de laboratorio: etiqueta `.bajaResolucionBadge` («baja resolución») y preservación en exportación JSON.
  - 9 mutaciones obligatorias comprobadas y revertidas; batería completa verde (1546 tests, +16 netos).

## Lecciones aprendidas para futuros planes y para `tanda`

1. **Mutaciones con uncommitted changes:**
   - Para probar mutaciones en archivos modificados en el árbol de trabajo, usar siempre patrón `cp archivo archivo.bak`, aplicar mutación, correr suite, verificar fallo y restaurar con `cp archivo.bak archivo && rm archivo.bak`.
   - `git checkout -- archivo` revierte a `HEAD` y destruye todo el código implementado en la sesión.

2. **Tipado de `ContextoEstrategiaDominio.pais`:**
   - En `estrategiasDominio.ts`, el contexto exige `pais: PaisConfig`. En tests unitarios que simulan llamadas a `estrategiaVerificados`, pasar `{ pais: paisAr }` o mock equivalente en lugar de `{ pais: null }` para evitar errores TS2322.

3. **Mocks de DNS en pruebas de fallback y omisión:**
   - En `estrategiasDominio.test.ts`, al verificar que no se realizan llamadas a `.app` cuando hay acierto previo, asegurar que el stub de DNS simularía respuesta positiva para `.app` si se intentara consultar. Si el DNS mocked devolviera fallo para todo excepto el primer acierto, la prueba pasaría inadvertidamente por corte temprano de DNS y no por la lógica de segunda pasada.

4. **Conteo exacto de siglas heurísticas:**
   - Para «banco nacion» con AR, la generación produce 9 candidatos únicos (3 slug, 2 con guion, 4 siglas: `bn.com.ar`, `bn.com`, `bna.com.ar`, `bna.com`), por debajo del tope de 10.
