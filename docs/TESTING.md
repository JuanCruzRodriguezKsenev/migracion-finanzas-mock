# Guía de Pruebas (Testing) con Vitest

Este documento explica cómo está estructurado el entorno de pruebas en el proyecto, cómo escribir nuevos tests unitarios y de integración, y cómo ejecutarlos de forma eficiente utilizando **Vitest**.

---

## 1. Configuración del Entorno de Pruebas

El comportamiento de las pruebas está definido en el archivo [vitest.config.ts](file:///C:/Users/jcrod/Dev/migracion-finanzas_mock/vitest.config.ts). Las decisiones clave de configuración son:

### A) Entorno Node.js por Defecto
Establecemos `environment: "node"` debido a que las pruebas actuales se concentran en lógica pura (`lib`) y servicios de datos (`services`). Ejecutar pruebas en el entorno de Node.js es significativamente más veloz que simular un navegador entero.

#### ¿Qué pasa si necesitas simular un navegador (DOM/React)?
Si en el futuro creas un archivo de pruebas para componentes interactivos de UI (por ejemplo, probar un botón o formulario), no necesitas cambiar la configuración global del proyecto. Puedes forzar que un archivo individual use `jsdom` agregando el siguiente comentario especial en la **primera línea** del archivo:

```typescript
// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { Button } from "./Button";
// ... tus pruebas de componentes aquí
```

### B) Ubicación e Inclusión de los Tests
Para mantener el proyecto ordenado y evitar ejecuciones accidentales, Vitest está configurado para escanear **únicamente** archivos dentro de las siguientes rutas:
*   `src/shared/lib/**/*.test.ts`
*   `src/shared/services/**/*.test.ts`
*   `src/shared/ui/**/*.test.tsx`
*   `src/features/**/*.test.ts`
*   `src/features/**/*.test.tsx`

Los archivos de test deben ubicarse exactamente al lado del archivo de código que prueban.

---

## 2. Cómo Escribir una Prueba Unitaria Estándar

Utilizamos las APIs globales de Vitest (`describe`, `test`, `expect`), por lo que no es estrictamente obligatorio importarlas en cada archivo, aunque es una buena práctica si deseas una mayor claridad o compatibilidad estricta con editores.

### Estructura Recomendada de un Archivo de Pruebas:
```typescript
import { sumar } from "./math"; // Importas la función a probar

describe("Módulo de operaciones matemáticas (math)", () => {
  
  test("debería retornar 5 al sumar 2 y 3", () => {
    // 1. Preparación / Ejecución (Act)
    const resultado = sumar(2, 3);
    
    // 2. Aserción / Verificación (Assert)
    expect(resultado).toBe(5);
  });

  test("debería manejar números negativos correctamente", () => {
    expect(sumar(-1, -5)).toBe(-6);
  });
});
```

---

## 3. Comandos de Ejecución de Pruebas

Dispones de los siguientes scripts en tu entorno de terminal:

*   **Ejecución Única (CI / Pre-commit):**
    ```bash
    pnpm test
    ```
    *Este comando ejecuta las pruebas una sola vez y termina el proceso. Devuelve un código de salida `0` si todo pasa, o `1` si hay fallas (útil para automatizaciones).*

*   **Modo Observador (Watch Mode - Desarrollo Diario):**
    ```bash
    pnpm exec vitest
    ```
    *Mantiene el proceso abierto y vuelve a ejecutar instantáneamente las pruebas de los archivos que vayas modificando.*

*   **Interfaz Gráfica Interactiva (UI de Vitest):**
    Si prefieres una experiencia visual para inspeccionar las pruebas desde el navegador web:
    ```bash
    pnpm exec vitest --ui
    ```
    *Abre una página web interactiva local donde puedes explorar el árbol de pruebas, ver la velocidad de ejecución y depurar visualmente los errores.*
