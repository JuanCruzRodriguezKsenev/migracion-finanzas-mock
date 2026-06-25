# RFC 009: Calculadora de Decisiones Financieras, Inflación y Divisas

*   **ID de la Propuesta:** 009
*   **Título:** Suite de Calculadoras Financieras (Efectivo vs. Cuotas, Interés Compuesto, Inflación, Divisas e Inversiones)
*   **Estado:** `APPROVED` (Aprobado - 2026-06-23)
*   **Fecha de Creación:** 2026-06-22
*   **Autor:** Antigravity (AI Coding Assistant)

---

## 1. Contexto y Objetivos

Para tomar decisiones inteligentes, los usuarios necesitan herramientas de simulación rápidas que comparen escenarios financieros complejos en tiempo real (por ejemplo, evaluar si conviene pagar al contado con descuento o en cuotas fijas con interés en contextos de alta inflación, o estimar el rendimiento de reinvertir dividendos).

### Objetivos:
1.  **Fórmulas Financieras en `shared/lib`:** Implementar utilidades matemáticas puras y testeadas para valor presente neto, inflación, interés compuesto y simple.
2.  **Calculadora Efectivo vs. Cuotas (Ajustado por Inflación):** Determinar la opción óptima descontando el valor del dinero en el tiempo.
3.  **Conversor de Divisas Multimoneda:** Consultar tipos de cambio en tiempo real (USD, EUR, cotizaciones locales) con almacenamiento temporal en caché.
4.  **Simulador de Rendimiento y Dividendos:** Estimar el flujo de caja futuro de portafolios de inversión y rendimientos de billeteras virtuales.

---

## 2. Fórmulas Matemáticas Contables (`financialMath.ts`)

Las siguientes fórmulas se programarán como funciones puras en `src/shared/lib/financialMath.ts`:

### A. Valor Presente Neto Ajustado por Inflación (Efectivo vs. Cuotas)
Para evaluar si conviene comprar en cuotas fijas con interés frente a un pago único en efectivo:

$$VP = \sum_{t=1}^{n} \frac{C}{(1 + i)^t}$$

Donde:
*   $VP$: Valor Presente Neto total de las cuotas.
*   $C$: Valor de la cuota mensual.
*   $i$: Tasa de inflación mensual estimada (ej: 4% = 0.04).
*   $t$: Índice del mes de pago de la cuota.
*   $n$: Cantidad total de cuotas.

*Regla de Decisión:* Si $VP < \text{Precio Efectivo Contado}$, **conviene comprar en cuotas** (el dinero se deprecia más rápido que el recargo de las cuotas). Si $VP > \text{Precio Efectivo}$, **conviene pagar al contado**.

### B. Rendimientos de Billeteras Virtuales (Interés Simple Diario)
Las billeteras pagan rendimiento diario sobre saldo líquido (Tasa Nominal Anual - TNA):

$$R_d = S \times \left( \frac{\text{TNA}}{365} \right)$$

Donde $R_d$ es el rendimiento diario y $S$ es el saldo invertido.

### C. Proyección de Interés Compuesto (Plazo Fijo / Inversiones)
Proyección de capital final reinvirtiendo ganancias periódicamente (Tasa Efectiva Anual - TEA):

$$VF = VI \times (1 + r)^n$$

Donde:
*   $VF$: Valor Final.
*   $VI$: Valor Inicial.
*   $r$: Tasa de interés por período.
*   $n$: Número de períodos de capitalización (reinversiones).

---

## 3. Arquitectura del Servicio de Divisas (`exchangeRateService.ts`)

El servicio consumirá APIs de tipos de cambio públicas y gratuitas para obtener cotizaciones reales.

### Integración Propuesta:
*   **Monedas Globales (USD, EUR, BRL):** [ExchangeRate-API](https://www.exchangerate-api.com/) o [Frankfurter API](https://www.frankfurter.app/) (sin necesidad de API Keys para consultas básicas).
*   **Cotizaciones Especiales (Argentina - Blue, Oficial, Tarjeta, MEP):** [DolarApi.com](https://dolarapi.com) (API gratuita, abierta y sin límites para tipos de cambio locales).

### Lógica de Caché en Memoria (In-Memory Cache):
Para evitar latencias y peticiones innecesarias, las respuestas de divisas se almacenarán en la memoria del servidor de Next.js por un período de **60 minutos** (las divisas financieras no fluctúan tan drásticamente en segundos para decisiones de compra ordinarias).

---

## 4. Estructura de Datos para Proyección de Dividendos

Para la calculadora de inversiones que estime los cobros de dividendos futuros de acciones o CEDEARs:

```typescript
// Estructura para registrar el calendario de pagos de dividendos estimados de una empresa (Ticker)
export interface DividendSchedule {
  ticker: string; // Ej: "AAPL", "KO"
  declarationDate: Date; // Fecha de declaración
  exDividendDate: Date; // Fecha límite para poseer la acción y cobrar
  paymentDate: Date; // Fecha real de pago
  amountPerShare: number; // Monto por acción en centavos
  currency: string; // Divisa (ej: "USD")
}
```

### Algoritmo de Estimación de Cobros:
El simulador lee el portafolio del usuario (del RFC 006) y cruza las cantidades de activos que posee (`quantity` en `investment_assets`) con la base de datos de dividendos estimados:

$$\text{Dividendo Estimado} = \text{Cantidad de Acciones} \times \text{amountPerShare}$$

Esto genera un **Calendario Mensual de Ingresos Pasivos** proyectado para el usuario en la interfaz del simulador.
