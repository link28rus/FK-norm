export default function JournalLegend() {
  return (
    <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 print-legend">
      <h4 className="text-sm font-semibold text-heading mb-2">
        Обозначения в журнале:
      </h4>
      <ul className="text-sm text-gray-700 space-y-1">
        <li>
          <span className="font-medium">Н/Ф</span> — нет спортивной формы.
        </li>
        <li>
          <span className="font-medium">Н</span> — отсутствие на уроке.
        </li>
        <li>
          <span className="font-medium">Б</span> — болен (уважительная причина отсутствия).
        </li>
        <li>
          <span className="font-medium">2, 3, 4, 5</span> — оценки за урок.
        </li>
        <li>
          Пустая клетка — отметка ещё не выставлена.
        </li>
      </ul>
    </div>
  )
}

