import { redirect } from 'next/navigation'

export default function ReviewAddressPage({ params }: { params: { address: string } }) {
  redirect(`/verify/${params.address}`)
}
