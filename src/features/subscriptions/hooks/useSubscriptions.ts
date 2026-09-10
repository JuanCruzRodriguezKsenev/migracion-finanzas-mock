/**
 * @file useSubscriptions.ts
 * Hook cliente para gestionar el estado de las suscripciones del dashboard.
 * Aplica actualizaciones optimistas contra las Server Actions con rollback
 * automático si la operación falla en el servidor.
 */
"use client" ;

// Librerías externas
import { useState , useCallback , useMemo } from "react" ;

// Feature: Subscriptions
import { createSubscriptionAction , updateSubscriptionAction , deleteSubscriptionAction } from "../actions/subscriptionsActions" ;
import { Subscription , SubscriptionFormData }                                            from "../types" ;
import { buildSummary }                                                                   from "../utils/calculations" ;


/**
 * Gestiona el listado de suscripciones con mutaciones optimistas.
 *
 * @param initialData - Suscripciones cargadas en el servidor (fuente de verdad inicial).
 * @returns Estado, resumen agregado y mutadores (add/update/remove) con rollback.
 */
export function useSubscriptions( initialData: Subscription[] ) {
  const [ items , setItems ] = useState< Subscription[] >( initialData ) ;
  const [ error , setError ] = useState< string | null >( null ) ;

  const add = useCallback( ( data: SubscriptionFormData ) => {
    setError( null ) ;

    // Alta optimista con ID temporal, reemplazado por el registro real del servidor
    const tempId = `temp-${crypto.randomUUID()}` ;
    const now    = new Date() ;

    const optimistic: Subscription = {
      id:              tempId ,
      organizationId:  "" ,
      description:     null ,
      currency:        "ARS" ,
      intervalCount:   1 ,
      startDate:       now ,
      nextPaymentDate: now ,
      autoDebit:       false ,
      accountId:       null ,
      status:          "active" ,
      createdAt:       now ,
      updatedAt:       now ,
      ...data ,
      categoryId:      ( data.categoryId ?? null ) ,
    } ;

    setItems( ( prev ) => [ ...prev , optimistic ] ) ;

    createSubscriptionAction( data ).then( ( res ) => {
      if( res.success ){
        setItems( ( prev ) => prev.map( ( s ) => ( s.id === tempId ? res.value : s ) ) ) ;
      } else {
        // Rollback: eliminar el registro optimista y exponer el error
        setItems( ( prev ) => prev.filter( ( s ) => s.id !== tempId ) ) ;
        setError( res.error ) ;
      }
    } ) ;
  } , [] ) ;

  const update = useCallback( ( id: string , data: Partial<SubscriptionFormData> ) => {
    setError( null ) ;

    // Snapshot para rollback ante fallo del servidor
    let snapshot: Subscription[] = [] ;

    setItems( ( prev ) => {
      snapshot = prev ;
      return( prev.map( ( sub ) => ( sub.id === id ? { ...sub , ...data , updatedAt: new Date() } : sub ) ) ) ;
    } ) ;

    updateSubscriptionAction( id , data ).then( ( res ) => {
      if( res.success ){
        setItems( ( prev ) => prev.map( ( s ) => ( s.id === id ? res.value : s ) ) ) ;
      } else {
        setItems( snapshot ) ;
        setError( res.error ) ;
      }
    } ) ;
  } , [] ) ;

  const remove = useCallback( ( id: string ) => {
    setError( null ) ;

    let snapshot: Subscription[] = [] ;

    setItems( ( prev ) => {
      snapshot = prev ;
      return( prev.filter( ( sub ) => sub.id !== id ) ) ;
    } ) ;

    deleteSubscriptionAction( id ).then( ( res ) => {
      if( !res.success ){
        setItems( snapshot ) ;
        setError( res.error ) ;
      }
    } ) ;
  } , [] ) ;

  const summary = useMemo( () => buildSummary( items ) , [ items ] ) ;

  return( { items , summary , error , add , update , remove } ) ;
}
