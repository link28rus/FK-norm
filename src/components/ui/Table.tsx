'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {}

export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {}

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right'
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  align?: 'left' | 'center' | 'right'
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table
            ref={ref}
            className={cn('min-w-full divide-y divide-gray-200', className)}
            {...props}
          >
            {children}
          </table>
        </div>
      </div>
    )
  }
)

Table.displayName = 'Table'

const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={cn('bg-gray-50', className)}
        {...props}
      >
        {children}
      </thead>
    )
  }
)

TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={cn('bg-white divide-y divide-gray-200', className)}
        {...props}
      >
        {children}
      </tbody>
    )
  }
)

TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn('hover:bg-gray-50 transition-colors', className)}
        {...props}
      >
        {children}
      </tr>
    )
  }
)

TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, align = 'left', children, ...props }, ref) => {
    const alignClasses = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    }

    return (
      <th
        ref={ref}
        className={cn(
          'px-3 sm:px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider',
          alignClasses[align],
          className
        )}
        {...props}
      >
        {children}
      </th>
    )
  }
)

TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, align = 'left', children, ...props }, ref) => {
    const alignClasses = {
      left: 'text-left',
      center: 'text-center',
      right: 'text-right',
    }

    return (
      <td
        ref={ref}
        className={cn(
          'px-3 sm:px-6 py-3 sm:py-4 text-sm text-heading',
          alignClasses[align],
          className
        )}
        {...props}
      >
        {children}
      </td>
    )
  }
)

TableCell.displayName = 'TableCell'

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell }


