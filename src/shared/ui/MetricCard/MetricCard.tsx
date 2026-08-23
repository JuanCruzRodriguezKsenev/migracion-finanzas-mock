/**
 * @file MetricCard.tsx
 * Tarjeta de métrica individual.
 * Soporta estados de carga (skeletons), variantes hero/default, sparklines,
 * y ofuscación/visibilidad de saldos sensibles integrada con el contexto.
 */
"use client" ;

// Librerías externas
import React , { useContext } from "react" ;

// Shared
import { MetricsVisibilityContext } from "@/shared/ui/layout/MetricsSection/MetricsVisibilityContext" ;
import { Skeleton }                 from "@/shared/ui/feedback/Skeleton/Skeleton" ;
import { Card }                     from "@/shared/ui/display/Card/Card" ;
import styles                       from "./MetricCard.module.css" ;

interface MetricCardProps {
  title?:               string ;
  value?:               string | number ;
  count?:               string ;
  trend?: {
    value:      string ;
    isPositive: boolean ;
    isRising?:  boolean ;
    label?:     string ;
  } ;
  icon?:                React.ReactNode ;
  isDanger?:            boolean ;
  className?:           string ;
  iconBg?:              string ;
  iconColor?:           string ;
  sparkline?:           React.ReactNode ;
  children?:            React.ReactNode ;
  isLoading?:           boolean ;
  variant?:             "default" | "hero" ;
  hasVisibilityToggle?: boolean ;
  valueLabel?:          string ;
  secondValue?:         string | number ;
  secondValueLabel?:    string ;
  progressBar?:         React.ReactNode ;
  progressLabel?:       string ;
  isMuted?:             boolean ;
  isSensitive?:         boolean ;
}

/**
 * Componente de tarjeta de métrica financiera.
 */
export function MetricCard( {
  title = "" ,
  value = "" ,
  count ,
  trend ,
  icon ,
  isDanger = false ,
  className = "" ,
  iconBg ,
  iconColor ,
  sparkline ,
  children ,
  isLoading = false ,
  variant = "default" ,
  hasVisibilityToggle = false ,
  valueLabel ,
  secondValue ,
  secondValueLabel ,
  progressBar ,
  progressLabel ,
  isMuted = false ,
  isSensitive = true
}: MetricCardProps ) {
  const { isContentVisible , toggleVisibility } = useContext( MetricsVisibilityContext ) ;

  const displayValue = ( isSensitive && !isContentVisible && !isLoading && ( value !== undefined ) && ( value !== null ) ) ? "" : value ;
  const displaySecondValue = ( isSensitive && !isContentVisible && !isLoading && ( secondValue !== undefined ) && ( secondValue !== null ) ) ? "" : secondValue ;

  if( isLoading ) {
    if( variant === "hero" ) {
      return(
        <Card className={ `${styles.heroCard} ${styles.pulse} ${className}` }>
          <div className={styles.heroContent}>
            <div className={styles.heroHeader}>
              <div className={styles.heroSkeletonLabel} />
            </div>
            <div className={styles.heroSkeletonValue} />
            <div className={styles.heroSkeletonTrend} />
          </div>
        </Card>
      ) ;
    }
    return(
      <Card className={ `${styles.metricCard} ${className}` }>
        <Skeleton height="0.75rem"   width="60%" />
        <Skeleton height="1.3125rem" width="80%" />
        <Skeleton height="0.5625rem" width="50%" />
      </Card>
    ) ;
  }

  if( variant === "hero" ) {
    const toggleIcon = isContentVisible ? (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ) : (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ) ;

    return(
      <Card className={ `${styles.heroCard} ${isMuted ? styles.heroCardMuted : ""} ${className}` }>
        <div className={styles.heroContent}>
          <div className={styles.heroHeader}>
            <span className={styles.heroLabel}>{title}</span>
            {hasVisibilityToggle ? (
              <button
                type="button"
                className={styles.visibilityButton}
                onClick={toggleVisibility}
                aria-label={isContentVisible ? "Ocultar saldos" : "Mostrar saldos"}
                title={isContentVisible ? "Ocultar saldos" : "Mostrar saldos"}
                disabled={isMuted}
              >
                {toggleIcon}
              </button>
            ) : (
              icon && (
                <span className={styles.heroIcon}>
                  {icon}
                </span>
              )
            )}
          </div>
          {secondValue !== undefined ? (
            <div className={styles.dualValuesContainer}>
              <div>
                <div className={styles.dualValueLabel}>{valueLabel}</div>
                <div className={styles.dualValue}>{isMuted ? "—" : displayValue}</div>
              </div>
              <div>
                <div className={styles.dualValueLabel}>{secondValueLabel}</div>
                <div className={styles.dualValue}>{isMuted ? "—" : displaySecondValue}</div>
              </div>
            </div>
          ) : (
            ( displayValue !== "" ) && <div className={styles.heroValue}>{isMuted ? "—" : displayValue}</div>
          )}
          {trend && !isMuted && (
            <div className={styles.heroTrend}>
              <span className={ `${trend.isPositive ? styles.trendUp : styles.trendDown} ${styles.trendSpan}` }>
                { ( ( trend.isRising !== undefined ) ? trend.isRising : trend.isPositive ) ? (
                  <svg className={styles.trendArrowSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                ) : (
                  <svg className={styles.trendArrowSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <polyline points="19 12 12 19 5 12" />
                  </svg>
                ) }
                <span className={styles.trendValueText}>{trend.value}</span>
              </span>
              {trend.label && <span className={styles.trendLabel}> {trend.label}</span>}
            </div>
          )}
          {progressBar && !isMuted && (
            <div className={styles.progressContainer}>
              {progressBar}
              {progressLabel && <div className={styles.progressLabel}>{progressLabel}</div>}
            </div>
          )}
          {sparkline && !isMuted && (
            <div className={styles.heroSparkline}>
              {sparkline}
            </div>
          )}
        </div>
        {children}
      </Card>
    ) ;
  }

  const displayLabel = title ;
  const iconStyle: React.CSSProperties = {} ;
  if( iconBg ) { iconStyle.backgroundColor = iconBg ; }
  if( iconColor ) { iconStyle.color = iconColor ; }

  return(
    <Card className={ `${styles.metricCard} ${isMuted ? styles.metricCardMuted : ""} ${className}` }>
      <div className={styles.metricTop}>
        <span className={styles.metricLabel}>{displayLabel}</span>
        {icon && (
          <div
            className={ `${styles.metricIcon} ${!iconBg ? styles.iconBlue : ""}` }
            style={iconStyle}
          >
            {icon}
          </div>
        )}
      </div>
      <div className={ `${styles.metricValue} ${( isDanger && !isMuted ) ? styles.balanceNegative : ""}` }>
        {isMuted ? "—" : displayValue}
      </div>
      {count && !isMuted && (
        <div className={styles.metricCount}>
          {count}
        </div>
      )}
      {trend && !isMuted && (
        <div className={ `${styles.metricTrend} ${trend.isPositive ? styles.trendUp : styles.trendDown}` }>
          <span className={styles.trendSpan}>
            { ( ( trend.isRising !== undefined ) ? trend.isRising : trend.isPositive ) ? (
              <svg className={styles.trendArrowSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            ) : (
              <svg className={styles.trendArrowSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            ) }
            <span className={styles.trendValueText}>{trend.value}</span>
          </span>
          {trend.label && <span className={styles.trendLabel}> {trend.label}</span>}
        </div>
      )}
      {sparkline && !isMuted && (
        <div className={styles.metricSparkline}>
          {sparkline}
        </div>
      )}
      {children}
    </Card>
  ) ;
}
