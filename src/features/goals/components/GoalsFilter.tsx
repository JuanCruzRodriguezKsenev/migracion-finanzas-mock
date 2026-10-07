/**
 * @file GoalsFilter.tsx
 * Filtro Todas / Activas / Completadas. El estado vive en la URL (`?filter=`) para que el enlace sea compartible;
 * preserva el resto de los parámetros (por ejemplo `?currency=`).
 */
"use client" ;

// Librerías externas
import { useRouter , usePathname , useSearchParams } from "next/navigation" ;

// Shared
import { Tabs } from "@/shared/ui/display/Tabs/Tabs" ;

// Feature: Goals
import type { GoalsPageDict } from "./goalsDict" ;
import type { GoalFilter }    from "../types" ;


export interface GoalsFilterProps {
  current: GoalFilter ;
  dict:    GoalsPageDict ;
}

/**
 * Pestañas de filtro que escriben `?filter=` en la URL.
 */
export function GoalsFilter( { current , dict }: GoalsFilterProps ) {
  const router       = useRouter() ;
  const pathname     = usePathname() ;
  const searchParams = useSearchParams() ;

  const handleChange = ( key: string ) => {
    const params = new URLSearchParams( searchParams?.toString() || "" ) ;
    if( key === "all" ) {
      params.delete( "filter" ) ;
    } else {
      params.set( "filter" , key ) ;
    }
    const query = params.toString() ;
    router.push( query ? `${pathname}?${query}` : pathname ) ;
  } ;

  return(
    <Tabs
      tabs={ [
        { key: "all"       , label: dict.filterAll } ,
        { key: "active"    , label: dict.filterActive } ,
        { key: "completed" , label: dict.filterCompleted }
      ] }
      activeTab={current}
      onChange={handleChange}
    />
  ) ;
}
