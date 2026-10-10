/**
 * @file CajaPanel.tsx
 * Pestaña Caja de Configuración: la participación de cada miembro en la caja común, por divisa, y los aportes y
 * retiros recientes. Es informativa: no mueve plata (RN-26). Sólo quien puede escribir ve «Aportar» y «Retirar»;
 * el `viewer` ve la caja sin botones. El monto se convierte a centavos en un único punto (`parseAmountToCents`) y
 * un retiro viaja con signo negativo.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import { nuevaClaveDeEnvio } from "@/shared/lib/claveIdempotencia" ;
import { FormSelect }     from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }      from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }      from "@/shared/ui/forms/Form/FormError" ;
import { Button }         from "@/shared/ui/display/Button/Button" ;
import { Modal }          from "@/shared/ui/feedback/Modal/Modal" ;
import { formatCurrency } from "@/shared/lib/currencyFormatter" ;

// Feature: Profile
import { useProfileContext } from "@/features/profile/context/ProfileContext" ;

// Feature: Goals
import { parseAmountToCents } from "@/features/goals/utils/goalAmount" ;

// Feature: Splits
import { obtenerCajaAction , registrarAporteCajaAction , type VistaCaja } from "../actions/cajaActions" ;
import styles                                                             from "./CajaPanel.module.css" ;


export interface CajaPanelDict {
  title:               string ;
  subtitle:            string ;
  participationTitle:  string ;
  share:               string ;
  noShare:             string ;
  formerMember:        string ;
  empty:               string ;
  recentTitle:         string ;
  contribute:          string ;
  withdraw:            string ;
  contributeTitle:     string ;
  withdrawTitle:       string ;
  kindContribution:    string ;
  kindWithdrawal:      string ;
  memberLabel:         string ;
  currencyLabel:       string ;
  amountLabel:         string ;
  amountInvalid:       string ;
  noteLabel:           string ;
  submit:              string ;
  cancel:              string ;
  loadError:           string ;
  genericError:        string ;
}

export interface CajaPanelProps {
  initialData: VistaCaja ;
  dict:        CajaPanelDict ;
}

type TipoMovimiento = "aporte" | "retiro" ;

/** Participación como texto con un decimal: `6666` puntos básicos → `66,7`. */
function porcentajeComoTexto( bp: number , locale: string ): string {
  return( new Intl.NumberFormat( locale , { minimumFractionDigits: 1 , maximumFractionDigits: 1 } ).format( bp / 100 ) ) ;
}

/**
 * Participaciones y movimientos de la caja común de la organización activa.
 */
