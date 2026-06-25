/**
 * @file page.tsx
 * Página de inicio de sesión (Sign In) internacionalizada y protegida.
 * Utiliza CSS Modules y variables globales de estilos.
 */
"use client" ;

import { useState } from "react" ;
import { signIn } from "next-auth/react" ;
import { useRouter } from "next/navigation" ;
import styles from "./signin.module.css" ;

interface SignInPageProps {
  params: Promise< {lang: string} > ;
}

/**
 * Componente de interfaz de usuario para la pantalla de inicio de sesión.
 * Captura credenciales del usuario y se comunica con la API de sesión.
 */
export default function SignInPage( {params}: SignInPageProps ) {
  const router = useRouter() ;
  const [ email    , setEmail    ] = useState( "" ) ;
  const [ password , setPassword ] = useState( "" ) ;
  const [ error    , setError    ] = useState( "" ) ;
  const [ loading  , setLoading  ] = useState( false ) ;

  /**
   * Procesa el envío del formulario intentando iniciar sesión mediante el proveedor 'credentials' de NextAuth.
   * Desactiva la redirección por defecto para gestionar los errores de forma reactiva en pantalla.
   * 
   * @param e - Evento de envío del formulario.
   */
  const handleSubmit = async ( e: React.FormEvent ) => {
    e.preventDefault() ;
    setError( "" ) ;
    setLoading( true ) ;

    try {
      const result = await signIn( "credentials" , {
        email ,
        password ,
        redirect: false ,
      } ) ;

      if( result?.error ){
        setError( "Credenciales incorrectas. Intenta de nuevo." ) ;
      } else {
        router.push( "/" ) ;
        router.refresh() ;
      }
    } catch( err ) {
      setError( "Ocurrió un error inesperado al iniciar sesión." ) ;
    } finally {
      setLoading( false ) ;
    }
  } ;

  return(
    <div className={styles.container}>
      <div className={styles.card}>
        <h2 className={styles.header}>Iniciar Sesión</h2>

        {!!error && (
          <div className={styles.error}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={ (e) => setEmail(e.target.value) }
              required
              className={styles.input}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label htmlFor="password" className={styles.label}>Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={ (e) => setPassword(e.target.value) }
              required
              className={styles.input}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? "Cargando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  ) ;
}
