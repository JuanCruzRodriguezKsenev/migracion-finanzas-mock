/**
 * @file categoryIcons.ts
 * Utilidad de mapeo de nombres de íconos a emojis para la representación
 * visual de categorías contables en la interfaz de usuario.
 */

/**
 * Mapa de conversión de identificadores de íconos del catálogo a emojis visuales.
 */
export const CATEGORY_ICON_MAP: Record< string , string > = {
  "home":             "🏠" ,
  "key":              "🔑" ,
  "file-text":        "📄" ,
  "receipt":          "🧾" ,
  "tool":             "🛠️" ,
  "zap":              "⚡" ,
  "flame":            "🔥" ,
  "droplet":          "💧" ,
  "wifi":             "📶" ,
  "shopping-cart":    "🛒" ,
  "shopping-bag":     "🛍️" ,
  "utensils":         "🍽️" ,
  "truck":            "🚚" ,
  "fuel":             "⛽" ,
  "bus":              "🚌" ,
  "shield":           "🛡️" ,
  "wrench":           "🔧" ,
  "activity":         "📈" ,
  "heart":            "❤️" ,
  "plus-circle":      "➕" ,
  "stethoscope":      "🩺" ,
  "book-open":        "📖" ,
  "award":            "🏆" ,
  "monitor":          "🖥️" ,
  "book":             "📚" ,
  "film":             "🎬" ,
  "coffee":           "☕" ,
  "compass":          "🧭" ,
  "smile":            "😊" ,
  "tag":              "🏷️" ,
  "box":              "📦" ,
  "cpu":              "💻" ,
  "gift":             "🎁" ,
  "tv":               "📺" ,
  "check-circle":     "✅" ,
  "feather":          "🪶" ,
  "hard-drive":       "💾" ,
  "file":             "📁" ,
  "layers":           "📑" ,
  "credit-card":      "💳" ,
  "dollar-sign":      "💵" ,
  "percent":          "📊" ,
  "more-horizontal":  "🔘" ,
  "briefcase":        "💼" ,
  "user-check":       "👤" ,
  "user":             "👤" ,
  "pie-chart":        "📊" ,
  "trending-up":      "📈" ,
  "clock":            "⏰" ,
  "corner-down-left": "↩️" ,
} ;

export const CATEGORY_FALLBACK_ICON = "📦" ;

/**
 * Devuelve el emoji correspondiente para un identificador de ícono de categoría.
 * Si el nombre no existe en el catálogo o no está definido, devuelve el ícono de respaldo ("📦").
 *
 * @param nombre - Identificador textual del ícono (ej: "home", "shopping-cart") o emoji directo.
 * @returns Emoji representativo para la categoría.
 */
export function iconoDeCategoria( nombre?: string | null ): string {
  if( !nombre || (nombre.trim() === "") ) {
    return( CATEGORY_FALLBACK_ICON ) ;
  }

  const trimmed = nombre.trim() ;

  if( CATEGORY_ICON_MAP[trimmed] ) {
    return( CATEGORY_ICON_MAP[trimmed] ) ;
  }

  // Si contiene caracteres de texto latino/ASCII, no es un emoji aislado: fallback
  if( /[a-zA-Z0-9_-]/.test( trimmed ) ) {
    return( CATEGORY_FALLBACK_ICON ) ;
  }

  return( trimmed ) ;
}
