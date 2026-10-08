/**
 * @file contactsActions.ts
 * Acciones de servidor (Server Actions) para la gestión de Contactos y Métodos de Cobro (RFC 006).
 * Valida sesión activa, resuelve el tenant organizacional e implementa mutaciones protegidas.
 */
"use server" ;

// Librerías externas
import { getServerSession } from "next-auth" ;
import { revalidatePath }   from "next/cache" ;

// Shared
import { ok , fail , Result } from "@/shared/lib/result" ;
import { authOptions }        from "@/shared/lib/auth" ;
import { logger }             from "@/shared/lib/logger" ;

// Feature: Auth
import { obtenerSesionDeEscritura } from "@/features/auth/services/authorizationService" ;

// Feature: Contacts
import {
  contactFormSchema ,
  paymentMethodFormSchema ,
  ContactFormData ,
  PaymentMethodFormInput
} from "../schemas/contacts.schema" ;
import {
  contactsRepository ,
  FindContactsOptions
} from "../repositories/contactsRepository" ;
import {
  Contact ,
  ContactWithPaymentMethods ,
  ContactPaymentMethodWithEntity ,
  ContactPaymentMethod
} from "../types" ;


/**
 * Obtiene el listado de contactos de la organización autenticada.
 *
 * @param options - Opciones de filtrado (búsqueda y archivados).
 * @returns Lista de contactos con sus métodos de cobro.
 */
export async function getContactsAction(
  options: FindContactsOptions = {}
): Promise< Result< ContactWithPaymentMethods[] , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado para consultar los contactos." ) ) ;
  }

  try {
    const contactos = await contactsRepository.findAll( session.user.organizationId , options ) ;
    return( ok( contactos ) ) ;
  } catch( error ) {
    logger.error( "Error en getContactsAction" , { error: String( error ) } ) ;
    return( fail( "Error al consultar los contactos en el servidor." ) ) ;
  }
}

/**
 * Obtiene un contacto específico por su ID validando la organización de la sesión.
 *
 * @param id - ID del contacto.
 * @returns El contacto o error si no existe.
 */
export async function getContactByIdAction(
  id: string
): Promise< Result< ContactWithPaymentMethods , string > > {
  const session = await getServerSession( authOptions ) ;

  if( !session?.user?.organizationId ) {
    return( fail( "No autorizado." ) ) ;
  }

  try {
    const contacto = await contactsRepository.findById( id , session.user.organizationId ) ;
    if( !contacto ) {
      return( fail( "El contacto no fue encontrado o no pertenece a tu organización." ) ) ;
    }
    return( ok( contacto ) ) ;
  } catch( error ) {
    logger.error( "Error en getContactByIdAction" , { error: String( error ) } ) ;
    return( fail( "Error al consultar el contacto." ) ) ;
  }
}

/**
 * Registra un nuevo contacto en la organización del usuario autenticado.
 *
 * @param rawData - Datos del formulario.
 * @returns El contacto recién creado.
 */
export async function createContactAction(
  rawData: ContactFormData
): Promise< Result< Contact , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = contactFormSchema.safeParse( rawData ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[0]?.message || "Datos del contacto inválidos." ) ) ;
  }

  try {
    const nuevo = await contactsRepository.create( {
      organizationId: sesion.value.organizationId ,
      name:           parsed.data.name ,
      email:          parsed.data.email || undefined ,
      phone:          parsed.data.phone || undefined ,
      notes:          parsed.data.notes || undefined ,
    } ) ;

    revalidatePath( "/[lang]/(main)/contacts" , "page" ) ;
    return( ok( nuevo ) ) ;
  } catch( error ) {
    logger.error( "Error en createContactAction" , { error: String( error ) } ) ;
    return( fail( "Error al registrar el contacto." ) ) ;
  }
}

/**
 * Actualiza los datos de un contacto existente.
 *
 * @param id - ID del contacto a modificar.
 * @param rawData - Datos editados.
 * @returns El contacto actualizado.
 */
export async function updateContactAction(
  id:      string ,
  rawData: ContactFormData
): Promise< Result< Contact , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = contactFormSchema.safeParse( rawData ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[0]?.message || "Datos del contacto inválidos." ) ) ;
  }

  try {
    const actualizado = await contactsRepository.update( id , sesion.value.organizationId , {
      name:  parsed.data.name ,
      email: parsed.data.email || undefined ,
      phone: parsed.data.phone || undefined ,
      notes: parsed.data.notes || undefined ,
    } ) ;

    if( !actualizado ) {
      return( fail( "El contacto no existe o no pertenece a tu organización." ) ) ;
    }

    revalidatePath( "/[lang]/(main)/contacts" , "page" ) ;
    return( ok( actualizado ) ) ;
  } catch( error ) {
    logger.error( "Error en updateContactAction" , { error: String( error ) } ) ;
    return( fail( "Error al actualizar el contacto." ) ) ;
  }
}

/**
 * Realiza la baja lógica (archivado) de un contacto.
 *
 * @param id - ID del contacto a archivar.
 * @returns El contacto archivado.
 */
