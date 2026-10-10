/**
 * @file brandService.test.ts
 * Pruebas unitarias para brandService sin dependencias de Brandfetch.
 */

// Librerías externas
import { describe , it , expect , vi , beforeEach } from "vitest" ;

// Shared: Brand
import {
  cleanDomain ,
  getBrandLogoUrl ,
  getBrandMetadata
} from "./brandService" ;

describe( "brandService" , () => {
  beforeEach( () => {
    vi.restoreAllMocks() ;
  } ) ;

  it( "1. cleanDomain normaliza dominio y agrega .com si no tiene punto" , () => {
    expect( cleanDomain( "https://www.netflix.com/browse" ) ).toBe( "netflix.com/browse" ) ;
    expect( cleanDomain( "galicia" ) ).toBe( "galicia.com" ) ;
    expect( cleanDomain( "  bancogalicia.com.ar  " ) ).toBe( "bancogalicia.com.ar" ) ;
  } ) ;

  it( "2. getBrandLogoUrl devuelve URL de Google S2 sz=128" , () => {
    const url = getBrandLogoUrl( "netflix.com" ) ;
    expect( url ).toBe( "https://www.google.com/s2/favicons?domain=netflix.com&sz=128" ) ;

    const urlConHttps = getBrandLogoUrl( "https://www.galicia.ar" ) ;
    expect( urlConHttps ).toBe( "https://www.google.com/s2/favicons?domain=galicia.ar&sz=128" ) ;
  } ) ;

  it( "3. getBrandMetadata retorna objeto sintético compatible sin Brandfetch" , async () => {
    const meta = await getBrandMetadata( "netflix" ) ;
    expect( meta ).not.toBeNull() ;
    expect( meta!.domain ).toBe( "netflix.com" ) ;
    expect( meta!.primaryColor ).toBe( "#6b7280" ) ;
    expect( meta!.logoUrl ).toBe( "https://www.google.com/s2/favicons?domain=netflix.com&sz=128" ) ;
  } ) ;
} ) ;
