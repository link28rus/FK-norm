"use client"

export function BackButton() {
  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.close()
    }
  }

  return (
    <button
      onClick={goBack}
      className="no-print mb-4 inline-flex items-center gap-2 px-3 py-1.5 border rounded-md text-sm bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-sm transition-colors"
    >
      ← Вернуться назад
    </button>
  )
}

