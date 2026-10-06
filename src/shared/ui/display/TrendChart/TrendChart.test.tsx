// @vitest-environment jsdom
/**
 * @file TrendChart.test.tsx
 * Tests unitarios y de accesibilidad para TrendChart.
 */
// Librerías externas
import { render , screen }        from "@testing-library/react" ;
import { describe , it , expect } from "vitest" ;
import React                      from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;

// Componente
import { TrendChart , TrendChartPoint } from "./TrendChart" ;

describe( "TrendChart component" , () => {
  const mockData: TrendChartPoint[] = [
    { label: "Ene 26" , ingresos: 100000 , gastos: 80000 , formattedIngresos: "$ 100.000" , formattedGastos: "$ 80.000" } ,
    { label: "Feb 26" , ingresos: 120000 , gastos: 85000 , formattedIngresos: "$ 120.000" , formattedGastos: "$ 85.000" } ,
  ] ;

  it( "renderiza sin romper con datos vacíos" , () => {
    render( <TrendChart data={[]} emptyText="No hay datos" /> ) ;
    expect( screen.getByText( "No hay datos" ) ).toBeDefined() ;
    expect( screen.getByRole( "img" ) ).toBeDefined() ;
  } ) ;

  it( "renderiza la estructura del gráfico y la alternativa textual accesible (NFR-4)" , () => {
    render( <TrendChart data={mockData} ariaLabel="Tendencia anual" /> ) ;
    const imgElement = screen.getByRole( "img" , { name: "Tendencia anual" } ) ;
    expect( imgElement ).toBeDefined() ;

    // La tabla accesible contiene los datos
    expect( screen.getByText( "Ene 26" ) ).toBeDefined() ;
    expect( screen.getByText( "$ 100.000" ) ).toBeDefined() ;
    expect( screen.getByText( "$ 80.000" ) ).toBeDefined() ;
  } ) ;

  it( "enmascara los valores en la alternativa textual con el ojito cerrado (RN-24)" , () => {
    render(
      <MetricsVisibilityContext.Provider value={{ isContentVisible: false , toggleVisibility: () => {} }}>
        <TrendChart data={mockData} />
      </MetricsVisibilityContext.Provider>
    ) ;

    // No debe haber números legibles en la tabla accesible
    expect( screen.queryByText( "$ 100.000" ) ).toBeNull() ;
    expect( screen.queryByText( "$ 80.000" ) ).toBeNull() ;

    const maskedItems = screen.getAllByText( "••••••" ) ;
    expect( maskedItems.length ).toBeGreaterThanOrEqual( 2 ) ;
  } ) ;
} ) ;
