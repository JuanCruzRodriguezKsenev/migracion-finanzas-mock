---
name: laboratorio-sin-brandfetch-40
description: Plan 40 retiro de Brandfetch, estrategia verificados, batería de nombres a ícono y reducción modular de LaboratorioMarcas
metadata:
  type: execution-lessons
---

# Plan 40: Laboratorio sin Brandfetch y batería de nombre a ícono

## Resumen de ejecución
- **Alcance cumplido:** Retiro total de Brandfetch en sandbox y resolutor de identidad; implementación de `extraerNombreSitio` en `analisisHtml.ts`; estrategia `verificados` (candidatos + DNS + HTML title); colección `consultas.ts` (22 consultas); helpers puros en `bateriaVista.ts`; subcomponentes `CeldaIdentidad.tsx`, `CeldaFuente.tsx`, `MatrizDominios.tsx` y `MatrizNombres.tsx`; adaptación de `LaboratorioMarcas.tsx` (575 líneas); 12 tests nuevos en `LaboratorioMarcas.test.tsx`; 12 mutaciones comprobadas; batería completa verde (981 tests).

## Lecciones aprendidas para futuros planes y para `tanda`

1. **Extracción modular del laboratorio UI:**
   - La partición de `LaboratorioMarcas.tsx` en `MatrizDominios`, `MatrizNombres`, `CeldaIdentidad` y `CeldaFuente` permitió reducir el componente principal a 575 líneas (el plan exigía < 650).
   - Compartir los estilos de `LaboratorioMarcas.module.css` entre los subcomponentes mediante props `styles` evitó duplicar definiciones o crear archivos CSS fragmentados.

2. **Caché en batería de nombres:**
   - Varias consultas apuntan al mismo dominio esperado (ej: diferentes bancos o servicios con dominios compartidos). La caché en memoria dentro de `ejecutarBateriaNombres` reduce a 1 única consulta por dominio a `/api/brand/identidad` por corrida.

3. **Colisiones de selectores en tests de React:**
   - En `LaboratorioMarcas.test.tsx` (test 18), buscar un texto como `"google-s2"` con `getByText` colisionaba entre el badge de origen del resolutor individual y la tarjeta de la fuente. Conviene acotar el selector a contenedores específicos (`.${styles.iconTile}`).

4. **Retiro estricto sin tocar producción:**
   - Los archivos de producción (`InstitutionLogo`, `SubscriptionIcon`, `brandService.ts`, etc.) no deben modificarse hasta que las decisiones del laboratorio estén validadas en el Plan 41. La verificación con grep negativo acotado al sandbox y resolutor aseguró que el alcance fuera exacto.

5. **Mutaciones seguras sin git checkout:**
   - Para verificar mutaciones destructivas en código que aún no fue commiteado, hacer copia previa a `.bak` y restaurar con `cp archivo.bak archivo` evita el riesgo de que un `git checkout` revierta el archivo al commit base perdiendo el trabajo de la tanda.
