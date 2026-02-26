import { redirect } from 'next/navigation'

// The main Maiat landing page is served from https://maiat.xyz (maiat-landing repo).
// This route redirects there so maiat-protocol.vercel.app/  doesn't show a stale page.
// App routes (/explore, /dashboard, /score, /token, /swap) remain here.
export default function HomePage() {
  redirect('https://maiat.xyz')
}
