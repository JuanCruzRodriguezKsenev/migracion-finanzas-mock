/**
 * @file AcuerdoPanel.tsx
 * Pestaña Acuerdo de Configuración: el `owner` define el modo de reparto, los porcentajes y los aportes del
 * mes; el `member` ve el modo, su proporción y declara su propio aporte (S-W). Las plantillas sólo rellenan
 * el formulario: no se guardan (S-P).
 */
"use client" ;

// Librerías externas
import React , { useState } from "react" ;

// Shared
import { FormSelect } from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }  from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }  from "@/shared/ui/forms/Form/FormError" ;
import { Checkbox }   from "@/shared/ui/forms/Checkbox/Checkbox" ;
import RadioGroup     from "@/shared/ui/forms/RadioGroup/RadioGroup" ;
import { Button }     from "@/shared/ui/display/Button/Button" ;
import { Modal }      from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Splits
import { obtenerAcuerdoAction , guardarAcuerdoAction , declararAporteAction , type VistaAcuerdo }                                   from "../actions/acuerdoActions" ;
import { porcentajeComoTexto , porcentajeABp , importeACentavos , centavosComoTexto , porcentajesIguales , type ModoAcuerdo } from "../utils/reparto" ;
import styles                                                                                                                 from "./AcuerdoPanel.module.css" ;


export interface AcuerdoPanelDict {
  title:                  string ;
  subtitle:               string ;
  templateLabel:          string ;
  templatePlaceholder:    string ;
  templateFamilia:        string ;
  templateCompaneros:     string ;
  templateTrabajo:        string ;
  templatePersonal:       string ;
  templateHint:           string ;
  modeLegend:             string ;
  modeNone:               string ;
  modeFixed:              string ;
  modeMonthly:            string ;
  percentagesTitle:       string ;
  percentageOf:           string ;
  sumOk:                  string ;
  sumShort:               string ;
  sumOver:                string ;
  percentageInvalid:      string ;
  contributionsTitle:     string ;
  contributionsHint:      string ;
  contributionOf:         string ;
  contributionInvalid:    string ;
  commonPotLabel:         string ;
  commonPotAccounts:      string ;
  commonPotAccountOption: string ;
  commonPotNoAccounts:    string ;
  save:                   string ;
  confirmTitle:           string ;
  confirmBody:            string ;
  confirmAccept:          string ;
  cancel:                 string ;
  saved:                  string ;
  saveError:              string ;
  loadError:              string ;
  memberModeLabel:        string ;
  memberShare:            string ;
  memberContribution:     string ;
  memberSaveContribution: string ;
  contributionSaved:      string ;
  noContributions:        string ;
}

export interface AcuerdoPanelProps {
  initialData: VistaAcuerdo ;
  dict:        AcuerdoPanelDict ;
}

type Plantilla = "" | "familia" | "companeros" | "trabajo" | "personal" ;

/** Texto del mes en curso, `MM/AAAA`. */
function textoDeMes( mes: { year: number ; month: number } ): string {
  return( `${String( mes.month ).padStart( 2 , "0" )}/${mes.year}` ) ;
}

/** Porcentajes iniciales como texto editable, uno por miembro. */
function porcentajesIniciales( data: VistaAcuerdo ): Record< string , string > {
  return( Object.fromEntries( data.miembros.map( ( m ) => [ m.userId , porcentajeComoTexto( m.porcentajeBp ) ] ) ) ) ;
}

/** Aportes del mes como texto editable, uno por miembro (vacío si no declaró). */
function aportesIniciales( data: VistaAcuerdo ): Record< string , string > {
  return( Object.fromEntries( data.miembros.map( ( m ) => [ m.userId , ( (m.aporteDelMes === null) ? "" : centavosComoTexto( m.aporteDelMes ) ) ] ) ) ) ;
}

/** Cuentas marcadas como caja común al cargar la vista. */
function cuentasIniciales( data: VistaAcuerdo ): string[] {
  return( data.cuentasMarcables.filter( ( c ) => c.esCaja ).map( ( c ) => c.id ) ) ;
}

/**
 * Panel del acuerdo de reparto de la organización activa.
 */
