import AdminPanel from '@/components/AdminPanel'

export default async function AdminPage() {
  // Проверка роли происходит в layout.tsx
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AdminPanel />
    </div>
  )
}




