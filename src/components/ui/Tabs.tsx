'use client'

import React from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface TabItem {
  label: string
  href: string
  disabled?: boolean
}

export interface TabsProps {
  tabs: TabItem[]
  currentPath?: string
  className?: string
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ tabs, currentPath, className }, ref) => {
    const router = useRouter()
    const pathname = usePathname()
    const activePath = currentPath || pathname || ''

    const handleTabClick = (href: string, disabled?: boolean) => {
      if (disabled) return
      router.push(href)
    }

    const isActive = (href: string) => {
      if (!activePath) return false
      if (activePath === href) return true
      if (activePath.startsWith(href + '/')) return true
      return false
    }

    return (
      <div ref={ref} className={cn('border-b border-gray-200 no-print', className)}>
        <div className="overflow-x-auto">
          <nav className="flex space-x-8" role="tablist">
            {tabs.map((tab, index) => {
              const active = isActive(tab.href)
              return (
                <button
                  key={index}
                  role="tab"
                  aria-selected={active}
                  aria-disabled={tab.disabled}
                  onClick={() => handleTabClick(tab.href, tab.disabled)}
                  disabled={tab.disabled}
                  className={cn(
                    'px-3 sm:px-4 py-2 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    active
                      ? 'border-indigo-600 text-black font-semibold'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  )}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>
    )
  }
)

Tabs.displayName = 'Tabs'

export default Tabs

// Backward compatibility - export old interface as well
export interface TabItemOld {
  id: string
  label: string
  href?: string
  onClick?: () => void
  disabled?: boolean
}

export interface TabsPropsOld {
  items: TabItemOld[]
  activeTab?: string
  className?: string
  onTabChange?: (tabId: string) => void
}


