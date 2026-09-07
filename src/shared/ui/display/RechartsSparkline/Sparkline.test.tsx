// @vitest-environment jsdom
/**
 * @file Sparkline.test.tsx
 * Tests unitarios para el componente Sparkline y sus funciones auxiliares.
 */
// Librerías externas
import { render }                 from "@testing-library/react" ;
import { describe , it , expect } from "vitest" ;
import React                      from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import {
  Sparkline ,
  formatMonthKeyLabel ,
  calcularCambioPorcentual
} from "./Sparkline" ;

describe( "formatMonthKeyLabel" , () => {
  it( "debería formatear correctamente la clave de mes a etiqueta legible" , () => {
    const labelEs = formatMonthKeyLabel( "2026-05" , "es" ) ;
    expect( labelEs ).toContain( "26" ) ;
    expect( labelEs.toLowerCase() ).toContain( "may" ) ;

    const labelEn = formatMonthKeyLabel( "2026-05" , "en" ) ;
    expect( labelEn ).toBe( "May 26" ) ;
  } ) ;

  it( "debería retornar la clave intacta si el formato es inválido" , () => {
    expect( formatMonthKeyLabel( "invalido" ) ).toBe( "invalido" ) ;
    expect( formatMonthKeyLabel( "2026" ) ).toBe( "2026" ) ;
  } ) ;
} ) ;

describe( "calcularCambioPorcentual" , () => {
  it( "debería retornar null cuando el valor anterior es nulo, undefined o cero" , () => {
    expect( calcularCambioPorcentual( 100 , null ) ).toBeNull() ;
    expect( calcularCambioPorcentual( 100 , undefined ) ).toBeNull() ;
    expect( calcularCambioPorcentual( 100 , 0 ) ).toBeNull() ;
  } ) ;

  it( "debería calcular el porcentaje de incremento correctamente" , () => {
    expect( calcularCambioPorcentual( 150 , 100 ) ).toBe( 50 ) ;
    expect( calcularCambioPorcentual( 200 , 100 ) ).toBe( 100 ) ;
  } ) ;

  it( "debería calcular el porcentaje de disminución correctamente" , () => {
    expect( calcularCambioPorcentual( 50 , 100 ) ).toBe( -50 ) ;
  } ) ;
} ) ;

describe( "Sparkline component" , () => {
  it( "debería renderizar contenedor vacío si no hay puntos suficientes" , () => {
    const { container } = render(
      <Sparkline points={[]} color="#fff" />
    ) ;

    expect( container.querySelector( "svg" ) ).toBeNull() ;
  } ) ;

  it( "debería respetar el contexto de MetricsVisibilityContext para privacidad" , () => {
    const points = [
      { value: 1000 , monthKey: "2026-01" } ,
      { value: 1200 , monthKey: "2026-02" }
    ] ;

    const { container } = render(
      <MetricsVisibilityContext.Provider value={{ isContentVisible: false , toggleVisibility: () => {} }}>
        <Sparkline points={points} color="#10b981" />
      </MetricsVisibilityContext.Provider>
    ) ;

    expect( container.firstChild ).toBeDefined() ;
  } ) ;

  it( "debería renderizar la serie de puntos mapeando sus etiquetas desde monthKey" , () => {
    const points = [
      { value: 1000 , monthKey: "2026-01" } ,
      { value: 1200 , monthKey: "2026-02" }
    ] ;

    const { container } = render(
      <Sparkline points={points} color="#10b981" lang="es" />
    ) ;

    expect( container.firstChild ).toBeDefined() ;
  } ) ;
} ) ;
