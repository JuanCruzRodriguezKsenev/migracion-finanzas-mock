# Informe de Migración — Sistema de Métricas
**Componentes:** `MetricCard`, `MetricsSection`, `MetricsVisibilityContext`, `Sparkline`  
**Fecha:** Junio 2026  
**Estado:** Migración incompleta — funciona visualmente pero con bugs funcionales y regresiones

---

## Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [MetricsVisibilityContext](#1-metricsvisibilitycontext)
3. [MetricCard](#2-metriccard)
4. [MetricsSection](#3-metricssection)
5. [Sparkline](#4-sparkline)
6. [Estructura de Archivos](#5-estructura-de-archivos)
7. [Plan de Acción](#6-plan-de-acción)

---

## Resumen Ejecutivo

| Componente | Estado | Bugs críticos | Mejoras respecto al original |
|---|---|---|---|
| `MetricsVisibilityContext` | ✅ Igual | 0 | 0 |
| `MetricCard` | ⚠️ Copy-paste | 0 | 0 |
| `MetricsSection` | ❌ Roto | 2 | 1 |
| `Sparkline` | ❌ Regresión funcional | 2 | 2 |

**Diagnóstico general:** La migración es un reformateo cosmético del original con dos bugs funcionales silenciosos (cosas que compilan sin error pero no funcionan) y una regresión importante en el Sparkline que perdió el tooltip interactivo.

---

## 1. MetricsVisibilityContext

### Estado: ✅ Equivalente al original

**Diferencias con el original:**
- Solo reformateo de espaciado (estilo con `;` y espacios en blanco)
- Lógica idéntica: `localStorage`, `useState`, `useEffect`, `toggleVisibility`

**Lo que está bien:**
- Persiste preferencia en `localStorage` con key `"metrics-balances-visible"`
- Expone tanto el `Context` como el hook `useMetricsVisibility()` y el `MetricsVisibilityProvider`
- Valor por defecto del contexto es `isContentVisible: true` (correcto)

**Lo que está mal:** Nada funcional.

**Acción requerida:** Ninguna.

---

## 2. MetricCard

### Estado: ⚠️ Copy-paste con reformateo

**Diferencias con el original:**
- Reformateo de estilo (espacios, punto y coma)
- Lógica, props, JSX y CSS: **100% idénticos**

**Lo que está bien:**
- Todas las props están presentes: `variant`, `hero`, `isMuted`, `isSensitive`, `hasVisibilityToggle`, `dualValues`, `progressBar`, `sparkline`, `children`
- Skeleton loading con animación `pulse`
- Ofuscación `••••••` conectada al contexto de visibilidad
- CSS del hero card con gradiente azul, `pointer-events` y z-index correctos

**Lo que está mal:** Nada funcional. Es una copia exacta.

**Oportunidad de mejora (no urgente):**
- El componente podría separarse en dos archivos: `MetricCard.default.tsx` y `MetricCard.hero.tsx` para reducir complejidad ciclomática, pero no es necesario ahora.

**Acción requerida:** Ninguna urgente.

---

## 3. MetricsSection

### Estado: ❌ Tiene 2 bugs funcionales

---

### Bug #1 — CRÍTICO: `allowVisibilityToggle` está roto

**Descripción:**  
En la migración, `MetricsSection` envuelve su contenido en `MetricsVisibilityProvider` (que es una mejora real sobre el original). Sin embargo, el prop `allowVisibilityToggle` se recibe pero **nunca se usa** para controlar la visibilidad del contexto.

**Original (correcto):**
```tsx
// En MetricsSection.tsx del original:
const contextValue = {
    isContentVisible: allowVisibilityToggle ? globalVisibility.isContentVisible : true,
    toggleVisibility: globalVisibility.toggleVisibility
};
```
El original condiciona: si `allowVisibilityToggle` es `false`, fuerza `isContentVisible: true` (nunca oculta). Si es `true`, usa el estado real del localStorage.

**Migración (roto):**
```tsx
// MetricsSectionContent no recibe ni usa allowVisibilityToggle para el contexto
// El Provider siempre lee del localStorage sin importar el prop
function MetricsSectionContent({ ..., allowVisibilityToggle = false, ... }) {
    const { isContentVisible } = useMetricsVisibility(); // ← usa todo sin condición
    // allowVisibilityToggle nunca afecta el contexto
}
```

**Síntoma visible:** Si en la `page.tsx` se pasa `allowVisibilityToggle={false}` (o se omite), los saldos igual se van a ocultar/mostrar según lo que haya en `localStorage`. Las tarjetas que no deberían tener toggle igual van a ocultar sus valores.

**Actualmente en page.tsx:** Se usa `allowVisibilityToggle={true}`, por lo que el bug no se nota hoy. Pero en cualquier otra `MetricsSection` donde se omita el prop, el comportamiento será incorrecto.

**Fix requerido en `MetricsSection.tsx`:**
```tsx
// Opción A: pasar el prop al Provider (requiere que Provider lo soporte)
// Opción B (más simple, igual al original): controlar el valor del contexto manualmente

function MetricsSectionContent({
    ...,
    allowVisibilityToggle = false,
    ...
}: MetricsSectionProps) {
    const globalVisibility = useMetricsVisibility();

    // Respetar el prop: si no se permite toggle, forzar visibilidad total
    const isContentVisible = allowVisibilityToggle 
        ? globalVisibility.isContentVisible 
        : true;

    // Usar isContentVisible en lugar del del hook directamente
}
```

> ⚠️ Nota: como `MetricsSectionContent` no pasa valores al contexto, las `MetricCard` hijas leen directamente del Provider. Hay que asegurarse de que el valor condicional llegue al contexto que consumen las cards, no solo a la lógica interna de la section.

**Fix correcto completo:**
```tsx
export function MetricsSection(props: MetricsSectionProps) {
    return (
        <MetricsVisibilityProvider>
            <MetricsSectionInner {...props} />
        </MetricsVisibilityProvider>
    );
}

function MetricsSectionInner({
    allowVisibilityToggle = false,
    ...resto
}: MetricsSectionProps) {
    const global = useMetricsVisibility();

    // Sobrescribir el contexto con valor condicional
    const contextValue = {
        isContentVisible: allowVisibilityToggle ? global.isContentVisible : true,
        toggleVisibility: global.toggleVisibility,
    };

    return (
        <MetricsVisibilityContext.Provider value={contextValue}>
            {/* ... layout hero / simpleGrid */}
        </MetricsVisibilityContext.Provider>
    );
}
```

---

### Bug #2 — MENOR: `progressBarHack` es código muerto innecesario

**Descripción:**
```tsx
function progressBarHack(hero: HeroProps): React.ReactNode {
    return(hero.progressBar);
}
```
Esta función no hace nada. Es un wrapper de una línea que retorna exactamente lo que recibe. Probablemente fue agregada para evitar un error de TypeScript que no se entendió, o es un residuo de refactor incompleto.

**Fix requerido:** Eliminar la función y usar `hero.progressBar` directamente donde se llama.

---

### Mejora real que tiene la migración (conservar):

La migración hace que `MetricsSection` sea **autónomo**: inyecta su propio `MetricsVisibilityProvider`. En el original, el Provider tiene que existir más arriba en el árbol (en el layout). Esto es una mejora arquitectónica real porque:
- `MetricsSection` se puede usar en cualquier página sin configurar el layout
- Cada instancia tiene su propio estado de visibilidad independiente

**Esta mejora debe conservarse.**

---

### Diferencia en CSS — menor pero a revisar:

| | Original | Migración |
|---|---|---|
| Hero column width | `minmax(clamp(187.5px, 18.75vw, 225px), 1fr)` | `280px` fijo |
| Breakpoint responsive | `max-width: 576px` | `max-width: 900px` + `max-width: 480px` |
| simpleGrid min column | `165px` | `clamp(130px, 15vw, 180px)` |
| cardsGrid min column | `165px` | `clamp(110px, 12vw, 150px)` |

La migración usa `280px` fijo para la columna del hero, lo que puede verse mal en pantallas medianas. El original usa `clamp()` que es más robusto. La migración tiene mejor responsividad en el simpleGrid/cardsGrid con `clamp()`.

**Recomendación:** Combinar lo mejor de ambos — usar `clamp()` para el hero también:
```css
.heroLayout {
    grid-template-columns: minmax(clamp(200px, 20vw, 280px), 1fr) 2.5fr;
}
```

---

## 4. Sparkline

### Estado: ❌ Regresión funcional grave

Esta es la diferencia más importante entre ambos proyectos.

---

### Comparación de implementación

| Característica | Original (Recharts) | Migración (SVG puro) |
|---|---|---|
| Dependencia | Recharts (`AreaChart`) | SVG nativo — sin dependencias |
| Tooltip interactivo | ✅ Sí — muestra mes y `pctChange` | ❌ No hay tooltip |
| Localización de meses | ✅ `lang` prop (es/en) | ❌ Eliminado |
| `isInverted` funcional | ✅ Afecta color del tooltip | ❌ Declarado, nunca usado |
| Animación de entrada | ❌ No tiene | ✅ `drawLine` + `fadeIn` + `fadeInMarker` |
| Marcador en último punto | ❌ Solo `activeDot` en hover | ✅ Círculo visible siempre |
| Peso en bundle | Pesado (Recharts completo) | Ligero (SVG nativo) |
| `showLine` / `showArea` / `showMarker` | ❌ No configurable | ✅ Props para controlar capas |
| `ResponsiveContainer` | ✅ Maneja resize | ⚠️ SVG con `viewBox` + CSS |

---

### Bug #1 — CRÍTICO: Tooltip eliminado

El Sparkline del original tiene un tooltip custom que muestra:
- El mes correspondiente al punto (ej: "Jun 26")
- El valor formateado en moneda
- El porcentaje de cambio respecto al mes anterior, coloreado según si es bueno o malo
- Respeta `isInverted` para determinar si subir es bueno o malo (útil en gastos)

La migración no tiene ningún tooltip. El usuario no puede interactuar con el gráfico para ver valores históricos.

---

### Bug #2 — MENOR: `isInverted` y `lang` declarados pero ignorados

```tsx
// Migración — Sparkline.tsx
interface SparklineProps {
  data:        number[] ;
  color:       string ;
  height?:     number | string ;
  isInverted?: boolean ;  // ← declarado
  showLine?:   boolean ;
  showArea?:   boolean ;
  showMarker?: boolean ;
}

export function Sparkline({ data, color, height = "100%", isInverted = false, ... }) {
    // isInverted nunca se usa en ningún lugar del JSX
    // lang ni siquiera está en la interface
}
```

En `page.tsx` se pasa `lang` al hero de `MetricsSection`:
```tsx
hero={{ lang: lang, isInverted: false, ... }}
```
Pero `MetricsSection` ya no pasa `lang` al `Sparkline`:
```tsx
// Migración MetricsSection.tsx — línea del Sparkline:
<Sparkline data={hero.sparklineData} color="rgba(255,255,255,0.8)" height="100%" isInverted={hero.isInverted} />
// ↑ lang ausente
```

---

### Lo que tiene la migración que el original NO tiene (conservar):

**1. Animaciones CSS de entrada:**
```css
.line {
    stroke-dasharray: 400;
    stroke-dashoffset: 400;
    animation: drawLine 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
.area { animation: fadeInArea 0.8s ease 0.4s forwards; }
.marker { animation: fadeInMarker 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) 0.9s forwards; }
```
El efecto de "dibujado" de la línea es visualmente superior al original. **Conservar.**

**2. Marcador visible en el último punto:**
El original solo muestra un `activeDot` en hover. La migración siempre muestra un círculo en el punto más reciente, lo que da contexto visual inmediato. **Conservar.**

**3. Props `showLine`, `showArea`, `showMarker`:**
Permiten configurar qué capas del gráfico se renderizan. El original no tiene esto. **Conservar.**

**4. SVG puro sin Recharts:**
Elimina una dependencia pesada para un componente que es esencialmente decorativo. **Conservar.**

---

### Fix requerido — Agregar tooltip nativo al SVG:

El tooltip no puede ser un componente de Recharts porque la migración usa SVG puro. Hay que implementarlo con eventos `onMouseMove`/`onMouseLeave` sobre el SVG y un div absolutamente posicionado.

Esquema del fix:
```tsx
"use client";
import React, { useMemo, useState, useRef, useCallback } from "react";
import { SparklineMarker } from "./SparklineMarker";
import { SparklineLine } from "./SparklineLine";
import { SparklineArea } from "./SparklineArea";
import styles from "./Sparkline.module.css";

// Helper: genera etiquetas de meses (igual al original)
function getMonthsLabelSequence(length: number, lang: string = "es") {
    const labels = [];
    const currentDate = new Date();
    for (let i = 0; i < length; i++) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - (length - 1 - i), 1);
        const monthStr = date.toLocaleDateString(lang === "en" ? "en-US" : "es-ES", { month: "short" });
        const yearStr = date.toLocaleDateString(lang === "en" ? "en-US" : "es-ES", { year: "2-digit" });
        const cleanMonth = monthStr.replace(".", "");
        labels.push(`${cleanMonth.charAt(0).toUpperCase() + cleanMonth.slice(1)} ${yearStr}`);
    }
    return labels;
}

interface TooltipState {
    visible: boolean;
    x: number;
    y: number;
    value: number;
    label: string;
    pctChange: number | null;
}

interface SparklineProps {
    data: number[];
    color: string;
    height?: number | string;
    isInverted?: boolean;
    lang?: string;           // ← RESTAURADO
    showLine?: boolean;
    showArea?: boolean;
    showMarker?: boolean;
}

export function Sparkline({
    data,
    color,
    height = "100%",
    isInverted = false,
    lang = "es",             // ← RESTAURADO
    showLine = true,
    showArea = true,
    showMarker = true,
}: SparklineProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, value: 0, label: "", pctChange: null });

    const gradientId = useMemo(() => `sparkline-grad-${Math.random().toString(36).substring(2, 9)}`, []);

    const { points, linePath, areaPath } = useMemo(() => {
        const w = 100, h = 30;
        const min = Math.min(...data), max = Math.max(...data);
        const range = max - min;
        const padding = 3;
        const usableHeight = h - padding * 2;
        const pts = data.map((val, i) => ({
            x: (i / (data.length - 1)) * w,
            y: padding + (usableHeight - ((val - min) / (range || 1)) * usableHeight),
            value: val,
        }));
        const lPath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
        const aPath = `${lPath} L ${w} ${h} L 0 ${h} Z`;
        return { points: pts, linePath: lPath, areaPath: aPath };
    }, [data]);

    const labels = useMemo(() => getMonthsLabelSequence(data.length, lang), [data.length, lang]);

    const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
        if (!svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const relX = ((e.clientX - rect.left) / rect.width) * 100;
        // Encontrar el punto más cercano
        let closest = 0;
        let minDist = Infinity;
        points.forEach((p, i) => {
            const dist = Math.abs(p.x - relX);
            if (dist < minDist) { minDist = dist; closest = i; }
        });
        const pt = points[closest];
        const pctChange = closest > 0
            ? ((data[closest] - data[closest - 1]) / Math.abs(data[closest - 1])) * 100
            : null;
        setTooltip({
            visible: true,
            x: (pt.x / 100) * rect.width + rect.left - rect.left,
            y: (pt.y / 30) * rect.height,
            value: pt.value,
            label: labels[closest],
            pctChange,
        });
    }, [points, data, labels]);

    const handleMouseLeave = useCallback(() => {
        setTooltip(prev => ({ ...prev, visible: false }));
    }, []);

    if (!data || data.length < 2) return <div className={styles.wrapper} style={{ height }} />;

    const lastPoint = points[points.length - 1];
    const isGood = isInverted
        ? (tooltip.pctChange ?? 0) < 0
        : (tooltip.pctChange ?? 0) > 0;
    const pctColor = tooltip.pctChange === null || tooltip.pctChange === 0
        ? "var(--text-secondary, #94a3b8)"
        : isGood ? "var(--color-success, #10b981)" : "var(--color-danger, #ef4444)";

    return (
        <div className={styles.wrapper} style={{ height, position: "relative" }}>
            <svg
                ref={svgRef}
                viewBox="0 0 100 30"
                className={styles.svg}
                preserveAspectRatio="none"
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                {showArea && <SparklineArea path={areaPath} color={color} gradientId={gradientId} />}
                {showLine && <SparklineLine path={linePath} color={color} />}
                {showMarker && <SparklineMarker x={lastPoint.x} y={lastPoint.y} color={color} />}
            </svg>
            {tooltip.visible && (
                <div
                    className={styles.tooltip}
                    style={{
                        left: `clamp(0px, ${tooltip.x}px, calc(100% - 120px))`,
                        top: `${tooltip.y}px`,
                        transform: "translate(-50%, -110%)",
                    }}
                >
                    <div className={styles.tooltipHeader}>{tooltip.label}</div>
                    <div className={styles.tooltipBody}>
                        <span className={styles.tooltipValue}>
                            {tooltip.value < 0
                                ? `-$${Math.abs(tooltip.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : `$${tooltip.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                        {tooltip.pctChange !== null && (
                            <span className={styles.tooltipPct} style={{ color: pctColor }}>
                                {tooltip.pctChange >= 0 ? "+" : ""}{tooltip.pctChange.toFixed(1)}%
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
```

Y agregar al `Sparkline.module.css`:
```css
.tooltip {
    position: absolute;
    background: var(--bg-card, rgba(15, 23, 42, 0.95));
    backdrop-filter: blur(10px);
    border: 1px solid var(--border-card, rgba(255, 255, 255, 0.15));
    padding: 6px 10px;
    border-radius: var(--radius-md, 8px);
    font-size: 11px;
    color: var(--text-main, #fff);
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -4px rgba(0,0,0,0.3);
    pointer-events: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 110px;
    z-index: 10;
    white-space: nowrap;
}

.tooltipHeader {
    color: var(--text-secondary, #94a3b8);
    font-size: 10px;
    font-weight: 500;
}

.tooltipBody {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

.tooltipValue { font-weight: 700; }
.tooltipPct { font-weight: 600; font-size: 10px; }
```

---

### También corregir en `MetricsSection.tsx` — pasar `lang` al Sparkline:

```tsx
// Línea actual (rota):
<Sparkline data={hero.sparklineData} color="rgba(255,255,255,0.8)" height="100%" isInverted={hero.isInverted} />

// Línea corregida:
<Sparkline data={hero.sparklineData} color="rgba(255,255,255,0.8)" height="100%" lang={hero.lang} isInverted={hero.isInverted} />
```

---

## 5. Estructura de Archivos

### Original
```
src/shared/ui/
├── MetricCard/
│   ├── MetricCard.tsx
│   └── MetricCard.module.css
├── display/
│   └── Sparkline/
│       ├── Sparkline.tsx
│       └── Sparkline.module.css
└── layout/
    ├── MetricsGrid/
    │   ├── MetricsGrid.tsx
    │   └── MetricsGrid.module.css
    └── MetricsSection/
        ├── MetricsSection.tsx
        ├── MetricsSection.module.css
        └── MetricsVisibilityContext.tsx
```

### Migración
```
src/shared/components/   ← todo mezclado en una carpeta plana
    MetricCard.tsx
    MetricCard.module.css
    MetricsSection.tsx
    MetricsSection.module.css
    MetricsVisibilityContext.tsx
    Sparkline.tsx
    Sparkline.module.css
    SparklineArea.tsx    ← sub-componente
    SparklineLine.tsx    ← sub-componente
    SparklineMarker.tsx  ← sub-componente
    Card.tsx
    Header.tsx
    Navbar.tsx
    ... (todo junto)
```

**Problemas de la estructura plana:**
- Difícil de escalar: cuando haya 30+ componentes, la carpeta es un caos
- Sin separación de responsabilidades por categoría (display, layout, forms, feedback)
- Los sub-componentes de Sparkline están al mismo nivel que componentes de layout

**Recomendación:** Si el proyecto crece, migrar a una estructura por categoría como el original. Por ahora no es bloqueante.

**Lo que la migración tiene bien:** Los sub-componentes `SparklineArea`, `SparklineLine`, `SparklineMarker` son una buena separación. El original tiene todo en un solo archivo de 180 líneas.

**`MetricsGrid` ausente:**  
El original tiene un `MetricsGrid` separado que es simplemente un wrapper de grid. La migración no lo tiene — el grid está embebido en `MetricsSection`. No es un bug, es una decisión de diseño válida para un proyecto más chico.

---

## 6. Plan de Acción

### Prioridad 1 — Bugs críticos (hacer ya)

#### Tarea 1.1 — Fixear `allowVisibilityToggle` en `MetricsSection.tsx`

**Archivo:** `src/shared/components/MetricsSection.tsx`

**Qué hacer:**
1. Renombrar `MetricsSectionContent` a `MetricsSectionInner`
2. Importar `MetricsVisibilityContext` además del hook
3. Dentro de `MetricsSectionInner`, calcular el `contextValue` condicional:
   ```tsx
   const global = useMetricsVisibility();
   const contextValue = {
       isContentVisible: allowVisibilityToggle ? global.isContentVisible : true,
       toggleVisibility: global.toggleVisibility,
   };
   ```
4. Envolver el `return` del content en:
   ```tsx
   <MetricsVisibilityContext.Provider value={contextValue}>
       {content}
   </MetricsVisibilityContext.Provider>
   ```
5. En `MetricsSection` (el export público), mantener el `MetricsVisibilityProvider` wrapper

**Resultado:** `allowVisibilityToggle={false}` fuerza visibilidad total; `allowVisibilityToggle={true}` usa el estado del localStorage.

---

#### Tarea 1.2 — Restaurar tooltip en `Sparkline.tsx`

**Archivos:** `src/shared/components/Sparkline.tsx` y `Sparkline.module.css`

**Qué hacer:**
1. Agregar prop `lang?: string` a la interface y al destructuring (default `"es"`)
2. Agregar prop `isInverted` al cálculo del color del tooltip (ya está declarado, solo conectarlo)
3. Agregar la función helper `getMonthsLabelSequence` (igual al original)
4. Agregar `useRef` al SVG y handlers `onMouseMove` / `onMouseLeave`
5. Agregar estado `tooltip` con `useState`
6. Calcular el índice del punto más cercano al cursor en `onMouseMove`
7. Renderizar el div `.tooltip` condicionalmente sobre el SVG
8. Agregar los estilos `.tooltip`, `.tooltipHeader`, `.tooltipBody`, `.tooltipValue`, `.tooltipPct` al CSS
9. **Conservar** las animaciones CSS existentes (`drawLine`, `fadeIn`, `fadeInMarker`) — no tocarlas
10. **Conservar** los sub-componentes `SparklineArea`, `SparklineLine`, `SparklineMarker` — no fusionarlos

Ver el código completo del fix en la sección [4. Sparkline](#4-sparkline).

---

### Prioridad 2 — Bugs menores (hacer después)

#### Tarea 2.1 — Eliminar `progressBarHack` en `MetricsSection.tsx`

**Archivo:** `src/shared/components/MetricsSection.tsx`

**Qué hacer:**
1. Buscar la función `progressBarHack` (al final del archivo)
2. Eliminarla
3. En el JSX donde se llama `progressBarHack(hero)`, reemplazarla por `hero.progressBar`

---

#### Tarea 2.2 — Pasar `lang` al Sparkline del hero en `MetricsSection.tsx`

**Archivo:** `src/shared/components/MetricsSection.tsx`

**Qué hacer:**  
Buscar la instancia de `<Sparkline>` dentro del bloque `hero ?` y agregar el prop `lang`:

```tsx
// Antes:
<Sparkline data={hero.sparklineData} color="rgba(255,255,255,0.8)" height="100%" isInverted={hero.isInverted} />

// Después:
<Sparkline data={hero.sparklineData} color="rgba(255,255,255,0.8)" height="100%" lang={hero.lang} isInverted={hero.isInverted} />
```

---

### Prioridad 3 — Mejoras opcionales (nice to have)

#### Tarea 3.1 — Mejorar CSS del hero en `MetricsSection.module.css`

Reemplazar el ancho fijo del hero por `clamp()`:
```css
/* Antes: */
.heroLayout { grid-template-columns: 280px 1fr; }

/* Después: */
.heroLayout { grid-template-columns: minmax(clamp(200px, 20vw, 280px), 1fr) 2.5fr; }
```

---

### Checklist final para el compañero

- [ ] **1.1** Fix `allowVisibilityToggle` en `MetricsSection.tsx`
- [ ] **1.2** Tooltip + `lang` + `isInverted` en `Sparkline.tsx`
- [ ] **1.2b** Estilos del tooltip en `Sparkline.module.css`
- [ ] **2.1** Eliminar `progressBarHack` en `MetricsSection.tsx`
- [ ] **2.2** Pasar `lang` al `<Sparkline>` en `MetricsSection.tsx`
- [ ] **3.1** (Opcional) Fix `clamp()` en `MetricsSection.module.css`
- [ ] Verificar en browser: toggle de visibilidad funciona con `allowVisibilityToggle={true}` y `={false}`
- [ ] Verificar en browser: tooltip del Sparkline aparece al hacer hover
- [ ] Verificar en browser: meses del tooltip cambian según `lang` (`es` vs `en`)
- [ ] Verificar en browser: animación de entrada del Sparkline sigue funcionando

---

*Informe generado con base en lectura directa de los archivos fuente de ambos proyectos.*