/**
 * @file SaldosPanel.tsx
 * Pestaña Saldos de Configuración: lo que cada miembro le debe a quien mira y lo que él debe, por divisa y sin
 * compensar entre divisas. El acreedor ve «Solicitar» y «Pago»; el `viewer` y «Miembro anterior» no llevan botones.
 * El monto del pago se convierte a centavos en un único punto (`parseAmountToCents`).
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { nuevaClaveDeEnvio } from "@/shared/lib/claveIdempotencia" ;
import { FormInput }      from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }      from "@/shared/ui/forms/Form/FormError" ;
import { Button }         from "@/shared/ui/display/Button/Button" ;
import { Modal }          from "@/shared/ui/feedback/Modal/Modal" ;
import { formatCurrency } from "@/shared/lib/currencyFormatter" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Goals
import { parseAmountToCents , centsToInput } from "@/features/goals/utils/goalAmount" ;

// Feature: Splits
import { obtenerSaldosAction , registrarPagoAction , solicitarPagoAction , type VistaSaldos , type SaldoVista } from "../actions/saldosActions" ;
import styles                                                                                                    from "./SaldosPanel.module.css" ;


export interface SaldosPanelDict {
  title:            string ;
  owesYou:          string ;
  youOwe:           string ;
  formerMember:     string ;
  empty:            string ;
  request:          string ;
  requestSent:      string ;
  pay:              string ;
  payTitle:         string ;
  payAmountLabel:   string ;
  payAmountInvalid: string ;
  paySubmit:        string ;
  cancel:           string ;
  loadError:        string ;
  genericError:     string ;
}

export interface SaldosPanelProps {
  initialData: VistaSaldos ;
  dict:        SaldosPanelDict ;
}

/** Reemplaza `{nombre}` en la plantilla resaltando el nombre. */
function conNombre( plantilla: string , nombre: string ): React.ReactNode[] {
  return(
    plantilla.split( /(\{nombre\})/ ).map( ( parte , i ) => {
      return( (parte === "{nombre}") ? <strong key={i}>{nombre}</strong> : <React.Fragment key={i}>{parte}</React.Fragment> ) ;
    } )
  ) ;
}

/**
 * Lista de saldos de quien mira, con las acciones de pago para el acreedor.
 */
