import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import ProductsClient from './ProductsClient'
import { createClient } from '@nextrium/supabase/server'
import type { Product } from '@nextrium/supabase/database'

export const metadata = {
  title: 'Our Builds',
  description: 'Products designed and built by NexTrium. Each one addresses a real gap in an underserved market.',
}

async function getProducts(): Promise<Product[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error || !data) return []
  return data
}

export default async function ProductsPage() {
  const products = await getProducts()
  return (
    <>
      <Navbar />
      <ProductsClient products={products} />
      <Footer />
    </>
  )
}