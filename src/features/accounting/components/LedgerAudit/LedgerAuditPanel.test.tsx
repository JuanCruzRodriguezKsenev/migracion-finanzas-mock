// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , beforeAll } from "vitest" ;
import { render , screen , fireEvent }       from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Accounting
import { LedgerAuditPanel } from "./LedgerAuditPanel" ;
import { Account }          from "../../types" ;

describe( "LedgerAuditPanel - Auditoría de plan de cuentas" , () => {
  const sampleAccounts: Account[] = [
    {
      id:             "acc-asset-ars" ,
      organizationId: "org-1" ,
      code:           "1.1.01.01" ,
      name:           "Caja Chica" ,
      type:           "asset" ,
      balance:        1500000 ,
      currency:       "ARS" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      isCommonPot:    false ,
      createdAt:      new Date() ,
    } ,
    {
      id:             "acc-asset-usd" ,
      organizationId: "org-1" ,
      code:           "1.1.01.02" ,
      name:           "Cuenta Corriente USD" ,
      type:           "asset" ,
      balance:        50000 ,
      currency:       "USD" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      isCommonPot:    false ,
      createdAt:      new Date() ,
    } ,
    {
      id:             "acc-liab-ars" ,
      organizationId: "org-1" ,
      code:           "2.1.01.01" ,
      name:           "Tarjeta Santander Visa" ,
      type:           "liability" ,
      balance:        -842000 ,
      currency:       "ARS" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      isCommonPot:    false ,
      createdAt:      new Date() ,
    } ,
    {
      id:             "acc-equity" ,
      organizationId: "org-1" ,
      code:           "3.1.01.01" ,
      name:           "Capital Social" ,
      type:           "equity" ,
      balance:        20000000 ,
      currency:       "ARS" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      isCommonPot:    false ,
      createdAt:      new Date() ,
    } ,
    {
      id:             "acc-expense" ,
      organizationId: "org-1" ,
      code:           "5.1.01.01" ,
      name:           "Alquiler Oficina" ,
      type:           "expense" ,
      balance:        1200000 ,
      currency:       "ARS" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      isCommonPot:    false ,
      createdAt:      new Date() ,
    } ,
  ] ;

  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const renderPanel = ( accounts: Account[] = sampleAccounts ) => (
    render(
      <LedgerAuditPanel accounts={accounts} dict={dict} />
    )
  ) ;

  it( "renderiza una fila por cuenta y cada una muestra su propia divisa (USD para la cuenta en dólares)" , () => {
    renderPanel() ;

    expect( screen.getByText( "Caja Chica" ) ).toBeTruthy() ;
    expect( screen.getByText( "Cuenta Corriente USD" ) ).toBeTruthy() ;

    const usdElements = screen.getAllByText( "USD" ) ;
    expect( usdElements.length ).toBeGreaterThanOrEqual( 1 ) ;

    const arsElements = screen.getAllByText( "ARS" ) ;
    expect( arsElements.length ).toBe( 4 ) ;
  } ) ;

  it( "el buscador filtra por código y por nombre de cuenta" , () => {
    renderPanel() ;

    const searchInput = screen.getByPlaceholderText( dict.settingsPage.ledgerSearch ) ;

    fireEvent.change( searchInput , { target: { value: "1.1.01.02" } } ) ;
    expect( screen.getByText( "Cuenta Corriente USD" ) ).toBeTruthy() ;
    expect( screen.queryByText( "Caja Chica" ) ).toBeNull() ;
    expect( screen.queryByText( "Tarjeta Santander Visa" ) ).toBeNull() ;

    fireEvent.change( searchInput , { target: { value: "Alquiler" } } ) ;
    expect( screen.getByText( "Alquiler Oficina" ) ).toBeTruthy() ;
    expect( screen.queryByText( "Cuenta Corriente USD" ) ).toBeNull() ;
    expect( screen.queryByText( "Caja Chica" ) ).toBeNull() ;
  } ) ;

  it( "el saldo de la cuenta liability se muestra negativo con el saldo crudo del libro mayor" , () => {
    renderPanel() ;

    expect( screen.getByText( "-$8.420,00" ) ).toBeTruthy() ;
  } ) ;
} ) ;
