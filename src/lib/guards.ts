import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getCurrentUserFromCookies } from './auth'

export type UserRole = 'ADMIN' | 'TRAINER'

/**
 * Проверяет роль пользователя и перенаправляет при несоответствии
 * @param allowedRoles - Массив разрешённых ролей
 * @param redirectTo - Куда перенаправить при несоответствии (по умолчанию '/login')
 */
export async function requireRole(
  allowedRoles: UserRole[],
  redirectTo: string = '/login'
): Promise<{ role: UserRole; id: string }> {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user) {
    redirect(redirectTo)
  }

  if (!allowedRoles.includes(user.role)) {
    // Если роль не соответствует, перенаправляем на главную страницу пользователя
    if (user.role === 'ADMIN') {
      redirect('/admin')
    } else if (user.role === 'TRAINER') {
      redirect('/trainer')
    } else {
      redirect(redirectTo)
    }
  }

  return {
    role: user.role,
    id: user.id,
  }
}

/**
 * Проверяет, что пользователь является админом
 */
export async function requireAdmin(): Promise<{ role: 'ADMIN'; id: string }> {
  return requireRole(['ADMIN']) as Promise<{ role: 'ADMIN'; id: string }>
}

/**
 * Проверяет, что пользователь является тренером или админом
 */
export async function requireTrainer(): Promise<{ role: UserRole; id: string }> {
  return requireRole(['TRAINER', 'ADMIN'])
}

/**
 * Получает текущего пользователя без проверки роли
 * Перенаправляет на /login если не авторизован
 */
export async function requireAuth() {
  const cookieStore = await cookies()
  const user = await getCurrentUserFromCookies(cookieStore)

  if (!user) {
    redirect('/login')
  }

  return user
}


