/**
 * @file ProfileContext.tsx
 * Proveedor y contexto de React para la gestión del perfil de usuario (Client Component).
 */
"use client" ;

// Librerías externas
import React , { createContext , useState , useEffect , useContext } from "react" ;

// Shared
import { Result , ok , fail } from "@/shared/lib/result" ;

// Feature: Profile
import { updateProfileAction }  from "../actions/profileActions" ;
import { UpdateProfileInput }   from "../schemas/profile.schema" ;
import { ProfileData }          from "../types" ;

interface ProfileContextType {
  profile:        ProfileData ;
  loading:        boolean ;
  error:          string | null ;
  // El tipo de entrada es el del esquema Zod, no Partial<ProfileData>: la acción valida en modo
  // estricto y rechaza las columnas comerciales (planName, planBilling, planNextCharge) que sí
  // viven en ProfileData. Tiparlo acá hace que el compilador lo diga antes que el servidor.
  updateProfile:  ( data: UpdateProfileInput ) => Promise< Result<ProfileData , string> > ;
  refreshProfile: () => Promise< void > ;
}

const ProfileContext = createContext< ProfileContextType | undefined >( undefined ) ;

export function ProfileProvider( {children , initialProfile}: {children: React.ReactNode ; initialProfile: ProfileData} ) {
  const [ profile , setProfile ] = useState< ProfileData >( initialProfile ) ;
  const [ loading , setLoading ] = useState( false ) ;
  const [ error   , setError   ] = useState< string | null >( null ) ;

  const theme = profile?.theme ;

  // Sincroniza el tema en caliente y guarda la preferencia en localStorage para el script de bloqueo
  useEffect( () => {
    if( !theme ){ return ; }

    let activeTheme = theme ;

    if( theme === "system" ){
      activeTheme = window.matchMedia( "(prefers-color-scheme: dark)" ).matches ? "dark" : "light" ;
    }

    document.documentElement.setAttribute( "data-theme" , activeTheme ) ;
    localStorage.setItem( "theme" , theme ) ;
  } , [ theme ] ) ;

  async function updateProfile( newData: UpdateProfileInput ): Promise< Result<ProfileData , string> > {
    setLoading( true ) ;
    setError( null ) ;
    
    // Actualización optimista de estado local
    const oldProfile = profile ;
    
    setProfile( (prev) => ({...prev , ...newData}) ) ;

    try {
      const res = await updateProfileAction( newData ) ;

      if( res.success ){
        setProfile( res.value ) ;
        
        return( ok(res.value) ) ;
      } else {
        // Revertir estado local si la Server Action falla
        setProfile( oldProfile ) ;
        setError( res.error || "Error al guardar el perfil en el servidor." ) ;
        
        return( fail(res.error || "Error al guardar el perfil en el servidor.") ) ;
      }
    } catch( err ) {
      // Revertir estado local en caso de excepción inesperada
      setProfile( oldProfile ) ;
      
      const errMsg = ( (err as Error).message || "Error al actualizar el perfil." ) ;
      
      setError( errMsg ) ;
      
      return( fail(errMsg) ) ;
    } finally {
      setLoading( false ) ;
    }
  }

  async function refreshProfile() {
    // La revalidación se delega al servidor
  }

  return(
    <ProfileContext.Provider value={ {profile , loading , error , updateProfile , refreshProfile} }>
      {children}
    </ProfileContext.Provider>
  ) ;
}

export function useProfileContext() {
  const context = useContext( ProfileContext ) ;
  
  if( context === undefined ){
    throw new Error( "useProfileContext debe utilizarse dentro de un ProfileProvider." ) ;
  }
  
  return( context ) ;
}
