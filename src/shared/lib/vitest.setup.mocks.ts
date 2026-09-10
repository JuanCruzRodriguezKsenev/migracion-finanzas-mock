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

vi.mock( "next/navigation" , () => ( {
  useRouter: () => ( {
    push:    vi.fn() ,
    replace: vi.fn() ,
    refresh: vi.fn() ,
    back:    vi.fn() ,
    forward: vi.fn() ,
  } ) ,
  usePathname:     () => "/" ,
  useSearchParams: () => new URLSearchParams() ,
} ) ) ;

vi.mock( "@/features/notifications/context/NotificationsContext" , () => ( {
  useNotifications: () => ( {
    unreadCount:    0 ,
    notifications:  [] ,
    markAsSent:     vi.fn() ,
    confirmReceipt: vi.fn() ,
    rejectReceipt:  vi.fn() ,
    resetDemo:      vi.fn() ,
  } ) ,
} ) ) ;
