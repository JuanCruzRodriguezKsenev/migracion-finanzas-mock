/**
 * @file ProfileContext.tsx
 * Proveedor de contexto global de React para el perfil y preferencias del usuario.
 */
"use client" ;

import React , { createContext , useState , useEffect , useContext } from "react" ;
import { ProfileData } from "../types" ;
import { updateProfileAction } from "../actions/profileActions" ;

interface ProfileContextType {
  profile:        ProfileData ;
  loading:        boolean ;
  error:          string | null ;
  updateProfile:  ( data: Partial< ProfileData > ) => Promise< ProfileData > ;
  refreshProfile: () => Promise< void > ;
}

const ProfileContext = createContext< ProfileContextType | undefined >( undefined ) ;

export function ProfileProvider( {children , initialProfile}: {children: React.ReactNode ; initialProfile: ProfileData} ) {
  const [ profile , setProfile ] = useState< ProfileData >( initialProfile ) ;
  const [ loading , setLoading ] = useState( false ) ;
  const [ error   , setError   ] = useState< string | null >( null ) ;

  // Sincroniza el tema en caliente y guarda la preferencia en localStorage para el script de bloqueo
  useEffect( () => {
    if( !(profile) || !(profile.theme) ){
      return ;
    }

    let activeTheme = profile.theme ;

    if( profile.theme === "system" ){
      activeTheme = window.matchMedia( "(prefers-color-scheme: dark)" ).matches ? "dark" : "light" ;
    }

    document.documentElement.setAttribute( "data-theme" , activeTheme ) ;
    localStorage.setItem( "theme" , profile.theme ) ;
  } , [profile.theme] ) ;

  async function updateProfile( newData: Partial< ProfileData > ): Promise< ProfileData > {
    setLoading( true ) ;
    setError( null ) ;
    
    // Actualización optimista de estado local
    const oldProfile = profile ;
    setProfile( (prev) => ( { ...prev , ...newData } ) ) ;

    try {
      const res = await updateProfileAction( newData ) ;
      if( (res.isOk) && (res.value) ){
        setProfile( res.value ) ;
        return( res.value ) ;
      } else {
        throw new Error( (res.error?.message) || "Error al guardar el perfil en el servidor." ) ;
      }
    } catch( err ) {
      // Revertir estado local en caso de error
      setProfile( oldProfile ) ;
      setError( (err as Error).message ) ;
      throw err ;
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
