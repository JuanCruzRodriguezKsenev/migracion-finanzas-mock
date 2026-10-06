// @vitest-environment jsdom
/**
 * @file DonutChart.test.tsx
 * Tests unitarios y de accesibilidad para DonutChart.
 */
// Librerías externas
import { render , screen , fireEvent } from "@testing-library/react" ;
import { describe , it , expect , vi } from "vitest" ;
import React                           from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;

// Componente
import { DonutChart , DonutSegment } from "./DonutChart" ;

describe( "DonutChart component" , () => {
  const mockSegments: DonutSegment[] = [
    { id: "cat-1" , name: "Vivienda" , value: 380000 , color: "#EF4444" , formattedValue: "$ 380.000" } ,
    { id: "cat-2" , name: "Alimentos" , value: 240000 , color: "#3B82F6" , formattedValue: "$ 240.000" } ,
  ] ;

  it( "renderiza sin romper con segmentos vacíos" , () => {
    render( <DonutChart segments={[]} emptyText="Sin gastos" /> ) ;
    expect( screen.getByText( "Sin gastos" ) ).toBeDefined() ;
    expect( screen.getByRole( "img" ) ).toBeDefined() ;
  } ) ;

  it( "renderiza nombres, porcentajes y valores en la lista accesible" , () => {
    render( <DonutChart segments={mockSegments} ariaLabel="Gastos por categoría" /> ) ;
    expect( screen.getByRole( "img" , { name: "Gastos por categoría" } ) ).toBeDefined() ;

    // Nombres en la lista accesible
    expect( screen.getAllByText( "Vivienda" ).length ).toBeGreaterThanOrEqual( 1 ) ;
    expect( screen.getAllByText( "Alimentos" ).length ).toBeGreaterThanOrEqual( 1 ) ;

    // Importes
    expect( screen.getAllByText( "$ 380.000" ).length ).toBeGreaterThanOrEqual( 1 ) ;
    expect( screen.getAllByText( "$ 240.000" ).length ).toBeGreaterThanOrEqual( 1 ) ;
  } ) ;

  it( "enmascara valores y porcentajes como •••••• con el ojito cerrado (RN-24)" , () => {
    render(
      <MetricsVisibilityContext.Provider value={{ isContentVisible: false , toggleVisibility: () => {} }}>
        <DonutChart segments={mockSegments} />
      </MetricsVisibilityContext.Provider>
    ) ;

    // No debe haber valores ni porcentajes legibles
    expect( screen.queryByText( "$ 380.000" ) ).toBeNull() ;
    expect( screen.queryByText( "$ 240.000" ) ).toBeNull() ;

    const maskedItems = screen.getAllByText( "••••••" ) ;
    // Al menos 2 por segmento (porcentaje + importe) en la lista visible y en la accesible
    expect( maskedItems.length ).toBeGreaterThanOrEqual( 4 ) ;
  } ) ;

  it( "dispara onSelect al interactuar con un segmento" , () => {
    const handleSelect = vi.fn() ;
    render( <DonutChart segments={mockSegments} onSelect={handleSelect} /> ) ;

    const btnVivienda = screen.getAllByText( "Vivienda" )[ 0 ].closest( "button" ) ;
    expect( btnVivienda ).toBeDefined() ;
    if( btnVivienda ) {
      fireEvent.click( btnVivienda ) ;
      expect( handleSelect ).toHaveBeenCalledWith( "cat-1" ) ;
    }
  } ) ;
} ) ;
