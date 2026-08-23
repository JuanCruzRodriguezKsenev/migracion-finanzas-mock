/**
 * @file Submit.tsx
 * Botón de envío que refleja automáticamente el estado `pending` del formulario
 * padre vía `useFormStatus` (React Server Actions).
 * @remarks Componente de catálogo — aún sin consumidores en producción.
 */
"use client" ;

// Librerías externas
import { useFormStatus } from "react-dom" ;

// Shared UI
import { Button } from "@/shared/ui/display/Button/Button" ;


interface SubmitButtonProps {
  children:   React.ReactNode ;
  className?: string ;
  variant?:   "primary" | "secondary" | "outline" | "danger" ;
}

/**
 * Botón de submit consciente del estado de pendiente del `<form>` circundante.
 */
export default function SubmitButton( {
  children ,
  variant = "primary" ,
  className
}: SubmitButtonProps ) {
  const { pending } = useFormStatus() ;

  return(
    <Button
      type="submit"
      variant={variant}
      isLoading={pending}
      className={className}
      disabled={pending}
    >
      { children }
    </Button>
  ) ;
}
