/**
 * @file CategoriesSettingsContainer.tsx
 * Contenedor principal cliente para la administración del árbol de categorías contables (RFC 022).
 * Implementa el diseño de dos columnas (Variante B): listado por tipo contable y ficha de detalle.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { SearchInput } from "@/shared/ui/forms/SearchInput/SearchInput" ;
import { FormActions } from "@/shared/ui/forms/Form/FormActions" ;
import { FormSelect }  from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }   from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }   from "@/shared/ui/forms/Form/FormError" ;
import { EmptyState }  from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Button }      from "@/shared/ui/display/Button/Button" ;
import { Modal }       from "@/shared/ui/feedback/Modal/Modal" ;
import { Tabs }        from "@/shared/ui/display/Tabs/Tabs" ;

// Feature: Accounting
import { CategoryTreeNode }                                                                                               from "../../repositories/categoryRepository" ;
import { getCategoryTreeAction , createCategoryAction , updateCategoryAction , archiveCategoryAction , unarchiveCategoryAction , getCategoryMovementsCountAction } from "../../actions/categoryActions" ;
import { iconoDeCategoria }                                                                                               from "../../utils/categoryIcons" ;
import { Category }                                                                                                       from "../../types" ;
import styles                                                                                                             from "./CategoriesSettingsContainer.module.css" ;


export interface CategoriesSettingsContainerProps {
  initialTree: CategoryTreeNode[] ;
  lang?:       string ;
}

const SETTINGS_TABS = [
  { key: "categories"   , label: "Categorías" } ,
  { key: "profile"      , label: "Perfil"        , disabled: true , badge: "Próximamente" } ,
  { key: "preferences"  , label: "Preferencias"  , disabled: true , badge: "Próximamente" } ,
  { key: "security"     , label: "Seguridad"     , disabled: true , badge: "Próximamente" } ,
] ;

/**
 * Contenedor orquestador para la gestión y configuración del árbol de categorías.
 */
