/**
 * @file initialCatalog.ts
 * Definición del catálogo estándar inicial de 18 categorías contables
 * con sus respectivas subcategorías (RFC 022 §10).
 */

export interface InitialCategoryItem {
  code:          string ;
  name:          string ;
  type:          "expense" | "revenue" ;
  icon?:         string ;
  color?:        string ;
  subcategories: {
    code:   string ;
    name:   string ;
    icon?:  string ;
    color?: string ;
  } [] ;
}

/**
 * Catálogo estándar inicial compuesto por 12 categorías de gastos y 6 categorías de ingresos.
 */
export const INITIAL_CATEGORIES_CATALOG: readonly InitialCategoryItem[] = [
  // --- GASTOS (expense, raíz 5) ---
  {
    code:  "5.1.01" ,
    name:  "Vivienda" ,
    type:  "expense" ,
    icon:  "home" ,
    color: "#9b59b6" ,
    subcategories: [
      { code: "5.1.01.01" , name: "Alquiler"          , icon: "key" , color: "#9b59b6" } ,
      { code: "5.1.01.02" , name: "Expensas"           , icon: "file-text" , color: "#8e44ad" } ,
      { code: "5.1.01.03" , name: "Impuestos y tasas" , icon: "receipt" , color: "#7d3c98" } ,
      { code: "5.1.01.04" , name: "Mantenimiento"     , icon: "tool" , color: "#6c3483" } ,
    ] ,
  } ,
  {
    code:  "5.1.02" ,
    name:  "Servicios del hogar" ,
    type:  "expense" ,
    icon:  "zap" ,
    color: "#3498db" ,
    subcategories: [
      { code: "5.1.02.01" , name: "Luz"                 , icon: "zap" , color: "#f39c12" } ,
      { code: "5.1.02.02" , name: "Gas"                 , icon: "flame" , color: "#e67e22" } ,
      { code: "5.1.02.03" , name: "Agua"                , icon: "droplet" , color: "#3498db" } ,
      { code: "5.1.02.04" , name: "Internet y teléfono" , icon: "wifi" , color: "#2980b9" } ,
    ] ,
  } ,
  {
    code:  "5.1.03" ,
    name:  "Alimentación" ,
    type:  "expense" ,
    icon:  "shopping-cart" ,
    color: "#e67e22" ,
    subcategories: [
      { code: "5.1.03.01" , name: "Supermercado"             , icon: "shopping-cart" , color: "#e67e22" } ,
      { code: "5.1.03.02" , name: "Verdulería y carnicería"  , icon: "shopping-bag" , color: "#d35400" } ,
      { code: "5.1.03.03" , name: "Restaurantes y delivery"  , icon: "utensils" , color: "#ba4a00" } ,
    ] ,
  } ,
  {
    code:  "5.1.04" ,
    name:  "Transporte" ,
    type:  "expense" ,
    icon:  "truck" ,
    color: "#f1c40f" ,
    subcategories: [
      { code: "5.1.04.01" , name: "Combustible"        , icon: "fuel" , color: "#f39c12" } ,
      { code: "5.1.04.02" , name: "Transporte público" , icon: "bus" , color: "#f1c40f" } ,
      { code: "5.1.04.03" , name: "Seguro y patente"   , icon: "shield" , color: "#d4ac0d" } ,
      { code: "5.1.04.04" , name: "Mantenimiento"      , icon: "wrench" , color: "#b7950b" } ,
    ] ,
  } ,
  {
    code:  "5.1.05" ,
    name:  "Salud" ,
    type:  "expense" ,
    icon:  "activity" ,
    color: "#e74c3c" ,
    subcategories: [
      { code: "5.1.05.01" , name: "Obra social y prepaga" , icon: "heart" , color: "#e74c3c" } ,
      { code: "5.1.05.02" , name: "Farmacia"              , icon: "plus-circle" , color: "#c0392b" } ,
      { code: "5.1.05.03" , name: "Consultas y estudios"  , icon: "stethoscope" , color: "#a93226" } ,
    ] ,
  } ,
  {
    code:  "5.1.06" ,
    name:  "Educación" ,
    type:  "expense" ,
    icon:  "book-open" ,
    color: "#1abc9c" ,
    subcategories: [
      { code: "5.1.06.01" , name: "Cuotas"                , icon: "award" , color: "#1abc9c" } ,
      { code: "5.1.06.02" , name: "Cursos y capacitación" , icon: "monitor" , color: "#16a085" } ,
      { code: "5.1.06.03" , name: "Materiales"            , icon: "book" , color: "#117a65" } ,
    ] ,
  } ,
  {
    code:  "5.1.07" ,
    name:  "Entretenimiento" ,
    type:  "expense" ,
    icon:  "film" ,
    color: "#e84393" ,
    subcategories: [
      { code: "5.1.07.01" , name: "Salidas" , icon: "coffee" , color: "#e84393" } ,
      { code: "5.1.07.02" , name: "Viajes"  , icon: "compass" , color: "#d63031" } ,
      { code: "5.1.07.03" , name: "Hobbies" , icon: "smile" , color: "#fd79a8" } ,
    ] ,
  } ,
  {
    code:  "5.1.08" ,
    name:  "Compras" ,
    type:  "expense" ,
    icon:  "shopping-bag" ,
    color: "#fd79a8" ,
    subcategories: [
      { code: "5.1.08.01" , name: "Indumentaria" , icon: "tag" , color: "#fd79a8" } ,
      { code: "5.1.08.02" , name: "Hogar"        , icon: "box" , color: "#e84393" } ,
      { code: "5.1.08.03" , name: "Tecnología"   , icon: "cpu" , color: "#6c5ce7" } ,
      { code: "5.1.08.04" , name: "Regalos"      , icon: "gift" , color: "#a29bfe" } ,
    ] ,
  } ,
  {
    code:  "5.1.09" ,
    name:  "Suscripciones y servicios digitales" ,
    type:  "expense" ,
    icon:  "tv" ,
    color: "#6c5ce7" ,
    subcategories: [
      { code: "5.1.09.01" , name: "Entretenimiento" , icon: "film" , color: "#6c5ce7" } ,
      { code: "5.1.09.02" , name: "Productividad"   , icon: "check-circle" , color: "#a29bfe" } ,
      { code: "5.1.09.03" , name: "Diseño"          , icon: "feather" , color: "#0984e3" } ,
      { code: "5.1.09.04" , name: "Salud y fitness" , icon: "activity" , color: "#00b894" } ,
      { code: "5.1.09.05" , name: "Seguridad"       , icon: "shield" , color: "#636e72" } ,
      { code: "5.1.09.06" , name: "Almacenamiento"  , icon: "hard-drive" , color: "#2d3436" } ,
    ] ,
  } ,
  {
    code:  "5.1.10" ,
    name:  "Impuestos y tributos" ,
    type:  "expense" ,
    icon:  "file-text" ,
    color: "#636e72" ,
    subcategories: [
      { code: "5.1.10.01" , name: "Monotributo"        , icon: "file" , color: "#636e72" } ,
      { code: "5.1.10.02" , name: "Ingresos brutos"    , icon: "file-text" , color: "#2d3436" } ,
      { code: "5.1.10.03" , name: "Bienes personales"  , icon: "layers" , color: "#b2bec3" } ,
    ] ,
  } ,
  {
    code:  "5.1.11" ,
    name:  "Comisiones y gastos financieros" ,
    type:  "expense" ,
    icon:  "credit-card" ,
    color: "#d63031" ,
    subcategories: [
      { code: "5.1.11.01" , name: "Comisiones bancarias"   , icon: "dollar-sign" , color: "#d63031" } ,
      { code: "5.1.11.02" , name: "Intereses"              , icon: "percent" , color: "#e17055" } ,
      { code: "5.1.11.03" , name: "Mantenimiento de cuenta", icon: "credit-card" , color: "#fab1a0" } ,
    ] ,
  } ,
  {
    code:          "5.1.12" ,
    name:          "Otros gastos" ,
    type:          "expense" ,
    icon:          "more-horizontal" ,
    color:         "#b2bec3" ,
    subcategories: [] ,
  } ,

  // --- INGRESOS (revenue, raíz 4) ---
  {
    code:  "4.1.01" ,
    name:  "Trabajo en relación de dependencia" ,
    type:  "revenue" ,
    icon:  "briefcase" ,
    color: "#27ae60" ,
    subcategories: [
      { code: "4.1.01.01" , name: "Sueldo"    , icon: "dollar-sign" , color: "#27ae60" } ,
      { code: "4.1.01.02" , name: "Aguinaldo" , icon: "gift" , color: "#2ecc71" } ,
      { code: "4.1.01.03" , name: "Bonos"     , icon: "award" , color: "#55efc4" } ,
    ] ,
  } ,
  {
    code:  "4.1.02" ,
    name:  "Trabajo independiente" ,
    type:  "revenue" ,
    icon:  "user-check" ,
    color: "#2ecc71" ,
    subcategories: [
      { code: "4.1.02.01" , name: "Honorarios"               , icon: "user" , color: "#2ecc71" } ,
      { code: "4.1.02.02" , name: "Facturación a clientes"   , icon: "file-text" , color: "#27ae60" } ,
    ] ,
  } ,
  {
    code:  "4.1.03" ,
    name:  "Rentas" ,
    type:  "revenue" ,
    icon:  "home" ,
    color: "#00b894" ,
    subcategories: [
      { code: "4.1.03.01" , name: "Alquileres" , icon: "key" , color: "#00b894" } ,
      { code: "4.1.03.02" , name: "Dividendos" , icon: "pie-chart" , color: "#55efc4" } ,
    ] ,
  } ,
  {
    code:  "4.1.04" ,
    name:  "Intereses y rendimientos" ,
    type:  "revenue" ,
    icon:  "trending-up" ,
    color: "#0984e3" ,
    subcategories: [
      { code: "4.1.04.01" , name: "Plazo fijo"        , icon: "clock" , color: "#0984e3" } ,
      { code: "4.1.04.02" , name: "Cuenta remunerada" , icon: "dollar-sign" , color: "#74b9ff" } ,
    ] ,
  } ,
  {
    code:          "4.1.05" ,
    name:          "Reintegros y devoluciones" ,
    type:          "revenue" ,
    icon:          "corner-down-left" ,
    color:         "#00cec9" ,
    subcategories: [] ,
  } ,
  {
    code:          "4.1.06" ,
    name:          "Otros ingresos" ,
    type:          "revenue" ,
    icon:          "plus-circle" ,
    color:         "#55efc4" ,
    subcategories: [] ,
  } ,
] ;
