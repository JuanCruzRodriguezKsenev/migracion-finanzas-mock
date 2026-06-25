/**
 * @file layout.tsx
 * Layout estructural (App Shell) para las rutas principales bajo el grupo (main).
 * Incorpora la barra lateral y el encabezado de navegación global.
 */
import { Sidebar } from "@/shared/components/Sidebar" ;
import { Header } from "@/shared/components/Header" ;

interface MainLayoutProps {
  children: React.ReactNode ;
}

export default function MainLayout( {children}: MainLayoutProps ) {
  return(
    <div className="app-container">
      <Sidebar />
      <div className="main-wrapper">
        <Header />
        <main>
          {children}
        </main>
      </div>
    </div>
  ) ;
}
