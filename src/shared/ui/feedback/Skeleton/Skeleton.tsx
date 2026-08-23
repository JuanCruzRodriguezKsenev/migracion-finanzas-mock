/**
 * @file Skeleton.tsx
 * Placeholder de carga genérico (shimmer). Consume la clase global `.skeleton`
 * definida en `src/app/globals.css`, reutilizable en cualquier feature o layout
 * en lugar de reimplementar estados de carga ad-hoc.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import styles from "./Skeleton.module.css" ;


interface SkeletonProps {
  width?:     string ;
  height?:    string ;
  radius?:    string ;
  count?:     number ;
  className?: string ;
}

/**
 * Renderiza uno o más bloques de carga (shimmer) con dimensiones configurables.
 * Cuando `count` es mayor a 1, los bloques se apilan verticalmente con espaciado.
 */
export function Skeleton( {
  width     = "100%" ,
  height    = "1rem" ,
  radius ,
  count     = 1 ,
  className = ""
}: SkeletonProps ) {
  const style: React.CSSProperties = {
    width ,
    height ,
    borderRadius: radius
  } ;

  if( count <= 1 ) {
    return( <div className={ `skeleton ${className}` } style={style} /> ) ;
  }

  return(
    <div className={styles.stack}>
      { Array.from( {length: count} ).map( ( _ , index ) => (
        <div key={index} className={ `skeleton ${className}` } style={style} />
      ) ) }
    </div>
  ) ;
}
