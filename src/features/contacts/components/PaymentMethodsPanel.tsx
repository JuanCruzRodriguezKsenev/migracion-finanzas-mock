/**
 * @file PaymentMethodsPanel.tsx
 * Panel interactivo para la visualización, copia y administración de métodos de cobro de un contacto.
 * Integra validadores puros, InstitutionLogo y CreateFinancialEntityForm para altas al vuelo.
 */
"use client" ;

// Librerías externas
import React , { useState , useTransition } from "react" ;

// Shared
import type { getDictionary } from "@/shared/lib/dictionary" ;
import { usePuedeEscribir }   from "@/shared/providers/PermissionsProvider" ;
import { InstitutionLogo }    from "@/shared/ui/display/InstitutionLogo/InstitutionLogo" ;
import { Modal }              from "@/shared/ui/feedback/Modal/Modal" ;
import { Button }             from "@/shared/ui/display/Button/Button" ;

// Feature: Accounting
import { CreateFinancialEntityForm } from "@/features/accounting/components/CreateFinancialEntityForm" ;
import { FinancialEntity }           from "@/features/accounting/types" ;

// Feature: Contacts
import {
  addPaymentMethodAction ,
  deletePaymentMethodAction ,
  setDefaultPaymentMethodAction
} from "../actions/contactsActions" ;
import {
  validarCbu ,
  validarAlias ,
  validarCuit ,
  normalizarCbu ,
  normalizarAlias ,
  normalizarCuit
} from "../utils/identificadores" ;
import { ContactWithPaymentMethods } from "../types" ;
import styles                        from "./Contacts.module.css" ;


interface PaymentMethodsPanelProps {
  isOpen:             boolean ;
  onClose:            () => void ;
  contact:            ContactWithPaymentMethods | null ;
  financialEntities:  FinancialEntity[] ;
  onRefresh:          () => void ;
  dict?: {
    panelAccountsTitle?:    string ;
    panelAccountsSubtitle?: string ;
    btnAddAccount?:         string ;
    fieldEntity?:           string ;
    fieldType?:             string ;
    typeBank?:              string ;
    typeWallet?:            string ;
    fieldCbu?:              string ;
    fieldAlias?:            string ;
    fieldHolderName?:       string ;
    fieldHolderTaxId?:      string ;
    fieldDefault?:          string ;
    badgeDefault?:          string ;
    btnSetDefault?:         string ;
    btnDelete?:             string ;
    btnNewEntity?:          string ;
    accountsPage?:          Awaited< ReturnType< typeof getDictionary > >["accountsPage"] ;
  } ;
}

