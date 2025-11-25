'use client'

import { useEffect } from 'react'

interface NormPrintViewProps {
  type: string
  date: string
  unit: string | null
  groupName?: string
  schoolYear?: string
  norms: Array<{
    athleteName: string
    value: number | null
    grade: string // Оценка: "-", "2", "3", "4", "5", "Б", "О"
  }>
}

export default function NormPrintView({
  type,
  date,
  unit,
  groupName,
  schoolYear,
  norms,
}: NormPrintViewProps) {
  useEffect(() => {
    // Автоматически вызываем печать при загрузке компонента
    const timer = setTimeout(() => {
      window.print()
    }, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            margin: 1cm;
            size: A4;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .print-container {
            width: 100%;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
          /* Усиливаем контрастность текста при печати */
          * {
            color: #000 !important;
          }
          .header h1,
          .header-info,
          .header-info strong,
          table th,
          table td {
            color: #000 !important;
          }
        }
        @media screen {
          .print-container {
            max-width: 210mm;
            margin: 20px auto;
            padding: 20px;
            background: white;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
          }
        }
        .header {
          margin-bottom: 20px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }
        .header h1 {
          font-size: 20px;
          font-weight: bold;
          margin: 0 0 5px 0;
          color: #000;
        }
        .header-info {
          font-size: 14px;
          color: #000;
        }
        .header-info strong {
          color: #000;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        th,
        td {
          border: 1px solid #000;
          padding: 8px;
          text-align: left;
        }
        td.grade-cell {
          text-align: center;
        }
        th {
          background-color: #f0f0f0;
          font-weight: bold;
          font-size: 12px;
          color: #000;
        }
        td {
          font-size: 12px;
          color: #000;
        }
        .grade-cell {
          text-align: center;
          font-weight: 500;
        }
        .legend {
          margin-top: 20px;
          font-size: 11px;
          color: #000;
        }
        .legend-title {
          font-weight: bold;
          margin-bottom: 4px;
        }
      `}</style>
      <div className="print-container">
        <div className="header">
          <h1>Отчёт по нормативу</h1>
        <div className="header-info">
          {groupName && (
            <div>
              Группа: {groupName}
            </div>
          )}
          {schoolYear && (
            <div>
              Учебный год: {schoolYear}
            </div>
          )}
          <div>
            <strong>Вид норматива:</strong> {type}
          </div>
          <div>
            <strong>Дата зачёта:</strong>{' '}
            {new Date(date).toLocaleDateString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </div>
          {unit && (
            <div>
              <strong>Единица измерения:</strong> {unit}
            </div>
          )}
        </div>
        </div>

        <table>
        <thead>
          <tr>
            <th style={{ width: '5%' }}>№</th>
            <th style={{ width: '45%' }}>ФИО ученика</th>
            <th style={{ width: '20%' }}>Значение</th>
            <th style={{ width: '30%' }}>Оценка</th>
          </tr>
        </thead>
        <tbody>
          {norms && norms.length > 0 ? (
            norms.map((norm, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{norm.athleteName}</td>
                <td>
                  {norm.value !== null && norm.value !== undefined
                    ? `${norm.value}${unit ? ` ${unit}` : ''}`
                    : '—'}
                </td>
                <td className="grade-cell">
                  {norm.grade || '-'}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center', padding: '16px', color: '#000' }}>
                По этому нормативу ещё нет данных для отчёта.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Блок с обозначениями */}
      <div className="legend">
        <div className="legend-title">Обозначения:</div>
        <div>Б — болен (уважительная причина отсутствия).</div>
        <div>О — освобождён от выполнения норматива.</div>
      </div>
      </div>
    </>
  )
}

