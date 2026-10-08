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
import { Modal }              from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Accounting
import { CreateFinancialEntityForm , EntidadCreada } from "./CreateFinancialEntityForm" ;
import { crearCuentaPersonalAction }                 from "../actions/cuentasPersonalesActions" ;
import { createAccountAction }                       from "../actions/accountingActions" ;
import styles                                        from "./CreateAccountForm.module.css" ;


/** Valor reservado de la opción «Crear entidad nueva…»: nunca se guarda como entidad ni viaja al servidor. */
const OPCION_ENTIDAD_NUEVA = "__nueva__" ;


interface CreateAccountFormProps {
  dict:              Awaited< ReturnType< typeof getDictionary > >["accountsPage"] ;
  financialEntities: { id: string ; name: string }[] ;
  defaultEntityId?:  string ;
  /** Crea una cuenta personal (siempre de activo, nace privada) en vez de una de la organización. */
  personal?:         boolean ;
  onSuccess?:        () => void ;
}

export function CreateAccountForm( {
  dict ,
  financialEntities ,
  defaultEntityId ,
  personal = false ,
  onSuccess
}: CreateAccountFormProps ) {
  const router                           = useRouter() ;
  const [ isTransitioning , startTrans ] = useTransition() ;
  const [ error , setError ]             = useState< string | null >( null ) ;

  const [ name , setName ]               = useState( "" ) ;
  const [ type , setType ]               = useState( "asset" ) ;
  const [ balance , setBalance ]         = useState( "" ) ;
  const [ selectedEntityId , setSelectedEntityId ] = useState( defaultEntityId || "" ) ;

  // Alta de entidad sin salir del formulario (RN-14): lo escrito acá se conserva, el modal se monta aparte
  const [ creandoEntidad , setCreandoEntidad ]       = useState( false ) ;
  const [ entidadesCreadas , setEntidadesCreadas ]   = useState< EntidadCreada[] >( [] ) ;
  const entidades = [ ...financialEntities , ...entidadesCreadas.filter( ( c ) => !financialEntities.some( ( e ) => e.id === c.id ) ) ] ;

  // Sincronizar preselección de entidad ante cambios de prop
  const [ prevDefaultEntityId , setPrevDefaultEntityId ] = useState( defaultEntityId ) ;
  if( defaultEntityId !== prevDefaultEntityId ) {
    setPrevDefaultEntityId( defaultEntityId ) ;
    if( defaultEntityId ) { setSelectedEntityId( defaultEntityId ) ; }
  }

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( null ) ;

    if( !name ) {
      setError( "El nombre de la cuenta es requerido." ) ;
      return ;
    }

    // Al permitirse sólo asset y liability, la entidad financiera es siempre obligatoria
    if( !selectedEntityId ) {
      setError( "Debe seleccionar una entidad financiera." ) ;
      return ;
    }

    startTrans( async () => {
      const rawCents = Math.floor( ( Number( balance ) || 0 ) * 100 ) ;

      const datos = {
        name ,
        balance:  rawCents ,
        entityId: ( selectedEntityId || undefined ) ,
        currency: "ARS"
      } ;

      const res = personal
        ? await crearCuentaPersonalAction( datos )
        : await createAccountAction( {...datos , type} ) ;

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

  const handleEntidadCreada = ( entidad: EntidadCreada ) => {
    setEntidadesCreadas( ( prev ) => [ ...prev , entidad ] ) ;
    setSelectedEntityId( entidad.id ) ;
    setCreandoEntidad( false ) ;
  } ;

  return(
    <>
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
        {!personal && (
          <FormSelect
            label={dict.formType || "Tipo de Cuenta"}
            value={type}
            onChange={ ( e ) => setType( e.target.value ) }
            disabled={isTransitioning}
            required
          >
            <option value="asset">{ dict.typeAsset || "Activo (Dinero/Bienes)" }</option>
            <option value="liability">{ dict.typeLiability || "Pasivo (Deudas/Tarjetas)" }</option>
          </FormSelect>
        )}

        <FormSelect
          label={dict.formInstitution || "Entidad Financiera"}
          value={selectedEntityId}
          onChange={ ( e ) => {
            if( e.target.value === OPCION_ENTIDAD_NUEVA ) {
              setCreandoEntidad( true ) ;
              return ;
            }
            setSelectedEntityId( e.target.value ) ;
          } }
          disabled={isTransitioning}
          required
        >
          <option value="">Seleccionar Entidad...</option>
          {entidades.map( ( ent ) => (
            <option key={ent.id} value={ent.id}>{ ent.name }</option>
          ) )}
          <option value={OPCION_ENTIDAD_NUEVA}>{ dict.createEntityOption }</option>
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

    <Modal
      isOpen={creandoEntidad}
      onClose={ () => setCreandoEntidad( false ) }
      title={dict.titleCreateEntityModal}
      subtitle={dict.subtitleCreateEntityModal}
    >
      <CreateFinancialEntityForm
        dict={dict}
        onSuccess={handleEntidadCreada}
      />
    </Modal>
    </>
  ) ;
}
