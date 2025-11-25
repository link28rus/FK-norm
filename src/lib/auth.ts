import { NextRequest, NextResponse } from 'next/server'
import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { prisma } from './prisma'

type UserRole = 'ADMIN' | 'TRAINER'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'
const COOKIE_NAME = 'auth_token'

export interface JWTPayload {
  userId: string
  role: UserRole
}

/**
 * Генерирует JWT токен для пользователя
 */
export function generateToken(userId: string, role: UserRole): string {
  return jwt.sign({ userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  })
}

/**
 * Верифицирует JWT токен и возвращает payload
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload
    return decoded
  } catch (error) {
    return null
  }
}

/**
 * Хеширует пароль с помощью bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

/**
 * Сравнивает пароль с хешем
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Устанавливает JWT токен в httpOnly cookie
 */
export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 дней
    path: '/',
  })
}

/**
 * Удаляет auth cookie (для logout)
 */
export function removeAuthCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME)
}

/**
 * Получает токен из cookie запроса
 */
export function getTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null
}

/**
 * Получает токен из cookies (для серверных компонентов)
 */
export function getTokenFromCookies(cookies: ReadonlyRequestCookies): string | null {
  return cookies.get(COOKIE_NAME)?.value || null
}

/**
 * Получает текущего пользователя из cookie (для API routes)
 * Проверяет валидность токена, существование пользователя и что он не заблокирован
 * Возвращает null если пользователь не авторизован или заблокирован
 */
export async function getCurrentUser(request: NextRequest) {
  const token = getTokenFromRequest(request)

  if (!token) {
    return null
  }

  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      trainerProfile: true,
    },
  })

  if (!user) {
    return null
  }

  // Проверяем блокировку: isBlocked или срок действия истёк
  if (user.isBlocked) {
    return null
  }

  // Проверяем срок действия: если activeUntil задан и текущая дата > activeUntil
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Сбрасываем время для сравнения только дат
  
  if (user.activeUntil) {
    const activeUntilDate = new Date(user.activeUntil)
    activeUntilDate.setHours(0, 0, 0, 0)
    
    // Если текущая дата больше activeUntil, доступ запрещён
    if (now > activeUntilDate) {
      return null
    }
  }

  return user
}

/**
 * Получает текущего пользователя из cookies (для серверных компонентов)
 * Проверяет валидность токена, существование пользователя и что он не заблокирован
 * Возвращает null если пользователь не авторизован или заблокирован
 */
export async function getCurrentUserFromCookies(cookies: ReadonlyRequestCookies) {
  const token = getTokenFromCookies(cookies)

  if (!token) {
    return null
  }

  const payload = verifyToken(token)
  if (!payload) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    include: {
      trainerProfile: true,
    },
  })

  if (!user) {
    return null
  }

  // Проверяем блокировку: isBlocked или срок действия истёк
  if (user.isBlocked) {
    return null
  }

  // Проверяем срок действия: если activeUntil задан и текущая дата > activeUntil
  const now = new Date()
  now.setHours(0, 0, 0, 0) // Сбрасываем время для сравнения только дат
  
  if (user.activeUntil) {
    const activeUntilDate = new Date(user.activeUntil)
    activeUntilDate.setHours(0, 0, 0, 0)
    
    // Если текущая дата больше activeUntil, доступ запрещён
    if (now > activeUntilDate) {
      return null
    }
  }

  return user
}

/**
 * Проверяет, является ли пользователь администратором
 */
export async function isAdmin(request: NextRequest): Promise<boolean> {
  const user = await getCurrentUser(request)
  return user?.role === 'ADMIN'
}

/**
 * Проверяет, является ли пользователь тренером или админом
 * (админ также имеет доступ к функционалу тренера)
 */
export async function isTrainer(request: NextRequest): Promise<boolean> {
  const user = await getCurrentUser(request)
  return user?.role === 'TRAINER' || user?.role === 'ADMIN'
}

/**
 * Генерирует случайный пароль
 */
export function generateRandomPassword(length: number = 12): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

