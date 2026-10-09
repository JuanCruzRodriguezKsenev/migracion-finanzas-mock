---
name: "cierre-resolutor-39b"
description: "Lecciones del cierre del paso 3.2 del resolutor de marcas: distinción DNS vs IP privada, contrato exacto de CDN sin fuenteUrl y validación de 8 mutaciones"
metadata:
  type: "leccion-aprendida"
---

# Lecciones del Plan 39b: Cierre del Paso 3.2 del Resolutor de Marcas

## Contexto y discrepancias superadas del Plan 39
- El plan 39 había quedado frenado porque asumía que `fetchSeguro` retornaba el estado `ip-privada`. En el código real, tanto un host sin DNS como uno resolviendo a IP privada emiten `"host privado o no resoluble"`.
- Intentar reintentar automáticamente con `www.` provocaba que hosts con IP privada (`privado.test`) realizaran llamadas HTTP no deseadas hacia `www.privado.test` y Google S2, violando el test 13.
- Además, el test 10 evaluaba `expect(res.icono).toEqual(...)` de forma rígida, lo que chocaba con agregar `fuenteUrl` en la rama `brandfetch-cdn` (donde `url` ya representa la fuente).

## Solución implementada en Plan 39b
1. **Distinción DNS en el resolutor:** Se introdujo la función auxiliar privada `dominioNoResuelve(host: string): Promise<boolean>` llamando a `dns.promises.lookup(host, { all: true })`. Si lanza o devuelve vacío, se trata de un host sin DNS y se ejecuta el reintento único con `www.`. Si resuelve a direcciones (ej. IP privada), se retorna de forma temprana `icono: null`, `color: null` sin llamadas a red ni fallback a S2.
2. **Contrato de fuentes:** `fuenteUrl` quedó reservada para `sitio` (candidatos y respaldo chico) y `google-s2`. Para `brandfetch-cdn` no se propaga `fuenteUrl`.
3. **Metadatos visuales en Laboratorio:** Se extendió `IdentidadMarcaLab` y `CeldaIdentidad` (`LaboratorioMarcas.tsx`) para incluir `origenAncho×origenAlto`, `fuenteUrl` y `→ {redirigeA}` en el tooltip `title`.
4. **Mutaciones:** Se ejecutaron y verificaron las 8 mutaciones requeridas con sus tests rojos unívocos (tests 10, 13, 15, 16, 17, 18, 19 y test 12 de sandbox).
