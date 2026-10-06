// @vitest-environment jsdom
/**
 * @file StatsContainer.test.tsx
 * Tests unitarios y de integración visual para StatsContainer.
 */
// Librerías externas
import { render , screen }        from "@testing-library/react" ;
import { describe , it , expect , vi } from "vitest" ;
import React                      from "react" ;

// Feature: Reports
import { StatsContainer } from "./StatsContainer" ;
import { ReportData }     from "../types" ;

vi.mock( "next/navigation" , () => ( {
  useRouter:       () => ( { push: vi.fn() } ) ,
  usePathname:     () => "/es/reports" ,
  useSearchParams: () => new URLSearchParams() ,
} ) ) ;

describe( "StatsContainer component" , () => {
  const mockReportData: ReportData = {
    currency:       "ARS" ,
    monthKey:       "2026-05" ,
    metrics:        {
      ingresos:      { value: 1250000 , variacionPct: 5 } ,
      gastos:        { value: 837700 , variacionPct: -2 } ,
      ahorroNeto:    { value: 412300 , variacionPct: 8 } ,
      tasaAhorro:    { value: 33 , deltaPP: 2 } ,
      transacciones: 48 ,
    } ,
    tendencia: [
      { monthKey: "2026-04" , ingresos: 1000000 , gastos: 800000 , ahorroNeto: 200000 , patrimonioLibro: 5000000 } ,
      { monthKey: "2026-05" , ingresos: 1250000 , gastos: 837700 , ahorroNeto: 412300 , patrimonioLibro: 5412300 } ,
    ] ,
    categorias: [
      {
        tipo:   "expense" ,
        total:  837700 ,
        padres: [
          {
            id:     "p-1" ,
            nombre: "Vivienda" ,
            color:  "#EF4444" ,
            total:  320000 ,
            hojas:  [ { id: "h-1" , nombre: "Alquiler" , total: 320000 } ] ,
          } ,
        ] ,
      } ,
      { tipo: "revenue" , total: 1250000 , padres: [] } ,
    ] ,
    topGastos: [
      { id: "tx-1" , descripcion: "Alquiler Mayo" , categoria: "Vivienda" , fecha: "2026-05-01" , monto: 320000 } ,
    ] ,
    patrimonio: {
      activos:        7100000 ,
      pasivos:        -420000 ,
      cuotasPorPagar: 200000 ,
      neto:           6480000 ,
    } ,
    divisas:        [ "ARS" , "USD" ] ,
    minKey:         "2026-01" ,
    hayMovimientos: true ,
  } ;

  it( "renderiza las cinco secciones principales con datos completos" , () => {
    render( <StatsContainer reportData={mockReportData} lang="es" /> ) ;

    // Métricas
    expect( screen.getByText( "Ahorro neto" ) ).toBeDefined() ;
    expect( screen.getAllByText( "Ingresos" ).length ).toBeGreaterThanOrEqual( 1 ) ;
    expect( screen.getAllByText( "Gastos" ).length ).toBeGreaterThanOrEqual( 1 ) ;
    expect( screen.getByText( "Tasa de ahorro" ) ).toBeDefined() ;

    // Categorías y top
    expect( screen.getByText( "Por categoría" ) ).toBeDefined() ;
    expect( screen.getByText( "Top gastos" ) ).toBeDefined() ;

    // Patrimonio neto
    expect( screen.getByText( "Patrimonio Neto" ) ).toBeDefined() ;
    expect( screen.getByText( "a hoy" ) ).toBeDefined() ;
  } ) ;

  it( "muestra banner de período vacío cuando no hay movimientos en el mes" , () => {
    const emptyReportData: ReportData = {
      ...mockReportData ,
      metrics: {
        ingresos:      { value: 0 , variacionPct: null } ,
        gastos:        { value: 0 , variacionPct: null } ,
        ahorroNeto:    { value: 0 , variacionPct: null } ,
        tasaAhorro:    { value: null , deltaPP: null } ,
        transacciones: 0 ,
      } ,
      hayMovimientos: true , // la organización tiene movimientos históricos pero este mes no
    } ;

    render( <StatsContainer reportData={emptyReportData} lang="es" /> ) ;

    expect( screen.getByText( /Sin movimientos en/i ) ).toBeDefined() ;
    // El patrimonio neto se sigue mostrando (RN-15)
    expect( screen.getByText( "Patrimonio Neto" ) ).toBeDefined() ;
  } ) ;

  it( "muestra aviso de historia insuficiente si la tendencia tiene un solo mes" , () => {
    const singleMonthReport: ReportData = {
      ...mockReportData ,
      tendencia: [ mockReportData.tendencia[ 0 ] ] ,
    } ;

    render( <StatsContainer reportData={singleMonthReport} lang="es" /> ) ;
    expect( screen.getByText( /Se necesita más de un mes de historia/i ) ).toBeDefined() ;
  } ) ;
} ) ;
