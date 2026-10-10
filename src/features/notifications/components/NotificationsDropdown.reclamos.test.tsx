// @vitest-environment jsdom
/**
 * @file NotificationsDropdown.reclamos.test.tsx
 * Pruebas unitarias de componentes para las interacciones de reclamos de pago en NotificationsDropdown:
 * «Ya pagué», campo de monto en línea, botones de confirmación/rechazo y estados resueltos.
 */
// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;
import React                                                   from "react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Splits
import { reclamarPagoAction , confirmarReclamoAction , rechazarReclamoAction , cancelarReclamoAction } from "@/features/splits/actions/reclamosActions" ;

// Feature: Notifications
import { NotificationsDropdown } from "./NotificationsDropdown" ;
import type { AvisoVista }       from "../types" ;


const mockRefresh = vi.fn() ;

vi.mock( "next/navigation" , () => ( {
  useRouter: () => ( {
    push:    vi.fn() ,
    replace: vi.fn() ,
    refresh: mockRefresh ,
  } ) ,
} ) ) ;

vi.mock( "@/features/profile/context/ProfileContext" , () => ( {
  useProfileContext: () => ( {
    profile: { numberFormat: "es-AR" } ,
  } ) ,
} ) ) ;

vi.mock( "@/features/splits/actions/reclamosActions" , () => ( {
  reclamarPagoAction:    vi.fn() ,
  confirmarReclamoAction: vi.fn() ,
  rechazarReclamoAction:  vi.fn() ,
  cancelarReclamoAction:  vi.fn() ,
} ) ) ;

const mockMarcarLeidas = vi.fn().mockResolvedValue( undefined ) ;
const mockRefrescar    = vi.fn().mockResolvedValue( undefined ) ;
let mockNotifications: AvisoVista[] = [] ;

vi.mock( "../context/NotificationsContext" , () => ( {
  useNotifications: () => ( {
    notifications:  mockNotifications ,
    unreadCount:    0 ,
    marcarLeidas:   mockMarcarLeidas ,
    refrescar:      mockRefrescar ,
    filtro:         null ,
    setFiltro:      vi.fn() ,
    organizaciones: [] ,
  } ) ,
} ) ) ;

let dict: Awaited< ReturnType< typeof getDictionary > > ;

beforeAll( async () => {
  dict = await getDictionary( "es" ) ;
} ) ;

beforeEach( () => {
  vi.clearAllMocks() ;
  mockNotifications = [] ;
} ) ;

