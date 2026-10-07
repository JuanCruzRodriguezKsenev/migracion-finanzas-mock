/**
 * @file OrganizationPanel.tsx
 * Pestaña Organización de Configuración (sólo `owner`): renombrar y zona de peligro con la eliminación
 * confirmada por nombre exacto (RN-30, RN-33, RN-34, RN-35, AC-29, AC-30).
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;
import { useSession }       from "next-auth/react" ;
import { useRouter }        from "next/navigation" ;

// Shared
import { FormInput } from "@/shared/ui/forms/Form/FormInput" ;
import { FormError } from "@/shared/ui/forms/Form/FormError" ;
import { Button }    from "@/shared/ui/display/Button/Button" ;

// Feature: Organizations
import { renombrarOrganizacionAction , eliminarOrganizacionAction } from "../actions/organizationActions" ;
import { guardarAvisoOrganizacion }                                  from "./avisoOrganizacion" ;
import styles                                                        from "./OrganizationPanel.module.css" ;


export interface OrganizationPanelProps {
  /** Nombre vigente de la organización activa. */
  nombre:                 string ;
  /** Cantidad de organizaciones de la persona: con una sola no puede eliminarla (RN-30). */
  cantidadOrganizaciones: number ;
  dict: {
    title:                  string ;
    subtitle:               string ;
    renameLabel:            string ;
    renameSubmit:           string ;
    renameSuccess:          string ;
    dangerZoneTitle:        string ;
    dangerZoneBody:         string ;
    dangerZoneConfirmLabel: string ;
    dangerZoneSubmit:       string ;
    dangerZoneOnlyOrg:      string ;
    deleteNotice:           string ;
    genericError:           string ;
  } ;
}

/**
 * Panel de la organización activa: nombre editable y eliminación irreversible.
 */
export function OrganizationPanel( { nombre , cantidadOrganizaciones , dict }: OrganizationPanelProps ) {
  const { update }                         = useSession() ;
  const router                             = useRouter() ;
  const [ nuevoNombre , setNuevoNombre ]   = useState( nombre ) ;
  const [ guardando , setGuardando ]       = useState( false ) ;
  const [ errorNombre , setErrorNombre ]   = useState( "" ) ;
  const [ aviso , setAviso ]               = useState( "" ) ;

  const [ confirmacion , setConfirmacion ] = useState( "" ) ;
  const [ eliminando , setEliminando ]     = useState( false ) ;
  const [ errorEliminar , setErrorEliminar ] = useState( "" ) ;

  const unicaOrganizacion = ( cantidadOrganizaciones <= 1 ) ;
  // Comparación exacta y sin recortar, igual que el servidor (RN-35).
  const coincide          = ( confirmacion === nombre ) ;
  const puedeEliminar     = ( coincide && !unicaOrganizacion && !eliminando ) ;

  const handleRenombrar = async ( e: React.FormEvent ) => {
    e.preventDefault() ;
    if( guardando ) { return ; }

    setErrorNombre( "" ) ;
    setAviso( "" ) ;
    setGuardando( true ) ;

    try {
      const res = await renombrarOrganizacionAction( { nombre: nuevoNombre } ) ;

      if( !res.success ) {
        setErrorNombre( res.error || dict.genericError ) ;
        return ;
      }

      setNuevoNombre( res.value.nombre ) ;
      setAviso( dict.renameSuccess ) ;
      router.refresh() ;
    } catch {
      setErrorNombre( dict.genericError ) ;
    } finally {
      setGuardando( false ) ;
    }
  } ;

  const handleEliminar = async ( e: React.FormEvent ) => {
    e.preventDefault() ;
    if( !puedeEliminar ) { return ; }

    setErrorEliminar( "" ) ;
    setEliminando( true ) ;

    try {
      const res = await eliminarOrganizacionAction( { confirmacion } ) ;

      if( !res.success ) {
        setErrorEliminar( res.error || dict.genericError ) ;
        return ;
      }

      // El selector, que vive en el layout, lee este aviso cuando cambia la organización activa.
      guardarAvisoOrganizacion( dict.deleteNotice.replace( "{nombre}" , res.value.nombreAnterior ) ) ;
      await update( { organizationId: res.value.organizationId } ) ;
      router.refresh() ;
    } catch {
      setErrorEliminar( dict.genericError ) ;
    } finally {
      setEliminando( false ) ;
    }
  } ;

  return(
    <section className={styles.panel}>
      <div>
        <h2 className={styles.title}>{dict.title}</h2>
        <p className={styles.subtitle}>{dict.subtitle}</p>
      </div>

      <form className={styles.form} onSubmit={handleRenombrar}>
        <FormError error={errorNombre} />
        {aviso && <p className={styles.notice} role="status">{aviso}</p>}

        <FormInput
          label={dict.renameLabel}
          value={nuevoNombre}
          onChange={ ( e ) => setNuevoNombre( e.target.value ) }
          maxLength={100}
          readOnly={guardando}
          required
        />

        <div className={styles.actions}>
          <Button type="submit" variant="primary" isLoading={guardando}>{dict.renameSubmit}</Button>
        </div>
      </form>

      <form className={styles.danger} onSubmit={handleEliminar}>
        <h3 className={styles.dangerTitle}>{dict.dangerZoneTitle}</h3>
        <p className={styles.dangerBody}>{dict.dangerZoneBody}</p>
        <FormError error={errorEliminar} />

        <FormInput
          label={dict.dangerZoneConfirmLabel.replace( "{nombre}" , nombre )}
          value={confirmacion}
          onChange={ ( e ) => setConfirmacion( e.target.value ) }
          readOnly={eliminando}
          disabled={unicaOrganizacion}
          aria-describedby={unicaOrganizacion ? "organizacion-eliminar-motivo" : undefined}
          autoComplete="off"
        />

        {unicaOrganizacion && <p id="organizacion-eliminar-motivo" className={styles.hint}>{dict.dangerZoneOnlyOrg}</p>}

        <div className={styles.actions}>
          <Button
            type="submit"
            variant="danger"
            isLoading={eliminando}
            disabled={!puedeEliminar}
            aria-describedby={unicaOrganizacion ? "organizacion-eliminar-motivo" : undefined}
          >
            {dict.dangerZoneSubmit}
          </Button>
        </div>
      </form>
    </section>
  ) ;
}
