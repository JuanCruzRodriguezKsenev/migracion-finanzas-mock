// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , beforeAll } from "vitest" ;
import { render , screen }                    from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Cards
import { makeInstallmentPlan }        from "../testing/installmentPlanFactory" ;
import { CardWithAccountsAndEntity } from "../types" ;
import { CardVisual }                 from "./CardVisual" ;


describe( "CardVisual" , () => {
  let dictEs: Awaited< ReturnType< typeof getDictionary > > ;
  let dictEn: Awaited< ReturnType< typeof getDictionary > > ;

  const baseCard: CardWithAccountsAndEntity = {
    id:                    "card-visual-1" ,
    organizationId:        "org-test" ,
    label:                 "Galicia Visa" ,
    type:                  "credit" ,
    network:               "visa" ,
    lastFour:              "4321" ,
    expiryMonth:           12 ,
    expiryYear:            2030 ,
    creditLimit:           50000000 , // $500.000
    closingDay:            20 ,
    dueDay:                5 ,
    monthlyMaintenanceFee: 0 ,
    annualRenewalFee:      0 ,
    interestRateFinancing: null ,
    interestRatePenalty:   null ,
    entityId:              null ,
    linkedAccountId:       null ,
    archivedAt:            null ,
    createdAt:             new Date() ,
    updatedAt:             new Date() ,
    accounts: [
      {
        id:        "ca-1" ,
        cardId:    "card-visual-1" ,
        accountId: "acc-1" ,
        currency:  "ARS" ,
        createdAt: new Date() ,
        account: {
          id:             "acc-1" ,
          organizationId: "org-test" ,
          code:           "2.1.01.01" ,
          name:           "Tarjeta Visa" ,
          type:           "liability" ,
          balance:        0 , // 0 deuda inicial
          currency:       "ARS" ,
          entityId:       null ,
          cbuCvu:         null ,
          alias:          null ,
          isCommonPot:    false ,
          ownerUserId:    null ,
          createdAt:      new Date() ,
        } ,
      } ,
    ] ,
  } ;

  beforeAll( async () => {
    dictEs = await getDictionary( "es" ) ;
    dictEn = await getDictionary( "en" ) ;
  } ) ;

  it( "una tarjeta de crédito sin closingDay (fechas en null) renderiza sin lanzar y no muestra facturado ni en curso" , () => {
    const cardSinCierre: CardWithAccountsAndEntity = {
      ...baseCard ,
      closingDay: null ,
      dueDay:     null ,
      ciclo: {
        cierreAnterior: null ,
        cierreActual:   null ,
        vencimiento:    null ,
        facturado:      0 ,
        enCurso:        0 ,
        cuotasFuturas:  {} ,
      } ,
    } ;

    // No debe lanzar RangeError: Invalid time value
    expect( () => {
      render(
        <CardVisual
          card={cardSinCierre}
          locale="es-AR"
          dict={dictEs}
        />
      ) ;
    } ).not.toThrow() ;

    expect( screen.queryByText( "Saldo facturado" ) ).toBeNull() ;
    expect( screen.queryByText( "Saldo en curso" ) ).toBeNull() ;
  } ) ;

  it( "con un plan de 12 cuotas de $10.000 y una imputada: cuotas futuras muestra $110.000, pista dice 11 y disponible resta deuda y cuotas futuras" , () => {
    const plan = {
      ...makeInstallmentPlan( {
        cardId:            baseCard.id ,
        installmentAmount: 1000000 , // $10.000
        totalInstallments: 12 ,
        currency:          "ARS" ,
      } ) ,
      cuotasImputadas: 1 ,
      pendientes:      [] ,
    } ;

    const cardConPlan: CardWithAccountsAndEntity = {
      ...baseCard ,
      creditLimit: 50000000 , // $500.000
      accounts: [
        {
          ...baseCard.accounts[0] ,
          account: {
            ...baseCard.accounts[0].account ,
            balance: -5000000 , // $50.000 de deuda contable (-balance)
          } ,
        } ,
      ] ,
      ciclo: {
        cierreAnterior: "2026-08-20T12:00:00Z" ,
        cierreActual:   "2026-09-20T12:00:00Z" ,
        vencimiento:    "2026-10-05T12:00:00Z" ,
        facturado:      3000000 ,
        enCurso:        2000000 ,
        cuotasFuturas:  { ARS: 11000000 } , // 11 cuotas x $10.000 = $110.000
      } ,
      planes: [ plan ] ,
    } ;

    render(
      <CardVisual
        card={cardConPlan}
        locale="es-AR"
        dict={dictEs}
      />
    ) ;

    // Fila de cuotas futuras visible con $ 110.000 y 11 cuotas pendientes
    expect( screen.getByText( "Cuotas futuras" ) ).toBeDefined() ;
    expect( screen.getByText( /110\.000/ ) ).toBeDefined() ;
    expect( screen.getByText( /11 cuotas pendientes/ ) ).toBeDefined() ;

    // Disponible = 500.000 - 50.000 (deuda) - 110.000 (futuras) = $340.000
    expect( screen.getByText( /Disponible:\s*\$\s*340\.000/ ) ).toBeDefined() ;
  } ) ;

  it( "un plan en USD sobre una tarjeta en ARS no entra en el disponible y aparece como badge aparte" , () => {
    const cardConUsd: CardWithAccountsAndEntity = {
      ...baseCard ,
      creditLimit: 50000000 , // $500.000
      ciclo: {
        cierreAnterior: "2026-08-20T12:00:00Z" ,
        cierreActual:   "2026-09-20T12:00:00Z" ,
        vencimiento:    "2026-10-05T12:00:00Z" ,
        facturado:      0 ,
        enCurso:        0 ,
        cuotasFuturas:  { USD: 20000 } , // US$ 200
      } ,
    } ;

    render(
      <CardVisual
        card={cardConUsd}
        locale="es-AR"
        dict={dictEs}
      />
    ) ;

    // Disponible no descuenta los USD (sigue en $500.000)
    expect( screen.getByText( /Disponible:\s*\$\s*500\.000/ ) ).toBeDefined() ;

    // Badge separado para cuotas futuras en USD
    expect( screen.getByText( /Cuotas futuras \(USD\):/ ) ).toBeDefined() ;
  } ) ;

  it( "los rótulos salen del diccionario real: montar con dict en inglés y comprobar Future installments" , () => {
    const plan = {
      ...makeInstallmentPlan( {
        cardId:            baseCard.id ,
        installmentAmount: 1000000 ,
        totalInstallments: 6 ,
        currency:          "ARS" ,
      } ) ,
      cuotasImputadas: 1 ,
      pendientes:      [] ,
    } ;

    const cardConPlan: CardWithAccountsAndEntity = {
      ...baseCard ,
      ciclo: {
        cierreAnterior: "2026-08-20T12:00:00Z" ,
        cierreActual:   "2026-09-20T12:00:00Z" ,
        vencimiento:    "2026-10-05T12:00:00Z" ,
        facturado:      0 ,
        enCurso:        0 ,
        cuotasFuturas:  { ARS: 5000000 } ,
      } ,
      planes: [ plan ] ,
    } ;

    render(
      <CardVisual
        card={cardConPlan}
        locale="en-US"
        dict={dictEn}
      />
    ) ;

    expect( screen.getByText( "Future installments" ) ).toBeDefined() ;
    expect( screen.getByText( /installments left/ ) ).toBeDefined() ;
  } ) ;
} ) ;
