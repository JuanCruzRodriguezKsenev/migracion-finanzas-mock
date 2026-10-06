import { describe , it , expect , vi , beforeEach } from "vitest" ;
import { getServerSession }                         from "next-auth" ;
import type { Session }                             from "next-auth" ;

// Feature: Reports
import { getReportsAction } from "./reportsActions" ;
import { reportsService }   from "../services/reportsService" ;
import type { ReportData }  from "../types" ;

vi.mock( "next-auth" , () => ( {
  getServerSession: vi.fn() ,
} ) ) ;

vi.mock( "../services/reportsService" , () => ( {
  reportsService: {
    armarReporte: vi.fn() ,
  } ,
} ) ) ;

describe( "reportsActions - getReportsAction" , () => {
  beforeEach( () => {
    vi.clearAllMocks() ;
  } ) ;

  it( "falla si el usuario no tiene sesión o no tiene organización asignada" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( null ) ;

    const res = await getReportsAction() ;
    expect( res.success ).toBe( false ) ;
    expect( res.error ).toBe( "No autorizado para consultar estadísticas." ) ;
  } ) ;

  it( "falla si los parámetros no cumplen la validación de esquema" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: { id: "user-1" , organizationId: "org-1" } ,
    } as Session ) ;

    // monthKey inválido
    const resMes = await getReportsAction( { monthKey: "2026-5" } ) ;
    expect( resMes.success ).toBe( false ) ;
    expect( resMes.error ).toContain( "Formato de mes inválido" ) ;

    // currency inválido
    const resCur = await getReportsAction( { currency: "PESOS" } ) ;
    expect( resCur.success ).toBe( false ) ;
    expect( resCur.error ).toContain( "La divisa debe tener 3 caracteres" ) ;
  } ) ;

  it( "devuelve ok con los datos del reporte cuando los parámetros y la sesión son válidos" , async () => {
    vi.mocked( getServerSession ).mockResolvedValue( {
      user: { id: "user-1" , organizationId: "org-1" } ,
    } as Session ) ;

    const mockReportData = {
      currency:       "ARS" ,
      monthKey:       "2026-05" ,
      hayMovimientos: true ,
    } ;

    vi.mocked( reportsService.armarReporte ).mockResolvedValue( mockReportData as unknown as ReportData ) ;

    const res = await getReportsAction( { monthKey: "2026-05" , currency: "ARS" } ) ;

    expect( res.success ).toBe( true ) ;
    expect( res.value ).toEqual( mockReportData ) ;
    expect( reportsService.armarReporte ).toHaveBeenCalledWith( {
      orgId:    "org-1" ,
      userId:   "user-1" ,
      monthKey: "2026-05" ,
      currency: "ARS" ,
    } ) ;
  } ) ;
} ) ;
