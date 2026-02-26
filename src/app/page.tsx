import { redirect } from 'next/navigation'

// Landing page 已移至 maiat-landing 獨立專案
// App 入口直接到 explore
export default function HomePage() {
  redirect('/explore')
}
