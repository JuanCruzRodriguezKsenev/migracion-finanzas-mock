// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }   from "@testing-library/react" ;

// Feature: Notifications
import { NotificationsProvider } from "@/features/notifications/context/NotificationsContext" ;

// Feature: Accounting
import { CategoriesSettingsContainer } from "./CategoriesSettingsContainer" ;
import { CategoryTreeNode }            from "../../types" ;

// Mocks
vi.mock( "../../actions/categoryActions" , () => ( {
  getCategoryTreeAction:          vi.fn() ,
  createCategoryAction:           vi.fn() ,
  updateCategoryAction:           vi.fn() ,
  archiveCategoryAction:          vi.fn() ,
  unarchiveCategoryAction:        vi.fn() ,
  getCategoryMovementsCountAction: vi.fn() ,
} ) ) ;

import {
  getCategoryTreeAction ,
  archiveCategoryAction ,
  getCategoryMovementsCountAction
} from "../../actions/categoryActions" ;

describe( "CategoriesSettingsContainer - Dos columnas y gestión de categorías" , () => {
  const sampleTree: CategoryTreeNode[] = [
    {
      id:             "cat-exp-1" ,
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
          id:             "sub-exp-1" ,
          organizationId: "org-1" ,
          parentId:       "cat-exp-1" ,
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
          id:             "leaf-exp-1" ,
          organizationId: "org-1" ,
          parentId:       "cat-exp-1" ,
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
      id:             "cat-exp-2" ,
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
          id:             "sub-exp-2" ,
          organizationId: "org-1" ,
          parentId:       "cat-exp-2" ,
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
  ] ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const renderContainer = ( tree: CategoryTreeNode[] ) => (
    render(
      <NotificationsProvider>
        <CategoriesSettingsContainer initialTree={tree} />
      </NotificationsProvider>
    )
  ) ;

  it( "seleccionar un padre muestra sus hijas y no muestra el código contable" , () => {
    renderContainer( sampleTree ) ;

    // Por defecto el primer padre seleccionado es Vivienda
    expect( screen.getByRole( "heading" , { name: "Vivienda" , level: 2 } ) ).toBeTruthy() ;
    expect( screen.getByText( "Alquiler" ) ).toBeTruthy() ;
    expect( screen.getByText( "Sin detallar" ) ).toBeTruthy() ;

    // Comprobar que NO muestra códigos contables como "5.1.01" o "5.1.01.01"
    expect( screen.queryByText( "5.1.01" ) ).toBeNull() ;
    expect( screen.queryByText( "5.1.01.01" ) ).toBeNull() ;

    // Cambiar al segundo padre haciendo clic en "Alimentación"
    const alimentacionBtn = screen.getByRole( "button" , { name: /Alimentación/i } ) ;
    fireEvent.click( alimentacionBtn ) ;

    expect( screen.getByRole( "heading" , { name: "Alimentación" , level: 2 } ) ).toBeTruthy() ;
    expect( screen.getByText( "Supermercado" ) ).toBeTruthy() ;
  } ) ;

  it( "el checkbox Ver archivadas consulta el árbol con includeArchived: true" , async () => {
    vi.mocked( getCategoryTreeAction ).mockResolvedValue( {
      success: true ,
      value:   sampleTree ,
    } ) ;

    renderContainer( sampleTree ) ;

    const checkbox = screen.getByLabelText( /Ver archivadas/i ) ;
    fireEvent.click( checkbox ) ;

    await waitFor( () => {
      expect( getCategoryTreeAction ).toHaveBeenCalledWith( { includeArchived: true } ) ;
    } ) ;
  } ) ;

  it( "confirmación de archivado consulta y muestra el conteo de movimientos" , async () => {
    vi.mocked( getCategoryMovementsCountAction ).mockResolvedValue( {
      success: true ,
      value:   14 ,
    } ) ;

    vi.mocked( archiveCategoryAction ).mockResolvedValue( {
      success: true ,
      value:   sampleTree[0] ,
    } ) ;

    vi.mocked( getCategoryTreeAction ).mockResolvedValue( {
      success: true ,
      value:   sampleTree ,
    } ) ;

    renderContainer( sampleTree ) ;

    // Botón archivar de la cabecera del padre Vivienda
    const archiveBtns = screen.getAllByRole( "button" , { name: /^Archivar$/i } ) ;
    fireEvent.click( archiveBtns[0] ) ;

    // Debe abrir el modal y mostrar el conteo consultado
    await waitFor( () => {
      expect( getCategoryMovementsCountAction ).toHaveBeenCalledWith( "cat-exp-1" ) ;
      expect( screen.getByText( /Movimientos registrados: 14/i ) ).toBeTruthy() ;
    } ) ;

    // Advertencia de archivo en cascada para padres
    expect( screen.getByText( /archiva en cascada todas sus subcategorías/i ) ).toBeTruthy() ;

    // Confirmar archivado
    const confirmBtn = screen.getByRole( "button" , { name: /Confirmar archivado/i } ) ;
    fireEvent.click( confirmBtn ) ;

    await waitFor( () => {
      expect( archiveCategoryAction ).toHaveBeenCalledWith( { id: "cat-exp-1" } ) ;
    } ) ;
  } ) ;
} ) ;