export function AcuerdoPanel( { initialData , dict }: AcuerdoPanelProps ) {
  const [ data , setData ]               = useState< VistaAcuerdo >( initialData ) ;
  const [ modo , setModo ]               = useState< ModoAcuerdo >( initialData.modo ) ;
  const [ usaCaja , setUsaCaja ]         = useState( initialData.usesCommonPot ) ;
  const [ cuentasCaja , setCuentasCaja ] = useState< string[] >( () => cuentasIniciales( initialData ) ) ;
  const [ porcentajes , setPorcentajes ] = useState< Record< string , string > >( () => porcentajesIniciales( initialData ) ) ;
  const [ aportes , setAportes ]         = useState< Record< string , string > >( () => aportesIniciales( initialData ) ) ;
  const [ plantilla , setPlantilla ]     = useState< Plantilla >( "" ) ;
  const [ confirmando , setConfirmando ] = useState( false ) ;
  const [ guardando , setGuardando ]     = useState( false ) ;
  const [ error , setError ]             = useState( "" ) ;
  const [ aviso , setAviso ]             = useState( "" ) ;

  const esOwner = ( data.rol === "owner" ) ;
  const mes     = textoDeMes( data.mes ) ;

  const nombreDeModo = ( m: ModoAcuerdo ): string => {
    if( m === "fixed_percentages" )    { return( dict.modeFixed ) ; }
    if( m === "monthly_contributions" ) { return( dict.modeMonthly ) ; }
    return( dict.modeNone ) ;
  } ;

  // ── Porcentajes en vivo (modo fixed_percentages) ──────────────────────────
  const bpDe        = ( id: string ): number | null => porcentajeABp( porcentajes[id] ?? "" ) ;
  const hayInvalido = data.miembros.some( ( m ) => (bpDe( m.userId ) === null) ) ;
  const sumaBp      = data.miembros.reduce( ( s , m ) => ( s + (bpDe( m.userId ) ?? 0) ) , 0 ) ;
  const sumaOk      = ( !hayInvalido && (sumaBp === 10000) ) ;

  const mensajeSuma = ( (): string => {
    if( hayInvalido )       { return( dict.percentageInvalid ) ; }
    if( sumaBp === 10000 )  { return( dict.sumOk.replace( "{suma}" , porcentajeComoTexto( sumaBp ) ) ) ; }

    const plantillaMensaje = ( sumaBp < 10000 ) ? dict.sumShort : dict.sumOver ;

    return( plantillaMensaje.replace( "{suma}" , porcentajeComoTexto( sumaBp ) ).replace( "{resto}" , porcentajeComoTexto( Math.abs( 10000 - sumaBp ) ) ) ) ;
  } )() ;

  // ── Aportes del mes (modo monthly_contributions y vista del member) ───────
  const aporteInvalido = ( id: string ): boolean => {
    const texto = ( aportes[id] ?? "" ).trim() ;
    return( (texto !== "") && (importeACentavos( texto ) === null) ) ;
  } ;
  const hayAporteInvalido = data.miembros.some( ( m ) => aporteInvalido( m.userId ) ) ;

  // ── Caja común: sin cuentas de activo no puede quedar marcada, y activa exige al menos una cuenta ──
  const hayMarcables    = ( data.cuentasMarcables.length > 0 ) ;
  const usaCajaEfectiva = ( usaCaja && hayMarcables ) ;
  const cuentasValidas  = cuentasCaja.filter( ( id ) => data.cuentasMarcables.some( ( c ) => (c.id === id) ) ) ;
  const cajaIncompleta  = ( usaCajaEfectiva && (cuentasValidas.length === 0) ) ;

  const alternarCuenta = ( id: string ) => {
    setCuentasCaja( ( previas ) => ( previas.includes( id ) ? previas.filter( ( x ) => (x !== id) ) : [ ...previas , id ] ) ) ;
  } ;

  const puedeGuardar = ( esOwner && !guardando && !hayAporteInvalido && !cajaIncompleta && ((modo !== "fixed_percentages") || sumaOk) ) ;

  const aplicarPlantilla = ( valor: Plantilla ) => {
    setPlantilla( valor ) ;
    setAviso( "" ) ;

    if( valor === "familia" ) {
      setModo( "monthly_contributions" ) ;
      setUsaCaja( false ) ;
    } else if( valor === "companeros" ) {
      const iguales = porcentajesIguales( data.miembros.length ) ;
      setModo( "fixed_percentages" ) ;
      setUsaCaja( false ) ;
      setPorcentajes( Object.fromEntries( data.miembros.map( ( m , i ) => [ m.userId , porcentajeComoTexto( iguales[i] ) ] ) ) ) ;
    } else if( valor === "trabajo" ) {
      setModo( "none" ) ;
      setUsaCaja( true ) ;
    } else if( valor === "personal" ) {
      setModo( "none" ) ;
      setUsaCaja( false ) ;
    }
  } ;

  const recargar = async () => {
    const res = await obtenerAcuerdoAction() ;

    if( !res.success ) {
      setError( dict.loadError ) ;
      return ;
    }

    setData( res.value ) ;
    setModo( res.value.modo ) ;
    setUsaCaja( res.value.usesCommonPot ) ;
    setCuentasCaja( cuentasIniciales( res.value ) ) ;
    setPorcentajes( porcentajesIniciales( res.value ) ) ;
    setAportes( aportesIniciales( res.value ) ) ;
  } ;

  const handleConfirmar = async () => {
    if( !puedeGuardar ) { return ; }

    setGuardando( true ) ;
    setError( "" ) ;
    setAviso( "" ) ;

    try {
      const res = await guardarAcuerdoAction( {
        modo ,
        usesCommonPot: usaCajaEfectiva ,
        porcentajes:   ( modo === "fixed_percentages" )
          ? data.miembros.map( ( m ) => ( { userId: m.userId , percentageBp: ( bpDe( m.userId ) ?? 0 ) } ) )
          : [] ,
        cuentasCajaIds: ( usaCajaEfectiva ? cuentasValidas : [] ) ,
      } ) ;

      if( !res.success ) {
        setError( res.error || dict.saveError ) ;
        setConfirmando( false ) ;
        return ;
      }

      // Los aportes que el owner cambió se declaran uno por uno (cada uno es del mes en curso)
      if( modo === "monthly_contributions" ) {
        for( const m of data.miembros ) {
          const centavos = importeACentavos( aportes[m.userId] ?? "" ) ;

          if( (centavos !== null) && (centavos !== m.aporteDelMes) ) {
            const r = await declararAporteAction( { userId: m.userId , year: data.mes.year , month: data.mes.month , amountInCents: centavos } ) ;

            if( !r.success ) {
              setError( r.error || dict.saveError ) ;
              setConfirmando( false ) ;
              return ;
            }
          }
        }
      }

      setConfirmando( false ) ;
      await recargar() ;
      setAviso( dict.saved ) ;
    } catch {
      setError( dict.saveError ) ;
      setConfirmando( false ) ;
    } finally {
      setGuardando( false ) ;
    }
  } ;

  const handleGuardarMiAporte = async ( userId: string ) => {
    const centavos = importeACentavos( aportes[userId] ?? "" ) ;

    if( centavos === null ) {
      setError( dict.contributionInvalid ) ;
      return ;
    }

    setGuardando( true ) ;
    setError( "" ) ;
    setAviso( "" ) ;

    try {
      const res = await declararAporteAction( { year: data.mes.year , month: data.mes.month , amountInCents: centavos } ) ;

      if( !res.success ) {
        setError( res.error || dict.saveError ) ;
        return ;
      }

      await recargar() ;
      setAviso( dict.contributionSaved ) ;
    } catch {
      setError( dict.saveError ) ;
    } finally {
      setGuardando( false ) ;
    }
  } ;

  // ── Vista del member: el modo en lectura, su proporción y su aporte ───────
  if( !esOwner ) {
    const yo = data.miembros[0] ;

    return(
      <section className={styles.panel}>
        <div>
          <h2 className={styles.title}>{dict.title}</h2>
          <p className={styles.subtitle}>{dict.subtitle}</p>
        </div>

        <FormError error={error} />
        {aviso && <p className={styles.notice} role="status">{aviso}</p>}

        <p className={styles.readRow}>
          <span className={styles.readLabel}>{dict.memberModeLabel}</span>
          <span className={styles.readValue}>{nombreDeModo( data.modo )}</span>
        </p>

        {( yo && (data.modo !== "none") ) && (
          <p className={styles.readRow}>
            <span className={styles.readValue}>{dict.memberShare.replace( "{porcentaje}" , porcentajeComoTexto( yo.porcentajeBp ) )}</span>
          </p>
        )}

        {( yo && data.partesIguales ) && <p className={styles.hint}>{dict.noContributions}</p>}

        {yo && (
          <form
            className={styles.contributionForm}
            onSubmit={ ( e ) => { e.preventDefault() ; void handleGuardarMiAporte( yo.userId ) ; } }
          >
            <FormInput
              label={dict.memberContribution.replace( "{mes}" , mes )}
              inputMode="decimal"
              value={aportes[yo.userId] ?? ""}
              onChange={ ( e ) => setAportes( ( previos ) => ( { ...previos , [yo.userId]: e.target.value } ) ) }
              error={aporteInvalido( yo.userId ) ? dict.contributionInvalid : undefined}
            />
            <Button type="submit" variant="secondary" isLoading={guardando} disabled={aporteInvalido( yo.userId ) || ( (aportes[yo.userId] ?? "").trim() === "" )}>
              {dict.memberSaveContribution}
            </Button>
          </form>
        )}
      </section>
    ) ;
  }

  // ── Vista del owner ───────────────────────────────────────────────────────
  return(
    <section className={styles.panel}>
      <div>
        <h2 className={styles.title}>{dict.title}</h2>
        <p className={styles.subtitle}>{dict.subtitle}</p>
      </div>

      <FormError error={error} />
      {aviso && <p className={styles.notice} role="status">{aviso}</p>}

      <FormSelect
        label={dict.templateLabel}
        value={plantilla}
        onChange={ ( e ) => aplicarPlantilla( e.target.value as Plantilla ) }
        helperText={dict.templateHint}
      >
        <option value="">{dict.templatePlaceholder}</option>
        <option value="familia">{dict.templateFamilia}</option>
        <option value="companeros">{dict.templateCompaneros}</option>
        <option value="trabajo">{dict.templateTrabajo}</option>
        <option value="personal">{dict.templatePersonal}</option>
      </FormSelect>

      <RadioGroup
        name="acuerdo-modo"
        label={dict.modeLegend}
        value={modo}
        onChange={ ( v ) => { setModo( v as ModoAcuerdo ) ; setAviso( "" ) ; } }
        options={ [
          { value: "none"                  , label: dict.modeNone } ,
          { value: "fixed_percentages"     , label: dict.modeFixed } ,
          { value: "monthly_contributions" , label: dict.modeMonthly } ,
        ] }
      />

      {modo === "fixed_percentages" && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>{dict.percentagesTitle}</h3>
          <ul className={styles.list}>
            {data.miembros.map( ( m ) => (
              <li key={m.userId} className={styles.row}>
                <FormInput
                  label={dict.percentageOf.replace( "{nombre}" , m.nombre )}
                  inputMode="decimal"
                  value={porcentajes[m.userId] ?? ""}
                  onChange={ ( e ) => setPorcentajes( ( previos ) => ( { ...previos , [m.userId]: e.target.value } ) ) }
                />
              </li>
            ) )}
          </ul>
          <p className={sumaOk ? styles.sumOk : styles.sumError} role="status">{mensajeSuma}</p>
        </div>
      )}

      {modo === "monthly_contributions" && (
        <div className={styles.block}>
          <h3 className={styles.blockTitle}>{dict.contributionsTitle.replace( "{mes}" , mes )}</h3>
          <p className={styles.hint}>{dict.contributionsHint}</p>
          <ul className={styles.list}>
            {data.miembros.map( ( m ) => (
              <li key={m.userId} className={styles.row}>
                <FormInput
                  label={dict.contributionOf.replace( "{nombre}" , m.nombre )}
                  inputMode="decimal"
                  value={aportes[m.userId] ?? ""}
                  onChange={ ( e ) => setAportes( ( previos ) => ( { ...previos , [m.userId]: e.target.value } ) ) }
                  error={aporteInvalido( m.userId ) ? dict.contributionInvalid : undefined}
                />
              </li>
            ) )}
          </ul>
        </div>
      )}

      <div className={styles.potBlock}>
        <Checkbox
          label={dict.commonPotLabel}
          description={hayMarcables ? undefined : dict.commonPotNoAccounts}
          checked={usaCajaEfectiva}
          disabled={!hayMarcables}
          onChange={ ( e ) => { setUsaCaja( e.target.checked ) ; setAviso( "" ) ; } }
        />

        {usaCajaEfectiva && (
          <fieldset className={styles.potAccounts}>
            <legend className={styles.potLegend}>{dict.commonPotAccounts}</legend>
            {data.cuentasMarcables.map( ( c ) => (
              <Checkbox
                key={c.id}
                label={dict.commonPotAccountOption.replace( "{nombre}" , c.nombre ).replace( "{divisa}" , c.divisa )}
                checked={cuentasCaja.includes( c.id )}
                onChange={ () => alternarCuenta( c.id ) }
              />
            ) )}
          </fieldset>
        )}
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="primary" disabled={!puedeGuardar} onClick={ () => setConfirmando( true ) }>
          {dict.save}
        </Button>
      </div>

      <Modal
        isOpen={confirmando}
        onClose={ () => setConfirmando( false ) }
        title={dict.confirmTitle}
        footer={
          <div className={styles.confirmActions}>
            <Button type="button" variant="secondary" onClick={ () => setConfirmando( false ) }>{dict.cancel}</Button>
            <Button type="button" variant="primary" isLoading={guardando} onClick={ () => void handleConfirmar() }>{dict.confirmAccept}</Button>
          </div>
        }
      >
        <p className={styles.confirmBody}>{dict.confirmBody}</p>
      </Modal>
    </section>
  ) ;
}
