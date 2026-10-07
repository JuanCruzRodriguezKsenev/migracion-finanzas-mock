// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll } from "vitest" ;
import { render , screen , fireEvent }            from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Settings
import { SettingsContainer } from "./SettingsContainer" ;

// Feature: Accounting
import { Account , CategoryTreeNode } from "@/features/accounting/types" ;

// Mocks
vi.mock( "@/features/organizations/actions/membersActions" , () => ( {
  listarMiembrosAction:    vi.fn() ,
  invitarMiembroAction:    vi.fn() ,
  revocarInvitacionAction: vi.fn() ,
  quitarMiembroAction:     vi.fn() ,
} ) ) ;

vi.mock( "@/features/accounting/actions/categoryActions" , () => ( {
  getCategoryTreeAction:          vi.fn() ,
  createCategoryAction:           vi.fn() ,
  updateCategoryAction:           vi.fn() ,
  archiveCategoryAction:          vi.fn() ,
  unarchiveCategoryAction:        vi.fn() ,
  getCategoryMovementsCountAction: vi.fn() ,
} ) ) ;

describe( "SettingsContainer - Shell de navegación" , () => {
  const sampleTree: CategoryTreeNode[] = [
    {
      id:             "cat-1" ,
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
          id:             "sub-1" ,
          organizationId: "org-1" ,
          parentId:       "cat-1" ,
          name:           "Alquiler" ,
          type:           "expense" ,
          accountCode:    "5.1.01.01" ,
          icon:           "key" ,
          color:          "#9b59b6" ,
          isSystemLeaf:   false ,
          archivedAt:     null ,
          createdAt:      new Date() ,
        } ,
      ] ,
    } ,
  ] ;

  const sampleAccounts: Account[] = [
    {
      id:             "acc-1" ,
      organizationId: "org-1" ,
      code:           "1.1.01.01" ,
      name:           "Banco Galicia" ,
      type:           "asset" ,
      balance:        5000000 ,
      currency:       "ARS" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      createdAt:      new Date() ,
    } ,
    {
      id:             "acc-2" ,
      organizationId: "org-1" ,
      code:           "2.1.01.01" ,
      name:           "Tarjeta Visa" ,
      type:           "liability" ,
      balance:        -250000 ,
      currency:       "ARS" ,
      entityId:       null ,
      cbuCvu:         null ,
      alias:          null ,
      createdAt:      new Date() ,
    } ,
  ] ;

  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  const renderShell = () => (
    render(
      <NotificationsProvider>
        <SettingsContainer
          initialTree={sampleTree}
          accounts={sampleAccounts}
          dict={dict}
          lang="es"
        />
      </NotificationsProvider>
    )
  ) ;

  it( "arranca en la pestaña Categorías mostrando el árbol y sin mostrar cuentas contables" , () => {
    renderShell() ;

    expect( screen.getByRole( "heading" , { name: "Vivienda" , level: 2 } ) ).toBeTruthy() ;
    expect( screen.getByText( "Alquiler" ) ).toBeTruthy() ;
    expect( screen.queryByText( "1.1.01.01" ) ).toBeNull() ;
    expect( screen.queryByText( "Banco Galicia" ) ).toBeNull() ;
  } ) ;

  it( "al hacer clic en Plan contable muestra la tabla de auditoría con las cuentas" , () => {
    renderShell() ;

    const ledgerTab = screen.getByRole( "tab" , { name: /Plan contable/i } ) ;
    fireEvent.click( ledgerTab ) ;

    expect( screen.getByText( "1.1.01.01" ) ).toBeTruthy() ;
    expect( screen.getByText( "Banco Galicia" ) ).toBeTruthy() ;
    expect( screen.getByText( "2.1.01.01" ) ).toBeTruthy() ;
    expect( screen.getByText( "Tarjeta Visa" ) ).toBeTruthy() ;
  } ) ;

  it( "sin esOwner no existe la pestaña Miembros" , () => {
    renderShell() ;

    expect( screen.queryByRole( "tab" , { name: /Miembros/i } ) ).toBeNull() ;
  } ) ;

  it( "con esOwner aparece la pestaña Miembros y muestra el panel" , () => {
    render(
      <NotificationsProvider>
        <SettingsContainer
          initialTree={sampleTree}
          accounts={sampleAccounts}
          dict={dict}
          lang="es"
          esOwner
          miembros={ { miembros: [ { userId: "u-1" , nombre: "Juan" , email: "juan@ejemplo.com" , rol: "owner" } ] , invitaciones: [] } }
          currentUserId="u-1"
        />
      </NotificationsProvider>
    ) ;

    fireEvent.click( screen.getByRole( "tab" , { name: /Miembros/i } ) ) ;

    expect( screen.getByText( "juan@ejemplo.com" ) ).toBeTruthy() ;
  } ) ;
} ) ;