export function CajaPanel( { initialData , dict }: CajaPanelProps ) {
  const { profile } = useProfileContext() ;
  const locale      = ( profile?.numberFormat || "es-AR" ) ;

  const [ data , setData ]              = useState< VistaCaja >( initialData ) ;
  const [ error , setError ]            = useState< string >( "" ) ;
  const [ tipo , setTipo ]              = useState< TipoMovimiento | null >( null ) ;
  const [ divisa , setDivisa ]          = useState< string >( "" ) ;
  const [ miembroId , setMiembroId ]    = useState< string >( "" ) ;
  const [ monto , setMonto ]            = useState< string >( "" ) ;
  const [ nota , setNota ]              = useState< string >( "" ) ;
  const [ errorMonto , setErrorMonto ]  = useState< string >( "" ) ;
  const [ errorForm , setErrorForm ]    = useState< string >( "" ) ;
  const [ claveDeEnvio , setClaveDeEnvio ] = useState( nuevaClaveDeEnvio ) ;
  const [ isPending , startTransition ] = useTransition() ;

  const esOwner = ( data.rol === "owner" ) ;

  const refrescar = async (): Promise< void > => {
    const res = await obtenerCajaAction() ;

    if( res.success ) {
      setData( res.value ) ;
    } else {
      setError( dict.loadError ) ;
    }
  } ;

  const abrir = ( nuevo: TipoMovimiento ): void => {
    setTipo( nuevo ) ;
    setDivisa( data.divisas[ 0 ] ?? "" ) ;
    setMiembroId( data.yoId ) ;
    setMonto( "" ) ;
    setNota( "" ) ;
    setErrorMonto( "" ) ;
    setErrorForm( "" ) ;
  } ;

  const confirmar = ( e: React.FormEvent ): void => {
    e.preventDefault() ;

    if( !tipo ) {
      return ;
    }

    setErrorMonto( "" ) ;
    setErrorForm( "" ) ;

    const centavos = parseAmountToCents( monto , divisa ) ;

    if( !centavos || (centavos <= 0) ) {
      setErrorMonto( dict.amountInvalid ) ;
      return ;
    }

    startTransition( async () => {
      const res = await registrarAporteCajaAction( {
        ...( (esOwner && (miembroId !== "")) ? { userId: miembroId } : {} ) ,
        currency:      divisa ,
        amountInCents: ( (tipo === "retiro") ? -centavos : centavos ) ,
        ...( (nota.trim() !== "") ? { note: nota.trim() } : {} ) ,
      } , claveDeEnvio ) ;

      if( res.success ) {
        setTipo( null ) ;
        setClaveDeEnvio( nuevaClaveDeEnvio() ) ;
        setError( "" ) ;
        await refrescar() ;
      } else {
        setErrorForm( res.error || dict.genericError ) ;
      }
    } ) ;
  } ;

  const nombreDe = ( nombre: string | null ): string => ( nombre ?? dict.formerMember ) ;

  return(
    <section className={styles.panel} aria-label={dict.title}>
      <div>
        <h2 className={styles.title}>{dict.title}</h2>
        <p className={styles.subtitle}>{dict.subtitle}</p>
      </div>

      { error ? <FormError error={error} /> : null }

      { data.puedeEscribir ? (
        <div className={styles.actions}>
          <Button type="button" variant="outline" disabled={isPending || (data.divisas.length === 0)} onClick={ () => abrir( "retiro" ) }>
            {dict.withdraw}
          </Button>
          <Button type="button" variant="primary" disabled={isPending || (data.divisas.length === 0)} onClick={ () => abrir( "aporte" ) }>
            {dict.contribute}
          </Button>
        </div>
      ) : null }

      { (data.participaciones.length === 0) ? (
        <p className={styles.empty}>{dict.empty}</p>
      ) : (
        data.participaciones.map( ( p ) => (
          <div key={p.divisa} className={styles.section}>
            <h3 className={styles.sectionTitle}>{ dict.participationTitle.replace( "{divisa}" , p.divisa ) }</h3>
            <ul className={styles.list}>
              { p.filas.map( ( f ) => (
                <li key={`${p.divisa}-${f.userId ?? "anterior"}`} className={styles.row}>
                  <span className={styles.text}>{ (f.userId === null) ? <strong>{dict.formerMember}</strong> : nombreDe( f.nombre ) }</span>
                  <span className={styles.net}>{ formatCurrency( f.neto , p.divisa , locale ) } {p.divisa}</span>
                  <span className={styles.share}>
                    { (f.bp === null) ? dict.noShare : dict.share.replace( "{porcentaje}" , porcentajeComoTexto( f.bp , locale ) ) }
                  </span>
                </li>
              ) ) }
            </ul>
          </div>
        ) )
      ) }

      { (data.aportes.length > 0) ? (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{dict.recentTitle}</h3>
          <ul className={styles.list}>
            { data.aportes.map( ( a ) => {
              const esAporte = ( a.amountInCents > 0 ) ;

              return(
                <li key={a.id} className={styles.row}>
                  <span className={styles.text}>
                    {esAporte ? dict.kindContribution : dict.kindWithdrawal} · {nombreDe( a.nombre )} · {new Date( a.occurredAt ).toLocaleDateString( locale )}
                  </span>
                  <span className={esAporte ? styles.amountIn : styles.amountOut}>
                    {esAporte ? "+" : "−"}{ formatCurrency( Math.abs( a.amountInCents ) , a.currency , locale ) } {a.currency}
                  </span>
                  { a.note ? <span className={styles.note}>{a.note}</span> : null }
                </li>
              ) ;
            } ) }
          </ul>
        </div>
      ) : null }

      { tipo ? (
        <Modal
          isOpen={true}
          onClose={ () => setTipo( null ) }
          title={ (tipo === "retiro") ? dict.withdrawTitle : dict.contributeTitle }
          size="small"
        >
          <form onSubmit={confirmar} className={styles.form} noValidate>
            { (esOwner && (data.miembros.length > 0)) ? (
              <FormSelect label={dict.memberLabel} value={miembroId} onChange={ ( e ) => setMiembroId( e.target.value ) }>
                { data.miembros.map( ( m ) => ( <option key={m.userId} value={m.userId}>{m.nombre}</option> ) ) }
              </FormSelect>
            ) : null }

            { (data.divisas.length > 1) ? (
              <FormSelect label={dict.currencyLabel} value={divisa} onChange={ ( e ) => setDivisa( e.target.value ) }>
                { data.divisas.map( ( d ) => ( <option key={d} value={d}>{d}</option> ) ) }
              </FormSelect>
            ) : null }

            <FormInput
              label={ dict.amountLabel.replace( "{divisa}" , divisa ) }
              type="text"
              inputMode="decimal"
              value={monto}
              onChange={ ( e ) => setMonto( e.target.value ) }
              error={errorMonto}
            />

            <FormInput
              label={dict.noteLabel}
              type="text"
              maxLength={200}
              value={nota}
              onChange={ ( e ) => setNota( e.target.value ) }
            />

            { errorForm ? <FormError error={errorForm} /> : null }

            <div className={styles.modalFooter}>
              <Button type="button" variant="outline" onClick={ () => setTipo( null ) } disabled={isPending}>
                {dict.cancel}
              </Button>
              <Button type="submit" variant="primary" isLoading={isPending}>
                {dict.submit}
              </Button>
            </div>
          </form>
        </Modal>
      ) : null }
    </section>
  ) ;
}
