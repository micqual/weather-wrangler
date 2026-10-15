import { headers } from 'next/headers'

export async function isMobile(): Promise<boolean> {
  const ua = (await headers()).get('user-agent') ?? ''
  return /Mobi|Android|iPhone|iPod/i.test(ua)
}
