import { describe , it , expect } from "vitest" ;

// Feature: Accounting
import { Category } from "@/features/accounting/types" ;

// Feature: Reports
import {
  calcularVariacionPct ,
  obtenerMesAnterior ,
  obtenerUltimos12Meses ,
  agruparCategorias ,
} from "./reportsService" ;
import { GastoPorHojaItem } from "../types" ;

describe( "reportsService - funciones puras" , () => {
  describe( "obtenerMesAnterior" , () => {
    it( "calcula correctamente el mes previo dentro del mismo año" , () => {
      expect( obtenerMesAnterior( "2026-05" ) ).toBe( "2026-04" ) ;
      expect( obtenerMesAnterior( "2026-12" ) ).toBe( "2026-11" ) ;
    } ) ;

    it( "cambia de año al retroceder desde enero" , () => {
      expect( obtenerMesAnterior( "2026-01" ) ).toBe( "2025-12" ) ;
    } ) ;
  } ) ;

  describe( "obtenerUltimos12Meses" , () => {
    it( "genera exactamente 12 meses finalizando en el mes solicitado" , () => {
      const meses = obtenerUltimos12Meses( "2026-05" ) ;
      expect( meses ).toHaveLength( 12 ) ;
      expect( meses[ 0 ] ).toBe( "2025-06" ) ;
      expect( meses[ 11 ] ).toBe( "2026-05" ) ;
    } ) ;
  } ) ;

  describe( "calcularVariacionPct (RN-8)" , () => {
    it( "devuelve null cuando el período anterior es 0 o negativo" , () => {
      expect( calcularVariacionPct( 1000 , 0 ) ).toBeNull() ;
      expect( calcularVariacionPct( 1000 , -500 ) ).toBeNull() ;
    } ) ;

    it( "calcula variación porcentual positiva y negativa" , () => {
      expect( calcularVariacionPct( 120 , 100 ) ).toBeCloseTo( 20 , 1 ) ;
      expect( calcularVariacionPct( 80 , 100 ) ).toBeCloseTo( -20 , 1 ) ;
    } ) ;
  } ) ;

  describe( "agruparCategorias (RN-10, RN-11, RN-12)" , () => {
    const parentVivienda: Category = {
      id:             "cat-p-vivienda" ,
      organizationId: "org-1" ,
      parentId:       null ,
      name:           "Vivienda" ,
      accountCode:    "5.1.01" ,
      color:          "#FF5733" ,
      icon:           null ,
      type:           "expense" ,
      archivedAt:     null ,
      isSystemLeaf:   false ,
      createdAt:      new Date() ,
    } ;

    const leafAlquiler: Category = {
      id:             "cat-h-alquiler" ,
      organizationId: "org-1" ,
      parentId:       "cat-p-vivienda" ,
      name:           "Alquiler" ,
      accountCode:    "5.1.01.01" ,
      color:          null ,
      icon:           null ,
      type:           "expense" ,
      archivedAt:     null ,
      isSystemLeaf:   false ,
      createdAt:      new Date() ,
    } ;

    const leafGeneralVivienda: Category = {
      id:             "cat-h-gen-viv" ,
      organizationId: "org-1" ,
      parentId:       "cat-p-vivienda" ,
      name:           "Vivienda General" ,
      accountCode:    "5.1.01.99" ,
      color:          null ,
      icon:           null ,
      type:           "expense" ,
      archivedAt:     null ,
      isSystemLeaf:   true ,
      createdAt:      new Date() ,
    } ;

    const leafRaizGenerales: Category = {
      id:             "cat-h-raiz-gen" ,
      organizationId: "org-1" ,
      parentId:       null ,
      name:           "Gastos Generales" ,
      accountCode:    "5.1.01.99" ,
      color:          null ,
      icon:           null ,
      type:           "expense" ,
      archivedAt:     null ,
      isSystemLeaf:   true ,
      createdAt:      new Date() ,
    } ;

    it( "agrupa hojas bajo su padre y rotula isSystemLeaf como General" , () => {
      const categorias = [ parentVivienda , leafAlquiler , leafGeneralVivienda ] ;
      const hojas: GastoPorHojaItem[] = [
        { categoryId: leafAlquiler.id , accountId: "acc-1" , total: 300000 } ,
        { categoryId: leafGeneralVivienda.id , accountId: "acc-2" , total: 50000 } ,
      ] ;

      const res = agruparCategorias( categorias , hojas , "expense" ) ;
      expect( res.total ).toBe( 350000 ) ;
      expect( res.padres ).toHaveLength( 1 ) ;

      const viv = res.padres[ 0 ] ;
      expect( viv.nombre ).toBe( "Vivienda" ) ;
      expect( viv.total ).toBe( 350000 ) ;
      expect( viv.hojas ).toHaveLength( 2 ) ;
      expect( viv.hojas[ 0 ].nombre ).toBe( "Alquiler" ) ;
      expect( viv.hojas[ 0 ].total ).toBe( 300000 ) ;
      expect( viv.hojas[ 1 ].nombre ).toBe( "General" ) ;
      expect( viv.hojas[ 1 ].total ).toBe( 50000 ) ;
    } ) ;

    it( "hoja de tipo raíz y cuenta sin categoría suman a Sin categoría al nivel padre" , () => {
      const categorias = [ leafRaizGenerales ] ;
      const hojas: GastoPorHojaItem[] = [
        { categoryId: leafRaizGenerales.id , accountId: "acc-gen" , total: 20000 } ,
        { categoryId: null , accountId: "acc-nocat" , total: 15000 } ,
      ] ;

      const res = agruparCategorias( categorias , hojas , "expense" ) ;
      expect( res.padres ).toHaveLength( 1 ) ;
      expect( res.padres[ 0 ].id ).toBe( "sin-categoria" ) ;
      expect( res.padres[ 0 ].nombre ).toBe( "Sin categoría" ) ;
      expect( res.padres[ 0 ].total ).toBe( 35000 ) ;
    } ) ;

    it( "no genera Otras si hay 7 o menos padres, pero agrupa en Otras a partir del 8vo (RN-10)" , () => {
      // Crear 8 categorías padre
      const categorias: Category[] = [] ;
      const hojas: GastoPorHojaItem[] = [] ;

      for( let i = 1 ; i <= 8 ; i++ ) {
        const cat: Category = {
          id:             `cat-p-${i}` ,
          organizationId: "org-1" ,
          parentId:       null ,
          name:           `Padre ${i}` ,
          accountCode:    `5.1.0${i}` ,
          color:          `#00000${i}` ,
          icon:           null ,
          type:           "expense" ,
          archivedAt:     null ,
          isSystemLeaf:   false ,
          createdAt:      new Date() ,
        } ;
        categorias.push( cat ) ;
        // Montos decrecientes: 800, 700, 600, ...
        hojas.push( { categoryId: cat.id , accountId: `acc-${i}` , total: ( 9 - i ) * 1000 } ) ;
      }

      // Con 7 padres:
      const res7 = agruparCategorias( categorias.slice( 0 , 7 ) , hojas.slice( 0 , 7 ) , "expense" ) ;
      expect( res7.padres ).toHaveLength( 7 ) ;
      expect( res7.padres.some( ( p ) => { return( p.id === "otras" ) ; } ) ).toBe( false ) ;

      // Con 8 padres:
      const res8 = agruparCategorias( categorias , hojas , "expense" ) ;
      expect( res8.padres ).toHaveLength( 7 ) ; // 6 mayores + 1 "Otras"
      const padreOtras = res8.padres.find( ( p ) => { return( p.id === "otras" ) ; } ) ;
      expect( padreOtras ).toBeDefined() ;
      expect( padreOtras?.nombre ).toBe( "Otras" ) ;
      // Los dos últimos tenían 2000 y 1000 -> total 3000
      expect( padreOtras?.total ).toBe( 3000 ) ;
    } ) ;
  } ) ;
} ) ;
