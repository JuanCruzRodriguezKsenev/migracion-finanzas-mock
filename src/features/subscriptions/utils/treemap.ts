/**
 * @file treemap.ts
 * Algoritmo de treemap "squarified": distribuye rectángulos proporcionales al peso
 * de cada nodo minimizando la relación de aspecto (tiles lo más cuadrados posible).
 * Lógica pura sin dependencias — las coordenadas usan las unidades del lienzo recibido.
 */

/**
 * Nodo de entrada del treemap.
 */
export interface TreemapNode {
  id:     string ;
  name:   string ;
  price:  number ;
  weight: number ;
}

/**
 * Rectángulo calculado del treemap, en las mismas unidades del lienzo de entrada.
 */
export interface TreemapRect {
  id:     string ;
  name:   string ;
  price:  number ;
  x:      number ;
  y:      number ;
  width:  number ;
  height: number ;
}

/**
 * Calcula la peor relación de aspecto de una fila de áreas para un lado dado.
 * Es la métrica que el algoritmo squarified minimiza al decidir si agregar
 * un área más a la fila actual o cerrar la fila.
 */
function worstAspectRatio( row: number[] , length: number ): number {
  if( row.length === 0 ){ return( Infinity ) ; }

  const sum = row.reduce( ( a , b ) => a + b , 0 ) ;
  const min = Math.min( ...row ) ;
  const max = Math.max( ...row ) ;

  const sumSq    = sum * sum ;
  const lengthSq = length * length ;

  return( Math.max(
    (lengthSq * max) / sumSq ,
    sumSq / (lengthSq * min)
  ) ) ;
}

/**
 * Distribuye los nodos en rectángulos proporcionales a su peso dentro del lienzo.
 *
 * @param nodes - Nodos con su peso relativo (mayor peso = mayor área).
 * @param width - Ancho del lienzo (por defecto 100, para trabajar en porcentajes).
 * @param height - Alto del lienzo (por defecto 100).
 * @returns Rectángulos posicionados, en las unidades del lienzo.
 */
export function computeTreemap(
  nodes:  TreemapNode[] ,
  width:  number = 100 ,
  height: number = 100
): TreemapRect[] {
  const sorted      = [ ...nodes ].sort( ( a , b ) => b.weight - a.weight ) ;
  const totalWeight = sorted.reduce( ( sum , n ) => sum + n.weight , 0 ) ;

  if( totalWeight === 0 ){ return( [] ) ; }

  const totalArea = width * height ;
  const scale     = totalArea / totalWeight ;
  const areas     = sorted.map( ( n ) => n.weight * scale ) ;

  const rects: TreemapRect[] = [] ;

  let currentX = 0 ;
  let currentY = 0 ;
  let currentW = width ;
  let currentH = height ;

  let i = 0 ;
  while( i < areas.length ){
    const side               = Math.min( currentW , currentH ) ;
    const row: number[]      = [] ;
    const rowNodes: TreemapNode[] = [] ;

    // Agregar áreas a la fila mientras mejore (o mantenga) la peor relación de aspecto
    let worst = Infinity ;
    while( i < areas.length ){
      const area      = areas[i] ;
      const nextRow   = [ ...row , area ] ;
      const nextWorst = worstAspectRatio( nextRow , side ) ;

      if( nextWorst <= worst ){
        row.push( area ) ;
        rowNodes.push( sorted[i] ) ;
        worst = nextWorst ;
        i++ ;
      } else {
        break ;
      }
    }

    const rowAreaSum   = row.reduce( ( a , b ) => a + b , 0 ) ;
    const isHorizontal = ( currentW >= currentH ) ;
    const rowLength    = isHorizontal ? rowAreaSum / currentH : rowAreaSum / currentW ;

    let offset = 0 ;
    for( let j = 0 ; j < row.length ; j++ ){
      const area          = row[j] ;
      const node          = rowNodes[j] ;
      const segmentLength = area / rowLength ;

      if( isHorizontal ){
        rects.push( {
          id:     node.id ,
          name:   node.name ,
          price:  node.price ,
          x:      Number( currentX.toFixed( 4 ) ) ,
          y:      Number( (currentY + offset).toFixed( 4 ) ) ,
          width:  Number( rowLength.toFixed( 4 ) ) ,
          height: Number( segmentLength.toFixed( 4 ) ) ,
        } ) ;
      } else {
        rects.push( {
          id:     node.id ,
          name:   node.name ,
          price:  node.price ,
          x:      Number( (currentX + offset).toFixed( 4 ) ) ,
          y:      Number( currentY.toFixed( 4 ) ) ,
          width:  Number( segmentLength.toFixed( 4 ) ) ,
          height: Number( rowLength.toFixed( 4 ) ) ,
        } ) ;
      }
      offset += segmentLength ;
    }

    if( isHorizontal ){
      currentX += rowLength ;
      currentW -= rowLength ;
    } else {
      currentY += rowLength ;
      currentH -= rowLength ;
    }
  }

  return( rects ) ;
}
