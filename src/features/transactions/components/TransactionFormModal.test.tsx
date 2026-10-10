// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }     from "@testing-library/react" ;

// Feature: Accounting
import { CategoryTreeNode } from "@/features/accounting/types" ;
import { Account }          from "@/features/accounting/types" ;

// Feature: Transactions
import { TransactionFormModal } from "./TransactionFormModal" ;

// Mocks
vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  createCategoryAction: vi.fn() ,
} ) ) ;

vi.mock( "../actions/transactionsActions" , () => ( {
  createTransactionFromFormAction: vi.fn() ,
} ) ) ;

import { createCategoryAction } from "@/features/accounting/actions/categoryActions" ;
import { createTransactionFromFormAction } from "../actions/transactionsActions" ;

describe( "TransactionFormModal - Selector jerárquico y creación al vuelo" , () => {
  const sampleAccounts: Account[] = [
    {
      id:             "acc-1" ,
      organizationId: "org-1" ,
      code:           "1.1.01-ARS" ,
      name:           "Caja Pesos" ,
      type:           "asset" ,
      balance:        50000 ,
      currency:       "ARS" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      isCommonPot:    false ,
      ownerUserId:    null ,
      createdAt:      new Date() ,
    } ,
  ] ;

  const sampleTree: CategoryTreeNode[] = [
    {
      id:             "parent-exp-1" ,
      organizationId: "org-1" ,
      parentId:       null ,
      name:           "Vivienda" ,
      type:           "expense" ,
      accountCode:    "5.1.01" ,
      icon:           "home" ,
      color:          "#9b59b6" ,
      isSystemLeaf:   false ,
      archivedAt:     null ,
      createdAt:      new Date() ,
      children: [
        {
          id:             "child-exp-1" ,
          organizationId: "org-1" ,
          parentId:       "parent-exp-1" ,
          name:           "Alquiler" ,
          type:           "expense" ,
          accountCode:    "5.1.01.01" ,
          icon:           "key" ,
          color:          "#9b59b6" ,
          isSystemLeaf:   false ,
          archivedAt:     null ,
          createdAt:      new Date() ,
        } ,
        {
          id:             "child-exp-leaf" ,
          organizationId: "org-1" ,
          parentId:       "parent-exp-1" ,
          name:           "General" ,
          type:           "expense" ,
          accountCode:    "5.1.01.99" ,
          icon:           "home" ,
          color:          "#9b59b6" ,
          isSystemLeaf:   true ,
          archivedAt:     null ,
          createdAt:      new Date() ,
        } ,
      ] ,
    } ,
    {
      id:             "parent-exp-2" ,
      organizationId: "org-1" ,
      parentId:       null ,
      name:           "Alimentación" ,
      type:           "expense" ,
      accountCode:    "5.1.02" ,
      icon:           "shopping-cart" ,
      color:          "#e67e22" ,
      isSystemLeaf:   false ,
      archivedAt:     null ,
      createdAt:      new Date() ,
      children: [
        {
          id:             "child-exp-2" ,
          organizationId: "org-1" ,
          parentId:       "parent-exp-2" ,
          name:           "Supermercado" ,
          type:           "expense" ,
          accountCode:    "5.1.02.01" ,
          icon:           "shopping-cart" ,
          color:          "#e67e22" ,
          isSystemLeaf:   false ,
          archivedAt:     null ,
          createdAt:      new Date() ,
        } ,
      ] ,
    } ,
    {
      id:             "parent-rev-1" ,
      organizationId: "org-1" ,
      parentId:       null ,
      name:           "Ingresos Laborales" ,
      type:           "revenue" ,
      accountCode:    "4.1.01" ,
      icon:           "briefcase" ,
      color:          "#27ae60" ,
      isSystemLeaf:   false ,
      archivedAt:     null ,
      createdAt:      new Date() ,
      children: [
        {
          id:             "child-rev-1" ,
          organizationId: "org-1" ,
          parentId:       "parent-rev-1" ,
          name:           "Sueldo" ,
          type:           "revenue" ,
          accountCode:    "4.1.01.01" ,
          icon:           "dollar-sign" ,
          color:          "#27ae60" ,
          isSystemLeaf:   false ,
          archivedAt:     null ,
          createdAt:      new Date() ,
        } ,
      ] ,
    } ,
  ] ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "renderiza dos optgroups para gastos, no muestra hojas isSystemLeaf y filtra revenue en modo expense" , () => {
    render(
      <TransactionFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        accounts={sampleAccounts}
        categoryTree={sampleTree}
      />
    ) ;

    // En modo por defecto (expense), buscar los optgroup
    const optgroups = document.querySelectorAll( "optgroup" ) ;
    expect( optgroups.length ).toBe( 2 ) ;
    expect( optgroups[0].getAttribute( "label" ) ).toContain( "Vivienda" ) ;
    expect( optgroups[1].getAttribute( "label" ) ).toContain( "Alimentación" ) ;

    // No debe ofrecer la categoría revenue (Ingresos Laborales)
    expect( screen.queryByText( /Ingresos Laborales/i ) ).toBeNull() ;

    // Las subcategorías visibles
    expect( screen.getByRole( "option" , { name: /Alquiler/i } ) ).toBeTruthy() ;
    expect( screen.getByRole( "option" , { name: /Supermercado/i } ) ).toBeTruthy() ;

    const categorySelect = screen.getByLabelText( /^Categoría/i ) ;
    const categoryOptions = Array.from( categorySelect.querySelectorAll( "option" ) ).map( ( o ) => o.textContent || "" ) ;
    expect( categoryOptions.some( ( text ) => text.includes( "General" ) && !text.includes( "Sin categoría" ) ) ).toBe( false ) ;

    // Opción "Sin detallar" como primera opción
    expect( categoryOptions[0] ).toBe( "Sin detallar" ) ;
  } ) ;

  it( "permite crear una categoría al vuelo con createCategoryAction y la deja seleccionada" , async () => {
    const mockCreatedCategory = {
      id:             "new-cat-123" ,
      organizationId: "org-1" ,
      parentId:       "parent-exp-1" ,
      name:           "Mascotas" ,
      type:           "expense" as const ,
      accountCode:    "5.1.01.05" ,
      icon:           "🐶" ,
      color:          "#3498db" ,
      isSystemLeaf:   false ,
      archivedAt:     null ,
      createdAt:      new Date() ,
      updatedAt:      new Date() ,
    } ;

    vi.mocked( createCategoryAction ).mockResolvedValue( {
      success: true ,
      value:   mockCreatedCategory ,
    } ) ;

    render(
      <TransactionFormModal
        isOpen={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        accounts={sampleAccounts}
        categoryTree={sampleTree}
      />
    ) ;

    const categorySelect = screen.getByLabelText( /^Categoría/i ) ;

    // Seleccionar la opción de crear nueva categoría
    fireEvent.change( categorySelect , { target: { value: "__NEW_CATEGORY__" } } ) ;

    // Se debe mostrar el formulario de alta rápida dentro del modal
    expect( screen.getByText( /Nueva categoría de gastos/i ) ).toBeTruthy() ;

    // Completar el nombre
    const nameInput = screen.getByPlaceholderText( /Ej: Cursos, Mascotas/i ) ;
    fireEvent.change( nameInput , { target: { value: "Mascotas" } } ) ;

    // Confirmar creación
    const saveButton = screen.getByRole( "button" , { name: /Guardar categoría/i } ) ;
    fireEvent.click( saveButton ) ;

    await waitFor( () => {
      expect( createCategoryAction ).toHaveBeenCalledWith( {
        name:     "Mascotas" ,
        type:     "expense" ,
        parentId: undefined ,
        icon:     undefined ,
        color:    undefined ,
      } ) ;
    } ) ;

    // La categoría creada debe quedar seleccionada en el select de transacciones
    await waitFor( () => {
      expect( ( categorySelect as HTMLSelectElement ).value ).toBe( "new-cat-123" ) ;
    } ) ;
  } ) ;
} ) ;

