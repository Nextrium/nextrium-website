import Navbar from '@/components/public/Navbar'
import Footer from '@/components/public/Footer'
import ContactClient from './ContactClient'

export const metadata = {
  title: 'Contact',
  description:
    'Get in touch with NexTrium. Tell us what you are building and we will respond within two business days.',
}

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <ContactClient />
      <Footer />
    </>
  )
}
