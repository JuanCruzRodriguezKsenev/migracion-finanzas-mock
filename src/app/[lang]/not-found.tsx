/**
 * @file not-found.tsx
 * Página 404 localizada para rutas inexistentes dentro de un locale.
 */
"use client" ;

// Librerías externas
import { useParams } from "next/navigation" ;
import Link          from "next/link" ;

// Shared
import { EmptyState } from "@/shared/ui/feedback/EmptyState/EmptyState" ;
import { Button }     from "@/shared/ui/display/Button/Button" ;

// Local styles
import styles from "./not-found.module.css" ;


const COPY = {
  es: {title: "Página no encontrada" , description: "La página que buscás no existe o fue movida." , goHome: "Ir al inicio"} ,
  en: {title: "Page not found" , description: "The page you're looking for doesn't exist or was moved." , goHome: "Go home"} ,
  br: {title: "Página não encontrada" , description: "A página que você procura não existe ou foi movida." , goHome: "Ir para o início"}
} ;

export default function NotFound() {
  const params = useParams< {lang: string} >() ;
  const lang   = ( ( params?.lang as keyof typeof COPY ) || "es" ) ;
  const copy   = ( COPY[lang] || COPY.es ) ;

  return(
    <div className={styles.container}>
      <EmptyState
        title={copy.title}
        description={copy.description}
        action={
          <Link href={`/${lang}`}>
            <Button variant="primary">{ copy.goHome }</Button>
          </Link>
        }
      />
    </div>
  ) ;
}
