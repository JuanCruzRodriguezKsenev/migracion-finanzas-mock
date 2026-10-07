// @vitest-environment jsdom

// Librerías externas
import { describe , it , expect , vi , beforeAll , beforeEach } from "vitest" ;
import { render , screen , fireEvent , waitFor }               from "@testing-library/react" ;

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Organizations
import { HabilitacionesPanel } from "./HabilitacionesPanel" ;
import {
  listarHabilitacionesAction ,
  otorgarHabilitacionAction ,
  revocarHabilitacionAction ,
  type HabilitacionesListadas
} from "../actions/habilitacionesActions" ;


vi.mock( "../actions/habilitacionesActions" , () => ( {
  listarHabilitacionesAction: vi.fn() ,
  otorgarHabilitacionAction:  vi.fn() ,
  revocarHabilitacionAction:  vi.fn() ,
} ) ) ;

describe( "HabilitacionesPanel" , () => {
  let dict: Awaited< ReturnType< typeof getDictionary > > ;

  beforeAll( async () => {
    dict = await getDictionary( "es" ) ;
  } ) ;

  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  const inicial: HabilitacionesListadas = {
    otorgadas:  [] ,
    candidatos: [ { userId: "u-beto" , nombre: "Beto" } , { userId: "u-carla" , nombre: "Carla" } ] ,
    recibidas:  [ { userId: "u-dani" , nombre: "Dani" } ] ,
  } ;

  const interruptor = ( nombre: string ) => screen.getByLabelText( dict.habilitaciones.toggleLabel.replace( "{nombre}" , nombre ) ) as HTMLInputElement ;

  it( "muestra un interruptor por candidato y la lista de lo recibido" , () => {
    render( <HabilitacionesPanel initialData={inicial} dict={dict.habilitaciones} /> ) ;

    expect( screen.getByText( dict.habilitaciones.title ) ).toBeTruthy() ;
    expect( interruptor( "Beto" ).checked ).toBe( false ) ;
    expect( interruptor( "Carla" ).checked ).toBe( false ) ;
    expect( screen.getByText( "Dani" ) ).toBeTruthy() ;
  } ) ;

  it( "los habilitados aparecen con el interruptor encendido" , () => {
    render(
      <HabilitacionesPanel
        initialData={ { ...inicial , otorgadas: [ { userId: "u-beto" , nombre: "Beto" } ] } }
        dict={dict.habilitaciones}
      />
    ) ;

    expect( interruptor( "Beto" ).checked ).toBe( true ) ;
    expect( interruptor( "Carla" ).checked ).toBe( false ) ;
  } ) ;

  it( "al encender llama a otorgar con el miembro y refleja el estado nuevo" , async () => {
    vi.mocked( otorgarHabilitacionAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( listarHabilitacionesAction ).mockResolvedValue( {
      success: true ,
      value:   { ...inicial , otorgadas: [ { userId: "u-beto" , nombre: "Beto" } ] } ,
    } ) ;
    render( <HabilitacionesPanel initialData={inicial} dict={dict.habilitaciones} /> ) ;

    fireEvent.click( interruptor( "Beto" ) ) ;

    await waitFor( () => expect( interruptor( "Beto" ).checked ).toBe( true ) ) ;
    expect( otorgarHabilitacionAction ).toHaveBeenCalledWith( { habilitadoUserId: "u-beto" } ) ;
    expect( revocarHabilitacionAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "al apagar llama a revocar" , async () => {
    vi.mocked( revocarHabilitacionAction ).mockResolvedValue( { success: true , value: null } ) ;
    vi.mocked( listarHabilitacionesAction ).mockResolvedValue( { success: true , value: inicial } ) ;
    render(
      <HabilitacionesPanel
        initialData={ { ...inicial , otorgadas: [ { userId: "u-beto" , nombre: "Beto" } ] } }
        dict={dict.habilitaciones}
      />
    ) ;

    fireEvent.click( interruptor( "Beto" ) ) ;

    await waitFor( () => expect( interruptor( "Beto" ).checked ).toBe( false ) ) ;
    expect( revocarHabilitacionAction ).toHaveBeenCalledWith( { habilitadoUserId: "u-beto" } ) ;
  } ) ;

  it( "mientras guarda, los interruptores quedan deshabilitados" , async () => {
    let resolver: ( v: { success: true ; value: null } ) => void = () => {} ;
    vi.mocked( otorgarHabilitacionAction ).mockReturnValue( new Promise( ( r ) => { resolver = r ; } ) ) ;
    vi.mocked( listarHabilitacionesAction ).mockResolvedValue( { success: true , value: inicial } ) ;
    render( <HabilitacionesPanel initialData={inicial} dict={dict.habilitaciones} /> ) ;

    fireEvent.click( interruptor( "Beto" ) ) ;

    await waitFor( () => expect( interruptor( "Carla" ).disabled ).toBe( true ) ) ;
    expect( interruptor( "Beto" ).disabled ).toBe( true ) ;

    resolver( { success: true , value: null } ) ;
    await waitFor( () => expect( interruptor( "Carla" ).disabled ).toBe( false ) ) ;
  } ) ;

  it( "si el servidor rechaza, el interruptor se restaura y se muestra el error" , async () => {
    vi.mocked( otorgarHabilitacionAction ).mockResolvedValue( { success: false , error: "No se pudo otorgar la habilitación." } ) ;
    render( <HabilitacionesPanel initialData={inicial} dict={dict.habilitaciones} /> ) ;

    fireEvent.click( interruptor( "Beto" ) ) ;

    await waitFor( () => expect( screen.getByText( "No se pudo otorgar la habilitación." ) ).toBeTruthy() ) ;
    expect( interruptor( "Beto" ).checked ).toBe( false ) ;
    expect( interruptor( "Beto" ).disabled ).toBe( false ) ;
    expect( listarHabilitacionesAction ).not.toHaveBeenCalled() ;
  } ) ;

  it( "si la acción lanza, se restaura y muestra el error genérico" , async () => {
    vi.mocked( otorgarHabilitacionAction ).mockRejectedValue( new Error( "red caída" ) ) ;
    render( <HabilitacionesPanel initialData={inicial} dict={dict.habilitaciones} /> ) ;

    fireEvent.click( interruptor( "Carla" ) ) ;

    await waitFor( () => expect( screen.getByText( dict.habilitaciones.saveError ) ).toBeTruthy() ) ;
    expect( interruptor( "Carla" ).checked ).toBe( false ) ;
  } ) ;

  it( "sin candidatos ni recibidas muestra los textos vacíos" , () => {
    render( <HabilitacionesPanel initialData={ { otorgadas: [] , candidatos: [] , recibidas: [] } } dict={dict.habilitaciones} /> ) ;

    expect( screen.getByText( dict.habilitaciones.emptyCandidates ) ).toBeTruthy() ;
    expect( screen.getByText( dict.habilitaciones.receivedEmpty ) ).toBeTruthy() ;
  } ) ;
} ) ;
