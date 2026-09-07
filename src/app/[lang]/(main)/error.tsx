/**
 * @file error.tsx
 * Límite de error del segmento (main). Captura excepciones no controladas
 * en cualquier página del dashboard y ofrece un camino de recuperación.
 */
"use client" ;

// Librerías externas
import { useParams } from "next/navigation" ;
import { useEffect } from "react" ;

// Shared
import { EmptyState } from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Button }     from "@/shared/ui/display/Button/Button" ;

// Local styles
import styles from "./error.module.css" ;


const COPY = {
  es: {title: "Algo salió mal" , description: "Ocurrió un error inesperado al cargar esta página." , retry: "Reintentar" , goHome: "Ir al inicio"} ,
  en: {title: "Something went wrong" , description: "An unexpected error occurred while loading this page." , retry: "Retry" , goHome: "Go home"} ,
  br: {title: "Algo deu errado" , description: "Ocorreu um erro inesperado ao carregar esta página." , retry: "Tentar novamente" , goHome: "Ir para o início"}
} ;

interface DashboardErrorProps {
  error: Error & { digest?: string } ;
  reset: () => void ;
}

export default function DashboardError( { error , reset }: DashboardErrorProps ) {
  const params = useParams< {lang: string} >() ;
  const lang   = ( params.lang as keyof typeof COPY ) || "es" ;
  const copy   = ( COPY[lang] || COPY.es ) ;

  useEffect( () => {
    console.error( "Error capturado por el error boundary del dashboard:" , error ) ;
  } , [ error ] ) ;

  return(
    <div className={styles.container}>
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <div className={styles.actions}>
            <Button variant="primary" onClick={reset}>{ copy.retry }</Button>
            <Button variant="outline" onClick={ () => { window.location.href = `/${lang}` ; } }>
              { copy.goHome }
            </Button>
          </div>
        }
      />
    </div>
  ) ;
}
