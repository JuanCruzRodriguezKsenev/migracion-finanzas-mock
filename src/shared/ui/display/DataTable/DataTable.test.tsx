// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi } from "vitest" ;
import { render , screen , fireEvent } from "@testing-library/react" ;

// Shared
import { DataTable , DataTableColumn } from "./DataTable" ;


interface SampleRow {
  id:     string ;
  name:   string ;
  amount: number ;
}

describe( "DataTable" , () => {
  const columns: DataTableColumn< SampleRow >[] = [
    { key: "name"   , header: "Nombre" } ,
    { key: "amount" , header: "Monto"  , align: "right" , render: ( row ) => `$${row.amount}` } ,
  ] ;

  const rows: SampleRow[] = [
    { id: "1" , name: "Sueldo"   , amount: 1500 } ,
    { id: "2" , name: "Expensas" , amount: 350  } ,
  ] ;

  it( "debería renderizar las cabeceras y filas de datos correctamente" , () => {
    render( <DataTable columns={columns} data={rows} /> ) ;

    expect( screen.getByText( "Nombre" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "Monto" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "Sueldo" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "$1500" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "Expensas" ) ).toBeInTheDocument() ;
    expect( screen.getByText( "$350" ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería mostrar el mensaje de vacío cuando no hay registros" , () => {
    render( <DataTable columns={columns} data={[]} emptyMessage="Sin movimientos" /> ) ;

    expect( screen.getByText( "Sin movimientos" ) ).toBeInTheDocument() ;
  } ) ;

  it( "debería llamar a onRowClick cuando se hace clic en una fila" , () => {
    const handleRowClick = vi.fn() ;
    render( <DataTable columns={columns} data={rows} onRowClick={handleRowClick} /> ) ;

    fireEvent.click( screen.getByText( "Sueldo" ) ) ;
    expect( handleRowClick ).toHaveBeenCalledTimes( 1 ) ;
    expect( handleRowClick ).toHaveBeenCalledWith( rows[0] ) ;
  } ) ;

  it( "debería renderizar skeletons en estado de carga" , () => {
    const { container } = render( <DataTable columns={columns} data={[]} loading={true} loadingRows={3} /> ) ;

    // Skeletons renderizados en filas
    const trs = container.querySelectorAll( "tbody tr" ) ;
    expect( trs.length ).toBe( 3 ) ;
  } ) ;
} ) ;
