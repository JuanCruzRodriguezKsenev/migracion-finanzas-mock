/**
 * @file categoryActions.ts
 * Server Actions para la gestión del árbol de Categorías Contables (RFC 022).
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Accounting
import {
  createCategorySchema ,
  updateCategorySchema ,
  archiveCategorySchema ,
  unarchiveCategorySchema ,
  CreateCategoryInput ,
  UpdateCategoryInput ,
  ArchiveCategoryInput ,
  UnarchiveCategoryInput
} from "../schemas/category.schema" ;
import { categoryRepository , CategoryTreeNode } from "../repositories/categoryRepository" ;
import { ledgerRepository }                       from "../repositories/ledgerRepository" ;
import { getNextCategoryCode }                   from "../utils/categoryCodes" ;
import { Category }                              from "../types" ;


/**
 * Crea una nueva categoría contable (padre o subcategoría) para la organización autenticada.
 * Si nace bajo un padre que ya tenía movimientos imputados, dispara la mudanza R3 hacia la hoja General.
 *
 * @param rawInput - Datos de entrada para la creación.
 * @returns Result con la categoría creada o mensaje de error.
 */
export async function createCategoryAction(
  rawInput: CreateCategoryInput
): Promise< Result< Category , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para crear categorías.") ) ;
  }

  const organizationId = session.user.organizationId ;
  const validation     = createCategorySchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos de categoría inválidos." ;
    return( fail(errorMsg) ) ;
  }

  const data = validation.data ;

  try {
    let accountCode: string ;

    if( data.parentId ) {
      const parent = await categoryRepository.findById( data.parentId , organizationId ) ;
      if( !parent ) {
        return( fail("La categoría padre no existe o no pertenece a tu organización.") ) ;
      }

      if( parent.parentId ) {
        return( fail("No se permite anidar más de dos niveles de categorías.") ) ;
      }

      if( parent.type !== data.type ) {
        return( fail("La subcategoría debe pertenecer al mismo tipo contable que su categoría padre.") ) ;
      }

      const existingChildren = await categoryRepository.findChildren( parent.id , organizationId ) ;
      const realChildren     = existingChildren.filter( ( c ) => !c.isSystemLeaf ) ;

      // Regla R3: Si el padre tenía movimientos directos y recibe su primera subcategoría, se mudan a General
      if( realChildren.length === 0 ) {
        await categoryRepository.moveMovementsToGeneralLeaf( parent.id , organizationId ) ;
      }

      accountCode = getNextCategoryCode( {
        type:       data.type ,
        parentCode: parent.accountCode ,
        siblings:   existingChildren ,
      } ) ;
    } else {
      const all = await categoryRepository.findAll( organizationId ) ;
      const rootSiblings = all.filter( ( c ) => (!c.parentId) && (c.type === data.type) ) ;

      accountCode = getNextCategoryCode( {
        type:       data.type ,
        parentCode: null ,
        siblings:   rootSiblings ,
      } ) ;
    }

    const newCategory = await categoryRepository.create( {
      organizationId ,
      name:         data.name ,
      type:         data.type ,
      accountCode ,
      parentId:     data.parentId || null ,
      icon:         data.icon || null ,
      color:        data.color || null ,
      isSystemLeaf: false ,
    } ) ;

    // Crea cuenta en ARS y vincula en category_accounts por defecto
    await categoryRepository.findOrCreateAccountForCurrency( newCategory.id , "ARS" ) ;

    return( ok(newCategory) ) ;
  } catch( error ) {
    logger.error( "Error en createCategoryAction:" , {error: String(error)} ) ;
    return( fail(error instanceof Error ? error.message : "Error al crear la categoría.") ) ;
  }
}

/**
 * Actualiza el nombre, ícono o color de una categoría existente.
 * Nota: El tipo contable y el código contable son inmutables.
 *
 * @param rawInput - Datos de actualización.
 * @returns Result con la categoría actualizada o mensaje de error.
 */
