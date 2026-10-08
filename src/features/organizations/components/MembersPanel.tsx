/**
 * @file MembersPanel.tsx
 * Pestaña Miembros de Configuración: lista de miembros con su rol, invitaciones pendientes,
 * alta de invitaciones y quita de miembros con confirmación (RN-9 a RN-13, AC-10, AC-11).
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;
import { useRouter }        from "next/navigation" ;

// Shared
import { FormActions } from "@/shared/ui/forms/Form/FormActions" ;
import { FormSelect }  from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }   from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }   from "@/shared/ui/forms/Form/FormError" ;
import { Button }      from "@/shared/ui/display/Button/Button" ;
import { Modal }       from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Organizations
import {
  listarMiembrosAction ,
  invitarMiembroAction ,
  revocarInvitacionAction ,
  quitarMiembroAction ,
  cambiarRolAction ,
  type ListadoMiembros ,
  type MiembroListado
} from "../actions/membersActions" ;
import styles from "./MembersPanel.module.css" ;


export interface MembersPanelProps {
  initialData:       ListadoMiembros ;
  currentUserId:     string ;
  lang:              string ;
  /** Espacio Personal: sólo se invita (y se deja) como visualizador (RN-4). */
  soloVisualizador?: boolean ;
  dict: {
    title:                   string ;
    subtitle:                string ;
    inviteButton:            string ;
    roleOwner:               string ;
    roleMember:              string ;
    roleViewer:              string ;
    you:                     string ;
    remove:                  string ;
    removeDisabledOnlyOwner: string ;
    roleSelectLabel:         string ;
    roleDisabledOnlyOwner:   string ;
    pendingTitle:            string ;
    expiresOn:               string ;
    revoke:                  string ;
    inviteTitle:             string ;
    inviteSubtitle:          string ;
    emailLabel:              string ;
    emailPlaceholder:        string ;
    roleLabel:               string ;
    inviteSubmit:            string ;
    cancel:                  string ;
    inviteSuccess:           string ;
    removeConfirmTitle:      string ;
    removeConfirmBody:       string ;
    removeConfirmSubmit:     string ;
    loadError:               string ;
    genericError:            string ;
    /** Aviso del espacio Personal; sin él, no se muestra. */
    personalOnlyViewer?:     string ;
  } ;
}

type RolInvitable = "owner" | "member" | "viewer" ;

/**
 * Panel de gestión de miembros e invitaciones de la organización activa.
 */
