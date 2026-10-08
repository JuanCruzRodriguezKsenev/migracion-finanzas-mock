/**
 * @file CategoriesSettingsContainer.tsx
 * Contenedor principal cliente para la administración del árbol de categorías contables (RFC 022).
 * Implementa el diseño de dos columnas (Variante B): listado por tipo contable y ficha de detalle.
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { EmptyState }         from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { SearchInput }        from "@/shared/ui/forms/SearchInput/SearchInput" ;
import { FormActions }        from "@/shared/ui/forms/Form/FormActions" ;
import { FormSelect }         from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }          from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }          from "@/shared/ui/forms/Form/FormError" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { Modal }              from "@/shared/ui/feedback/Modal/Modal" ;
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { usePuedeEscribir }   from "@/shared/providers/PermissionsProvider" ;

// Feature: Accounting
import { getCategoryTreeAction , createCategoryAction , updateCategoryAction , archiveCategoryAction , unarchiveCategoryAction , getCategoryMovementsCountAction } from "../../actions/categoryActions" ;
import { iconoDeCategoria }                                                                                               from "../../utils/categoryIcons" ;
import { Category , CategoryTreeNode }                                                                                    from "../../types" ;
import styles                                                                                                             from "./CategoriesSettingsContainer.module.css" ;


export interface CategoriesSettingsContainerProps {
  initialTree: CategoryTreeNode[] ;
  dict:        Awaited< ReturnType< typeof getDictionary > > ;
}

/**
 * Contenedor orquestador para la gestión y configuración del árbol de categorías.
 */
