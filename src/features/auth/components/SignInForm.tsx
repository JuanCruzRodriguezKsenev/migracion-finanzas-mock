/**
 * @file SignInForm.tsx
 * Formulario de inicio de sesión (Sign In) interactivo (Client Component).
 * Refactorizado utilizando la biblioteca de componentes de formulario compartidos.
 */
"use client" ;

// Librerías externas
import { useRouter , useSearchParams } from "next/navigation" ;
import { signIn }            from "next-auth/react" ;
import React , { useState }  from "react" ;

// Feature: Auth
import { ERROR_DEMASIADOS_INTENTOS } from "@/features/auth/constants" ;

// Shared UI
import { PasswordInput } from "@/shared/ui/forms/Form/PasswordInput" ;
import { Button }        from "@/shared/ui/display/Button/Button" ;
import { FormInput }     from "@/shared/ui/forms/Form/FormInput" ;
import { FormError }     from "@/shared/ui/forms/Form/FormError" ;
import { Card }          from "@/shared/ui/display/Card/Card" ;

// Local styles
import styles from "./Signin.module.css" ;


interface SignInFormProps {
  lang: string ;
  dict: {
    title:           string ;
    emailLabel:      string ;
    passwordLabel:   string ;
    submitBtn:       string ;
    loadingBtn:      string ;
    errorMsg:        string ;
    unexpectedError: string ;
    tooManyAttempts?: string ;
  } ;
}

/**
 * Valida el destino posterior al login para no convertir el formulario en un redirector abierto.
 * Sólo se acepta una ruta interna: cualquier URL absoluta a otro origen se descarta.
 *
 * @param callbackUrl - Valor recibido por query string, controlado por quien arma el enlace.
 * @param lang - Idioma vigente, usado como destino de reserva.
 * @returns Una ruta interna segura a la que navegar.
 */
function resolverDestino( callbackUrl: string | null , lang: string ): string {
  const porDefecto = `/${lang}` ;

  if( !callbackUrl ) { return( porDefecto ) ; }

  // Una ruta relativa propia empieza con "/" y no con "//" (que el navegador lee como otro host).
  if( callbackUrl.startsWith( "/" ) && !callbackUrl.startsWith( "//" ) ) {
    return( callbackUrl ) ;
  }

  try {
    const destino = new URL( callbackUrl ) ;

    if( destino.origin === window.location.origin ) {
      return( `${destino.pathname}${destino.search}` ) ;
    }
  } catch {
    // Valor ilegible como URL: se ignora y se usa el destino por defecto.
  }

  return( porDefecto ) ;
}

/**
 * Componente cliente interactivo que contiene los campos y lógica de envío de sesión.
 */
export function SignInForm( { dict , lang }: SignInFormProps ) {
  const router               = useRouter() ;
  const searchParams         = useSearchParams() ;
  const [ email , setEmail ] = useState( "" ) ;
  const [ password , setPassword ] = useState( "" ) ;
  const [ error , setError ] = useState( "" ) ;
  const [ loading , setLoading ] = useState( false ) ;

  /**
   * Procesa el envío del formulario intentando iniciar sesión mediante el proveedor 'credentials'.
   * 
   * @param e - Evento de envío del formulario.
   */
  const handleSubmit = async ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( "" ) ;
    setLoading( true ) ;

    try {
      const result = await signIn( "credentials" , { email , password , redirect: false } ) ;

      if( result?.error ) {
        // El bloqueo por fuerza bruta es la única causa que se distingue: decir "demasiados
        // intentos" no revela si la cuenta existe, y sin ese aviso el usuario legítimo repetiría
        // su contraseña correcta creyendo que se equivoca.
        const esBloqueo = result.error.includes( ERROR_DEMASIADOS_INTENTOS ) ;

        setError( esBloqueo ? ( dict.tooManyAttempts || dict.errorMsg ) : dict.errorMsg ) ;
      } else {
        // Volver a donde el usuario quería ir, que el proxy dejó en `callbackUrl` al interceptarlo.
        router.push( resolverDestino( searchParams.get( "callbackUrl" ) , lang ) ) ;
        router.refresh() ;
      }
    } catch {
      setError( dict.unexpectedError ) ;
    } finally {
      setLoading( false ) ;
    }
  } ;

  return(
    <div className={styles.container}>
      <Card className={styles.card}>
        <h2 className={styles.header}>{ dict.title }</h2>

        <FormError error={error} />

        <form onSubmit={handleSubmit} className={styles.form}>
          <FormInput
            id="email"
            type="email"
            label={dict.emailLabel}
            value={email}
            onChange={ ( e ) => setEmail( e.target.value ) }
            required
            disabled={loading}
          />

          <PasswordInput
            id="password"
            label={dict.passwordLabel}
            value={password}
            onChange={ ( e ) => setPassword( e.target.value ) }
            required
            disabled={loading}
            showToggle={true}
            toggleLabels={ { show: "Mostrar" , hide: "Ocultar" } }
          />

          <Button
            type="submit"
            isLoading={loading}
            className={styles.submitButton}
          >
            { loading ? dict.loadingBtn : dict.submitBtn }
          </Button>
        </form>
      </Card>
    </div>
  ) ;
}
