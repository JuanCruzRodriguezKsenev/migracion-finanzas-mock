// @vitest-environment jsdom
/**
 * @file TransactionFormModal.cuentas.test.tsx
 * Plan 26 (AC-16): sin bloque «Compartir y usar», la pregunta de deuda aparece sólo con cuenta
 * propia + reparto aplicable, titular fijo con personal (RN-9) y selector «a nombre de» sin viewers (AC-9).
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor , within }       from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Splits
import type { VistaPreviaReparto } from "@/features/splits/actions/acuerdoActions" ;

// Feature: Accounting
import type { Account , EtiquetaCuenta } from "@/features/accounting/types" ;

// Feature: Transactions
import { createTransactionFromFormAction } from "../actions/transactionsActions" ;
import { TransactionFormModal }            from "./TransactionFormModal" ;


vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  createCategoryAction: vi.fn() ,
} ) ) ;

vi.mock( "../actions/transactionsActions" , () => ( {
  createTransactionFromFormAction: vi.fn() ,
} ) ) ;

type ConEtiqueta = Account & { etiqueta?: EtiquetaCuenta ; ownerNombre?: string } ;

function cuenta( id: string , name: string , extra: Partial< ConEtiqueta > = {} ): ConEtiqueta {
  return( {
    id , name , organizationId: "org-1" , code: `1.${name}` , type: "asset" , balance: 1000 , currency: "ARS" ,
    entityId: null , cbuCvu: null , alias: null , isCommonPot: false , ownerUserId: null , createdAt: new Date() ,
    ...extra ,
  } as ConEtiqueta ) ;
}

const caja:       ConEtiqueta = cuenta( "acc-caja"  , "Caja Casa"  , { etiqueta: { tipo: "organizacion" } } ) ;
const bancoAna:   ConEtiqueta = cuenta( "acc-banco" , "Banco Ana"  , {
  ownerUserId: "u-ana" ,
  etiqueta:    { tipo: "compartida" , organizaciones: [ { id: "org-1" , nombre: "reparto-demo" } ] } ,
} ) ;
const dniAna:     ConEtiqueta = cuenta( "acc-dni"   , "Cuenta DNI" , { ownerUserId: "u-ana" , etiqueta: { tipo: "privada" } } ) ;
const cuentaBeto: ConEtiqueta = cuenta( "acc-beto"  , "Banco Beto" , {
  ownerUserId: "u-beto" ,
  ownerNombre: "Beto" ,
  etiqueta:    { tipo: "compartida" , organizaciones: [ { id: "org-1" , nombre: "reparto-demo" } ] } ,
} ) ;

describe( "TransactionFormModal — cuentas propias y pregunta de deuda (plan 26)" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const titulares = [ { userId: "u-ana" , nombre: "Ana" } , { userId: "u-juan" , nombre: "Juan" } ] ;

  const vistaPreviaAplica: VistaPreviaReparto = {
    aplica:         true ,
    motivo:         "aplica" ,
    titular:        "Ana" ,
    partesIguales:  false ,
    desactualizado: false ,
    partes: [
      { userId: "u-ana"  , nombre: "Ana"  , porcentajeBp: 5000 , montoEnCentavos: 5000 , esDeuda: false } ,
      { userId: "u-juan" , nombre: "Juan" , porcentajeBp: 5000 , montoEnCentavos: 5000 , esDeuda: true } ,
    ] ,
  } ;

  const montar = ( props: Partial< React.ComponentProps< typeof TransactionFormModal > > = {} ) => {
    return( render(
      <TransactionFormModal
        isOpen
        onClose={ () => {} }
        onSuccess={ () => {} }
        accounts={ [ caja , bancoAna , dniAna , cuentaBeto ] }
        cuentasDict={dict.accountsPage}
        titulares={titulares}
        holderDict={dict.transactionsPage}
        {...props}
      />
    ) ) ;
  } ;

  const origen = () => screen.getByLabelText( /Cuenta de pago/ ) as HTMLSelectElement ;

  it( "el selector de origen ofrece las usables (propias privadas/compartidas, ajenas y org)" , () => {
    montar() ;

    expect( within( origen() ).getByRole( "option" , { name: "Caja Casa (asset) · De la organización" } ) ).toBeTruthy() ;
    expect( within( origen() ).getByRole( "option" , { name: "Banco Ana (asset) · Compartida · reparto-demo" } ) ).toBeTruthy() ;
    expect( within( origen() ).getByRole( "option" , { name: "Cuenta DNI (asset) · Privada" } ) ).toBeTruthy() ;
    expect( within( origen() ).getByRole( "option" , { name: "Banco Beto · Compartida · reparto-demo (de Beto)" } ) ).toBeTruthy() ;
  } ) ;

  it( "no existe bloque «Compartir y usar» en el formulario" , () => {
    montar() ;

    expect( screen.queryByText( /¿Pagaste con una cuenta tuya\?/i ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , { name: /Compartir .* y usarla/ } ) ).toBeNull() ;
  } ) ;

  describe( "pregunta de deuda (AC-16, RN-18, RN-19)" , () => {
    it( "aparece con cuenta propia y reparto aplicable, con «Sí» marcado por defecto" , async () => {
      const previsualizar = vi.fn().mockResolvedValue( { success: true , value: vistaPreviaAplica } ) ;
      montar( { previsualizar: previsualizar as never , repartoDict: dict.splits } ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
      fireEvent.change( origen() , { target: { value: "acc-banco" } } ) ;

      await waitFor( () => expect( screen.getByText( dict.accountsPage.debtQuestion ) ).toBeTruthy() ) ;

      const radioSi = screen.getByLabelText( dict.accountsPage.debtYes ) as HTMLInputElement ;
      const radioNo = screen.getByLabelText( dict.accountsPage.debtNo ) as HTMLInputElement ;

      expect( radioSi.checked ).toBe( true ) ;
      expect( radioNo.checked ).toBe( false ) ;
    } ) ;

    it( "marcar «No, lo absorbo yo» envía absorbeElDueno: true" , async () => {
      vi.mocked( createTransactionFromFormAction ).mockResolvedValue( { success: true , value: {} } as never ) ;
      const previsualizar = vi.fn().mockResolvedValue( { success: true , value: vistaPreviaAplica } ) ;
      montar( { previsualizar: previsualizar as never , repartoDict: dict.splits } ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
      fireEvent.change( screen.getByLabelText( /Descripción/ ) , { target: { value: "Súper" } } ) ;
      fireEvent.change( origen() , { target: { value: "acc-banco" } } ) ;

      await waitFor( () => expect( screen.getByText( dict.accountsPage.debtQuestion ) ).toBeTruthy() ) ;

      const radioNo = screen.getByLabelText( dict.accountsPage.debtNo ) ;
      fireEvent.click( radioNo ) ;

      fireEvent.click( screen.getByRole( "button" , { name: "Guardar Transacción" } ) ) ;

      await waitFor( () => expect( createTransactionFromFormAction ).toHaveBeenCalledTimes( 1 ) ) ;
      expect( vi.mocked( createTransactionFromFormAction ).mock.calls[0][0] ).toMatchObject( {
        sourceAccountId: "acc-banco" ,
        absorbeElDueno:  true ,
      } ) ;
    } ) ;

    it( "no aparece con una cuenta de la organización" , async () => {
      const previsualizar = vi.fn().mockResolvedValue( { success: true , value: vistaPreviaAplica } ) ;
      montar( { previsualizar: previsualizar as never , repartoDict: dict.splits } ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
      fireEvent.change( origen() , { target: { value: "acc-caja" } } ) ;

      // Esperar debounce
      await waitFor( () => expect( previsualizar ).toHaveBeenCalled() ) ;
      expect( screen.queryByText( dict.accountsPage.debtQuestion ) ).toBeNull() ;
    } ) ;

    it( "no aparece con una cuenta personal ajena (de Beto)" , async () => {
      const previsualizar = vi.fn().mockResolvedValue( { success: true , value: vistaPreviaAplica } ) ;
      montar( { previsualizar: previsualizar as never , repartoDict: dict.splits } ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
      fireEvent.change( origen() , { target: { value: "acc-beto" } } ) ;

      await waitFor( () => expect( previsualizar ).toHaveBeenCalled() ) ;
      expect( screen.queryByText( dict.accountsPage.debtQuestion ) ).toBeNull() ;
    } ) ;

    it( "no aparece si el reparto no aplica" , async () => {
      const previsualizar = vi.fn().mockResolvedValue( {
        success: true ,
        value:   { ...vistaPreviaAplica , aplica: false , motivo: "modo_none" , partes: [] } ,
      } ) ;
      montar( { previsualizar: previsualizar as never , repartoDict: dict.splits } ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
      fireEvent.change( origen() , { target: { value: "acc-banco" } } ) ;

      await waitFor( () => expect( previsualizar ).toHaveBeenCalled() ) ;
      expect( screen.queryByText( dict.accountsPage.debtQuestion ) ).toBeNull() ;
    } ) ;
  } ) ;

  describe( "titular con una cuenta personal (RN-9) y selector «a nombre de» (AC-9)" , () => {
    const titular = () => screen.getByLabelText( dict.transactionsPage.holderSelectLabel ) as HTMLSelectElement ;

    it( "AC-9: el selector lista sólo los titulares recibidos (un viewer no llega)" , () => {
      montar() ;

      expect( within( titular() ).getAllByRole( "option" ).map( ( o ) => o.textContent ) ).toEqual( [ "Ana (vos)" , "Juan" ] ) ;
      expect( screen.queryByRole( "option" , { name: /Vera/ } ) ).toBeNull() ;
    } ) ;

    it( "con una personal de origen el titular queda fijo en el dueño y deshabilitado" , () => {
      montar() ;
      fireEvent.change( titular() , { target: { value: "u-juan" } } ) ;
      expect( titular().value ).toBe( "u-juan" ) ;

      fireEvent.change( origen() , { target: { value: "acc-banco" } } ) ;

      expect( titular().value ).toBe( "u-ana" ) ;
      expect( titular().disabled ).toBe( true ) ;
      expect( screen.getByText( dict.accountsPage.holderFixedOwner ) ).toBeTruthy() ;
    } ) ;

    it( "con una personal no se envía otro titular aunque se hubiera elegido antes" , async () => {
      vi.mocked( createTransactionFromFormAction ).mockResolvedValue( { success: true , value: {} } as never ) ;
      montar() ;

      fireEvent.change( titular() , { target: { value: "u-juan" } } ) ;
      fireEvent.change( origen() , { target: { value: "acc-banco" } } ) ;
      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
      fireEvent.change( screen.getByLabelText( /Descripción/ ) , { target: { value: "Súper" } } ) ;
      fireEvent.click( screen.getByRole( "button" , { name: "Guardar Transacción" } ) ) ;

      await waitFor( () => expect( createTransactionFromFormAction ).toHaveBeenCalledTimes( 1 ) ) ;
      expect( vi.mocked( createTransactionFromFormAction ).mock.calls[0][0] ).toMatchObject( {
        sourceAccountId: "acc-banco" ,
        holderUserId:    undefined ,
      } ) ;
    } ) ;

    it( "con una cuenta de la organización el titular se puede elegir y se envía" , async () => {
      vi.mocked( createTransactionFromFormAction ).mockResolvedValue( { success: true , value: {} } as never ) ;
      montar() ;

      fireEvent.change( titular() , { target: { value: "u-juan" } } ) ;
      fireEvent.change( origen() , { target: { value: "acc-caja" } } ) ;
      expect( titular().disabled ).toBe( false ) ;

      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "100" } } ) ;
      fireEvent.change( screen.getByLabelText( /Descripción/ ) , { target: { value: "Súper" } } ) ;
      fireEvent.click( screen.getByRole( "button" , { name: "Guardar Transacción" } ) ) ;

      await waitFor( () => expect( createTransactionFromFormAction ).toHaveBeenCalledTimes( 1 ) ) ;
      expect( vi.mocked( createTransactionFromFormAction ).mock.calls[0][0] ).toMatchObject( { holderUserId: "u-juan" } ) ;
    } ) ;
  } ) ;
} ) ;