export async function archiveContactAction(
  id: string
): Promise< Result< Contact , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  try {
    const archivado = await contactsRepository.archive( id , sesion.value.organizationId ) ;

    if( !archivado ) {
      return( fail( "El contacto no existe o no pertenece a tu organización." ) ) ;
    }

    revalidatePath( "/[lang]/(main)/contacts" , "page" ) ;
    return( ok( archivado ) ) ;
  } catch( error ) {
    logger.error( "Error en archiveContactAction" , { error: String( error ) } ) ;
    return( fail( "Error al archivar el contacto." ) ) ;
  }
}

/**
 * Restaura un contacto previamente archivado.
 *
 * @param id - ID del contacto a restaurar.
 * @returns El contacto restaurado.
 */
export async function unarchiveContactAction(
  id: string
): Promise< Result< Contact , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  try {
    const restaurado = await contactsRepository.unarchive( id , sesion.value.organizationId ) ;

    if( !restaurado ) {
      return( fail( "El contacto no existe o no pertenece a tu organización." ) ) ;
    }

    revalidatePath( "/[lang]/(main)/contacts" , "page" ) ;
    return( ok( restaurado ) ) ;
  } catch( error ) {
    logger.error( "Error en unarchiveContactAction" , { error: String( error ) } ) ;
    return( fail( "Error al restaurar el contacto." ) ) ;
  }
}

/**
 * Agrega un método de cobro a un contacto validando pertenencia organizacional.
 *
 * @param contactId - ID del contacto destinatario.
 * @param rawData - Datos del método de pago.
 * @returns El método creado con su entidad financiera vinculada.
 */
export async function addPaymentMethodAction(
  contactId: string ,
  rawData:   PaymentMethodFormInput
): Promise< Result< ContactPaymentMethodWithEntity , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  const parsed = paymentMethodFormSchema.safeParse( rawData ) ;
  if( !parsed.success ) {
    return( fail( parsed.error.issues[0]?.message || "Datos del método de cobro inválidos." ) ) ;
  }

  try {
    const creado = await contactsRepository.addPaymentMethod(
      contactId ,
      sesion.value.organizationId ,
      {
        financialEntityId: parsed.data.financialEntityId ,
        type:              parsed.data.type ,
        cbuCvu:            parsed.data.cbuCvu || undefined ,
        alias:             parsed.data.alias || undefined ,
        holderName:        parsed.data.holderName || undefined ,
        holderTaxId:       parsed.data.holderTaxId || undefined ,
        isDefault:         parsed.data.isDefault ,
      }
    ) ;

    if( !creado ) {
      return( fail( "El contacto no existe o no pertenece a tu organización." ) ) ;
    }

    revalidatePath( "/[lang]/(main)/contacts" , "page" ) ;
    return( ok( creado ) ) ;
  } catch( error ) {
    logger.error( "Error en addPaymentMethodAction" , { error: String( error ) } ) ;
    return( fail( "Error al agregar el método de cobro." ) ) ;
  }
}

/**
 * Elimina un método de cobro verificando aislamiento multi-tenant transitivo.
 *
 * @param paymentMethodId - ID del método a eliminar.
 * @returns Resultado exitoso o mensaje de error.
 */
export async function deletePaymentMethodAction(
  paymentMethodId: string
): Promise< Result< boolean , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  try {
    const eliminado = await contactsRepository.deletePaymentMethod(
      paymentMethodId ,
      sesion.value.organizationId
    ) ;

    if( !eliminado ) {
      return( fail( "El método de cobro no existe o pertenece a un contacto ajeno." ) ) ;
    }

    revalidatePath( "/[lang]/(main)/contacts" , "page" ) ;
    return( ok( true ) ) ;
  } catch( error ) {
    logger.error( "Error en deletePaymentMethodAction" , { error: String( error ) } ) ;
    return( fail( "Error al eliminar el método de cobro." ) ) ;
  }
}

/**
 * Establece un método de cobro como predeterminado (default) desmarcando los demás.
 *
 * @param paymentMethodId - ID del método a marcar como default.
 * @returns El método actualizado.
 */
export async function setDefaultPaymentMethodAction(
  paymentMethodId: string
): Promise< Result< ContactPaymentMethod , string > > {
  const sesion = await obtenerSesionDeEscritura() ;

  if( !sesion.success ) {
    return( sesion ) ;
  }

  try {
    const actualizado = await contactsRepository.setDefaultPaymentMethod(
      paymentMethodId ,
      sesion.value.organizationId
    ) ;

    if( !actualizado ) {
      return( fail( "El método de cobro no existe o pertenece a un contacto ajeno." ) ) ;
    }

    revalidatePath( "/[lang]/(main)/contacts" , "page" ) ;
    return( ok( actualizado ) ) ;
  } catch( error ) {
    logger.error( "Error en setDefaultPaymentMethodAction" , { error: String( error ) } ) ;
    return( fail( "Error al establecer el método de cobro por defecto." ) ) ;
  }
}