export function MembersPanel( { initialData , currentUserId , lang , dict , soloVisualizador = false }: MembersPanelProps ) {
  const router                                  = useRouter() ;
  const [ data , setData ]                      = useState< ListadoMiembros >( initialData ) ;
  const [ cargando , setCargando ]              = useState( false ) ;
  const [ error , setError ]                    = useState( "" ) ;
  const [ aviso , setAviso ]                    = useState( "" ) ;

  const [ invitando , setInvitando ]            = useState( false ) ;
  const [ emailInvitado , setEmailInvitado ]    = useState( "" ) ;
  const [ rolInvitado , setRolInvitado ]        = useState< RolInvitable >( soloVisualizador ? "viewer" : "member" ) ;
  const [ errorInvitar , setErrorInvitar ]      = useState( "" ) ;

  const [ rolesPendientes , setRolesPendientes ] = useState< Record< string , RolInvitable > >( {} ) ;
  const [ cambiandoRol , setCambiandoRol ]      = useState( false ) ;

  const [ aQuitar , setAQuitar ]                = useState< MiembroListado | null >( null ) ;
  const [ errorQuitar , setErrorQuitar ]        = useState( "" ) ;

  const etiquetasRol: Record< string , string > = {
    owner:  dict.roleOwner ,
    member: dict.roleMember ,
    viewer: dict.roleViewer ,
  } ;

  const locale          = ( lang === "en" ) ? "en-US" : ( (lang === "br") ? "pt-BR" : "es-AR" ) ;
  const formatearFecha  = ( iso: string ) => new Intl.DateTimeFormat( locale , { dateStyle: "medium" } ).format( new Date( iso ) ) ;
  const cantidadOwners  = data.miembros.filter( ( m ) => m.rol === "owner" ).length ;

  const recargar = async () => {
    const res = await listarMiembrosAction() ;

    if( res.success ) {
      setData( res.value ) ;
    } else {
      setError( dict.loadError ) ;
    }
  } ;

  const abrirInvitar = () => {
    setEmailInvitado( "" ) ;
    setRolInvitado( soloVisualizador ? "viewer" : "member" ) ;
    setErrorInvitar( "" ) ;
    setInvitando( true ) ;
  } ;

  const handleInvitar = async ( e: React.FormEvent ) => {
    e.preventDefault() ;
    if( cargando ) { return ; }

    setErrorInvitar( "" ) ;
    setCargando( true ) ;

    try {
      const res = await invitarMiembroAction( { email: emailInvitado , rol: rolInvitado } ) ;

      if( !res.success ) {
        setErrorInvitar( res.error || dict.genericError ) ;
        return ;
      }

      setAviso( dict.inviteSuccess.replace( "{email}" , emailInvitado.trim() ) ) ;
      setInvitando( false ) ;
      await recargar() ;
    } catch {
      setErrorInvitar( dict.genericError ) ;
    } finally {
      setCargando( false ) ;
    }
  } ;

  const handleRevocar = async ( id: string ) => {
    setError( "" ) ;
    setAviso( "" ) ;
    setCargando( true ) ;

    try {
      const res = await revocarInvitacionAction( id ) ;

      if( !res.success ) {
        setError( res.error || dict.genericError ) ;
      }

      await recargar() ;
    } catch {
      setError( dict.genericError ) ;
    } finally {
      setCargando( false ) ;
    }
  } ;

  /**
   * Cambia el rol de un miembro. El desplegable muestra el valor pedido mientras guarda; si el servidor
   * lo rechaza se descarta y vuelve al valor real, con el error a la vista.
   */
  const handleCambiarRol = async ( miembro: MiembroListado , rol: RolInvitable ) => {
    if( cambiandoRol || cargando || (rol === miembro.rol) ) { return ; }

    setError( "" ) ;
    setAviso( "" ) ;
    setRolesPendientes( ( previos ) => ( { ...previos , [miembro.userId]: rol } ) ) ;
    setCambiandoRol( true ) ;

    try {
      const res = await cambiarRolAction( { userId: miembro.userId , rol } ) ;

      if( !res.success ) {
        setError( res.error || dict.genericError ) ;
        return ;
      }

      // Quien se quita el rol de `owner` ya no puede listar: se refresca la página en vez de pedir la lista.
      if( (miembro.userId === currentUserId) && (rol !== "owner") ) {
        router.refresh() ;
      } else {
        await recargar() ;
      }
    } catch {
      setError( dict.genericError ) ;
    } finally {
      setRolesPendientes( ( previos ) => {
        const resto = { ...previos } ;
        delete resto[miembro.userId] ;
        return( resto ) ;
      } ) ;
      setCambiandoRol( false ) ;
    }
  } ;

  const handleQuitar = async () => {
    if( !aQuitar || cargando ) { return ; }

    setErrorQuitar( "" ) ;
    setCargando( true ) ;

    try {
      const res = await quitarMiembroAction( aQuitar.userId ) ;

      if( !res.success ) {
        setErrorQuitar( res.error || dict.genericError ) ;
        return ;
      }

      const eraYo = ( aQuitar.userId === currentUserId ) ;
      setAQuitar( null ) ;
      setAviso( "" ) ;

      // Quien se quita a sí mismo ya no puede listar: se refresca la página en vez de pedir la lista.
      if( eraYo ) {
        router.refresh() ;
      } else {
        await recargar() ;
      }
    } catch {
      setErrorQuitar( dict.genericError ) ;
    } finally {
      setCargando( false ) ;
    }
  } ;

  return(
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{dict.title}</h2>
          <p className={styles.subtitle}>{dict.subtitle}</p>
        </div>
        <Button variant="primary" onClick={abrirInvitar}>{dict.inviteButton}</Button>
      </div>

      <FormError error={error} />
      {aviso && <p className={styles.notice} role="status">{aviso}</p>}

      <ul className={styles.list}>
        {data.miembros.map( ( m ) => {
          const unicoOwner = ( (m.rol === "owner") && (cantidadOwners === 1) ) ;
          const hintId     = `miembro-${m.userId}-hint` ;
          const rolHintId  = `miembro-${m.userId}-rol-hint` ;
          return(
            <li key={m.userId} className={styles.row}>
              <div className={styles.person}>
                <span className={styles.personName}>
                  {m.nombre || m.email}
                  {(m.userId === currentUserId) && <span className={styles.you}> {dict.you}</span>}
                </span>
                {m.nombre && <span className={styles.personEmail}>{m.email}</span>}
                {unicoOwner && <span id={hintId} className={styles.hint}>{dict.removeDisabledOnlyOwner}</span>}
                {unicoOwner && <span id={rolHintId} className={styles.hint}>{dict.roleDisabledOnlyOwner}</span>}
              </div>

              <div className={styles.roleCell}>
                <FormSelect
                  aria-label={dict.roleSelectLabel.replace( "{nombre}" , m.nombre || m.email )}
                  aria-describedby={unicoOwner ? rolHintId : undefined}
                  value={rolesPendientes[m.userId] ?? m.rol}
                  disabled={unicoOwner || cambiandoRol || cargando}
                  onChange={ ( e ) => handleCambiarRol( m , e.target.value as RolInvitable ) }
                >
                  {( !soloVisualizador || (m.rol === "owner") ) && <option value="owner">{dict.roleOwner}</option>}
                  {( !soloVisualizador || (m.rol === "member") ) && <option value="member">{dict.roleMember}</option>}
                  <option value="viewer">{dict.roleViewer}</option>
                </FormSelect>
              </div>

              <Button
                variant="outline"
                disabled={unicoOwner || cargando}
                aria-describedby={unicoOwner ? hintId : undefined}
                onClick={ () => { setErrorQuitar( "" ) ; setAQuitar( m ) ; } }
              >
                {dict.remove}
              </Button>
            </li>
          ) ;
        } )}
      </ul>

      {(data.invitaciones.length > 0) && (
        <div className={styles.pending}>
          <h3 className={styles.pendingTitle}>{dict.pendingTitle}</h3>
          <ul className={styles.list}>
            {data.invitaciones.map( ( inv ) => (
              <li key={inv.id} className={styles.row}>
                <div className={styles.person}>
                  <span className={styles.personName}>{inv.email}</span>
                  <span className={styles.personEmail}>{dict.expiresOn.replace( "{fecha}" , formatearFecha( inv.venceEl ) )}</span>
                </div>

                <span className={styles.role}>{etiquetasRol[inv.rol] ?? inv.rol}</span>

                <Button variant="outline" disabled={cargando} onClick={ () => handleRevocar( inv.id ) }>
                  {dict.revoke}
                </Button>
              </li>
            ) )}
          </ul>
        </div>
      )}

      {/* Modal: invitar */}
      <Modal
        isOpen={invitando}
        onClose={ () => { if( !cargando ) { setInvitando( false ) ; } } }
        title={dict.inviteTitle}
        subtitle={dict.inviteSubtitle}
      >
        <form onSubmit={handleInvitar}>
          <FormError error={errorInvitar} />

          <FormInput
            label={dict.emailLabel}
            type="email"
            value={emailInvitado}
            onChange={ ( e ) => setEmailInvitado( e.target.value ) }
            placeholder={dict.emailPlaceholder}
            required
          />

            <FormSelect
              label={dict.roleLabel}
              value={rolInvitado}
              onChange={ ( e ) => setRolInvitado( e.target.value as RolInvitable ) }
            >
              {!soloVisualizador && <option value="member">{dict.roleMember}</option>}
              <option value="viewer">{dict.roleViewer}</option>
              {!soloVisualizador && <option value="owner">{dict.roleOwner}</option>}
            </FormSelect>

            {soloVisualizador && dict.personalOnlyViewer && <p className={styles.hint}>{dict.personalOnlyViewer}</p>}

          <FormActions
            onCancel={ () => setInvitando( false ) }
            cancelLabel={dict.cancel}
            submitLabel={dict.inviteSubmit}
            submitting={cargando}
          />
        </form>
      </Modal>

      {/* Modal: confirmar quita */}
      <Modal
        isOpen={!!aQuitar}
        onClose={ () => { if( !cargando ) { setAQuitar( null ) ; } } }
        title={dict.removeConfirmTitle.replace( "{nombre}" , aQuitar ? (aQuitar.nombre || aQuitar.email) : "" )}
        subtitle={dict.removeConfirmBody}
      >
        <FormError error={errorQuitar} />
        <div className={styles.confirmActions}>
          <Button variant="secondary" disabled={cargando} onClick={ () => setAQuitar( null ) }>{dict.cancel}</Button>
          <Button variant="danger" isLoading={cargando} onClick={handleQuitar}>{dict.removeConfirmSubmit}</Button>
        </div>
      </Modal>
    </section>
  ) ;
}
