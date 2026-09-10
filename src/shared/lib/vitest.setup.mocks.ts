/**
 * @file vitest.setup.mocks.ts
 * Mocks globales de módulos externos para la suite de pruebas ejecutada con Vitest.
 * Se incluye en `setupFiles` de vitest.config.ts para correr en cada archivo de test.
 * Política: sólo dependencias de framework que jsdom no provee; el código propio del
 * proyecto se monta real.
 */
// Librerías externas
import { vi } from "vitest" ;


vi.mock( "next/cache" , () => ( {
  revalidatePath: vi.fn() ,
} ) ) ;

const routerMock = vi.hoisted( () => ( {
  push:    vi.fn() ,
  replace: vi.fn() ,
  refresh: vi.fn() ,
  back:    vi.fn() ,
  forward: vi.fn() ,
} ) ) ;

export { routerMock } ;

vi.mock( "next/navigation" , () => ( {
  useRouter:       () => routerMock ,
  usePathname:     () => "/" ,
  useSearchParams: () => new URLSearchParams() ,
} ) ) ;

