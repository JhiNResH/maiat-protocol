import { redirect } from 'next/navigation'

// Redirect root → /explore until a custom domain is set up for the landing page.
// When maiat.xyz (or maiat-landing.vercel.app) is live, update this to:
//   redirect('https://maiat.xyz')
export default function HomePage() {
  redirect('/explore')
}
