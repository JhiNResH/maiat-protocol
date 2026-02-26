import { redirect } from 'next/navigation'

export default function HomePage() {
  // 由於 Landing Page 已經獨立，主專案的根目錄直接導向應用程式入口
  redirect('/explore')
}
