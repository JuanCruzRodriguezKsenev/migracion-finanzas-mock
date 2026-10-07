/**
 * @file TransactionFormModal.tsx
 * Modal interactivo para el registro de transacciones con soporte de doble partida asistida.
 */
"use client" ;

// Librerías externas
import React , { useState , useMemo , useTransition } from "react" ;

// Shared
import { FormActions } from "@/shared/ui/forms/Form/FormActions" ;
import { FormSelect }  from "@/shared/ui/forms/Form/FormSelect" ;
import { FormInput }   from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }   from "@/shared/ui/forms/Form/FormError" ;
import { Button }      from "@/shared/ui/display/Button/Button" ;
import { Modal }       from "@/shared/ui/feedback/Modal/Modal" ;

// Feature: Accounting
import { CategoryTreeNode }     from "@/features/accounting/types" ;
import { createCategoryAction } from "@/features/accounting/actions/categoryActions" ;
import { iconoDeCategoria }     from "@/features/accounting/utils/categoryIcons" ;
import { Account , Category }   from "@/features/accounting/types" ;

// Feature: Auth
import type { TitularPosible } from "@/features/auth/services/titularService" ;

// Feature: Transactions
import { createTransactionFromFormAction } from "../actions/transactionsActions" ;
import { TransactionType }                 from "../utils/derivarTipo" ;
import styles                              from "./Transactions.module.css" ;


interface TransactionFormModalProps {
  isOpen:        boolean ;
  onClose:       () => void ;
  onSuccess:     () => void ;
  accounts:      Account[] ;
  categories?:   Category[] ;
  categoryTree?: CategoryTreeNode[] ;
  /** A nombre de quiénes puede cargar quien abre el modal, con uno mismo primero (RN-2, RN-5, RN-6). */
  titulares?:    TitularPosible[] ;
  holderDict?:   { holderSelectLabel: string ; holderSelfOption: string } ;
}

/**
 * Reconstruye la estructura arbórea cuando sólo se dispone de una lista plana de categorías.
 */
function buildTreeFromFlatCategories( flat: Category[] ): CategoryTreeNode[] {
  const parents:     CategoryTreeNode[]        = [] ;
  const childrenMap: Map< string , Category[] > = new Map() ;

  for( const cat of flat ) {
    if( !cat.parentId ) {
      parents.push( { ...cat , children: [] } ) ;
    } else {
      const list = ( childrenMap.get( cat.parentId ) || [] ) ;
      list.push( cat ) ;
      childrenMap.set( cat.parentId , list ) ;
    }
  }

  for( const p of parents ) {
    p.children = ( childrenMap.get( p.id ) || [] ) ;
  }

  return( parents ) ;
}

