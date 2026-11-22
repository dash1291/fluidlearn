'use client'

import { createContext, useContext } from 'react'

const LanguageContext = createContext<string | undefined>(undefined)

export const LanguageProvider = LanguageContext.Provider

export function useLanguage(): string | undefined {
  return useContext(LanguageContext)
}