export function CategoriesSettingsContainer( {
  initialTree ,
  dict ,
}: CategoriesSettingsContainerProps ) {
  const t = dict.settingsPage.categories ;
  const puedeEscribir = usePuedeEscribir() ;
  const [ tree , setTree ]                                 = useState< CategoryTreeNode[] >( initialTree ) ;
  const [ isActionLoading , setIsActionLoading ]           = useState( false ) ;
  const [ actionError , setActionError ]                   = useState< string | null >( null ) ;
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
    setActionError( null ) ;
    setShowArchived( checked ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await getCategoryTreeAction( { includeArchived: checked } ) ;
      if( res.success ) {
        setTree( res.value ) ;
      } else {
        setShowArchived( !checked ) ;
        setActionError( res.error ) ;
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
    } else {
      setActionError( res.error ) ;
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
    setFormError( "" ) ;
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
    setFormError( "" ) ;
    setActionError( null ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await archiveCategoryAction( { id: catId } ) ;
      if( !res.success ) {
        setFormError( res.error ) ;
        return ;
      }

      await refreshTree() ;
      setArchiveTargetCat( null ) ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  const handleUnarchive = async ( id: string ) => {
    setActionError( null ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await unarchiveCategoryAction( { id } ) ;
      if( !res.success ) {
        setActionError( res.error ) ;
        return ;
      }

      await refreshTree() ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  // Alta de categoría principal
  const handleCreateParent = async () => {
    setFormError( "" ) ;
    if( !formName.trim() ) {
      setFormError( t.errorNameRequired ) ;
      return ;
    }

    if( formColor.trim() && !/^#[0-9A-Fa-f]{6}$/.test( formColor.trim() ) ) {
      setFormError( t.errorColorInvalid ) ;
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
      setFormError( t.errorChildNameRequired ) ;
      return ;
    }

    if( formColor.trim() && !/^#[0-9A-Fa-f]{6}$/.test( formColor.trim() ) ) {
      setFormError( t.errorColorInvalid ) ;
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
      setFormError( t.errorNameInvalid ) ;
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

    setActionError( null ) ;
    setIsActionLoading( true ) ;
    try {
      const res = await updateCategoryAction( {
        id:    activeParent.id ,
        icon:  ( quickIcon.trim() || null ) ,
        color: ( quickColor.trim() || null ) ,
      } ) ;

      if( !res.success ) {
        setActionError( res.error ) ;
        return ;
      }

      setCustomVisuals( null ) ;
      await refreshTree() ;
    } finally {
      setIsActionLoading( false ) ;
    }
  } ;

  return(
    <div className={styles.container}>
      {/* Barra de herramientas superior */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchBox}>
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={t.searchPlaceholder}
            />
          </div>

          <label className={styles.archivedCheckboxLabel}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={ ( e ) => handleToggleArchived( e.target.checked ) }
              className={styles.archivedCheckbox}
            />
            <span>{t.showArchived}</span>
          </label>
        </div>

        {puedeEscribir && (
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
              {t.newParent}
            </Button>
          </div>
        )}
      </div>

      {actionError && <FormError error={actionError} />}

      {/* Disposición en dos columnas */}
      <div className={styles.twoColumnsLayout}>
        {/* Columna Izquierda: Listado de categorías padre */}
        <aside className={styles.leftColumn}>
          {expenseParents.length > 0 && (
            <div className={styles.groupBlock}>
              <h3 className={styles.groupHeading}>{t.groupExpense}</h3>
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
                            <span className={styles.archivedBadge}>{t.archivedBadge}</span>
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
              <h3 className={styles.groupHeading}>{t.groupRevenue}</h3>
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
                            <span className={styles.archivedBadge}>{t.archivedBadge}</span>
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
              title={t.emptySearchTitle}
              description={t.emptySearchDescription}
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
                      {(activeParent.type === "expense") ? t.typeBadgeExpense : t.typeBadgeRevenue}
                      {activeParent.archivedAt && ` ${t.archivedSuffix}`}
                    </span>
                  </div>
                </div>

                {puedeEscribir && (
                  <div className={styles.headerActions}>
                    <Button
                      variant="secondary"
                      onClick={ () => {
                        setEditCategoryModal( activeParent ) ;
                        setFormName( activeParent.name ) ;
                        setFormError( "" ) ;
                      } }
                    >
                      {t.rename}
                    </Button>

                    {activeParent.archivedAt ? (
                      <Button
                        variant="secondary"
                        onClick={ () => handleUnarchive( activeParent.id ) }
                        isLoading={isActionLoading}
                      >
                        {t.unarchive}
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={ () => handleOpenArchiveModal( activeParent.id , activeParent.name , true ) }
                      >
                        {t.archive}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Controles de Ícono y Color a la vista */}
              {puedeEscribir && (
                <div className={styles.customizationRow}>
                  <div className={styles.controlField}>
                    <label className={styles.controlLabel}>{t.iconLabel}</label>
                    <div className={styles.iconInputRow}>
                      <FormInput
                        value={quickIcon}
                        onChange={ ( e ) => {
                          if( activeParent ){
                            setCustomVisuals( { parentId: activeParent.id , icon: e.target.value , color: quickColor } ) ;
                          }
                        } }
                        placeholder={t.iconPlaceholder}
                      />
                    </div>
                  </div>

                  <div className={styles.controlField}>
                    <label className={styles.controlLabel}>{t.colorLabel}</label>
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
                        {t.save}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sección de Subcategorías */}
              <div className={styles.subcategoriesSection}>
                <div className={styles.subcategoriesHeader}>
                  <h3 className={styles.subcategoriesTitle}>{t.subcategoriesTitle}</h3>
                  {puedeEscribir && (
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
                      {t.addChild}
                    </Button>
                  )}
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
                            <span className={styles.archivedBadge}>{t.archivedBadge}</span>
                          )}
                        </div>

                        {puedeEscribir && (
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
                              {t.rename}
                            </button>

                            {child.archivedAt ? (
                              <button
                                type="button"
                                className={styles.actionBtnText}
                                onClick={ () => handleUnarchive( child.id ) }
                              >
                                {t.unarchive}
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={ `${styles.actionBtnText} ${styles.actionBtnDanger}` }
                                onClick={ () => handleOpenArchiveModal( child.id , child.name , false ) }
                              >
                                {t.archive}
                              </button>
                            )}
                          </div>
                        )}
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
                          <span className={styles.subcatName}>{t.systemLeafName}</span>
                          <span className={styles.systemLeafTag}>{t.systemLeafTag}</span>
                        </div>
                      </li>
                    ) )}
                </ul>
              </div>
            </>
          ) : (
            <EmptyState
              title={t.emptyDetailTitle}
              description={t.emptyDetailDescription}
            />
          )}
        </section>
      </div>

      {/* Modal: Nueva categoría principal */}
      <Modal
        isOpen={isCreateParentOpen}
        onClose={ () => setIsCreateParentOpen( false ) }
        title={t.createParentTitle}
        subtitle={t.createParentSubtitle}
      >
        <form onSubmit={ ( e ) => { e.preventDefault() ; handleCreateParent() ; } }>
          {formError && <FormError error={formError} />}

          <FormInput
            label={t.nameLabel}
            value={formName}
            onChange={ ( e ) => setFormName( e.target.value ) }
            placeholder={t.namePlaceholder}
            required
          />

          <FormSelect
            label={t.typeLabel}
            value={formType}
            onChange={ ( e ) => setFormType( e.target.value as "expense" | "revenue" ) }
          >
            <option value="expense">{t.optionExpense}</option>
            <option value="revenue">{t.optionRevenue}</option>
          </FormSelect>

          <FormInput
            label={t.iconOptionalLabel}
            value={formIcon}
            onChange={ ( e ) => setFormIcon( e.target.value ) }
            placeholder={t.iconParentPlaceholder}
          />

          <FormInput
            label={t.colorOptionalLabel}
            value={formColor}
            onChange={ ( e ) => setFormColor( e.target.value ) }
            placeholder="#e67e22"
          />

          <FormActions
            onCancel={ () => setIsCreateParentOpen( false ) }
            cancelLabel={t.cancel}
            submitLabel={t.submitCreateParent}
            submitting={isActionLoading}
          />
        </form>
      </Modal>

      {/* Modal: Agregar subcategoría */}
      <Modal
        isOpen={isCreateChildOpen}
        onClose={ () => setIsCreateChildOpen( false ) }
        title={ t.createChildTitle.replace( "{parent}" , (activeParent?.name || "") ) }
        subtitle={t.createChildSubtitle}
      >
        <form onSubmit={ ( e ) => { e.preventDefault() ; handleCreateChild() ; } }>
          {formError && <FormError error={formError} />}

          <FormInput
            label={t.childNameLabel}
            value={formName}
            onChange={ ( e ) => setFormName( e.target.value ) }
            placeholder={t.childNamePlaceholder}
            required
          />

          <FormInput
            label={t.iconOptionalLabel}
            value={formIcon}
            onChange={ ( e ) => setFormIcon( e.target.value ) }
            placeholder={t.iconChildPlaceholder}
          />

          <FormInput
            label={t.colorOptionalLabel}
            value={formColor}
            onChange={ ( e ) => setFormColor( e.target.value ) }
            placeholder="#f39c12"
          />

          <FormActions
            onCancel={ () => setIsCreateChildOpen( false ) }
            cancelLabel={t.cancel}
            submitLabel={t.submitCreateChild}
            submitting={isActionLoading}
          />
        </form>
      </Modal>

      {/* Modal: Renombrar categoría */}
      <Modal
        isOpen={Boolean( editCategoryModal )}
        onClose={ () => setEditCategoryModal( null ) }
        title={t.renameTitle}
        subtitle={t.renameSubtitle}
      >
        <form onSubmit={ ( e ) => { e.preventDefault() ; handleUpdateCategory() ; } }>
          {formError && <FormError error={formError} />}

          <FormInput
            label={t.renameNameLabel}
            value={formName}
            onChange={ ( e ) => setFormName( e.target.value ) }
            required
          />

          <FormActions
            onCancel={ () => setEditCategoryModal( null ) }
            cancelLabel={t.cancel}
            submitLabel={t.submitRename}
            submitting={isActionLoading}
          />
        </form>
      </Modal>

      {/* Modal: Confirmación de archivado con conteo de movimientos (Paso 6) */}
      <Modal
        isOpen={Boolean( archiveTargetCat )}
        onClose={ () => setArchiveTargetCat( null ) }
        title={ t.archiveTitle.replace( "{name}" , (archiveTargetCat?.name || "") ) }
        subtitle={t.archiveSubtitle}
      >
        <div className={styles.archiveModalContent}>
          {formError && <FormError error={formError} />}

          <p className={styles.archiveWarning}>
            {archiveTargetCat?.isParent ? (
              <>
                {t.archiveWarningParent}
                <strong> {t.archiveWarningParentStrong}</strong>
              </>
            ) : (
              t.archiveWarningChild
            )}
          </p>

          <p className={styles.archiveMovementsInfo}>
            {isCheckingCount
              ? t.archiveCounting
              : t.archiveMovements.replace( "{count}" , String( archiveMovementsCount ?? 0 ) )}
          </p>

          <div className={styles.headerActions}>
            <Button
              variant="secondary"
              onClick={ () => setArchiveTargetCat( null ) }
              disabled={isActionLoading || isCheckingCount}
            >
              {t.cancel}
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmArchive}
              isLoading={isActionLoading || isCheckingCount}
            >
              {t.submitArchive}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  ) ;
}