export function TransactionFormModal( {
  isOpen ,
  onClose ,
  onSuccess ,
  accounts ,
  categories ,
  categoryTree ,
  titulares = [] ,
  holderDict ,
}: TransactionFormModalProps ) {
  const [ isPending , startTransition ]                           = useTransition() ;
  const [ isQuickCategoryPending , startQuickCategoryTransition ] = useTransition() ;

  const todayStr = new Date().toISOString().slice( 0 , 10 ) ;

  const [ type , setType ]                                 = useState< TransactionType >( "expense" ) ;
  const [ description , setDescription ]                   = useState( "" ) ;
  const [ amount , setAmount ]                             = useState( "" ) ;
  const [ currency , setCurrency ]                         = useState( "ARS" ) ;
  const [ sourceAccountId , setSourceAccountId ]           = useState( "" ) ;
  const [ destinationAccountId , setDestinationAccountId ] = useState( "" ) ;
  const [ destinationAmount , setDestinationAmount ]       = useState( "" ) ;
  const [ categoryId , setCategoryId ]                     = useState( "" ) ;
  const [ merchantName , setMerchantName ]                 = useState( "" ) ;
  const [ occurredAt , setOccurredAt ]                     = useState( todayStr ) ;
  const [ holderUserId , setHolderUserId ]                 = useState( "" ) ;
  const [ errorMessage , setErrorMessage ]                 = useState( "" ) ;

  // Estado para creación de categorías al vuelo (Paso 3)
  const [ isCreatingCategory , setIsCreatingCategory ]       = useState( false ) ;
  const [ quickCategoryName , setQuickCategoryName ]         = useState( "" ) ;
  const [ quickCategoryParentId , setQuickCategoryParentId ] = useState( "" ) ;
  const [ quickCategoryIcon , setQuickCategoryIcon ]         = useState( "" ) ;
  const [ quickCategoryColor , setQuickCategoryColor ]       = useState( "" ) ;
  const [ quickCategoryError , setQuickCategoryError ]       = useState( "" ) ;

  const baseTree = useMemo( () => {
    return( (categoryTree && (categoryTree.length > 0))
      ? categoryTree
      : ( categories ? buildTreeFromFlatCategories( categories ) : [] ) ) ;
  } , [ categoryTree , categories ] ) ;

  const [ customTree , setCustomTree ] = useState< CategoryTreeNode[] | null >( null ) ;
  const tree = ( customTree ?? baseTree ) ;

  // Filtrar cuentas de pago/cobro (Activos y Pasivos como tarjetas)
  const liquidityAccounts = accounts.filter( ( a ) => ( (a.type === "asset") || (a.type === "liability") ) ) ;

  // La moneda no se elige: es la de la cuenta. Un selector libre permitía cargar un movimiento en
  // dólares contra una caja en pesos, y el saldo terminaba mezclando centavos de dos divisas.
  const monedaDestino = ( accounts.find( ( a ) => a.id === destinationAccountId )?.currency || "" ) ;

  const handleReset = () => {
    setDescription( "" ) ;
    setAmount( "" ) ;
    setCurrency( "ARS" ) ;
    setSourceAccountId( "" ) ;
    setDestinationAccountId( "" ) ;
    setDestinationAmount( "" ) ;
    setCategoryId( "" ) ;
    setMerchantName( "" ) ;
    setOccurredAt( todayStr ) ;
    setHolderUserId( "" ) ;
    setErrorMessage( "" ) ;
    setType( "expense" ) ;
    setIsCreatingCategory( false ) ;
    setQuickCategoryName( "" ) ;
    setQuickCategoryParentId( "" ) ;
    setQuickCategoryIcon( "" ) ;
    setQuickCategoryColor( "" ) ;
    setQuickCategoryError( "" ) ;
    setCustomTree( null ) ;
  } ;

  const handleSourceAccountChange = ( id: string ) => {
    setSourceAccountId( id ) ;
    const acc = accounts.find( ( a ) => a.id === id ) ;
    if( acc?.currency ) {
      setCurrency( acc.currency ) ;
    }
  } ;

  const handleCreateQuickCategory = () => {
    if( !quickCategoryName.trim() ) {
      setQuickCategoryError( "Ingresá un nombre para la categoría." ) ;
      return ;
    }

    startQuickCategoryTransition( async () => {
      const res = await createCategoryAction( {
        name:     quickCategoryName.trim() ,
        type:     ( (type === "income") ? "revenue" : "expense" ) ,
        parentId: ( quickCategoryParentId ? quickCategoryParentId : undefined ) ,
        icon:     ( quickCategoryIcon.trim() || undefined ) ,
        color:    ( quickCategoryColor.trim() || undefined ) ,
      } ) ;

      if( !res.success ) {
        setQuickCategoryError( res.error ) ;
        return ;
      }

      const created = res.value ;

      setCustomTree( ( prevTree ) => {
        const current = ( prevTree ?? baseTree ) ;
        if( created.parentId ) {
          return( current.map( ( p ) => {
            if( p.id === created.parentId ) {
              return( {
                ...p ,
                children: [ ...p.children , created ] ,
              } ) ;
            }
            return( p ) ;
          } ) ) ;
        } else {
          return( [ ...current , { ...created , children: [] } ] ) ;
        }
      } ) ;

      setCategoryId( created.id ) ;
      setIsCreatingCategory( false ) ;
      setQuickCategoryName( "" ) ;
      setQuickCategoryParentId( "" ) ;
      setQuickCategoryIcon( "" ) ;
      setQuickCategoryColor( "" ) ;
      setQuickCategoryError( "" ) ;
    } ) ;
  } ;

  const handleSubmit = ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setErrorMessage( "" ) ;

    const parsedAmount = parseFloat( amount ) ;
    if( isNaN( parsedAmount ) || (parsedAmount <= 0) ) {
      setErrorMessage( "Ingresá un monto válido mayor a 0." ) ;
      return ;
    }

    if( !sourceAccountId ) {
      setErrorMessage( "Seleccioná una cuenta." ) ;
      return ;
    }

    const necesitaDestino = ( (type === "transfer") || (type === "exchange") ) ;

    if( necesitaDestino && !destinationAccountId ) {
      setErrorMessage( "Seleccioná la cuenta de destino." ) ;
      return ;
    }

    if( necesitaDestino && (sourceAccountId === destinationAccountId) ) {
      setErrorMessage( "La cuenta de origen y destino deben ser distintas." ) ;
      return ;
    }

    const parsedDestino = parseFloat( destinationAmount ) ;

    if( type === "exchange" ) {
      if( isNaN( parsedDestino ) || (parsedDestino <= 0) ) {
        setErrorMessage( "Ingresá cuánto recibís en la moneda de destino." ) ;
        return ;
      }

      if( monedaDestino === currency ) {
        setErrorMessage( `Ambas cuentas operan en ${currency}. Para mover dinero entre cuentas de la misma moneda usá una transferencia.` ) ;
        return ;
      }
    }

    if( (type === "transfer") && monedaDestino && (monedaDestino !== currency) ) {
      setErrorMessage( `No se puede transferir de ${currency} a ${monedaDestino}. Usá un cambio de moneda.` ) ;
      return ;
    }

    startTransition( async () => {
      const res = await createTransactionFromFormAction( {
        description ,
        type ,
        amount:               parsedAmount ,
        currency ,
        sourceAccountId ,
        destinationAccountId: necesitaDestino ? destinationAccountId : undefined ,
        destinationAmount:    (type === "exchange") ? parsedDestino : undefined ,
        categoryId:           categoryId || null ,
        merchantName:         merchantName || null ,
        occurredAt:           new Date( occurredAt ) ,
        holderUserId:         ( holderUserId && (holderUserId !== propio?.userId) ) ? holderUserId : undefined ,
      } ) ;

      if( !res.success ) {
        setErrorMessage( res.error ) ;
        return ;
      }

      handleReset() ;
      onSuccess() ;
      onClose() ;
    } ) ;
  } ;

  // El primero de la lista es uno mismo: el selector sólo aparece si hay a nombre de quién más cargar.
  const propio           = titulares[0] ;
  const mostrarTitulares = ( (titulares.length > 1) && !!holderDict ) ;

  const targetCategoryType = ( (type === "income") ? "revenue" : "expense" ) ;
  const currentTypeTree    = tree.filter( ( p ) => ( (p.type === targetCategoryType) && (!p.isSystemLeaf) ) ) ;

  return(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nueva Transacción"
      subtitle="Registrá un movimiento contable en el libro diario"
      size="medium"
    >
      <form onSubmit={handleSubmit} className={styles.modalForm}>
        {/* Selector de tipo */}
        <div className={styles.typeTabs}>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "expense" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => {
              setType( "expense" ) ;
              setCategoryId( "" ) ;
            } }
          >
            Gasto
          </button>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "income" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => {
              setType( "income" ) ;
              setCategoryId( "" ) ;
            } }
          >
            Ingreso
          </button>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "transfer" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => setType( "transfer" ) }
          >
            Transferencia
          </button>
          <button
            type="button"
            className={ `${styles.typeTabBtn} ${type === "exchange" ? styles.typeTabBtnActive : ""}` }
            onClick={ () => setType( "exchange" ) }
          >
            Cambio
          </button>
        </div>

        {errorMessage && <FormError error={errorMessage} />}

        <div className={styles.amountCurrencyRow}>
          <FormInput
            label="Monto"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={ ( e ) => setAmount( e.target.value ) }
            required
          />
          <FormInput
            label="Moneda"
            value={currency}
            readOnly
            title="La moneda la determina la cuenta de origen"
            onChange={ () => {} }
          />
        </div>

        {( mostrarTitulares && holderDict ) && (
          <FormSelect
            label={holderDict.holderSelectLabel}
            value={holderUserId || propio.userId}
            onChange={ ( e ) => setHolderUserId( e.target.value ) }
          >
            {titulares.map( ( t , i ) => (
              <option key={t.userId} value={t.userId}>
                {(i === 0) ? holderDict.holderSelfOption.replace( "{nombre}" , t.nombre ) : t.nombre}
              </option>
            ) )}
          </FormSelect>
        )}

        <FormInput
          label="Descripción"
          placeholder="Ej: Compra supermercado, Sueldo mensual..."
          value={description}
          onChange={ ( e ) => setDescription( e.target.value ) }
          required
        />

        <FormInput
          label="Fecha del movimiento"
          type="date"
          value={occurredAt}
          onChange={ ( e ) => setOccurredAt( e.target.value ) }
          required
        />

        <FormSelect
          label={ (type === "income") ? "Cuenta de depósito" : "Cuenta de pago / origen" }
          value={sourceAccountId}
          onChange={ ( e ) => handleSourceAccountChange( e.target.value ) }
          required
        >
          <option value="">Seleccionar cuenta...</option>
          {liquidityAccounts.map( ( a ) => (
            <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
          ) )}
        </FormSelect>

        {( (type === "transfer") || (type === "exchange") ) && (
          <FormSelect
            label={ (type === "exchange") ? "Cuenta de destino (otra moneda)" : "Cuenta de destino" }
            value={destinationAccountId}
            onChange={ ( e ) => setDestinationAccountId( e.target.value ) }
            required
          >
            <option value="">Seleccionar cuenta de destino...</option>
            {liquidityAccounts
              .filter( ( a ) => ( (type !== "exchange") || !currency || (a.currency !== currency) ) )
              .map( ( a ) => (
                <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>
              ) )}
          </FormSelect>
        )}

        {type === "exchange" && (
          <FormInput
            label={ monedaDestino ? `Importe recibido en ${monedaDestino}` : "Importe recibido" }
            type="number"
            step="0.01"
            placeholder="0.00"
            value={destinationAmount}
            onChange={ ( e ) => setDestinationAmount( e.target.value ) }
            required
          />
        )}

        {( (type !== "transfer") && (type !== "exchange") ) && (
          <>
            <FormSelect
              label="Categoría"
              value={categoryId}
              onChange={ ( e ) => {
                if( e.target.value === "__NEW_CATEGORY__" ) {
                  setIsCreatingCategory( true ) ;
                  setQuickCategoryError( "" ) ;
                } else {
                  setCategoryId( e.target.value ) ;
                }
              } }
            >
              <option value="">Sin detallar</option>
              {currentTypeTree.map( ( parent ) => {
                const visibleChildren = parent.children.filter( ( c ) => !c.isSystemLeaf ) ;
                return(
                  <optgroup
                    key={parent.id}
                    label={ `${iconoDeCategoria( parent.icon )} ${parent.name}` }
                  >
                    {visibleChildren.length > 0 ? (
                      visibleChildren.map( ( child ) => (
                        <option key={child.id} value={child.id}>
                          {iconoDeCategoria( child.icon )} {child.name}
                        </option>
                      ) )
                    ) : (
                      <option value={parent.id}>
                        {iconoDeCategoria( parent.icon )} {parent.name}
                      </option>
                    )}
                  </optgroup>
                ) ;
              } )}
              <option value="__NEW_CATEGORY__">＋ Crear categoría nueva</option>
            </FormSelect>

            {isCreatingCategory && (
              <div className={styles.quickCategoryBox}>
                <h4 className={styles.quickCategoryTitle}>
                  Nueva categoría de { (type === "income") ? "ingresos" : "gastos" }
                </h4>

                {quickCategoryError && <FormError error={quickCategoryError} />}

                <FormInput
                  label="Nombre"
                  placeholder="Ej: Cursos, Mascotas, Software..."
                  value={quickCategoryName}
                  onChange={ ( e ) => setQuickCategoryName( e.target.value ) }
                  required
                />

                <FormSelect
                  label="Va dentro de"
                  value={quickCategoryParentId}
                  onChange={ ( e ) => setQuickCategoryParentId( e.target.value ) }
                >
                  <option value="">Que sea una categoría principal</option>
                  {currentTypeTree.map( ( p ) => (
                    <option key={p.id} value={p.id}>
                      {iconoDeCategoria( p.icon )} {p.name}
                    </option>
                  ) )}
                </FormSelect>

                <div className={styles.quickCategoryGrid}>
                  <FormInput
                    label="Ícono (opcional)"
                    placeholder="Ej: 📚 o book"
                    value={quickCategoryIcon}
                    onChange={ ( e ) => setQuickCategoryIcon( e.target.value ) }
                  />
                  <FormInput
                    label="Color (hex opcional)"
                    placeholder="#3498db"
                    value={quickCategoryColor}
                    onChange={ ( e ) => setQuickCategoryColor( e.target.value ) }
                  />
                </div>

                <div className={styles.quickCategoryActions}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={ () => {
                      setIsCreatingCategory( false ) ;
                      setQuickCategoryError( "" ) ;
                    } }
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    isLoading={isQuickCategoryPending}
                    onClick={handleCreateQuickCategory}
                  >
                    Guardar categoría
                  </Button>
                </div>
              </div>
            )}

            <FormInput
              label="Comercio o Entidad (opcional)"
              placeholder="Ej: Coto, Netflix, Spotify..."
              value={merchantName}
              onChange={ ( e ) => setMerchantName( e.target.value ) }
            />
          </>
        )}

        <FormActions
          onCancel={onClose}
          cancelLabel="Cancelar"
          submitLabel="Guardar Transacción"
          submitting={isPending}
        />
      </form>
    </Modal>
  ) ;
}
