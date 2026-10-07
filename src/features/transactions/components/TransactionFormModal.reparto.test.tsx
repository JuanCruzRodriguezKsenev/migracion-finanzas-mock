// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import type { Account } from "@/features/accounting/types" ;

// Feature: Splits
import type { VistaPreviaReparto } from "@/features/splits/actions/acuerdoActions" ;

// Feature: Transactions
import { TransactionFormModal } from "./TransactionFormModal" ;


vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  createCategoryAction: vi.fn() ,
} ) ) ;

vi.mock( "../actions/transactionsActions" , () => ( {
  createTransactionFromFormAction: vi.fn() ,
} ) ) ;

describe( "TransactionFormModal - Reparto previsto" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const cuentas: Account[] = [
    {
      id: "acc-1" , organizationId: "org-1" , code: "1.1.01" , name: "Caja" , type: "asset" , balance: 0 , currency: "ARS" ,
      entityId: null , cbuCvu: null , alias: null , isCommonPot: false , createdAt: new Date() ,
    } ,
  ] ;

  const aplica: VistaPreviaReparto = {
    aplica:         true ,
    motivo:         "aplica" ,
    titular:        "Ana" ,
    partesIguales:  false ,
    desactualizado: false ,
    partes: [
      { userId: "u-ana"  , nombre: "Ana"  , porcentajeBp: 5000 , montoEnCentavos: 5001 , esDeuda: false } ,
      { userId: "u-beto" , nombre: "Beto" , porcentajeBp: 5000 , montoEnCentavos: 5000 , esDeuda: true } ,
    ] ,
  } ;

  const montar = ( previsualizar?: ( ...args: never[] ) => Promise< unknown > ) => render(
    <TransactionFormModal
      isOpen
      onClose={ () => {} }
      onSuccess={ () => {} }
      accounts={cuentas}
      previsualizar={previsualizar as never}
      repartoDict={dict.splits}
    />
  ) ;

  const completar = () => {
    fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100.01" } } ) ;
    fireEvent.change( screen.getByLabelText( /Cuenta de pago/ ) , { target: { value: "acc-1" } } ) ;
  } ;

  it( "con la vista previa inyectada muestra el bloque «Reparto previsto» con nombre, porcentaje, monto y «te debe a»" , async () => {
    const previsualizar = vi.fn().mockResolvedValue( { success: true , value: aplica } ) ;
    montar( previsualizar ) ;

    completar() ;

    await waitFor( () => expect( screen.getByText( dict.splits.previewTitle ) ).toBeTruthy() ) ;
    expect( previsualizar ).toHaveBeenCalledWith( expect.objectContaining( { tipo: "expense" , montoEnCentavos: 10001 , currency: "ARS" , accountIds: [ "acc-1" ] } ) ) ;
    expect( screen.getByText( "Beto" ) ).toBeTruthy() ;
    expect( screen.getByText( dict.splits.owesTo.replace( "{titular}" , "Ana" ) ) ).toBeTruthy() ;
    expect( screen.getAllByText( "50 %" ) ).toHaveLength( 2 ) ;
  } ) ;

  it( "si nadie declaró su aporte avisa que se reparte por partes iguales" , async () => {
    const previsualizar = vi.fn().mockResolvedValue( { success: true , value: { ...aplica , partesIguales: true } } ) ;
    montar( previsualizar ) ;

    completar() ;

    await waitFor( () => expect( screen.getByText( dict.splits.noContributions ) ).toBeTruthy() ) ;
  } ) ;

  it( "sin la prop no hay bloque y nadie hace consulta" , async () => {
    render(
      <TransactionFormModal isOpen onClose={ () => {} } onSuccess={ () => {} } accounts={cuentas} />
    ) ;

    completar() ;
    await new Promise( ( resolve ) => setTimeout( resolve , 450 ) ) ;

    expect( screen.queryByText( dict.splits.previewTitle ) ).toBeNull() ;
  } ) ;

  it( "no consulta por cada tecla: espera y manda una sola consulta con el último monto" , async () => {
    const previsualizar = vi.fn().mockResolvedValue( { success: true , value: aplica } ) ;
    montar( previsualizar ) ;

    fireEvent.change( screen.getByLabelText( /Cuenta de pago/ ) , { target: { value: "acc-1" } } ) ;
    for( const v of [ "1" , "10" , "100" , "100.0" , "100.01" ] ) {
      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: v } } ) ;
    }

    await waitFor( () => expect( previsualizar ).toHaveBeenCalled() ) ;
    await new Promise( ( resolve ) => setTimeout( resolve , 450 ) ) ;

    expect( previsualizar ).toHaveBeenCalledTimes( 1 ) ;
    expect( previsualizar ).toHaveBeenCalledWith( expect.objectContaining( { montoEnCentavos: 10001 } ) ) ;
  } ) ;

  it( "no muestra el bloque cuando el reparto no aplica ni en ingresos" , async () => {
    const previsualizar = vi.fn().mockResolvedValue( { success: true , value: { ...aplica , aplica: false , motivo: "modo_none" , partes: [] } } ) ;
    montar( previsualizar ) ;

    completar() ;
    await waitFor( () => expect( previsualizar ).toHaveBeenCalled() ) ;
    expect( screen.queryByText( dict.splits.previewTitle ) ).toBeNull() ;

    previsualizar.mockClear() ;
    fireEvent.click( screen.getByRole( "button" , { name: "Ingreso" } ) ) ;
    await new Promise( ( resolve ) => setTimeout( resolve , 450 ) ) ;
    expect( previsualizar ).not.toHaveBeenCalled() ;
  } ) ;

  it( "con el acuerdo desactualizado muestra el motivo y deshabilita Guardar" , async () => {
    const previsualizar = vi.fn().mockResolvedValue( { success: true , value: { ...aplica , desactualizado: true , partes: [] } } ) ;
    montar( previsualizar ) ;

    completar() ;

    await waitFor( () => expect( screen.getByText( dict.splits.outdated ) ).toBeTruthy() ) ;
    expect( ( screen.getByRole( "button" , { name: "Guardar Transacción" } ) as HTMLButtonElement ).disabled ).toBe( true ) ;
  } ) ;
} ) ;
