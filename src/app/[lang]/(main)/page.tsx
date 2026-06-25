/**
 * @file page.tsx
 * Página de inicio (Dashboard) bajo el grupo de rutas principales (main) y localización por lang.
 */
import styles from "./page.module.css" ;

interface HomePageProps {
  params: Promise< {lang: string} > ;
}

export default async function HomePage( {params}: HomePageProps ) {
  const { lang } = await params ;

  return(
    <div className={styles.container}>
      <h1 className={styles.title}>FinanzIA Dashboard</h1>
      <p className={styles.subtitle}>
        Bienvenido a tu panel financiero. Idioma actual: <span className={styles.badge}>{lang}</span>
      </p>
    </div>
  ) ;
}
