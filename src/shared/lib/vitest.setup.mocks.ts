/**
 * @file vitest.setup.mocks.ts
 * Mocks globales de módulos externos para la suite de pruebas ejecutada con Vitest.
 * Se incluye en `setupFiles` de vitest.config.ts para correr en cada archivo de test.
 */
// Librerías externas
import { vi } from "vitest" ;


vi.mock( "next/cache" , () => ( {
  revalidatePath: vi.fn() ,
} ) ) ;
