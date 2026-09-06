/**
 * @file MetricsSection.tsx
 * Sección contenedora de métricas.
 * Agrupa una tarjeta principal tipo "Hero" y una grilla responsiva de tarjetas.
 * Inyecta el proveedor de visibilidad (MetricsVisibilityProvider) de forma transparente.
 */
"use client" ;

// Librerías externas
import React from "react" ;

// Shared
import { MetricsVisibilityContext , MetricsVisibilityProvider , useMetricsVisibility } from "./MetricsVisibilityContext" ;
import { Sparkline , SparklinePoint }                                 from "@/shared/ui/display/RechartsSparkline/Sparkline" ;
import { MetricCard }                                                 from "@/shared/ui/MetricCard/MetricCard" ;
import styles                                                         from "./MetricsSection.module.css" ;

export interface HeroProps {
  label:            string ;
  value?:           string | number ;
  valueLabel?:      string ;
  secondValue?:     string | number ;
  secondValueLabel?:string ;
  progressBar?:     React.ReactNode ;
  progressLabel?:   string ;
  trend?: {
    value:      string ;
    isPositive: boolean ;
    isRising?:  boolean ;
    label?:     string ;
  } ;
  sparklineData?:   number[] ;
  sparklinePoints?: SparklinePoint[] ;
  lang?:            string ;
  isInverted?:      boolean ;
  icon?:            React.ReactNode ;
  isMuted?:         boolean ;
  referenceDate?:   Date ;
}

interface MetricsSectionProps {
  hero?:                  HeroProps ;
  heroComponent?:         React.ReactNode ;
  isLoading?:             boolean ;
  skeletonCount?:         number ;
  allowVisibilityToggle?: boolean ;
  children:               React.ReactNode ;
}

/**
 * Contenido interno de la sección de métricas.
 * Consume el contexto de visibilidad.
 */
function MetricsSectionInner( {
  hero ,
  heroComponent ,
  isLoading = false ,
  skeletonCount = 4 ,
  allowVisibilityToggle = false ,
  children
}: MetricsSectionProps ) {
  const global = useMetricsVisibility() ;

  const contextValue = {
    isContentVisible: allowVisibilityToggle ? global.isContentVisible : true ,
    toggleVisibility: global.toggleVisibility
  } ;

  const content = heroComponent ? (
    <div className={styles.heroLayout}>
      {heroComponent}
      <div className={styles.cardsGrid}>
        {isLoading ? (
          Array.from( {length: skeletonCount} ).map( ( _ , i ) => (
            <MetricCard key={i} isLoading={true} />
          ) )
        ) : (
          children
        )}
      </div>
    </div>
  ) : hero ? (
    <div className={styles.heroLayout}>
      <MetricCard
        variant="hero"
        title={hero.label}
        value={hero.value}
        trend={hero.trend}
        sparkline={
          ( hero.sparklinePoints && ( hero.sparklinePoints.length > 0 ) ) ? (
            <Sparkline
              points={hero.sparklinePoints}
              color="rgba(255, 255, 255, 0.8)"
              height="100%"
              lang={hero.lang}
              isInverted={hero.isInverted}
              fullWidth={true}
            />
          ) : ( hero.sparklineData && ( hero.sparklineData.length > 0 ) ) ? (
            <Sparkline
              data={hero.sparklineData}
              color="rgba(255, 255, 255, 0.8)"
              height="100%"
              lang={hero.lang}
              isInverted={hero.isInverted}
              fullWidth={true}
              referenceDate={hero.referenceDate}
            />
          ) : undefined
        }
        icon={hero.icon}
        isLoading={isLoading}
        hasVisibilityToggle={allowVisibilityToggle}
        valueLabel={hero.valueLabel}
        secondValue={hero.secondValue}
        secondValueLabel={hero.secondValueLabel}
        progressBar={hero.progressBar}
        progressLabel={hero.progressLabel}
        isMuted={hero.isMuted}
      />
      <div className={styles.cardsGrid}>
        {isLoading ? (
          Array.from( {length: skeletonCount} ).map( ( _ , i ) => (
            <MetricCard key={i} isLoading={true} />
          ) )
        ) : (
          children
        )}
      </div>
    </div>
  ) : (
    <div className={styles.simpleGrid}>
      {isLoading ? (
        Array.from( {length: skeletonCount} ).map( ( _ , i ) => (
          <MetricCard key={i} isLoading={true} />
        ) )
      ) : (
        children
      )}
    </div>
  ) ;

  return(
    <MetricsVisibilityContext.Provider value={contextValue}>
      { content }
    </MetricsVisibilityContext.Provider>
  ) ;
}

/**
 * Componente principal MetricsSection.
 * Consume directamente el proveedor global configurado en el layout de la app.
 */
export function MetricsSection( props: MetricsSectionProps ) {
  return(
    <MetricsSectionInner {...props} />
  ) ;
}

