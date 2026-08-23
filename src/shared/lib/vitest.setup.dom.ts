/**
 * @file vitest.setup.dom.ts
 * Extiende `expect` con los matchers de `@testing-library/jest-dom`
 * (`toBeInTheDocument`, `toBeDisabled`, `toHaveAttribute`, etc.) para los
 * tests de componentes que corren bajo `@vitest-environment jsdom`.
 */
import "@testing-library/jest-dom/vitest" ;
