import Footer from '@/components/Footer'
import { ContactForm } from '@/components/ContactForm'
import { Phone, Mail, Clock, MapPin } from 'lucide-react'

export default function ContactPage() {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#ffffff' }}>
      
      {/* Отступ для fixed хедера */}
      <div className="lg:hidden h-20"></div>
      <div className="hidden lg:block h-28"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Page Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Կապ մեզ հետ
          </h1>
          <p className="text-xl text-gray-700 max-w-2xl mx-auto">
            Մենք միշտ պատրաստ ենք օգնել ձեզ և պատասխանել ձեր հարցերին
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-200 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#f3d98c' }}>
              <Phone className="h-8 w-8" style={{ color: '#002c45' }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Հեռախոս</h3>
            <p className="text-gray-700 mb-2">+374 77 79 29 29</p>
            <p className="text-gray-700 mb-2">+374 44 79 29 29</p>
            <p className="text-sm text-gray-500">24/7 աջակցություն</p>
            <a 
              href="tel:+37477792929"
              className="inline-block mt-4 text-gray-900 px-6 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: '#f3d98c' }}
            >
              Զանգել
            </a>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-200 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#f3d98c' }}>
              <Mail className="h-8 w-8" style={{ color: '#002c45' }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Էլ. փոստ</h3>
            <p className="text-gray-700 mb-2">info@welcomebaby.am</p>
            <p className="text-sm text-gray-500">Պատասխանում ենք 2 ժամում</p>
            <a 
              href="mailto:info@welcomebaby.am"
              className="inline-block mt-4 text-gray-900 px-6 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: '#f3d98c' }}
            >
              Գրել
            </a>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-200 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#f3d98c' }}>
              <Clock className="h-8 w-8" style={{ color: '#002c45' }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Աշխատանքային ժամեր</h3>
            <p className="text-gray-700 mb-2">Աշխատում ենք ամեն օր</p>
            <p className="text-sm text-gray-500">Ժամը՝ 11:00 - 20:00</p>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border border-gray-200 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: '#f3d98c' }}>
              <MapPin className="h-8 w-8" style={{ color: '#002c45' }} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Հասցե</h3>
            <p className="text-gray-700 mb-2 text-sm">14, Արցախի պողոտա, Երևան</p>
            <p className="text-gray-700 mb-2 text-sm">42, Պուշկինի փողոց, Գյումրի</p>
            <a 
              href="https://maps.google.com/?q=14,+Արցախի+պողոտա,+Երևան,+Հայաստան"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-gray-900 px-6 py-2 rounded-lg transition-colors"
              style={{ backgroundColor: '#f3d98c' }}
            >
              Տեսնել քարտեզում
            </a>
          </div>
        </div>

        <ContactForm />

        {/* Google Map */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-16 border border-gray-200">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">Մեր գտնվելու վայրը</h2>
          <div className="w-full h-96 rounded-lg overflow-hidden">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3048.123456789!2d44.5152!3d40.1776!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDDCsDEwJzM5LjQiTiA0NMKwMzAnNTQuNyJF!5e0!3m2!1sen!2sam!4v1234567890123!5m2!1sen!2sam"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Welcome Baby Armenia Location"
            ></iframe>
          </div>
        </div>
      </div>
      
      {/* Hide Footer on Mobile and Tablet */}
      <div className="hidden lg:block">
        <Footer />
      </div>
    </div>
  )
}