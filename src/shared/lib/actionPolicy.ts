/**
 * @file actionPolicy.ts
 * Registro fail-closed de las exportaciones de cada archivo de acciones de servidor (RN-21 a RN-25).
 *
 * Cada exportación de cada `actions/*.ts` aparece una vez, como `"lectura"`, `"escritura"` o `{ exenta }` con
 * su motivo. `actionPolicy.test.ts` compara este registro con las exportaciones reales: una acción nueva sin
 * clasificar, o un archivo de acciones nuevo, rompe la compuerta. Las `"escritura"` tienen que pasar por
 * `obtenerSesionDeEscritura()` (un `viewer` no escribe); el test de efecto lo comprueba contra la base.
 */

/** Cómo trata la guarda de escritura a una exportación. */
export type PoliticaDeAccion = "lectura" | "escritura" | { exenta: string } ;

/** Claves: ruta del archivo bajo `src/features/` sin extensión. Valores: exportación → política. */
export const POLITICA_DE_ACCIONES: Record< string , Record< string , PoliticaDeAccion > > = {
  "accounting/actions/accountingActions": {
    getAccountsAction:                     "lectura" ,
    createAccountAction:                   "escritura" ,
    createFinancialEntityAction:           "escritura" ,
    getFinancialEntitiesAction:            "lectura" ,
    createLedgerTransactionAction:         "escritura" ,
    deleteLedgerTransactionAction:         "escritura" ,
    getTransactionsAction:                 "lectura" ,
    getTransactionsPageAction:             "lectura" ,
    updateLedgerTransactionMetadataAction: "escritura" ,
    reverseLedgerTransactionAction:        "escritura" ,
    getMonthlySummariesAction:             "lectura" ,
    getEarliestMonthKeyAction:             "lectura" ,
    rellenarResumenesMensualesAction:      { exenta: "RN-25: dato derivado que dispara el dashboard" } ,
  } ,
  "accounting/actions/categoryActions": {
    createCategoryAction:            "escritura" ,
    updateCategoryAction:            "escritura" ,
    archiveCategoryAction:           "escritura" ,
    unarchiveCategoryAction:         "escritura" ,
    getCategoryTreeAction:           "lectura" ,
    getCategoryMovementsCountAction: "lectura" ,
  } ,
  "accounting/actions/cuentasPersonalesActions": {
    crearCuentaPersonalAction:                "escritura" ,
    compartirCuentaAction:                    { exenta: "su permiso lo decide la organización destino (puedeEscribirEn, plan 23), no la activa" } ,
    dejarDeCompartirAction:                   { exenta: "su permiso lo decide la organización destino (puedeEscribirEn, plan 23), no la activa" } ,
    obtenerMisCuentasAction:                  "lectura" ,
    obtenerCuentasDeListadoAction:            "lectura" ,
    obtenerCuentasParaMovimientoAction:       "lectura" ,
    listarOrganizacionesParaCompartirAction:  "lectura" ,
  } ,
  "budgets/actions/budgetsActions": {
    getBudgetsAction:         "lectura" ,
    createBudgetAction:       "escritura" ,
    updateBudgetLimitAction:  "escritura" ,
    deleteBudgetAction:       "escritura" ,
  } ,
  "cards/actions/cardsActions": {
    createCardAction:  "escritura" ,
    getCardsAction:    "lectura" ,
    archiveCardAction: "escritura" ,
  } ,
  "cards/actions/installmentPlansActions": {
    createInstallmentPlanAction:  "escritura" ,
    resolveInstallmentAction:     "escritura" ,
    archiveInstallmentPlanAction: "escritura" ,
    getInstallmentPlansAction:    "lectura" ,
  } ,
  "contacts/actions/contactsActions": {
    getContactsAction:             "lectura" ,
    getContactByIdAction:          "lectura" ,
    createContactAction:           "escritura" ,
    updateContactAction:           "escritura" ,
    archiveContactAction:          "escritura" ,
    unarchiveContactAction:        "escritura" ,
    addPaymentMethodAction:        "escritura" ,
    deletePaymentMethodAction:     "escritura" ,
    setDefaultPaymentMethodAction: "escritura" ,
  } ,
  "goals/actions/goalsActions": {
    getGoalsAction:             "lectura" ,
    getReservedByAccountAction: "lectura" ,
    createGoalAction:           "escritura" ,
    updateGoalAction:           "escritura" ,
    contributeToGoalAction:     "escritura" ,
    withdrawFromGoalAction:     "escritura" ,
    abandonGoalAction:          "escritura" ,
  } ,
  "loans/actions/loansActions": {
    createLoanAction:           "escritura" ,
    payLoanInstallmentAction:   "escritura" ,
    getLoansAction:             "lectura" ,
    archiveLoanAction:          "escritura" ,
  } ,
  "notifications/actions/notificationsActions": {
    listarNotificacionesAction: "lectura" ,
    marcarLeidasAction:         { exenta: "estado de lectura de sus propios avisos (RN-22)" } ,
  } ,
  "organizations/actions/habilitacionesActions": {
    otorgarHabilitacionAction:     "escritura" ,
    revocarHabilitacionAction:     "escritura" ,
    listarHabilitacionesAction:    "lectura" ,
    listarTitularesPosiblesAction: "lectura" ,
  } ,
  "organizations/actions/membersActions": {
    listarMiembrosAction:       "lectura" ,
    invitarMiembroAction:       { exenta: "exige owner (exigirOwner), que implica poder escribir" } ,
    revocarInvitacionAction:    { exenta: "exige owner (exigirOwner), que implica poder escribir" } ,
    quitarMiembroAction:        { exenta: "exige owner (exigirOwner), que implica poder escribir" } ,
    cambiarRolAction:           { exenta: "exige owner (exigirOwner), que implica poder escribir" } ,
  } ,
  "organizations/actions/organizationActions": {
    listarOrganizacionesAction:   "lectura" ,
    crearOrganizacionAction:      { exenta: "acción del usuario, no de la organización activa" } ,
    renombrarOrganizacionAction:  { exenta: "exige owner (exigirOwner), que implica poder escribir" } ,
    abandonarOrganizacionAction:  { exenta: "acción del usuario, no de la organización activa" } ,
    eliminarOrganizacionAction:   { exenta: "exige owner (exigirOwner), que implica poder escribir" } ,
  } ,
  "profile/actions/profileActions": {
    updateProfileAction: { exenta: "RN-22: es su propio perfil, no la organización" } ,
  } ,
  "reports/actions/reportsActions": {
    getReportsAction: "lectura" ,
  } ,
  "splits/actions/acuerdoActions": {
    obtenerAcuerdoAction:       "lectura" ,
    guardarAcuerdoAction:       "escritura" ,
    declararAporteAction:       "escritura" ,
    previsualizarRepartoAction: "lectura" ,
  } ,
  "splits/actions/cajaActions": {
    obtenerCajaAction:          "lectura" ,
    registrarAporteCajaAction:  "escritura" ,
  } ,
  "splits/actions/reclamosActions": {
    reclamarPagoAction:     { exenta: "RN-40: la organización sale del aviso y revalida rol ≠ viewer en DB (plan 44)" } ,
    confirmarReclamoAction: { exenta: "RN-40: la organización sale del reclamo y revalida rol ≠ viewer en DB (plan 44)" } ,
    rechazarReclamoAction:  { exenta: "RN-40: la organización sale del reclamo y revalida rol ≠ viewer en DB (plan 44)" } ,
    cancelarReclamoAction:  { exenta: "RN-39: la organización sale del reclamo y cancela su propio reclamo (plan 44)" } ,
  } ,
  "splits/actions/saldosActions": {
    obtenerSaldosAction:  "lectura" ,
    registrarPagoAction:  "escritura" ,
    solicitarPagoAction:  "escritura" ,
  } ,
  "subscriptions/actions/resolveSubscriptionAction": {
    resolveSubscriptionAction: "escritura" ,
  } ,
  "subscriptions/actions/subscriptionsActions": {
    getSubscriptionsAction:    "lectura" ,
    createSubscriptionAction:  "escritura" ,
    updateSubscriptionAction:  "escritura" ,
    deleteSubscriptionAction:  "escritura" ,
  } ,
  "transactions/actions/transactionsActions": {
    getCategoriesAction:                   "lectura" ,
    createTransactionFromFormAction:       "escritura" ,
    getTransactionsPageAction:             "lectura" ,
    updateLedgerTransactionMetadataAction: "escritura" ,
    reverseLedgerTransactionAction:        "escritura" ,
    deleteLedgerTransactionAction:         "escritura" ,
  } ,
} ;

/** Pares `[ archivo , acción ]` clasificados como `"escritura"`: lo que recorre el test de efecto. */
export function accionesDeEscritura(): Array< [ string , string ] > {
  const pares: Array< [ string , string ] > = [] ;

  for( const [ archivo , acciones ] of Object.entries( POLITICA_DE_ACCIONES ) ) {
    for( const [ nombre , politica ] of Object.entries( acciones ) ) {
      if( politica === "escritura" ) {
        pares.push( [ archivo , nombre ] ) ;
      }
    }
  }

  return( pares ) ;
}
