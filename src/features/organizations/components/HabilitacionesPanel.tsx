/**
 * @file HabilitacionesPanel.tsx
 * Pestaña Habilitaciones de Configuración: a quiénes la persona deja cargar movimientos a su nombre
 * y a nombre de quiénes puede cargar ella (RN-5, RN-6).
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { ToggleSwitch } from "@/shared/ui/forms/ToggleSwitch/ToggleSwitch" ;
import { FormError }    from "@/shared/ui/forms/Form/FormError" ;

// Feature: Organizations
import {
  listarHabilitacionesAction ,
  otorgarHabilitacionAction ,
  revocarHabilitacionAction ,
  type HabilitacionesListadas
} from "../actions/habilitacionesActions" ;
import styles from "./HabilitacionesPanel.module.css" ;


export interface HabilitacionesPanelProps {
  initialData: HabilitacionesListadas ;
  dict: {
    title:           string ;
    subtitle:        string ;
    toggleLabel:     string ;
    emptyCandidates: string ;
    receivedTitle:   string ;
    receivedEmpty:   string ;
    saveError:       string ;
    loadError:       string ;
  } ;
}

/**
 * Panel de habilitaciones de la persona en la organización activa.
 * Cada interruptor otorga o revoca; mientras guarda queda deshabilitado y, si falla, vuelve a su valor real.
 */
export function HabilitacionesPanel( { initialData , dict }: HabilitacionesPanelProps ) {
  const [ data , setData ]           = useState< HabilitacionesListadas >( initialData ) ;
  const [ guardando , setGuardando ] = useState< string | null >( null ) ;
  const [ pedido , setPedido ]       = useState< Record< string , boolean > >( {} ) ;
  const [ error , setError ]         = useState( "" ) ;

  const otorgadas = new Set( data.otorgadas.map( ( u ) => u.userId ) ) ;

  const handleCambiar = async ( userId: string , habilitar: boolean ) => {
    if( guardando ) { return ; }

    setError( "" ) ;
    setGuardando( userId ) ;
    setPedido( ( previos ) => ( { ...previos , [userId]: habilitar } ) ) ;

    try {
      const res = habilitar
        ? await otorgarHabilitacionAction( { habilitadoUserId: userId } )
        : await revocarHabilitacionAction( { habilitadoUserId: userId } ) ;

      if( !res.success ) {
        setError( res.error || dict.saveError ) ;
        return ;
      }

      const lista = await listarHabilitacionesAction() ;

      if( lista.success ) {
        setData( lista.value ) ;
      } else {
        setError( dict.loadError ) ;
      }
    } catch {
      setError( dict.saveError ) ;
    } finally {
      // El valor pedido se descarta: el interruptor vuelve a mostrar el estado real de la base.
      setPedido( ( previos ) => {
        const resto = { ...previos } ;
        delete resto[userId] ;
        return( resto ) ;
      } ) ;
      setGuardando( null ) ;
    }
  } ;

  return(
    <section className={styles.panel}>
      <div>
        <h2 className={styles.title}>{dict.title}</h2>
        <p className={styles.subtitle}>{dict.subtitle}</p>
      </div>

      <FormError error={error} />

      {(data.candidatos.length === 0) ? (
        <p className={styles.empty}>{dict.emptyCandidates}</p>
      ) : (
        <ul className={styles.list}>
          {data.candidatos.map( ( c ) => {
            const id = `habilitacion-${c.userId}` ;
            return(
              <li key={c.userId} className={styles.row}>
                <label htmlFor={id} className={styles.rowLabel}>
                  {dict.toggleLabel.replace( "{nombre}" , c.nombre )}
                </label>
                <ToggleSwitch
                  id={id}
                  checked={pedido[c.userId] ?? otorgadas.has( c.userId )}
                  disabled={!!guardando}
                  onChange={ ( valor ) => handleCambiar( c.userId , valor ) }
                />
              </li>
            ) ;
          } )}
        </ul>
      )}

      <div className={styles.received}>
        <h3 className={styles.receivedTitle}>{dict.receivedTitle}</h3>
        {(data.recibidas.length === 0) ? (
          <p className={styles.empty}>{dict.receivedEmpty}</p>
        ) : (
          <ul className={styles.list}>
            {data.recibidas.map( ( r ) => (
              <li key={r.userId} className={styles.row}>
                <span className={styles.receivedName}>{r.nombre}</span>
              </li>
            ) )}
          </ul>
        )}
      </div>
    </section>
  ) ;
}