export function CategoriesSettingsContainer( {
  initialTree ,
}: CategoriesSettingsContainerProps ) {
  const [ tree , setTree ]                                 = useState< CategoryTreeNode[] >( initialTree ) ;
  const [ isActionLoading , setIsActionLoading ]           = useState( false ) ;
  const [ searchTerm , setSearchTerm ]                     = useState( "" ) ;
  const [ showArchived , setShowArchived ]                 = useState( false ) ;
  const [ selectedParentId , setSelectedParentId ]         = useState< string | null >( () => {
    return( initialTree[0]?.id || null ) ;
  } ) ;

  // Modales de alta, edición y archivo
  const [ isCreateParentOpen , setIsCreateParentOpen ]     = useState( false ) ;
  const [ isCreateChildOpen , setIsCreateChildOpen ]       = useState( false ) ;
  const [ editCategoryModal , setEditCategoryModal ]       = useState< Category | null >( null ) ;
  const [ archiveTargetCat , setArchiveTargetCat ]         = useState< { id: string ; name: string ; isParent: boolean } | null >( null ) ;
  const [ archiveMovementsCount , setArchiveMovementsCount ] = useState< number | null >( null ) ;
  const [ isCheckingCount , setIsCheckingCount ]           = useState( false ) ;

  // Campos de formulario modal
  const [ formName , setFormName ]   = useState( "" ) ;
  const [ formType , setFormType ]   = useState< "expense" | "revenue" >( "expense" ) ;
  const [ formIcon , setFormIcon ]   = useState( "" ) ;
  const [ formColor , setFormColor ] = useState( "" ) ;
  const [ formError , setFormError ] = useState( "" ) ;

  // Campos de edición rápida de ícono y color en la ficha (modificaciones sin persistir)
  const [ customVisuals , setCustomVisuals ] = useState< { parentId: string ; icon: string ; color: string } | null >( null ) ;

  // Recarga del árbol según la casilla "Ver archivadas"
  const handleToggleArchived = async ( checked: boolean ) => {
    setShowArchived( checked ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await getCategoryTreeAction( { includeArchived: checked } ) ;
      if( res.success ) {
        setTree( res.value ) ;
      }
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  // Refresca el árbol completo con el estado actual de archivadas
  const refreshTree = async () => {
    const res = await getCategoryTreeAction( { includeArchived: showArchived } ) ;
    if( res.success ) {
      setTree( res.value ) ;
    }
  } ;

  // Filtrado de búsqueda
  const termLower = searchTerm.toLowerCase().trim() ;
  const filteredTree = tree.filter( ( parent ) => {
    if( !termLower ) {
      return( true ) ;
    }
    const parentMatches = parent.name.toLowerCase().includes( termLower ) ;
    const childMatches  = parent.children.some( ( c ) => c.name.toLowerCase().includes( termLower ) ) ;
    return( (parentMatches || childMatches) ) ;
  } ) ;

  const expenseParents = filteredTree.filter( ( p ) => p.type === "expense" ) ;
  const revenueParents = filteredTree.filter( ( p ) => p.type === "revenue" ) ;

  // Determina el padre activo actual
  const activeParent = ( tree.find( ( p ) => p.id === selectedParentId ) || filteredTree[0] || null ) ;

  // Deriva los valores visuales actuales del padre activo (con posibles modificaciones en curso)
  const quickIcon = ( (activeParent && (customVisuals?.parentId === activeParent.id))
    ? customVisuals.icon
    : (activeParent?.icon || "") ) ;
  const quickColor = ( (activeParent && (customVisuals?.parentId === activeParent.id))
    ? customVisuals.color
    : (activeParent?.color || "#3498db") ) ;

  // Apertura del modal de confirmación de archivo
  const handleOpenArchiveModal = async ( id: string , name: string , isParent: boolean ) => {
    setArchiveTargetCat( { id , name , isParent } ) ;
    setArchiveMovementsCount( null ) ;
    setIsCheckingCount( true ) ;

    try {
      const res = await getCategoryMovementsCountAction( id ) ;
      if( res.success ) {
        setArchiveMovementsCount( res.value ) ;
      } else {
        setArchiveMovementsCount( 0 ) ;
      }
    } finally {
      setIsCheckingCount( false ) ;
    }
  } ;

  const handleConfirmArchive = async () => {
    if( !archiveTargetCat ) {
      return ;
    }

    const catId = archiveTargetCat.id ;
    setIsActionLoading( true ) ;
    try {
      await archiveCategoryAction( { id: catId } ) ;
      await refreshTree() ;
      setArchiveTargetCat( null ) ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  const handleUnarchive = async ( id: string ) => {
    setIsActionLoading( true ) ;
    try {
      await unarchiveCategoryAction( { id } ) ;
      await refreshTree() ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  // Alta de categoría principal
  const handleCreateParent = async () => {
    setFormError( "" ) ;
    if( !formName.trim() ) {
      setFormError( "Ingresá un nombre para la categoría." ) ;
      return ;
    }

    if( formColor.trim() && !/^#[0-9A-Fa-f]{6}$/.test( formColor.trim() ) ) {
      setFormError( "El color debe ser un hexadecimal de 6 caracteres (ej: #3498db)." ) ;
      return ;
    }

    setIsActionLoading( true ) ;
    try {
      const res = await createCategoryAction( {
        name:  formName.trim() ,
        type:  formType ,
        icon:  ( formIcon.trim() || undefined ) ,
        color: ( formColor.trim() || undefined ) ,
      } ) ;

      if( !res.success ) {
        setFormError( res.error ) ;
        return ;
      }

      await refreshTree() ;
      setSelectedParentId( res.value.id ) ;
      setIsCreateParentOpen( false ) ;
      setFormName( "" ) ;
      setFormIcon( "" ) ;
      setFormColor( "" ) ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  // Alta de subcategoría
  const handleCreateChild = async () => {
    if( !activeParent ) {
      return ;
    }

    setFormError( "" ) ;
    if( !formName.trim() ) {
      setFormError( "Ingresá un nombre para la subcategoría." ) ;
      return ;
    }

    if( formColor.trim() && !/^#[0-9A-Fa-f]{6}$/.test( formColor.trim() ) ) {
      setFormError( "El color debe ser un hexadecimal de 6 caracteres (ej: #3498db)." ) ;
      return ;
    }

    setIsActionLoading( true ) ;
    try {
      const res = await createCategoryAction( {
        name:     formName.trim() ,
        type:     ( activeParent.type as "expense" | "revenue" ) ,
        parentId: activeParent.id ,
        icon:     ( formIcon.trim() || undefined ) ,
        color:    ( formColor.trim() || undefined ) ,
      } ) ;

      if( !res.success ) {
        setFormError( res.error ) ;
        return ;
      }

      await refreshTree() ;
      setIsCreateChildOpen( false ) ;
      setFormName( "" ) ;
      setFormIcon( "" ) ;
      setFormColor( "" ) ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  // Renombrar categoría (modal)
  const handleUpdateCategory = async () => {
    if( !editCategoryModal ) {
      return ;
    }

    setFormError( "" ) ;
    if( !formName.trim() ) {
      setFormError( "Ingresá un nombre válido." ) ;
      return ;
    }

    setIsActionLoading( true ) ;
    try {
      const res = await updateCategoryAction( {
        id:   editCategoryModal.id ,
        name: formName.trim() ,
      } ) ;

      if( !res.success ) {
        setFormError( res.error ) ;
        return ;
      }

      await refreshTree() ;
      setEditCategoryModal( null ) ;
      setFormName( "" ) ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  // Actualización rápida de ícono y color en la ficha
  const handleApplyVisualChanges = async () => {
    if( !activeParent ) {
      return ;
    }

    setIsActionLoading( true ) ;
    try {
      await updateCategoryAction( {
        id:    activeParent.id ,
        icon:  ( quickIcon.trim() || null ) ,
        color: ( quickColor.trim() || null ) ,
      } ) ;
      setCustomVisuals( null ) ;
      await refreshTree() ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  return(
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <h1 className={styles.pageTitle}>Configuración</h1>
        <p className={styles.pageSubtitle}>
          Administrá las categorías contables de gastos e ingresos de tu organización.
        </p>
      </div>

      <Tabs
        tabs={SETTINGS_TABS}
        activeTab="categories"
        onChange={ () => {} }
      />

      {/* Barra de herramientas superior */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchBox}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Buscar categoría o subcategoría..."
            />
          </div>

          <label className={styles.archivedCheckboxLabel}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={ ( e ) => handleToggleArchived( e.target.checked ) }
              className={styles.archivedCheckbox}
            />
            <span>Ver archivadas</span>
          </label>
        </div>

        <div className={styles.toolbarRight}>
          <Button
            variant="primary"
            onClick={ () => {
              setFormName( "" ) ;
              setFormType( "expense" ) ;
              setFormIcon( "" ) ;
              setFormColor( "" ) ;
              setFormError( "" ) ;
              setIsCreateParentOpen( true ) ;
            } }
          >
            + Nueva categoría principal
          </Button>
        </div>
      </div>

      {/* Disposición en dos columnas */}
      <div className={styles.twoColumnsLayout}>
        {/* Columna Izquierda: Listado de categorías padre */}
        <aside className={styles.leftColumn}>
          {expenseParents.length > 0 && (
            <div className={styles.groupBlock}>
              <h3 className={styles.groupHeading}>Gastos</h3>
              <ul className={styles.parentList}>
                {expenseParents.map( ( parent ) => {
                  const isSelected = ( activeParent?.id === parent.id ) ;
                  const realCount  = parent.children.filter( ( c ) => !c.isSystemLeaf ).length ;
                  return(
                    <li key={parent.id}>
                      <button
                        type="button"
                        className={ `${styles.parentItemBtn} ${isSelected ? styles.parentItemBtnActive : ""}` }
                        onClick={ () => setSelectedParentId( parent.id ) }
                      >
                        <div className={styles.parentItemLeft}>
                          <span className={styles.parentItemIcon}>
                            {iconoDeCategoria( parent.icon )}
                          </span>
                          <span className={styles.parentItemName}>{parent.name}</span>
                          {parent.archivedAt && (
                            <span className={styles.archivedBadge}>Archivada</span>
                          )}
                        </div>
                        <span className={styles.parentItemCount}>
                          {(realCount > 0) ? realCount : "—"}
                        </span>
                      </button>
                    </li>
                  ) ;
                } )}
              </ul>
            </div>
          )}

          {revenueParents.length > 0 && (
            <div className={styles.groupBlock}>
              <h3 className={styles.groupHeading}>Ingresos</h3>
              <ul className={styles.parentList}>
                {revenueParents.map( ( parent ) => {
                  const isSelected = ( activeParent?.id === parent.id ) ;
                  const realCount  = parent.children.filter( ( c ) => !c.isSystemLeaf ).length ;
                  return(
                    <li key={parent.id}>
                      <button
                        type="button"
                        className={ `${styles.parentItemBtn} ${isSelected ? styles.parentItemBtnActive : ""}` }
                        onClick={ () => setSelectedParentId( parent.id ) }
                      >
                        <div className={styles.parentItemLeft}>
                          <span className={styles.parentItemIcon}>
                            {iconoDeCategoria( parent.icon )}
                          </span>
                          <span className={styles.parentItemName}>{parent.name}</span>
                          {parent.archivedAt && (
                            <span className={styles.archivedBadge}>Archivada</span>
                          )}
                        </div>
                        <span className={styles.parentItemCount}>
                          {(realCount > 0) ? realCount : "—"}
                        </span>
                      </button>
                    </li>
                  ) ;
                } )}
              </ul>
            </div>
          )}

          {(expenseParents.length === 0) && (revenueParents.length === 0) && (
            <EmptyState
              title="Sin resultados"
              description="No encontramos categorías que coincidan con tu búsqueda."
            />
          )}
        </aside>

        {/* Columna Derecha: Ficha de la categoría padre seleccionada */}
        <section className={styles.rightColumn}>
          {activeParent ? (
            <>
              {/* Encabezado de la Ficha */}
              <div className={styles.categoryCardHeader}>
                <div className={styles.categoryTitleGroup}>
                  <div
                    className={styles.heroIconBadge}
                    style={{ backgroundColor: `${activeParent.color || "#3498db"}20` }}
                  >
                    {iconoDeCategoria( activeParent.icon )}
                  </div>
                  <div className={styles.heroDetails}>
                    <h2 className={styles.heroName}>{activeParent.name}</h2>
                    <span className={styles.heroTypeBadge}>
                      {(activeParent.type === "expense") ? "Categoría de Gastos" : "Categoría de Ingresos"}
                      {activeParent.archivedAt && " · ARCHIVADA"}
                    </span>
                  </div>
                </div>

                <div className={styles.headerActions}>
                  <Button
                    variant="secondary"
                    onClick={ () => {
                      setEditCategoryModal( activeParent ) ;
                      setFormName( activeParent.name ) ;
                      setFormError( "" ) ;
                    } }
                  >
                    Renombrar
                  </Button>

                  {activeParent.archivedAt ? (
                    <Button
                      variant="secondary"
                      onClick={ () => handleUnarchive( activeParent.id ) }
                      isLoading={isActionLoading}
                    >
                      Desarchivar
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={ () => handleOpenArchiveModal( activeParent.id , activeParent.name , true ) }
                    >
                      Archivar
                    </Button>
                  )}
                </div>
              </div>

              {/* Controles de Ícono y Color a la vista */}
              <div className={styles.customizationRow}>
                <div className={styles.controlField}>
                  <label className={styles.controlLabel}>Ícono visual</label>
                  <div className={styles.iconInputRow}>
                    <FormInput
                      value={quickIcon}
                      onChange={ ( e ) => {
                        if( activeParent ){
                          setCustomVisuals( { parentId: activeParent.id , icon: e.target.value , color: quickColor } ) ;
                        }
                      } }
                      placeholder="Emoji o nombre"
                    />
                  </div>
                </div>

                <div className={styles.controlField}>
                  <label className={styles.controlLabel}>Color distintivo</label>
                  <div className={styles.colorInputRow}>
                    <input
                      type="color"
                      value={quickColor.startsWith("#") ? quickColor : "#3498db"}
                      onChange={ ( e ) => {
                        if( activeParent ){
                          setCustomVisuals( { parentId: activeParent.id , icon: quickIcon , color: e.target.value } ) ;
                        }
                      } }
                      className={styles.colorPickerBox}
                    />
                    <FormInput
                      value={quickColor}
                      onChange={ ( e ) => {
                        if( activeParent ){
                          setCustomVisuals( { parentId: activeParent.id , icon: quickIcon , color: e.target.value } ) ;
                        }
                      } }
                      placeholder="#3498db"
                    />
                    <Button
                      variant="secondary"
                      onClick={handleApplyVisualChanges}
                      isLoading={isActionLoading}
                    >
                      Guardar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Sección de Subcategorías */}
              <div className={styles.subcategoriesSection}>
                <div className={styles.subcategoriesHeader}>
                  <h3 className={styles.subcategoriesTitle}>Subcategorías</h3>
                  <Button
                    variant="secondary"
                    onClick={ () => {
                      setFormName( "" ) ;
                      setFormIcon( "" ) ;
                      setFormColor( "" ) ;
                      setFormError( "" ) ;
                      setIsCreateChildOpen( true ) ;
                    } }
                  >
                    + Agregar subcategoría
                  </Button>
                </div>

                <ul className={styles.subcategoriesList}>
                  {activeParent.children
                    .filter( ( c ) => !c.isSystemLeaf )
                    .map( ( child ) => (
                      <li key={child.id} className={styles.subcatItem}>
                        <div className={styles.subcatLeft}>
                          <span className={styles.subcatIcon}>
                            {iconoDeCategoria( child.icon )}
                          </span>
                          <span className={styles.subcatName}>{child.name}</span>
                          {child.archivedAt && (
                            <span className={styles.archivedBadge}>Archivada</span>
                          )}
                        </div>

                        <div className={styles.subcatActions}>
                          <button
                            type="button"
                            className={styles.actionBtnText}
                            onClick={ () => {
                              setEditCategoryModal( child ) ;
                              setFormName( child.name ) ;
                              setFormError( "" ) ;
                            } }
                          >
                            Renombrar
                          </button>

                          {child.archivedAt ? (
                            <button
                              type="button"
                              className={styles.actionBtnText}
                              onClick={ () => handleUnarchive( child.id ) }
                            >
                              Desarchivar
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={ `${styles.actionBtnText} ${styles.actionBtnDanger}` }
                              onClick={ () => handleOpenArchiveModal( child.id , child.name , false ) }
                            >
                              Archivar
                            </button>
                          )}
                        </div>
                      </li>
                    ) )}

                  {/* Hoja General: Sin detallar al final sin menú de acciones */}
                  {activeParent.children
                    .filter( ( c ) => c.isSystemLeaf )
                    .map( ( leaf ) => (
                      <li key={leaf.id} className={ `${styles.subcatItem} ${styles.subcatItemGeneral}` }>
                        <div className={styles.subcatLeft}>
                          <span className={styles.subcatIcon}>
                            {iconoDeCategoria( leaf.icon )}
                          </span>
                          <span className={styles.subcatName}>Sin detallar</span>
                          <span className={styles.systemLeafTag}>Sistema</span>
                        </div>
                      </li>
                    ) )}
                </ul>
              </div>
            </>
          ) : (
            <EmptyState
              title="Ninguna categoría seleccionada"
              description="Seleccioná una categoría de la columna izquierda para ver y editar sus detalles."
            />
          )}
        </section>
      </div>

      {/* Modal: Nueva categoría principal */}
      <Modal
        isOpen={isCreateParentOpen}
        onClose={ () => setIsCreateParentOpen( false ) }
        title="Nueva Categoría Principal"
        subtitle="Creá una categoría raíz de primer nivel en el árbol contable"
      >
        <form onSubmit={ ( e ) => { e.preventDefault() ; handleCreateParent() ; } }>
          {formError && <FormError error={formError} />}

          <FormInput
            label="Nombre de la categoría"
            value={formName}
            onChange={ ( e ) => setFormName( e.target.value ) }
            placeholder="Ej: Impuestos, Movilidad, Salidas..."
            required
          />

          <FormSelect
            label="Tipo contable"
            value={formType}
            onChange={ ( e ) => setFormType( e.target.value as "expense" | "revenue" ) }
          >
            <option value="expense">Gasto</option>
            <option value="revenue">Ingreso</option>
          </FormSelect>

          <FormInput
            label="Ícono (opcional)"
            value={formIcon}
            onChange={ ( e ) => setFormIcon( e.target.value ) }
            placeholder="Ej: 🚗 o truck"
          />

          <FormInput
            label="Color (hexadecimal opcional)"
            value={formColor}
            onChange={ ( e ) => setFormColor( e.target.value ) }
            placeholder="#e67e22"
          />

          <FormActions
            onCancel={ () => setIsCreateParentOpen( false ) }
            cancelLabel="Cancelar"
            submitLabel="Crear Categoría"
            submitting={isActionLoading}
          />
        </form>
      </Modal>

      {/* Modal: Agregar subcategoría */}
      <Modal
        isOpen={isCreateChildOpen}
        onClose={ () => setIsCreateChildOpen( false ) }
        title={ `Nueva subcategoría en ${activeParent?.name || ""}` }
        subtitle="Creá una subcategoría de segundo nivel vinculada a este padre"
      >
        <form onSubmit={ ( e ) => { e.preventDefault() ; handleCreateChild() ; } }>
          {formError && <FormError error={formError} />}

          <FormInput
            label="Nombre de la subcategoría"
            value={formName}
            onChange={ ( e ) => setFormName( e.target.value ) }
            placeholder="Ej: Combustible, Colectivo, Subte..."
            required
          />

          <FormInput
            label="Ícono (opcional)"
            value={formIcon}
            onChange={ ( e ) => setFormIcon( e.target.value ) }
            placeholder="Ej: ⛽ o fuel"
          />

          <FormInput
            label="Color (hexadecimal opcional)"
            value={formColor}
            onChange={ ( e ) => setFormColor( e.target.value ) }
            placeholder="#f39c12"
          />

          <FormActions
            onCancel={ () => setIsCreateChildOpen( false ) }
            cancelLabel="Cancelar"
            submitLabel="Agregar Subcategoría"
            submitting={isActionLoading}
          />
        </form>
      </Modal>

      {/* Modal: Renombrar categoría */}
      <Modal
        isOpen={Boolean( editCategoryModal )}
        onClose={ () => setEditCategoryModal( null ) }
        title="Renombrar Categoría"
        subtitle="Actualizá el nombre visible de la categoría y sus cuentas contables"
      >
        <form onSubmit={ ( e ) => { e.preventDefault() ; handleUpdateCategory() ; } }>
          {formError && <FormError error={formError} />}

          <FormInput
            label="Nombre"
            value={formName}
            onChange={ ( e ) => setFormName( e.target.value ) }
            required
          />

          <FormActions
            onCancel={ () => setEditCategoryModal( null ) }
            cancelLabel="Cancelar"
            submitLabel="Guardar Cambios"
            submitting={isActionLoading}
          />
        </form>
      </Modal>

      {/* Modal: Confirmación de archivado con conteo de movimientos (Paso 6) */}
      <Modal
        isOpen={Boolean( archiveTargetCat )}
        onClose={ () => setArchiveTargetCat( null ) }
        title={ `Archivar "${archiveTargetCat?.name || ""}"` }
        subtitle="Confirmación de baja lógica con impacto contable"
      >
        <div className={styles.archiveModalContent}>
          <p className={styles.archiveWarning}>
            {archiveTargetCat?.isParent ? (
              <>
                Esta categoría principal dejará de ofrecerse en nuevos registros.
                <strong> Archivar un padre archiva en cascada todas sus subcategorías.</strong>
              </>
            ) : (
              "Esta subcategoría dejará de ofrecerse en los selectores de transacciones."
            )}
          </p>

          <p className={styles.archiveMovementsInfo}>
            {isCheckingCount
              ? "Consultando movimientos contables en el libro mayor..."
              : `Movimientos registrados: ${archiveMovementsCount ?? 0}`}
          </p>

          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              onClick={ () => setArchiveTargetCat( null ) }
              disabled={isActionLoading || isCheckingCount}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmArchive}
              isLoading={isActionLoading || isCheckingCount}
            >
              Confirmar archivado
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  ) ;
}