export function SaldosPanel( { initialData , dict }: SaldosPanelProps ) {
  const { profile } = useProfileContext() ;
  const locale      = ( profile?.numberFormat || "es-AR" ) ;

  const [ data , setData ]               = useState< VistaSaldos >( initialData ) ;
  const [ aviso , setAviso ]             = useState< string >( "" ) ;
  const [ error , setError ]             = useState< string >( "" ) ;
  const [ pagando , setPagando ]         = useState< SaldoVista | null >( null ) ;
  const [ monto , setMonto ]             = useState< string >( "" ) ;
  const [ errorMonto , setErrorMonto ]   = useState< string >( "" ) ;
  const [ errorPago , setErrorPago ]     = useState< string >( "" ) ;
  const [ claveDeEnvio , setClaveDeEnvio ] = useState( nuevaClaveDeEnvio ) ;
  const [ isPending , startTransition ]  = useTransition() ;

  const refrescar = async (): Promise< void > => {
    const res = await obtenerSaldosAction() ;

    if( res.success ) {
      setData( res.value ) ;
    } else {
      setError( dict.loadError ) ;
    }
  } ;

  const abrirPago = ( saldo: SaldoVista ): void => {
    setPagando( saldo ) ;
    setMonto( centsToInput( saldo.montoEnCentavos , saldo.divisa ) ) ;
    setErrorMonto( "" ) ;
    setErrorPago( "" ) ;
  } ;

  const solicitar = ( saldo: SaldoVista ): void => {
    if( !saldo.contraparteId ) {
      return ;
    }

    const contraparteId = saldo.contraparteId ;

    setAviso( "" ) ;
    setError( "" ) ;

    startTransition( async () => {
      const res = await solicitarPagoAction( { contraparteId , divisa: saldo.divisa } ) ;

      if( res.success ) {
        setAviso( dict.requestSent ) ;
      } else {
        setError( res.error || dict.genericError ) ;
      }
    } ) ;
  } ;

  const confirmarPago = ( e: React.FormEvent ): void => {
    e.preventDefault() ;

    if( !pagando || !pagando.contraparteId ) {
      return ;
    }

    const contraparteId = pagando.contraparteId ;
    const divisa        = pagando.divisa ;

    setErrorMonto( "" ) ;
    setErrorPago( "" ) ;

    const centavos = parseAmountToCents( monto , divisa ) ;

    if( !centavos || (centavos <= 0) ) {
      setErrorMonto( dict.payAmountInvalid ) ;
      return ;
    }

    startTransition( async () => {
      const res = await registrarPagoAction( { contraparteId , divisa , montoEnCentavos: centavos } , claveDeEnvio ) ;

      if( res.success ) {
        setPagando( null ) ;
        setClaveDeEnvio( nuevaClaveDeEnvio() ) ;
        setAviso( "" ) ;
        await refrescar() ;
      } else {
        setErrorPago( res.error || dict.genericError ) ;
      }
    } ) ;
  } ;

  return(
    <section className={styles.panel} aria-label={dict.title}>
      <h2 className={styles.title}>{dict.title}</h2>

      { aviso ? <p className={styles.notice} role="status">{aviso}</p> : null }
      { error ? <FormError error={error} /> : null }

      { (data.saldos.length === 0) ? (
        <p className={styles.empty}>{dict.empty}</p>
      ) : (
        <ul className={styles.list}>
          { data.saldos.map( ( saldo ) => {
            const aFavor     = ( saldo.montoEnCentavos > 0 ) ;
            const esAnterior = ( saldo.contraparteId === null ) ;
            const importe    = formatCurrency( Math.abs( saldo.montoEnCentavos ) , saldo.divisa , locale ) ;
            const nombre     = esAnterior ? dict.formerMember : ( saldo.nombre ?? "" ) ;
            const conBotones = ( data.puedeEscribir && aFavor && !esAnterior ) ;

            return(
              <li key={`${saldo.contraparteId ?? "anterior"}-${saldo.divisa}`} className={styles.row}>
                <span className={styles.text}>
                  { esAnterior ? <strong>{nombre}</strong> : conNombre( aFavor ? dict.owesYou : dict.youOwe , nombre ) }
                </span>
                <span className={aFavor ? styles.amountIn : styles.amountOut}>{importe} {saldo.divisa}</span>

                { conBotones ? (
                  <span className={styles.actions}>
                    <Button type="button" variant="outline" disabled={isPending} onClick={ () => solicitar( saldo ) }>
                      {dict.request}
                    </Button>
                    <Button type="button" variant="primary" disabled={isPending} onClick={ () => abrirPago( saldo ) }>
                      {dict.pay}
                    </Button>
                  </span>
                ) : null }
              </li>
            ) ;
          } ) }
        </ul>
      ) }

      { pagando ? (
        <Modal
          isOpen={true}
          onClose={ () => setPagando( null ) }
          title={ dict.payTitle.replace( "{nombre}" , pagando.nombre ?? "" ) }
          size="small"
        >
          <form onSubmit={confirmarPago} className={styles.form} noValidate>
            <FormInput
              label={ dict.payAmountLabel.replace( "{divisa}" , pagando.divisa ) }
              type="text"
              inputMode="decimal"
              value={monto}
              onChange={ ( e ) => setMonto( e.target.value ) }
              error={errorMonto}
            />

            { errorPago ? <FormError error={errorPago} /> : null }

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={ () => setPagando( null ) } disabled={isPending}>
                {dict.cancel}
              </Button>
              <Button type="submit" variant="primary" isLoading={isPending}>
                {dict.paySubmit}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null }
    </section>
  ) ;
}