export function PaymentMethodsPanel( {
  isOpen ,
  onClose ,
  contact ,
  financialEntities ,
  onRefresh ,
  dict ,
}: PaymentMethodsPanelProps ) {
  const puedeEscribir                               = usePuedeEscribir() ;
  const [ isEntityModalOpen , setIsEntityModalOpen ] = useState( false ) ;
  const [ isPending , startTransition ]               = useTransition() ;

  // Estado del formulario de alta
  const [ selectedEntityId , setSelectedEntityId ] = useState( "" ) ;
  const [ type , setType ]                         = useState< "wallet" | "bank_account" >( "wallet" ) ;
  const [ cbuCvu , setCbuCvu ]                     = useState( "" ) ;
  const [ alias , setAlias ]                       = useState( "" ) ;
  const [ holderName , setHolderName ]             = useState( "" ) ;
  const [ holderTaxId , setHolderTaxId ]           = useState( "" ) ;
  const [ isDefault , setIsDefault ]               = useState( false ) ;

  const [ formError , setFormError ]   = useState< string | null >( null ) ;
  const [ copiedKey , setCopiedKey ]   = useState< string | null >( null ) ;

  if( !contact ) {
    return( null ) ;
  }

  const handleCopy = ( key: string , text: string ) => {
    navigator.clipboard.writeText( text ) ;
    setCopiedKey( key ) ;
    setTimeout( () => setCopiedKey( null ) , 1800 ) ;
  } ;

  const handleSetDefault = ( methodId: string ) => {
    startTransition( async() => {
      const res = await setDefaultPaymentMethodAction( methodId ) ;
      if( res.success ) {
        onRefresh() ;
      } else {
        setFormError( res.error ) ;
      }
    } ) ;
  } ;

  const handleDeleteMethod = ( methodId: string ) => {
    if( !confirm( "¿Estás seguro de eliminar este método de cobro?" ) ) {
      return ;
    }

    startTransition( async() => {
      const res = await deletePaymentMethodAction( methodId ) ;
      if( res.success ) {
        onRefresh() ;
      } else {
        setFormError( res.error ) ;
      }
    } ) ;
  } ;

  const handleAddMethod = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setFormError( null ) ;

    if( !selectedEntityId ) {
      setFormError( "Debes seleccionar una entidad financiera." ) ;
      return ;
    }

    const cbuLimpio   = normalizarCbu( cbuCvu ) ;
    const aliasLimpio = normalizarAlias( alias ) ;
    const cuitLimpio  = normalizarCuit( holderTaxId ) ;

    if( !cbuLimpio && !aliasLimpio ) {
      setFormError( "Debes ingresar al menos un CBU/CVU o un Alias." ) ;
      return ;
    }

    if( cbuLimpio && !validarCbu( cbuLimpio ) ) {
      setFormError( "El CBU/CVU ingresado es inválido según los dígitos verificadores del BCRA." ) ;
      return ;
    }

    if( aliasLimpio && !validarAlias( aliasLimpio ) ) {
      setFormError( "El Alias debe tener entre 6 y 20 caracteres alfanuméricos, puntos o guiones." ) ;
      return ;
    }

    if( cuitLimpio && !validarCuit( cuitLimpio ) ) {
      setFormError( "El CUIT/CUIL del titular es inválido (módulo 11 de AFIP)." ) ;
      return ;
    }

    startTransition( async() => {
      const res = await addPaymentMethodAction( contact.id , {
        financialEntityId: selectedEntityId ,
        type ,
        cbuCvu:      cbuLimpio || undefined ,
        alias:       aliasLimpio || undefined ,
        holderName:  holderName.trim() || undefined ,
        holderTaxId: cuitLimpio || undefined ,
        isDefault ,
      } ) ;

      if( res.success ) {
        // Reset form
        setSelectedEntityId( "" ) ;
        setCbuCvu( "" ) ;
        setAlias( "" ) ;
        setHolderName( "" ) ;
        setHolderTaxId( "" ) ;
        setIsDefault( false ) ;
        setFormError( null ) ;
        onRefresh() ;
      } else {
        setFormError( res.error ) ;
      }
    } ) ;
  } ;

  return(
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={ `${dict?.panelAccountsTitle || "Cuentas de Cobro"} — ${contact.name}` }
        subtitle={ `${dict?.panelAccountsSubtitle || "Cuentas bancarias y billeteras de"} ${contact.name}` }
      >
        <div className={styles.panelContainer}>
          {formError && <div className={styles.errorBanner}>{formError}</div>}

          {/* Listado de cuentas registradas */}
          <div className={styles.methodsList}>
            {(!contact.paymentMethods || ( contact.paymentMethods.length === 0 )) ? (
              <div className={styles.emptyMessage}>
                Este contacto aún no tiene métodos de cobro registrados.
              </div>
            ) : (
              contact.paymentMethods.map( ( pm ) => (
                <div
                  key={pm.id}
                  className={ pm.isDefault ? `${styles.methodCard} ${styles.methodCardDefault}` : styles.methodCard }
                >
                  <div className={styles.methodLeft}>
                    <InstitutionLogo
                      institution={pm.financialEntity?.name || "Entidad"}
                      brandDomain={pm.financialEntity?.brandDomain}
                      size={28}
                    />
                    <div className={styles.methodMeta}>
                      <div className={styles.methodHeader}>
                        <span className={styles.methodEntityName}>{pm.financialEntity?.name}</span>
                        {pm.isDefault && (
                          <span className={styles.defaultTag}>
                            {dict?.badgeDefault || "Predeterminada"}
                          </span>
                        )}
                      </div>

                      <div className={styles.methodDataRow}>
                        {pm.alias && (
                          <span>
                            Alias: <span className={styles.dataValue}>{pm.alias}</span>
                            <button
                              type="button"
                              className={ ( copiedKey === `alias-${pm.id}` ) ? `${styles.copyButton} ${styles.copySuccess}` : styles.copyButton }
                              onClick={ () => handleCopy( `alias-${pm.id}` , pm.alias! ) }
                            >
                              {( copiedKey === `alias-${pm.id}` ) ? "¡Copiado!" : "Copiar"}
                            </button>
                          </span>
                        )}

                        {pm.cbuCvu && (
                          <span>
                            CBU: <span className={styles.dataValue}>{pm.cbuCvu}</span>
                            <button
                              type="button"
                              className={ ( copiedKey === `cbu-${pm.id}` ) ? `${styles.copyButton} ${styles.copySuccess}` : styles.copyButton }
                              onClick={ () => handleCopy( `cbu-${pm.id}` , pm.cbuCvu! ) }
                            >
                              {( copiedKey === `cbu-${pm.id}` ) ? "¡Copiado!" : "Copiar"}
                            </button>
                          </span>
                        )}
                      </div>

                      {( pm.holderName || pm.holderTaxId ) && (
                        <span className={styles.methodHolder}>
                          Titular: {pm.holderName || "—"} {pm.holderTaxId ? `(CUIT: ${pm.holderTaxId})` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {puedeEscribir && (
                    <div className={styles.methodActions}>
                      {!pm.isDefault && (
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={ () => handleSetDefault( pm.id ) }
                          disabled={isPending}
                        >
                          {dict?.btnSetDefault || "Hacer default"}
                        </button>
                      )}
                      <button
                        type="button"
                        className={ `${styles.actionBtn} ${styles.actionBtnDanger}` }
                        onClick={ () => handleDeleteMethod( pm.id ) }
                        disabled={isPending}
                      >
                        {dict?.btnDelete || "Eliminar"}
                      </button>
                    </div>
                  )}
                </div>
              ) )
            )}
          </div>

          {/* Formulario para agregar nuevo método */}
          {puedeEscribir && (
            <form onSubmit={handleAddMethod} className={styles.addMethodSection}>
              <div className={styles.sectionHeader}>
                <h4 className={styles.sectionTitle}>
                  {dict?.btnAddAccount || "Agregar Cuenta de Cobro"}
                </h4>
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={ () => setIsEntityModalOpen( true ) }
                >
                  {dict?.btnNewEntity || "+ Nueva Entidad..."}
                </button>
              </div>

              <div className={styles.formGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {dict?.fieldEntity || "Entidad Financiera"} *
                  </label>
                  <select
                    className={styles.formSelect}
                    value={selectedEntityId}
                    onChange={ ( e ) => setSelectedEntityId( e.target.value ) }
                    required
                  >
                    <option value="">Seleccionar entidad...</option>
                    {financialEntities.map( ( fe ) => (
                      <option key={fe.id} value={fe.id}>
                        {fe.name}
                      </option>
                    ) )}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {dict?.fieldType || "Tipo de Cuenta"}
                  </label>
                  <select
                    className={styles.formSelect}
                    value={type}
                    onChange={ ( e ) => setType( e.target.value as "wallet" | "bank_account" ) }
                  >
                    <option value="wallet">{dict?.typeWallet || "Billetera Virtual"}</option>
                    <option value="bank_account">{dict?.typeBank || "Cuenta Bancaria"}</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {dict?.fieldCbu || "CBU / CVU"} (22 dígitos)
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={cbuCvu}
                    onChange={ ( e ) => setCbuCvu( e.target.value ) }
                    placeholder="0110002040000000000015"
                    maxLength={26}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {dict?.fieldAlias || "Alias"} (6 a 20 caracteres)
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={alias}
                    onChange={ ( e ) => setAlias( e.target.value ) }
                    placeholder="ejemplo.mp"
                    maxLength={20}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {dict?.fieldHolderName || "Titular"}
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={holderName}
                    onChange={ ( e ) => setHolderName( e.target.value ) }
                    placeholder="Nombre del titular"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>
                    {dict?.fieldHolderTaxId || "CUIT / CUIL"}
                  </label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={holderTaxId}
                    onChange={ ( e ) => setHolderTaxId( e.target.value ) }
                    placeholder="20-12345678-9"
                  />
                </div>
              </div>

              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={ ( e ) => setIsDefault( e.target.checked ) }
                />
                <span>{dict?.fieldDefault || "Marcar como cuenta predeterminada para este contacto"}</span>
              </label>

              <div className={styles.modalActions}>
                <Button type="submit" variant="primary" disabled={isPending}>
                  {isPending ? "Guardando..." : ( dict?.btnAddAccount || "Agregar Cuenta" )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Modal secundario para dar de alta entidad financiera al vuelo */}
      <Modal
        isOpen={isEntityModalOpen}
        onClose={ () => setIsEntityModalOpen( false ) }
        title="Registrar Entidad Financiera"
        subtitle="Agrega una nueva entidad financiera para vincular cuentas de cobro."
      >
        {dict?.accountsPage && (
          <CreateFinancialEntityForm
            dict={dict.accountsPage}
            onSuccess={ () => {
              setIsEntityModalOpen( false ) ;
              onRefresh() ;
            } }
          />
        )}
      </Modal>
    </>
  ) ;
}
