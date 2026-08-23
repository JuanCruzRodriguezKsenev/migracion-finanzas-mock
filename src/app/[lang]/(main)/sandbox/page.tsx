/**
 * @file page.tsx
 * Página del Sandbox para simular datos del Dashboard.
 */

// Shared
import { getDictionary } from "@/shared/lib/dictionary" ;

// Feature: Sandbox
import { SandboxContainer } from "@/features/sandbox/components/SandboxContainer" ;


interface SandboxPageProps {
  params: Promise< {lang: string} > ;
}

export default async function SandboxPage( {params}: SandboxPageProps ) {
  const { lang } = await params ;
  const dict     = await getDictionary( lang ) ;

  return(
    <SandboxContainer dict={dict} lang={lang} />
  ) ;
}
