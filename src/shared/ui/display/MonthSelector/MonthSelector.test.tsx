// @vitest-environment jsdom
/**
 * @file MonthSelector.test.tsx
 * Tests unitarios para el componente MonthSelector (a11y, i18n, navegación y teclado).
 */
// Librerías externas
import { render , screen , fireEvent } from "@testing-library/react" ;
import { describe , it , expect , vi } from "vitest" ;
import React                           from "react" ;

// Shared
import {
  MonthSelector ,
  getLocalizedMonthShortLabels
} from "./MonthSelector" ;

describe( "getLocalizedMonthShortLabels" , () => {
  it( "debería retornar 12 etiquetas de meses cortas para español" , () => {
    const labels = getLocalizedMonthShortLabels( "es" ) ;
    expect( labels.length ).toBe( 12 ) ;
    expect( labels[0].toLowerCase() ).toContain( "ene" ) ;
  } ) ;

  it( "debería retornar 12 etiquetas para inglés" , () => {
    const labels = getLocalizedMonthShortLabels( "en" ) ;
    expect( labels.length ).toBe( 12 ) ;
    expect( labels[0] ).toBe( "Jan" ) ;
    expect( labels[11] ).toBe( "Dec" ) ;
  } ) ;
} ) ;

describe( "MonthSelector Component" , () => {
  const defaultProps = {
    selectedKey: "2026-06" ,
    onChange:    vi.fn() ,
    lang:        "es" ,
    maxKey:      "2026-06" ,
    todayKey:    "2026-06"
  } ;

  it( "debería renderizar la etiqueta del mes y año seleccionados" , () => {
    render( <MonthSelector {...defaultProps} /> ) ;

    expect( screen.getByText( "2026" ) ).toBeInTheDocument() ;
    expect( screen.getByRole( "button" , { name: "Mes anterior" } ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería deshabilitar el botón de mes siguiente cuando supera maxKey" , () => {
    render( <MonthSelector {...defaultProps} selectedKey="2026-06" maxKey="2026-06" /> ) ;

    const nextBtn = screen.getByRole( "button" , { name: "Mes siguiente" } ) ;
    expect( nextBtn ).toBeDisabled() ;
  } ) ;

  it( "debería permitir navegar al mes anterior al hacer clic en el botón paso atrás" , () => {
    const onChange = vi.fn() ;
    render( <MonthSelector {...defaultProps} onChange={onChange} /> ) ;

    const prevBtn = screen.getByRole( "button" , { name: "Mes anterior" } ) ;
    fireEvent.click( prevBtn ) ;

    expect( onChange ).toHaveBeenCalledWith( "2026-05" ) ;
  } ) ;

  it( "debería abrir el diálogo con la grilla de meses al hacer clic en el disparador" , () => {
    render( <MonthSelector {...defaultProps} /> ) ;

    const trigger = screen.getByLabelText( "Seleccionar mes" ) ;
    fireEvent.click( trigger ) ;

    const dialog = screen.getByRole( "dialog" , { name: "Selector de mes y año" } ) ;
    expect( dialog ).toBeInTheDocument() ;
  } ) ;

  it( "debería cerrar el popover y devolver el foco al presionar Escape" , () => {
    render( <MonthSelector {...defaultProps} /> ) ;

    const trigger = screen.getByLabelText( "Seleccionar mes" ) ;
    fireEvent.click( trigger ) ;

    expect( screen.getByRole( "dialog" ) ).toBeInTheDocument() ;

    fireEvent.keyDown( document , { key: "Escape" } ) ;

    expect( screen.queryByRole( "dialog" ) ).toBeNull() ;
  } ) ;

  it( "debería seleccionar un mes de la grilla y cerrar el diálogo" , () => {
    const onChange = vi.fn() ;
    render( <MonthSelector {...defaultProps} onChange={onChange} /> ) ;

    const trigger = screen.getByLabelText( "Seleccionar mes" ) ;
    fireEvent.click( trigger ) ;

    const febBtn = screen.getByText( /Feb/i ) ;
    fireEvent.click( febBtn ) ;

    expect( onChange ).toHaveBeenCalledWith( "2026-02" ) ;
    expect( screen.queryByRole( "dialog" ) ).toBeNull() ;
  } ) ;

  it( "debería navegar a todayKey al presionar 'Ir al mes actual'" , () => {
    const onChange = vi.fn() ;
    render( <MonthSelector {...defaultProps} selectedKey="2025-01" todayKey="2026-06" onChange={onChange} /> ) ;

    const trigger = screen.getByLabelText( "Seleccionar mes" ) ;
    fireEvent.click( trigger ) ;

    const todayBtn = screen.getByText( "Ir al mes actual" ) ;
    fireEvent.click( todayBtn ) ;

    expect( onChange ).toHaveBeenCalledWith( "2026-06" ) ;
  } ) ;

  it( "debería deshabilitar el botón de mes anterior cuando prevMonthKey es menor a minKey" , () => {
    render( <MonthSelector {...defaultProps} selectedKey="2026-03" minKey="2026-03" /> ) ;

    const prevBtn = screen.getByRole( "button" , { name: "Mes anterior" } ) ;
    expect( prevBtn ).toBeDisabled() ;
  } ) ;

  it( "debería deshabilitar el botón de año anterior cuando el año actual es igual al minYear" , () => {
    render( <MonthSelector {...defaultProps} selectedKey="2025-05" minKey="2025-01" /> ) ;

    const trigger = screen.getByLabelText( "Seleccionar mes" ) ;
    fireEvent.click( trigger ) ;

    const prevYearBtn = screen.getByRole( "button" , { name: "Año anterior" } ) ;
    expect( prevYearBtn ).toBeDisabled() ;
  } ) ;

  it( "debería deshabilitar meses de la grilla anteriores a minKey y no invocar onChange al hacer clic" , () => {
    const onChange = vi.fn() ;
    render( <MonthSelector {...defaultProps} selectedKey="2026-05" minKey="2026-04" onChange={onChange} /> ) ;

    const trigger = screen.getByLabelText( "Seleccionar mes" ) ;
    fireEvent.click( trigger ) ;

    const febBtn = screen.getByText( /Feb/i ) ;
    expect( febBtn ).toBeDisabled() ;

    fireEvent.click( febBtn ) ;
    expect( onChange ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
