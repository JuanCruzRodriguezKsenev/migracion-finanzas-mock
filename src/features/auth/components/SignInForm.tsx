/**
 * @file SignInForm.tsx
 * Formulario de inicio de sesión (Sign In) interactivo (Client Component).
 * Refactorizado utilizando la biblioteca de componentes de formulario compartidos.
 */
"use client" ;

// Librerías externas
import { useRouter } from "next/navigation" ;
import { signIn }    from "next-auth/react" ;
import React , { useState }  from "react" ;

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
  } ;
}

/**
 * Componente cliente interactivo que contiene los campos y lógica de envío de sesión.
 */
export function SignInForm( { dict , lang }: SignInFormProps ) {
  const router               = useRouter() ;
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
        setError( dict.errorMsg ) ;
      } else {
        router.push( `/${lang}` ) ;
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
