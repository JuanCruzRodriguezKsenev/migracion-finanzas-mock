/**
 * @file FormActions.tsx
 * Barra de acciones estándar de formulario (Cancelar / Guardar).
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
// Librerías externas
import React from "react" ;

// Shared UI
import { Button } from "@/shared/ui/display/Button/Button" ;

// Local styles
import styles from "./Form.module.css" ;


interface FormActionsProps {
  onCancel:       () => void ;
  cancelLabel?:   string ;
  submitLabel?:   string ;
  submitting?:    boolean ;
  /** Deshabilita sólo el botón de enviar (por ejemplo, mientras el formulario no se puede guardar). */
  submitDisabled?: boolean ;
  /** Oculta el botón de enviar: formularios de solo lectura (un `viewer` no guarda nada). */
  hideSubmit?:    boolean ;
  cancelVariant?: "primary" | "secondary" | "outline" ;
  submitVariant?: "primary" | "secondary" | "outline" ;
  className?:     string ;
}

/**
 * Par de botones Cancelar/Guardar con estado de envío compartido.
 */
export function FormActions( {
  onCancel ,
  cancelLabel = "Cancelar" ,
  submitLabel = "Guardar" ,
  submitting = false ,
  submitDisabled = false ,
  hideSubmit = false ,
  cancelVariant = "secondary" ,
  submitVariant = "primary" ,
  className = ""
}: FormActionsProps ) {
  return(
    <div className={ `${styles.formActions} ${className}` }>
      <Button 
        type="button" 
        variant={cancelVariant} 
        onClick={onCancel}
        disabled={submitting}
      >
        { cancelLabel }
      </Button>
      {!hideSubmit && (
        <Button 
          type="submit" 
          variant={submitVariant}
          isLoading={submitting}
          disabled={submitDisabled}
        >
          { submitLabel }
        </Button>
      )}
    </div>
  ) ;
}
