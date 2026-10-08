// @vitest-environment jsdom
/**
 * @file TransactionFormModal.cuentas.test.tsx
 * Plan 25, paso 4: selector de origen con etiquetas (RN-15), «Compartir y usar» con confirmación (RN-10, PA-3),
 * titular fijo con una personal (RN-9) y selector «a nombre de» sin viewers (AC-9).
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor , within }       from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import type { Account , EtiquetaCuenta } from "@/features/accounting/types" ;
import { compartirCuentaAction }         from "@/features/accounting/actions/cuentasPersonalesActions" ;

// Feature: Transactions
import { createTransactionFromFormAction } from "../actions/transactionsActions" ;
import { TransactionFormModal }            from "./TransactionFormModal" ;


vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  createCategoryAction: vi.fn() ,
} ) ) ;

vi.mock( "@/features/accounting/actions/cuentasPersonalesActions" , () => ( {
  compartirCuentaAction: vi.fn() ,
} ) ) ;

vi.mock( "../actions/transactionsActions" , () => ( {
  createTransactionFromFormAction: vi.fn() ,
} ) ) ;

type ConEtiqueta = Account & { etiqueta?: EtiquetaCuenta } ;

function cuenta( id: string , name: string , extra: Partial< ConEtiqueta > = {} ): ConEtiqueta {
  return( {
    id , name , organizationId: "org-1" , code: `1.${name}` , type: "asset" , balance: 1000 , currency: "ARS" ,
    entityId: null , cbuCvu: null , alias: null , isCommonPot: false , ownerUserId: null , createdAt: new Date() ,
    ...extra ,
  } as ConEtiqueta ) ;
}

const caja:     ConEtiqueta = cuenta( "acc-caja"  , "Caja Casa"  , { etiqueta: { tipo: "organizacion" } } ) ;
const bancoAna: ConEtiqueta = cuenta( "acc-banco" , "Banco Ana"  , {
  ownerUserId: "u-ana" ,
  etiqueta:    { tipo: "compartida" , organizaciones: [ { id: "org-1" , nombre: "reparto-demo" } ] } ,
} ) ;
const dniAna:   ConEtiqueta = cuenta( "acc-dni"   , "Cuenta DNI" , { ownerUserId: "u-ana" , etiqueta: { tipo: "privada" } } ) ;

describe( "TransactionFormModal — cuentas propias y compartidas (plan 25)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const titulares = [ { userId: "u-ana" , nombre: "Ana" } , { userId: "u-juan" , nombre: "Juan" } ] ;

  const montar = ( props: Partial< React.ComponentProps< typeof TransactionFormModal > > = {} ) => {
    const onCuentaCompartida = vi.fn() ;
    const vista = render(
      <TransactionFormModal
        isOpen
        onClose={ () => {} }
        onSuccess={ () => {} }
        accounts={ [ caja , bancoAna ] }
        compartibles={ [ dniAna ] }
        organizacionId="org-1"
        organizacionNombre="reparto-demo"
        cuentasDict={dict.accountsPage}
        onCuentaCompartida={onCuentaCompartida}
        titulares={titulares}
        holderDict={dict.transactionsPage}
        {...props}
      />
    ) ;
    return( {...vista , onCuentaCompartida} ) ;
  } ;

  const origen = () => screen.getByLabelText( /Cuenta de pago/ ) as HTMLSelectElement ;

  it( "el selector de origen ofrece las usables, cada una con su etiqueta, y no ofrece las compartibles" , () => {
    montar() ;

    expect( within( origen() ).getByRole( "option" , {name: "Caja Casa (asset) · De la organización"} ) ).toBeTruthy() ;
    expect( within( origen() ).getByRole( "option" , {name: "Banco Ana (asset) · Compartida · reparto-demo"} ) ).toBeTruthy() ;
    expect( within( origen() ).queryByRole( "option" , {name: /Cuenta DNI/} ) ).toBeNull() ;
  } ) ;

  it( "sin compartibles el bloque «¿Pagaste con una cuenta tuya?» no aparece" , () => {
    montar( {compartibles: []} ) ;

    expect( screen.queryByText( dict.accountsPage.shareAndUseHint ) ).toBeNull() ;
  } ) ;

  it( "con compartibles ofrece «Compartir X con <org> y usarla»" , () => {
    montar() ;

    expect( screen.getByText( dict.accountsPage.shareAndUseHint ) ).toBeTruthy() ;
    expect( screen.getByRole( "button" , {name: "Compartir Cuenta DNI con reparto-demo y usarla"} ) ).toBeTruthy() ;
  } ) ;

  it( "pide confirmación con la línea fija (PA-3) y cancelar no comparte nada" , () => {
    montar() ;

    fireEvent.click( screen.getByRole( "button" , {name: /Compartir Cuenta DNI/} ) ) ;

    expect( screen.getByText(
      "Vas a compartir Cuenta DNI con reparto-demo: sus miembros verán los movimientos que cargues acá, no su saldo."
    ) ).toBeTruthy() ;

    const confirmacion = screen.getByRole( "group" , {name: dict.accountsPage.shareAndUseHint} ) ;
    fireEvent.click( within( confirmacion ).getByRole( "button" , {name: dict.accountsPage.shareConfirmCancel} ) ) ;

    expect( compartirCuentaAction ).not.toHaveBeenCalled() ;
    expect( screen.getByRole( "button" , {name: /Compartir Cuenta DNI/} ) ).toBeTruthy() ;
  } ) ;

  it( "aceptar comparte, deja la cuenta elegida y conserva lo escrito sin cerrar el formulario (AC-2)" , async () => {
    vi.mocked( compartirCuentaAction ).mockResolvedValue( {success: true , value: null} as never ) ;
    const onClose = vi.fn() ;
    const { onCuentaCompartida } = montar( {onClose} ) ;

    fireEvent.change( screen.getByLabelText( /Monto/ ) , {target: {value: "12000"}} ) ;
    fireEvent.change( screen.getByLabelText( /Descripción/ ) , {target: {value: "Súper"}} ) ;

    fireEvent.click( screen.getByRole( "button" , {name: /Compartir Cuenta DNI/} ) ) ;
    fireEvent.click( screen.getByRole( "button" , {name: dict.accountsPage.shareConfirmAccept} ) ) ;

    await waitFor( () => expect( compartirCuentaAction ).toHaveBeenCalledWith( {accountId: "acc-dni" , organizationId: "org-1"} ) ) ;
    await waitFor( () => expect( origen().value ).toBe( "acc-dni" ) ) ;

    expect( ( screen.getByLabelText( /Monto/ ) as HTMLInputElement ).value ).toBe( "12000" ) ;
    expect( ( screen.getByLabelText( /Descripción/ ) as HTMLInputElement ).value ).toBe( "Súper" ) ;
    expect( onClose ).not.toHaveBeenCalled() ;
    expect( onCuentaCompartida ).toHaveBeenCalledTimes( 1 ) ;
    expect( screen.queryByText( dict.accountsPage.shareAndUseHint ) ).toBeNull() ;
  } ) ;

  it( "si compartir falla, muestra el error y la cuenta sigue sin elegirse" , async () => {
    vi.mocked( compartirCuentaAction ).mockResolvedValue( {success: false , error: "No autorizado."} as never ) ;
    montar() ;

    fireEvent.click( screen.getByRole( "button" , {name: /Compartir Cuenta DNI/} ) ) ;
    fireEvent.click( screen.getByRole( "button" , {name: dict.accountsPage.shareConfirmAccept} ) ) ;

    expect( await screen.findByText( "No autorizado." ) ).toBeTruthy() ;
    expect( origen().value ).toBe( "" ) ;
  } ) ;

  describe( "titular con una cuenta personal (RN-9) y selector «a nombre de» (AC-9)" , () => {
    const titular = () => screen.getByLabelText( dict.transactionsPage.holderSelectLabel ) as HTMLSelectElement ;

    it( "AC-9: el selector lista sólo los titulares recibidos (un viewer no llega)" , () => {
      montar() ;

      expect( within( titular() ).getAllByRole( "option" ).map( ( o ) => o.textContent ) ).toEqual( [ "Ana (vos)" , "Juan" ] ) ;
      expect( screen.queryByRole( "option" , {name: /Vera/} ) ).toBeNull() ;
    } ) ;

    it( "con una personal de origen el titular queda fijo en el dueño y deshabilitado" , () => {
      montar() ;
      fireEvent.change( titular() , {target: {value: "u-juan"}} ) ;
      expect( titular().value ).toBe( "u-juan" ) ;

      fireEvent.change( origen() , {target: {value: "acc-banco"}} ) ;

      expect( titular().value ).toBe( "u-ana" ) ;
      expect( titular().disabled ).toBe( true ) ;
      expect( screen.getByText( dict.accountsPage.holderFixedOwner ) ).toBeTruthy() ;
    } ) ;

    it( "con una personal no se envía otro titular aunque se hubiera elegido antes" , async () => {
      vi.mocked( createTransactionFromFormAction ).mockResolvedValue( {success: true , value: {}} as never ) ;
      montar() ;

      fireEvent.change( titular() , {target: {value: "u-juan"}} ) ;
      fireEvent.change( origen() , {target: {value: "acc-banco"}} ) ;
      fireEvent.change( screen.getByLabelText( /Monto/ ) , {target: {value: "100"}} ) ;
      fireEvent.change( screen.getByLabelText( /Descripción/ ) , {target: {value: "Súper"}} ) ;
      fireEvent.click( screen.getByRole( "button" , {name: "Guardar Transacción"} ) ) ;

      await waitFor( () => expect( createTransactionFromFormAction ).toHaveBeenCalledTimes( 1 ) ) ;
      expect( vi.mocked( createTransactionFromFormAction ).mock.calls[0][0] ).toMatchObject( {sourceAccountId: "acc-banco" , holderUserId: undefined} ) ;
    } ) ;

    it( "con una cuenta de la organización el titular se puede elegir y se envía" , async () => {
      vi.mocked( createTransactionFromFormAction ).mockResolvedValue( {success: true , value: {}} as never ) ;
      montar() ;

      fireEvent.change( titular() , {target: {value: "u-juan"}} ) ;
      fireEvent.change( origen() , {target: {value: "acc-caja"}} ) ;
      expect( titular().disabled ).toBe( false ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , {target: {value: "100"}} ) ;
      fireEvent.change( screen.getByLabelText( /Descripción/ ) , {target: {value: "Súper"}} ) ;
      fireEvent.click( screen.getByRole( "button" , {name: "Guardar Transacción"} ) ) ;

      await waitFor( () => expect( createTransactionFromFormAction ).toHaveBeenCalledTimes( 1 ) ) ;
      expect( vi.mocked( createTransactionFromFormAction ).mock.calls[0][0] ).toMatchObject( {holderUserId: "u-juan"} ) ;
    } ) ;
  } ) ;
} ) ;
