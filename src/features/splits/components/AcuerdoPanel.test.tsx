// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Splits
import { AcuerdoPanel }  from "./AcuerdoPanel" ;
import {
  obtenerAcuerdoAction ,
  guardarAcuerdoAction ,
  declararAporteAction ,
  type VistaAcuerdo
} from "../actions/acuerdoActions" ;


vi.mock( "../actions/acuerdoActions" , () => ( {
  obtenerAcuerdoAction: vi.fn() ,
  guardarAcuerdoAction: vi.fn() ,
  declararAporteAction: vi.fn() ,
} ) ) ;

describe( "AcuerdoPanel" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const mes = { year: 2026 , month: 10 } ;

  const deOwner: VistaAcuerdo = {
    rol:           "owner" ,
    modo:          "none" ,
    usesCommonPot: false ,
    mes ,
    partesIguales: false ,
    cuentasMarcables: [] ,
    miembros: [
      { userId: "u-ana"  , nombre: "Ana"  , porcentajeBp: 0 , aporteDelMes: null } ,
      { userId: "u-beto" , nombre: "Beto" , porcentajeBp: 0 , aporteDelMes: null } ,
      { userId: "u-caro" , nombre: "Caro" , porcentajeBp: 0 , aporteDelMes: null } ,
    ] ,
  } ;

  const campo = ( nombre: string ) => screen.getByLabelText( dict.splits.percentageOf.replace( "{nombre}" , nombre ) ) as HTMLInputElement ;
  const modo  = ( etiqueta: string ) => screen.getByLabelText( etiqueta ) as HTMLInputElement ;

  it( "la suma de porcentajes se ve en vivo y la diferencia se informa («Suman 90 %: faltan 10»)" , () => {
    render( <AcuerdoPanel initialData={deOwner} dict={dict.splits} /> ) ;

    fireEvent.click( modo( dict.splits.modeFixed ) ) ;
    fireEvent.change( campo( "Ana" )  , { target: { value: "50" } } ) ;
    fireEvent.change( campo( "Beto" ) , { target: { value: "40" } } ) ;
    fireEvent.change( campo( "Caro" ) , { target: { value: "0" } } ) ;

    expect( screen.getByText( "Suman 90 %: faltan 10" ) ).toBeTruthy() ;
    expect( ( screen.getByRole( "button" , { name: dict.splits.save } ) as HTMLButtonElement ).disabled ).toBe( true ) ;

    fireEvent.change( campo( "Caro" ) , { target: { value: "10" } } ) ;

    expect( screen.getByText( "Suman 100 %" ) ).toBeTruthy() ;
    expect( ( screen.getByRole( "button" , { name: dict.splits.save } ) as HTMLButtonElement ).disabled ).toBe( false ) ;
  } ) ;

  it( "la plantilla «Compañeros de casa» rellena porcentajes iguales que suman 100 %, sin guardar" , () => {
    render( <AcuerdoPanel initialData={deOwner} dict={dict.splits} /> ) ;

    fireEvent.change( screen.getByLabelText( dict.splits.templateLabel ) , { target: { value: "companeros" } } ) ;

    expect( modo( dict.splits.modeFixed ).checked ).toBe( true ) ;
    expect( campo( "Ana" ).value ).toBe( "33,34" ) ;
    expect( campo( "Beto" ).value ).toBe( "33,33" ) ;
    expect( campo( "Caro" ).value ).toBe( "33,33" ) ;
    expect( screen.getByText( "Suman 100 %" ) ).toBeTruthy() ;
    expect( guardarAcuerdoAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "guardar pide confirmación («Rige para los gastos nuevos») y recién entonces llama a la acción con puntos básicos" , async () => {
    vi.mocked( guardarAcuerdoAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( obtenerAcuerdoAction ).mockResolvedValue( { success: true , value: { ...deOwner , modo: "fixed_percentages" } } ) ;
    render( <AcuerdoPanel initialData={deOwner} dict={dict.splits} /> ) ;

    fireEvent.change( screen.getByLabelText( dict.splits.templateLabel ) , { target: { value: "companeros" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.save } ) ) ;

    expect( screen.getByText( dict.splits.confirmBody ) ).toBeTruthy() ;
    expect( guardarAcuerdoAction ).not.toHaveBeenCalled() ;

    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.confirmAccept } ) ) ;

    await waitFor( () => expect( guardarAcuerdoAction ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( guardarAcuerdoAction ).toHaveBeenCalledWith( {
      modo:          "fixed_percentages" ,
      usesCommonPot: false ,
      porcentajes:   [
        { userId: "u-ana"  , percentageBp: 3334 } ,
        { userId: "u-beto" , percentageBp: 3333 } ,
        { userId: "u-caro" , percentageBp: 3333 } ,
      ] ,
      cuentasCajaIds: [] ,
    } ) ;
    await waitFor( () => expect( screen.getByText( dict.splits.saved ) ).toBeTruthy() ) ;
  } ) ;

  it( "sin cuentas de activo, la casilla «Usar caja común» queda deshabilitada y desmarcada, con su aviso" , () => {
    render( <AcuerdoPanel initialData={deOwner} dict={dict.splits} /> ) ;

    const casilla = screen.getByLabelText( dict.splits.commonPotLabel ) as HTMLInputElement ;

    expect( casilla.disabled ).toBe( true ) ;
    expect( casilla.checked ).toBe( false ) ;
    expect( screen.getByText( dict.splits.commonPotNoAccounts ) ).toBeTruthy() ;
  } ) ;

  describe( "con cuentas de activo" , () => {
    const conCuentas: VistaAcuerdo = {
      ...deOwner ,
      cuentasMarcables: [
        { id: "c-caja" , nombre: "Caja" , divisa: "ARS" , esCaja: false } ,
        { id: "c-usd"  , nombre: "Dólares" , divisa: "USD" , esCaja: false } ,
      ] ,
    } ;
    const etiquetaCuenta = ( nombre: string , divisa: string ) => dict.splits.commonPotAccountOption.replace( "{nombre}" , nombre ).replace( "{divisa}" , divisa ) ;

    it( "la casilla está habilitada; al marcarla aparece una casilla por cuenta y el guardado exige elegir al menos una" , () => {
      render( <AcuerdoPanel initialData={conCuentas} dict={dict.splits} /> ) ;

      expect( screen.queryByLabelText( etiquetaCuenta( "Caja" , "ARS" ) ) ).toBeNull() ;

      fireEvent.click( screen.getByLabelText( dict.splits.commonPotLabel ) ) ;

      expect( screen.getByLabelText( etiquetaCuenta( "Caja" , "ARS" ) ) ).toBeTruthy() ;
      expect( screen.getByLabelText( etiquetaCuenta( "Dólares" , "USD" ) ) ).toBeTruthy() ;
      expect( ( screen.getByRole( "button" , { name: dict.splits.save } ) as HTMLButtonElement ).disabled ).toBe( true ) ;

      fireEvent.click( screen.getByLabelText( etiquetaCuenta( "Caja" , "ARS" ) ) ) ;

      expect( ( screen.getByRole( "button" , { name: dict.splits.save } ) as HTMLButtonElement ).disabled ).toBe( false ) ;
    } ) ;

    it( "guarda la caja con las cuentas elegidas" , async () => {
      vi.mocked( guardarAcuerdoAction ).mockResolvedValue( { success: true , value: null } ) ;
      vi.mocked( obtenerAcuerdoAction ).mockResolvedValue( { success: true , value: conCuentas } ) ;
      render( <AcuerdoPanel initialData={conCuentas} dict={dict.splits} /> ) ;

      fireEvent.click( screen.getByLabelText( dict.splits.commonPotLabel ) ) ;
      fireEvent.click( screen.getByLabelText( etiquetaCuenta( "Dólares" , "USD" ) ) ) ;
      fireEvent.click( screen.getByRole( "button" , { name: dict.splits.save } ) ) ;
      fireEvent.click( screen.getByRole( "button" , { name: dict.splits.confirmAccept } ) ) ;

      await waitFor( () => expect( guardarAcuerdoAction ).toHaveBeenCalledWith( { modo: "none" , usesCommonPot: true , porcentajes: [] , cuentasCajaIds: [ "c-usd" ] } ) ) ;
    } ) ;

    it( "una cuenta ya marcada llega elegida y desactivar la caja envía la lista vacía" , async () => {
      vi.mocked( guardarAcuerdoAction ).mockResolvedValue( { success: true , value: null } ) ;
      const activa: VistaAcuerdo = { ...conCuentas , usesCommonPot: true , cuentasMarcables: [ { id: "c-caja" , nombre: "Caja" , divisa: "ARS" , esCaja: true } ] } ;
      vi.mocked( obtenerAcuerdoAction ).mockResolvedValue( { success: true , value: activa } ) ;
      render( <AcuerdoPanel initialData={activa} dict={dict.splits} /> ) ;

      expect( ( screen.getByLabelText( etiquetaCuenta( "Caja" , "ARS" ) ) as HTMLInputElement ).checked ).toBe( true ) ;

      fireEvent.click( screen.getByLabelText( dict.splits.commonPotLabel ) ) ;
      fireEvent.click( screen.getByRole( "button" , { name: dict.splits.save } ) ) ;
      fireEvent.click( screen.getByRole( "button" , { name: dict.splits.confirmAccept } ) ) ;

      await waitFor( () => expect( guardarAcuerdoAction ).toHaveBeenCalledWith( { modo: "none" , usesCommonPot: false , porcentajes: [] , cuentasCajaIds: [] } ) ) ;
    } ) ;
  } ) ;

  it( "en modo aportes muestra la grilla del mes y declara sólo lo que cambió" , async () => {
    vi.mocked( guardarAcuerdoAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( declararAporteAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( obtenerAcuerdoAction ).mockResolvedValue( { success: true , value: { ...deOwner , modo: "monthly_contributions" } } ) ;
    render( <AcuerdoPanel initialData={deOwner} dict={dict.splits} /> ) ;

    fireEvent.click( modo( dict.splits.modeMonthly ) ) ;
    expect( screen.getByText( dict.splits.contributionsTitle.replace( "{mes}" , "10/2026" ) ) ).toBeTruthy() ;

    fireEvent.change( screen.getByLabelText( dict.splits.contributionOf.replace( "{nombre}" , "Ana" ) ) , { target: { value: "600000,50" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.save } ) ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.confirmAccept } ) ) ;

    await waitFor( () => expect( declararAporteAction ).toHaveBeenCalledTimes( 1 ) ) ;
    expect( declararAporteAction ).toHaveBeenCalledWith( { userId: "u-ana" , year: 2026 , month: 10 , amountInCents: 60000050 } ) ;
  } ) ;

  it( "un member no ve los porcentajes de los demás ni el botón de guardar el acuerdo, y declara su aporte" , async () => {
    vi.mocked( declararAporteAction ).mockResolvedValue( { success: true , value: null } ) ;
    const deMember: VistaAcuerdo = {
      ...deOwner ,
      rol:      "member" ,
      modo:     "fixed_percentages" ,
      miembros: [ { userId: "u-beto" , nombre: "Beto" , porcentajeBp: 3000 , aporteDelMes: null } ] ,
    } ;
    vi.mocked( obtenerAcuerdoAction ).mockResolvedValue( { success: true , value: deMember } ) ;
    render( <AcuerdoPanel initialData={deMember} dict={dict.splits} /> ) ;

    expect( screen.getByText( dict.splits.modeFixed ) ).toBeTruthy() ;
    expect( screen.getByText( dict.splits.memberShare.replace( "{porcentaje}" , "30" ) ) ).toBeTruthy() ;
    expect( screen.queryByText( "Ana" ) ).toBeNull() ;
    expect( screen.queryByLabelText( dict.splits.percentageOf.replace( "{nombre}" , "Ana" ) ) ).toBeNull() ;
    expect( screen.queryByRole( "button" , { name: dict.splits.save } ) ).toBeNull() ;

    fireEvent.change( screen.getByLabelText( dict.splits.memberContribution.replace( "{mes}" , "10/2026" ) ) , { target: { value: "400000" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.memberSaveContribution } ) ) ;

    await waitFor( () => expect( declararAporteAction ).toHaveBeenCalledWith( { year: 2026 , month: 10 , amountInCents: 40000000 } ) ) ;
  } ) ;

  it( "si el servidor rechaza el guardado, muestra el error y no recarga" , async () => {
    vi.mocked( guardarAcuerdoAction ).mockResolvedValue( { success: false , error: "Suman 90 %: faltan 10" } ) ;
    render( <AcuerdoPanel initialData={deOwner} dict={dict.splits} /> ) ;

    fireEvent.change( screen.getByLabelText( dict.splits.templateLabel ) , { target: { value: "companeros" } } ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.save } ) ) ;
    fireEvent.click( screen.getByRole( "button" , { name: dict.splits.confirmAccept } ) ) ;

    await waitFor( () => expect( screen.getByRole( "alert" ).textContent ).toBe( "Suman 90 %: faltan 10" ) ) ;
    expect( obtenerAcuerdoAction ).not.toHaveBeenCalled() ;
  } ) ;
} ) ;