describe( "NotificationsDropdown - Acciones de reclamo (plan 44)" , () => {
  it( "«Ya pagué» abre el campo con el saldo precargado" , () => {
    mockNotifications = [
      {
        id:                     "aviso-1" ,
        tipo:                   "debt_created" ,
        actor:                  "Karla" ,
        titular:                null ,
        descripcion:            "Gasto comida" ,
        montoEnCentavos:        490_000 ,
        divisa:                 "ARS" ,
        leida:                  false ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "ya_pague" , saldoEnCentavos: 490_000 } ,
      } ,
    ] ;

    render( <NotificationsDropdown dict={dict.notifications} /> ) ;

    const botonYaPague = screen.getByRole( "button" , { name: dict.notifications.paidButton } ) ;
    expect( botonYaPague ).toBeInTheDocument() ;

    fireEvent.click( botonYaPague ) ;

    // Se abre el input con el saldo precargado
    const inputMonto = screen.getByLabelText( dict.notifications.amountLabel ) as HTMLInputElement ;
    expect( inputMonto ).toBeInTheDocument() ;
    expect( inputMonto.value ).toBe( "4900.00" ) ;

    expect( screen.getByRole( "button" , { name: dict.notifications.send } ) ).toBeInTheDocument() ;
    expect( screen.getByRole( "button" , { name: dict.notifications.cancel } ) ).toBeInTheDocument() ;
  } ) ;

  it( "enviar '0' no llama al servidor y muestra error de monto inválido" , async () => {
    mockNotifications = [
      {
        id:                     "aviso-1" ,
        tipo:                   "debt_created" ,
        actor:                  "Karla" ,
        titular:                null ,
        descripcion:            "Gasto comida" ,
        montoEnCentavos:        490_000 ,
        divisa:                 "ARS" ,
        leida:                  false ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "ya_pague" , saldoEnCentavos: 490_000 } ,
      } ,
    ] ;

    render( <NotificationsDropdown dict={dict.notifications} /> ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.notifications.paidButton } ) ) ;

    const inputMonto = screen.getByLabelText( dict.notifications.amountLabel ) ;
    fireEvent.change( inputMonto , { target: { value: "0" } } ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.notifications.send } ) ) ;

    expect( reclamarPagoAction ).not.toHaveBeenCalled() ;
    expect( screen.getByText( dict.notifications.amountInvalid ) ).toBeInTheDocument() ;
  } ) ;

  it( "enviar el monto llama a reclamarPagoAction con { avisoId, montoEnCentavos }" , async () => {
    vi.mocked( reclamarPagoAction ).mockResolvedValue( { success: true , value: null } ) ;

    mockNotifications = [
      {
        id:                     "aviso-1" ,
        tipo:                   "debt_created" ,
        actor:                  "Karla" ,
        titular:                null ,
        descripcion:            "Gasto comida" ,
        montoEnCentavos:        490_000 ,
        divisa:                 "ARS" ,
        leida:                  false ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "ya_pague" , saldoEnCentavos: 490_000 } ,
      } ,
    ] ;

    render( <NotificationsDropdown dict={dict.notifications} /> ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.notifications.paidButton } ) ) ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.notifications.send } ) ) ;

    await waitFor( () => {
      expect( reclamarPagoAction ).toHaveBeenCalledWith( {
        avisoId:         "aviso-1" ,
        montoEnCentavos: 490_000 ,
      } ) ;
    } ) ;

    expect( mockRefrescar ).toHaveBeenCalled() ;
    expect( mockRefresh ).toHaveBeenCalled() ;
  } ) ;

  it( "con reclamoPendienteId se ve «Esperando confirmación» y botón «Cancelar»" , async () => {
    vi.mocked( cancelarReclamoAction ).mockResolvedValue( { success: true , value: null } ) ;

    mockNotifications = [
      {
        id:                     "aviso-1" ,
        tipo:                   "debt_created" ,
        actor:                  "Karla" ,
        titular:                null ,
        descripcion:            "Gasto comida" ,
        montoEnCentavos:        490_000 ,
        divisa:                 "ARS" ,
        leida:                  false ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "ya_pague" , saldoEnCentavos: 490_000 , reclamoPendienteId: "claim-1" } ,
      } ,
    ] ;

    render( <NotificationsDropdown dict={dict.notifications} /> ) ;

    expect( screen.getByText( dict.notifications.waiting ) ).toBeInTheDocument() ;
    const botonCancelar = screen.getByRole( "button" , { name: dict.notifications.cancel } ) ;
    expect( botonCancelar ).toBeInTheDocument() ;

    fireEvent.click( botonCancelar ) ;

    await waitFor( () => {
      expect( cancelarReclamoAction ).toHaveBeenCalledWith( { reclamoId: "claim-1" } ) ;
    } ) ;

    expect( mockRefrescar ).toHaveBeenCalled() ;
  } ) ;

  it( "con responder_reclamo pendiente se ven «Confirmar» y «Rechazar»" , async () => {
    vi.mocked( confirmarReclamoAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( rechazarReclamoAction ).mockResolvedValue( { success: true , value: null } ) ;

    mockNotifications = [
      {
        id:                     "aviso-claim" ,
        tipo:                   "payment_claimed" ,
        actor:                  "Juan" ,
        titular:                null ,
        descripcion:            "" ,
        montoEnCentavos:        490_000 ,
        divisa:                 "ARS" ,
        leida:                  false ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "responder_reclamo" , reclamoId: "claim-1" , estado: "pending" } ,
      } ,
    ] ;

    render( <NotificationsDropdown dict={dict.notifications} /> ) ;

    const botonConfirmar = screen.getByRole( "button" , { name: dict.notifications.confirm } ) ;
    const botonRechazar  = screen.getByRole( "button" , { name: dict.notifications.reject } ) ;
    expect( botonConfirmar ).toBeInTheDocument() ;
    expect( botonRechazar ).toBeInTheDocument() ;

    fireEvent.click( botonConfirmar ) ;
    await waitFor( () => {
      expect( confirmarReclamoAction ).toHaveBeenCalledWith( { reclamoId: "claim-1" } ) ;
    } ) ;
  } ) ;

  it( "con estado resuelto, sin botones y con el texto del estado" , () => {
    mockNotifications = [
      {
        id:                     "aviso-claim-conf" ,
        tipo:                   "payment_claimed" ,
        actor:                  "Juan" ,
        titular:                null ,
        descripcion:            "" ,
        montoEnCentavos:        490_000 ,
        divisa:                 "ARS" ,
        leida:                  true ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "responder_reclamo" , reclamoId: "claim-1" , estado: "confirmed" } ,
      } ,
      {
        id:                     "aviso-claim-rej" ,
        tipo:                   "payment_claimed" ,
        actor:                  "Beto" ,
        titular:                null ,
        descripcion:            "" ,
        montoEnCentavos:        200_000 ,
        divisa:                 "ARS" ,
        leida:                  true ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "responder_reclamo" , reclamoId: "claim-2" , estado: "rejected" } ,
      } ,
      {
        id:                     "aviso-claim-canc" ,
        tipo:                   "payment_claimed" ,
        actor:                  "Ana" ,
        titular:                null ,
        descripcion:            "" ,
        montoEnCentavos:        100_000 ,
        divisa:                 "ARS" ,
        leida:                  true ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "responder_reclamo" , reclamoId: "claim-3" , estado: "cancelled" } ,
      } ,
    ] ;

    render( <NotificationsDropdown dict={dict.notifications} /> ) ;

    // No hay botones de confirmar ni rechazar
    expect( screen.queryByRole( "button" , { name: dict.notifications.confirm } ) ).not.toBeInTheDocument() ;
    expect( screen.queryByRole( "button" , { name: dict.notifications.reject } ) ).not.toBeInTheDocument() ;

    // Se muestran los textos de estado
    expect( screen.getByText( dict.notifications.statusConfirmed ) ).toBeInTheDocument() ;
    expect( screen.getByText( dict.notifications.statusRejected ) ).toBeInTheDocument() ;
    expect( screen.getByText( dict.notifications.statusCancelled ) ).toBeInTheDocument() ;
  } ) ;

  it( "un fail del servidor se muestra y los botones vuelven a habilitarse" , async () => {
    vi.mocked( confirmarReclamoAction ).mockResolvedValue( { success: false , error: "Error de prueba del servidor." } ) ;

    mockNotifications = [
      {
        id:                     "aviso-claim" ,
        tipo:                   "payment_claimed" ,
        actor:                  "Juan" ,
        titular:                null ,
        descripcion:            "" ,
        montoEnCentavos:        490_000 ,
        divisa:                 "ARS" ,
        leida:                  false ,
        creadaEn:               new Date().toISOString() ,
        organizacionId:         "org-1" ,
        organizacionNombre:     "Casa" ,
        organizacionEsPersonal: false ,
        accion:                 { tipo: "responder_reclamo" , reclamoId: "claim-1" , estado: "pending" } ,
      } ,
    ] ;

    render( <NotificationsDropdown dict={dict.notifications} /> ) ;

    const botonConfirmar = screen.getByRole( "button" , { name: dict.notifications.confirm } ) ;
    fireEvent.click( botonConfirmar ) ;

    await waitFor( () => {
      expect( screen.getByText( "Error de prueba del servidor." ) ).toBeInTheDocument() ;
    } ) ;

    // Botones vuelven a estar habilitados
    expect( botonConfirmar ).not.toBeDisabled() ;
    expect( screen.getByRole( "button" , { name: dict.notifications.reject } ) ).not.toBeDisabled() ;
  } ) ;
} ) ;
