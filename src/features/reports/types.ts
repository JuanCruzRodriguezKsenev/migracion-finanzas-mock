/**
 * @file types.ts
 * Contratos de tipos para el módulo de Estadísticas y Reportes (RFC 027 §5).
 */

export interface MetricaConVariacion {
  value:        number ;
  variacionPct: number | null ;
}

export interface TasaAhorro {
  value:   number | null ;
  deltaPP: number | null ;
}

export interface ReportTrendPoint {
  monthKey:        string ;
  ingresos:        number ;
  gastos:          number ;
  ahorroNeto:      number ;
  patrimonioLibro: number ;
}

export interface ReportCategoryLeaf {
  id:     string ;
  nombre: string ;
  total:  number ;
}

export interface ReportCategoryParent {
  id:     string ;
  nombre: string ;
  color:  string ;
  total:  number ;
  hojas:  ReportCategoryLeaf[] ;
}

export interface ReportCategoryGroup {
  tipo:   "expense" | "revenue" ;
  total:  number ;
  padres: ReportCategoryParent[] ;
}

export interface ReportTopExpense {
  id:          string ;
  descripcion: string ;
  categoria:   string ;
  fecha:       string ;
  monto:       number ;
}

export interface ReportNetWorth {
  activos:        number ;
  pasivos:        number ;
  cuotasPorPagar: number ;
  neto:           number ;
}

export interface ReportMetrics {
  ingresos:      MetricaConVariacion ;
  gastos:        MetricaConVariacion ;
  ahorroNeto:    MetricaConVariacion ;
  tasaAhorro:    TasaAhorro ;
  transacciones: number ;
}

export interface ReportData {
  currency:       string ;
  monthKey:       string ;
  metrics:        ReportMetrics ;
  tendencia:      ReportTrendPoint[] ;
  categorias:     ReportCategoryGroup[] ;
  topGastos:      ReportTopExpense[] ;
  patrimonio:     ReportNetWorth ;
  divisas:        string[] ;
  minKey:         string | undefined ;
  hayMovimientos: boolean ;
}

export interface GastoPorHojaItem {
  categoryId: string | null ;
  accountId:  string ;
  total:      number ;
}