describe( "TransactionFormModal - clave de envío (plan 46)" , () => {
  const cuenta: Account = {
    id:             "acc-1" ,
    organizationId: "org-1" ,
    code:           "1.1.01-ARS" ,
    name:           "Caja Pesos" ,
    type:           "asset" ,
    balance:        50000 ,
    currency:       "ARS" ,
    entityId:       null ,
    cbuCvu:         null ,
    alias:          null ,
    isCommonPot:    false ,
    ownerUserId:    null ,
    createdAt:      new Date() ,
  } ;

  const enviar = async ( veces: number ) => {
    fireEvent.click( screen.getByRole( "button" , { name: "Guardar Transacción" } ) ) ;
    await waitFor( () => expect( createTransactionFromFormAction ).toHaveBeenCalledTimes( veces ) ) ;
    // Deja asentar el estado posterior a la respuesta antes del siguiente envío
    await waitFor( () => expect( screen.getByRole( "button" , { name: "Guardar Transacción" } ) ).toBeTruthy() ) ;
  } ;

  it( "tras un error el reintento manda la misma clave; tras un éxito, otra" , async () => {
    vi.mocked( createTransactionFromFormAction ).mockReset() ;
    vi.mocked( createTransactionFromFormAction )
      .mockResolvedValueOnce( { success: false , error: "Se cayó la red" } )
      .mockResolvedValueOnce( { success: true , value: {} as never } ) ;

    render(
      <TransactionFormModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} accounts={[ cuenta ]} categoryTree={[]} />
    ) ;

    fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "120" } } ) ;
    fireEvent.change( screen.getByLabelText( /Descripción/ ) , { target: { value: "Súper" } } ) ;
    fireEvent.change( screen.getByLabelText( /Cuenta de pago/ ) , { target: { value: "acc-1" } } ) ;

    await enviar( 1 ) ;
    await waitFor( () => expect( screen.getByText( "Se cayó la red" ) ).toBeTruthy() ) ;
    await enviar( 2 ) ;

    const llamadas = vi.mocked( createTransactionFromFormAction ).mock.calls ;

    expect( typeof llamadas[0][1] ).toBe( "string" ) ;
    expect( llamadas[1][1] ).toBe( llamadas[0][1] ) ;
  } ) ;

  it( "tras un éxito el formulario genera otra clave" , async () => {
    vi.mocked( createTransactionFromFormAction ).mockReset() ;
    vi.mocked( createTransactionFromFormAction ).mockResolvedValue( { success: true , value: {} as never } ) ;

    render(
      <TransactionFormModal isOpen={true} onClose={vi.fn()} onSuccess={vi.fn()} accounts={[ cuenta ]} categoryTree={[]} />
    ) ;

    const completar = () => {
      fireEvent.change( screen.getByLabelText( /Monto/ ) , { target: { value: "120" } } ) ;
      fireEvent.change( screen.getByLabelText( /Descripción/ ) , { target: { value: "Súper" } } ) ;
      fireEvent.change( screen.getByLabelText( /Cuenta de pago/ ) , { target: { value: "acc-1" } } ) ;
    } ;

    completar() ;
    await enviar( 1 ) ;
    await waitFor( () => expect( ( screen.getByLabelText( /Monto/ ) as HTMLInputElement ).value ).toBe( "" ) ) ;
    completar() ;
    await enviar( 2 ) ;

    const llamadas = vi.mocked( createTransactionFromFormAction ).mock.calls ;

    expect( llamadas[1][1] ).not.toBe( llamadas[0][1] ) ;
  } ) ;
} ) ;
