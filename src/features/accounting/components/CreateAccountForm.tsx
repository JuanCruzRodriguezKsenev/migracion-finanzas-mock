"use client" ;

// Librerías externas
import { useRouter }                     from "next/navigation" ;
import React , { useState , useTransition } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { FormSelect }         from "@/shared/ui/forms/Form/FormSelect" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;
import { FormInput }          from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }          from "@/shared/ui/forms/Form/FormError" ;

// Feature: Accounting
import { createAccountAction } from "../actions/accountingActions" ;
import styles                  from "./CreateAccountForm.module.css" ;


interface CreateAccountFormProps {
  dict:              Awaited< ReturnType< typeof getDictionary > >["accountsPage"] ;
  financialEntities: { id: string ; name: string }[] ;
  defaultEntityId?:  string ;
  onSuccess?:        () => void ;
}

export function CreateAccountForm( {
  dict ,
  financialEntities ,
  defaultEntityId ,
  onSuccess
}: CreateAccountFormProps ) {
  const router                           = useRouter() ;
  const [ isTransitioning , startTrans ] = useTransition() ;
  const [ error , setError ]             = useState< string | null >( null ) ;

  const [ name , setName ]               = useState( "" ) ;
  const [ type , setType ]               = useState( "asset" ) ;
  const [ balance , setBalance ]         = useState( "" ) ;
  const [ selectedEntityId , setSelectedEntityId ] = useState( defaultEntityId || "" ) ;

  // Sincronizar preselección y resetear entidad al elegir una cuenta nominal/contable.
  // Se ajusta durante el render (patrón oficial de React para "resetear estado ante
  // un cambio de prop/estado") en vez de en un efecto, evitando un ciclo de render extra.
  const [ prevDefaultEntityId , setPrevDefaultEntityId ] = useState( defaultEntityId ) ;
  if( defaultEntityId !== prevDefaultEntityId ) {
    setPrevDefaultEntityId( defaultEntityId ) ;
    if( defaultEntityId ) { setSelectedEntityId( defaultEntityId ) ; }
  }

  const [ prevType , setPrevType ] = useState( type ) ;
  if( type !== prevType ) {
    setPrevType( type ) ;
    if( ( type === "equity" ) || ( type === "revenue" ) || ( type === "expense" ) ) {
      setSelectedEntityId( "" ) ;
    }
  }

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( null ) ;

    if( !name ) {
      setError( "El nombre de la cuenta es requerido." ) ;
      return ;
    }

    // Validar que se seleccione una entidad si es una cuenta financiera activa
    if( ( ( type === "asset" ) || ( type === "liability" ) ) && !selectedEntityId ) {
      setError( "Debe seleccionar una entidad financiera." ) ;
      return ;
    }

    startTrans( async () => {
      const rawCents = Math.floor( ( Number( balance ) || 0 ) * 100 ) ;

      const res = await createAccountAction( {
        name ,
        type ,
        balance:  rawCents ,
        entityId: ( selectedEntityId || undefined ) ,
        currency: "ARS"
      } ) ;

      if( res.success ) {
        setName( "" ) ;
        setBalance( "" ) ;
        setSelectedEntityId( "" ) ;
        router.refresh() ;
        if( onSuccess ) {
          onSuccess() ;
        }
      } else {
        setError( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <form className={styles.form} onSubmit={handleSubmit}>
      <h3 className={styles.formTitle}>{ dict.formTitle || "Crear Cuenta" }</h3>

      <FormError error={error || ""} />

      <FormInput
        label={dict.formName || "Nombre de la Cuenta"}
        type="text"
        placeholder="Ej: Caja de Ahorro Galicia, Tarjeta Visa Santander"
        value={name}
        onChange={ ( e ) => setName( e.target.value ) }
        disabled={isTransitioning}
        required
      />

      <div className={styles.row}>
        <FormSelect
          label={dict.formType || "Tipo de Cuenta"}
          value={type}
          onChange={ ( e ) => setType( e.target.value ) }
          disabled={isTransitioning}
          required
        >
          <option value="asset">{ dict.typeAsset || "Activo (Dinero/Bienes)" }</option>
          <option value="liability">{ dict.typeLiability || "Pasivo (Deudas/Tarjetas)" }</option>
          <option value="equity">{ dict.typeEquity || "Patrimonio Neto" }</option>
          <option value="revenue">{ dict.typeRevenue || "Ingreso" }</option>
          <option value="expense">{ dict.typeExpense || "Egreso / Gasto" }</option>
        </FormSelect>

        <FormSelect
          label={dict.formInstitution || "Entidad Financiera"}
          value={selectedEntityId}
          onChange={ ( e ) => setSelectedEntityId( e.target.value ) }
          disabled={ isTransitioning || ( type === "equity" ) || ( type === "revenue" ) || ( type === "expense" ) }
          required={ ( type === "asset" ) || ( type === "liability" ) }
        >
          <option value="">{ ( type === "equity" ) || ( type === "revenue" ) || ( type === "expense" ) ? "Contabilidad" : "Seleccionar Entidad..." }</option>
          {financialEntities.map( ( ent ) => (
            <option key={ent.id} value={ent.id}>{ ent.name }</option>
          ) )}
        </FormSelect>
      </div>

      <div className={styles.row}>
        <FormInput
          label={dict.formBalance || "Saldo Inicial"}
          type="number"
          step="0.01"
          placeholder="0.00"
          value={balance}
          onChange={ ( e ) => setBalance( e.target.value ) }
          disabled={isTransitioning}
          required
        />
      </div>

      <Button type="submit" isLoading={isTransitioning} className={styles.submitBtn}>
        { isTransitioning ? "Procesando..." : ( dict.btnCreate || "Crear Cuenta" ) }
      </Button>
    </form>
  ) ;
}
