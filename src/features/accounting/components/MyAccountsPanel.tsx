/**
 * @file MyAccountsPanel.tsx
 * Vista «Mis cuentas» de `/accounts` (RN-16): todas las cuentas personales del usuario con su etiqueta, las
 * organizaciones donde están compartidas, y los controles para compartir, dejar de compartir y crear una nueva.
 * No es una ruta: la monta el contenedor cuando el usuario elige esa vista.
 */
"use client" ;

// Librerías externas
import React , { useEffect , useState , useTransition } from "react" ;

// Shared
import { useMetricsVisibility } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { FormSelect }           from "@/shared/ui/forms/Form/FormSelect" ;
import { FormError }            from "@/shared/ui/forms/Form/FormError" ;
import type { getDictionary }   from "@/shared/lib/dictionary" ;
import { Button }               from "@/shared/ui/display/Button/Button" ;
import { Modal }                from "@/shared/ui/feedback/Modal/Modal" ;
import { Card }                 from "@/shared/ui/display/Card/Card" ;

// Feature: Accounting
import {
  obtenerMisCuentasAction ,
  compartirCuentaAction ,
  dejarDeCompartirAction ,
  listarOrganizacionesParaCompartirAction ,
  CuentaPersonalVista ,
  OrganizacionParaCompartir
} from "../actions/cuentasPersonalesActions" ;
import type { FinancialEntity } from "../types" ;
import { formatCents }          from "../utils/dashboardMetrics" ;
import { CreateAccountForm }    from "./CreateAccountForm" ;
import { AccountLabel }         from "./AccountLabel" ;
import styles                   from "./MyAccountsPanel.module.css" ;


interface MyAccountsPanelProps {
  dict:              Awaited< ReturnType< typeof getDictionary > >["accountsPage"] ;
  financialEntities: FinancialEntity[] ;
}

export function MyAccountsPanel( {dict , financialEntities}: MyAccountsPanelProps ) {
  const { isContentVisible }                   = useMetricsVisibility() ;
  const [ isPending , startTransition ]        = useTransition() ;
  const [ cuentas , setCuentas ]               = useState< CuentaPersonalVista[] | null >( null ) ;
  const [ organizaciones , setOrganizaciones ] = useState< OrganizacionParaCompartir[] >( [] ) ;
  const [ destinos , setDestinos ]             = useState< Record< string , string > >( {} ) ;
  const [ error , setError ]                   = useState( "" ) ;
  const [ recarga , setRecarga ]               = useState( 0 ) ;
  const [ isCreateOpen , setIsCreateOpen ]     = useState( false ) ;

  useEffect( () => {
    let vigente = true ;

    void ( async () => {
      const [ misCuentas , orgs ] = await Promise.all( [
        obtenerMisCuentasAction() ,
        listarOrganizacionesParaCompartirAction() ,
      ] ) ;

      if( !vigente ) { return ; }

      if( misCuentas.success ) {
        setCuentas( misCuentas.value ) ;
      } else {
        setCuentas( [] ) ;
        setError( misCuentas.error ) ;
      }
      setOrganizaciones( orgs.success ? orgs.value : [] ) ;
    } )() ;

    return( () => { vigente = false ; } ) ;
  } , [ recarga ] ) ;

  const cambiarComparticion = ( accountId: string , organizationId: string , compartir: boolean ) => {
    setError( "" ) ;

    startTransition( async () => {
      const res = compartir
        ? await compartirCuentaAction( {accountId , organizationId} )
        : await dejarDeCompartirAction( {accountId , organizationId} ) ;

      if( !res.success ) {
        setError( res.error ) ;
        return ;
      }

      setDestinos( ( prev ) => ( {...prev , [accountId]: ""} ) ) ;
      setRecarga( ( n ) => (n + 1) ) ;
    } ) ;
  } ;

  return(
    <section className={styles.panel} aria-label={dict.viewMine}>
      <div className={styles.toolbar}>
        <Button onClick={ () => setIsCreateOpen( true ) }>
          + {dict.btnNewPersonal}
        </Button>
      </div>

      {error && <FormError error={error} />}

      {cuentas === null ? (
        <p className={styles.note}>{dict.loadingMine}</p>
      ) : ( cuentas.length === 0 ) ? (
        <p className={styles.note}>{dict.emptyMine}</p>
      ) : (
        <div className={styles.list}>
          {cuentas.map( ( {cuenta , etiqueta , organizacionesIds} ) => {
            const compartidas = ( (etiqueta.tipo === "compartida") ? etiqueta.organizaciones : [] ) ;
            const candidatas  = organizaciones.filter( ( o ) => !organizacionesIds.includes( o.id ) ) ;
            const destino     = ( destinos[cuenta.id] ?? "" ) ;

            return(
              <Card key={cuenta.id} className={styles.account}>
                <div className={styles.head}>
                  <div className={styles.titleGroup}>
                    <span className={styles.name}>{cuenta.name}</span>
                    <AccountLabel etiqueta={etiqueta} dict={dict} />
                  </div>
                  <span className={styles.balance}>
                    {isContentVisible ? formatCents( cuenta.balance ) : ""}
                  </span>
                </div>

                {compartidas.length > 0 && (
                  <ul className={styles.sharedList} aria-label={dict.sharedInLabel}>
                    {compartidas.map( ( org ) => (
                      <li key={org.id} className={styles.sharedRow}>
                        <span className={styles.sharedName}>{org.nombre}</span>
                        <Button
                          variant="outline"
                          disabled={isPending}
                          onClick={ () => cambiarComparticion( cuenta.id , org.id , false ) }
                        >
                          {dict.btnStopSharing}
                        </Button>
                      </li>
                    ) )}
                  </ul>
                )}

                {candidatas.length > 0 && (
                  <div className={styles.shareRow}>
                    <FormSelect
                      aria-label={ `${dict.btnShareWith} ${cuenta.name}` }
                      value={destino}
                      onChange={ ( e ) => setDestinos( ( prev ) => ( {...prev , [cuenta.id]: e.target.value} ) ) }
                      disabled={isPending}
                    >
                      <option value="">{dict.shareChooseOrganization}</option>
                      {candidatas.map( ( o ) => (
                        <option key={o.id} value={o.id}>{o.nombre}</option>
                      ) )}
                    </FormSelect>
                    <Button
                      variant="secondary"
                      disabled={isPending || !destino}
                      onClick={ () => cambiarComparticion( cuenta.id , destino , true ) }
                    >
                      {dict.btnShareWith}
                    </Button>
                  </div>
                )}
              </Card>
            ) ;
          } )}
        </div>
      )}

      <Modal
        isOpen={isCreateOpen}
        onClose={ () => setIsCreateOpen( false ) }
        title={dict.titleCreatePersonalModal}
        subtitle={dict.subtitleCreatePersonalModal}
      >
        <CreateAccountForm
          dict={dict}
          financialEntities={financialEntities}
          personal={true}
          onSuccess={ () => {
            setIsCreateOpen( false ) ;
            setRecarga( ( n ) => (n + 1) ) ;
          } }
        />
      </Modal>
    </section>
  ) ;
}
