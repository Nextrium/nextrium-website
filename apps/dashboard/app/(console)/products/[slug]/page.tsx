import { notFound } from 'next/navigation'
import { createServiceClient } from '@nextrium/supabase/server'
import ProductEditor from './ProductEditor'
import type { Product } from '@nextrium/supabase/database'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  if (slug === 'new') return { title: 'New Product' }
  return { title: `Edit: ${slug}` }
}

export default async function ProductEditorPage({ params }: Props) {
  const { slug }  = await params
  const supabase  = createServiceClient()
  let product: Product | null = null

  if (slug !== 'new') {
    const { data } = await supabase.from('products').select('*').eq('slug', slug).single()
    if (!data) notFound()
    product = data
  }

  return <ProductEditor product={product} />
}
