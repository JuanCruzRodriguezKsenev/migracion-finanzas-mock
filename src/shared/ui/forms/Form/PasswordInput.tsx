/**
 * @file PasswordInput.tsx
 * Campo de contraseña con toggle de visibilidad y validación de reglas de fortaleza en vivo
 * (ej: longitud mínima, mayúsculas, números), con indicador visual de requisitos cumplidos.
 */
"use client" ;

// Librerías externas
import React , {
  ChangeEvent ,
  FocusEvent ,
  forwardRef ,
  useMemo ,
  useEffect ,
  useImperativeHandle ,
  useRef ,
  useState ,
  useId
} from "react" ;

// Local styles
import styles from "./PasswordInput.module.css" ;


export interface PasswordRule {
  id:       string ;
  label:    string ;
  test:     ( value: string ) => boolean ;
  enabled?: boolean ;
}

interface PasswordInputProps extends Omit< React.InputHTMLAttributes< HTMLInputElement > , "type" | "onChange" > {
  label?:             string ;
  error?:             string ;
  rules?:             PasswordRule[] ;
  showRequirements?:  "always" | "focus" | "filled" | "never" ;
  validationMessage?: string ;
  showToggle?:        boolean ;
  toggleLabels?: {
    show: string ;
    hide: string ;
  } ;
  onValidityChange?: ( isValid: boolean , results: Record< string , boolean > ) => void ;
  onChange?:         ( event: ChangeEvent< HTMLInputElement > ) => void ;
}

/**
 * Input de contraseña con botón de mostrar/ocultar y checklist de reglas de validez en vivo.
 */
export const PasswordInput = forwardRef< HTMLInputElement , PasswordInputProps >( function PasswordInput( {
  label ,
  error ,
  rules = [] ,
  showRequirements = "focus" ,
  validationMessage = "La contraseña no cumple los requisitos." ,
  showToggle = true ,
  toggleLabels = { show: "Mostrar" , hide: "Ocultar" } ,
  onValidityChange ,
  className = "" ,
  defaultValue ,
  value ,
  onChange ,
  onFocus ,
  onBlur ,
  ...props
} , ref ) {
  const inputRef                     = useRef< HTMLInputElement >( null ) ;
  const [ isFocused , setIsFocused ] = useState( false ) ;
  const [ revealed , setRevealed ]   = useState( false ) ;
  const [ internalValue , setInternalValue ] = useState( ( value ?? defaultValue ?? "" ).toString() ) ;
  
  const currentValue = ( value !== undefined ? value.toString() : internalValue ) ;

  const generatedId    = useId() ;
  const id             = ( props.id || generatedId ) ;
  const errorId        = ( error ? `${id}-error` : undefined ) ;
  const requirementsId = `${id}-requirements` ;

  const safeRules     = ( Array.isArray( rules ) ? rules : [] ) ;
  const activeRules   = safeRules.filter( ( rule ) => rule.enabled !== false ) ;
  const activeRuleIds = activeRules.map( ( r ) => r.id ).join( "," ) ;
  
  const results = useMemo( () => {
    return(
      activeRules.reduce< Record< string , boolean > >( ( acc , rule ) => {
        try {
          acc[rule.id] = rule.test( currentValue ) ;
        } catch {
          acc[rule.id] = false ;
        }
        return( acc ) ;
      } , {} )
    ) ;
  } , [ currentValue , activeRuleIds ] ) ;

  const isValid = ( activeRules.length ? Object.values( results ).every( Boolean ) : true ) ;

  const shouldShowRequirements = (
    showRequirements === "always" ||
    ( showRequirements === "focus" && isFocused ) ||
    ( showRequirements === "filled" && currentValue.length > 0 )
  ) ;

  const requirementsRefId = ( shouldShowRequirements ? requirementsId : undefined ) ;
  const describedBy       = ( [ errorId , requirementsRefId ].filter( Boolean ).join( " " ) || undefined ) ;

  const onValidityChangeRef = useRef( onValidityChange ) ;
  useEffect( () => {
    onValidityChangeRef.current = onValidityChange ;
  } ) ;

  useEffect( () => {
    onValidityChangeRef.current?.( isValid , results ) ;
  } , [ isValid , results ] ) ;

  useEffect( () => {
    const input = inputRef.current ;
    if( !input ) { return ; }
    if( !activeRules.length || ( currentValue.length === 0 ) ) {
      input.setCustomValidity( "" ) ;
      return ;
    }
    input.setCustomValidity( isValid ? "" : validationMessage ) ;
  } , [ isValid , activeRules.length , currentValue , validationMessage ] ) ;

  useImperativeHandle( ref , () => inputRef.current! ) ;

  const handleInput = ( event: ChangeEvent< HTMLInputElement > ) => {
    const target = event.target ;
    onChange?.( event ) ;
    if( value === undefined ) {
      setInternalValue( target.value ) ;
    }
  } ;

  const handleFocus = ( event: FocusEvent< HTMLInputElement > ) => {
    setIsFocused( true ) ;
    onFocus?.( event ) ;
  } ;

  const handleBlur = ( event: FocusEvent< HTMLInputElement > ) => {
    setIsFocused( false ) ;
    onBlur?.( event ) ;
  } ;

  const handleToggle = () => {
    setRevealed( ( prev ) => !prev ) ;
  } ;

  return(
    <div className={ `${styles.group} ${className}` }>
      {label && (
        <label className={styles.label} htmlFor={id}>
          { label }
          {props.required && <span className={styles.required}> *</span>}
        </label>
      )}
      
      <div className={styles.passwordWrapper}>
        <input
          ref={inputRef}
          id={id}
          type={ revealed ? "text" : "password" }
          className={ `${styles.input} ${error ? styles.inputError : ""} ${showToggle ? styles.passwordHasToggle : ""}` }
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
          value={currentValue}
          onChange={handleInput}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />

        {showToggle && (
          <button
            type="button"
            className={styles.passwordToggle}
            onClick={handleToggle}
            aria-label={ revealed ? toggleLabels.hide : toggleLabels.show }
            aria-pressed={revealed}
          >
            {revealed ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        )}
      </div>

      {error && (
        <span className={styles.errorText} id={errorId}>
          { error }
        </span>
      )}

      {( activeRules.length > 0 ) && shouldShowRequirements && (
        <ul
          className={styles.requirements}
          id={requirementsId}
          aria-live="polite"
          aria-atomic="true"
        >
          {activeRules.map( ( rule ) => (
            <li
              key={rule.id}
              className={ `${styles.requirement} ${results[rule.id] ? styles.requirementMet : ""}` }
            >
              <span className={styles.requirementIcon} aria-hidden="true" />
              <span>{ rule.label }</span>
            </li>
          ) )}
        </ul>
      )}
    </div>
  ) ;
} ) ;

PasswordInput.displayName = "PasswordInput" ;
export default PasswordInput ;