export async function updateCategoryAction(
  rawInput: UpdateCategoryInput
): Promise< Result< Category , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para modificar categorías.") ) ;
  }

  const organizationId = session.user.organizationId ;
  const validation     = updateCategorySchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    const errorMsg = validation.error.issues[0]?.message || "Datos de categoría inválidos." ;
    return( fail(errorMsg) ) ;
  }

  const { id , ...updateData } = validation.data ;

  try {
    const updated = await categoryRepository.update( id , organizationId , updateData ) ;

    if( !updated ) {
      return( fail("Categoría no encontrada.") ) ;
    }

    return( ok(updated) ) ;
  } catch( error ) {
    logger.error( "Error en updateCategoryAction:" , {error: String(error)} ) ;
    return( fail("Error al actualizar la categoría.") ) ;
  }
}

/**
 * Archiva lógicamente una categoría contable y en cascada a sus subcategorías.
 *
 * @param rawInput - Objeto con el ID de la categoría.
 * @returns Result con la categoría archivada o mensaje de error.
 */
export async function archiveCategoryAction(
  rawInput: ArchiveCategoryInput
): Promise< Result< Category , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para archivar categorías.") ) ;
  }

  const organizationId = session.user.organizationId ;
  const validation     = archiveCategorySchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail("ID de categoría inválido.") ) ;
  }

  try {
    const archived = await categoryRepository.archive( validation.data.id , organizationId ) ;

    if( !archived ) {
      return( fail("Categoría no encontrada.") ) ;
    }

    return( ok(archived) ) ;
  } catch( error ) {
    logger.error( "Error en archiveCategoryAction:" , {error: String(error)} ) ;
    return( fail("Error al archivar la categoría.") ) ;
  }
}

/**
 * Desarchiva una categoría contable para habilitarla nuevamente en los selectores.
 *
 * @param rawInput - Objeto con el ID de la categoría.
 * @returns Result con la categoría desarchivada o mensaje de error.
 */
export async function unarchiveCategoryAction(
  rawInput: UnarchiveCategoryInput
): Promise< Result< Category , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para desarchivar categorías.") ) ;
  }

  const organizationId = session.user.organizationId ;
  const validation     = unarchiveCategorySchema.safeParse( rawInput ) ;

  if( !validation.success ) {
    return( fail("ID de categoría inválido.") ) ;
  }

  try {
    const unarchived = await categoryRepository.unarchive( validation.data.id , organizationId ) ;

    if( !unarchived ) {
      return( fail("Categoría no encontrada.") ) ;
    }

    return( ok(unarchived) ) ;
  } catch( error ) {
    logger.error( "Error en unarchiveCategoryAction:" , {error: String(error)} ) ;
    return( fail("Error al desarchivar la categoría.") ) ;
  }
}

/**
 * Obtiene el árbol estructurado de categorías para la organización autenticada.
 *
 * @param options - Opciones adicionales (ej: incluir archivadas).
 * @returns Result con el árbol de categorías.
 */
export async function getCategoryTreeAction(
  options?: { includeArchived?: boolean }
): Promise< Result< CategoryTreeNode[] , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para consultar las categorías.") ) ;
  }

  try {
    const tree = await categoryRepository.findTree( session.user.organizationId , options?.includeArchived ?? false ) ;

    return( ok(tree) ) ;
  } catch( error ) {
    logger.error( "Error en getCategoryTreeAction:" , {error: String(error)} ) ;
    return( fail("Error al consultar el árbol de categorías.") ) ;
  }
}

/**
 * Obtiene la cantidad de movimientos contables imputados a una categoría y a sus subcategorías.
 * Informa el impacto real antes de archivar (Paso 6).
 *
 * @param categoryId - ID de la categoría a consultar.
 * @returns Result con la cantidad de movimientos.
 */
export async function getCategoryMovementsCountAction(
  categoryId: string
): Promise< Result< number , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail("No autorizado para consultar movimientos de categorías.") ) ;
  }

  const organizationId = session.user.organizationId ;

  try {
    const category = await categoryRepository.findById( categoryId , organizationId ) ;
    if( !category ) {
      return( fail("Categoría no encontrada.") ) ;
    }

    const children = await categoryRepository.findChildren( categoryId , organizationId ) ;
    const allIds   = [ categoryId , ...children.map( ( c ) => c.id ) ] ;

    const count = await ledgerRepository.countByCategories( allIds , organizationId ) ;
    return( ok(count) ) ;
  } catch( error ) {
    logger.error( "Error en getCategoryMovementsCountAction:" , {error: String(error)} ) ;
    return( fail("Error al consultar los movimientos de la categoría.") ) ;
  }
}

