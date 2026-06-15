'use client'

import { BookOpen } from 'lucide-react'

export default function FornecedoresPage() {
  const fornecedores = [
    { src: '/Novo-logo-Sinproquim-vertical.webp', alt: 'Sinproquim', url: 'https://sinproquim.org.br/' },
    { src: '/araguaya_g.webp', alt: 'Química Araguaya', url: 'https://araguaya.com.br/' },
    { src: '/cropped-Marca-Saber-Quimica-945x945px-cor-1.png', alt: 'Saber Química', url: 'https://www.saberquimica.com.br/' },
    { src: '/Logo-Carbono-Quimica-sem-Slogan-1024x848.png', alt: 'Carbono Química', url: 'https://carbono.com.br/' },
    { src: '/Brenntag_Logo_2022.svg.png', alt: 'Brenntag', url: 'https://www.brenntag.com/pt-br/' },
    { src: '/Bandeirante Brazmo.png', alt: 'Bandeirante Brazmo', url: 'https://www.bandeirantebrazmo.com.br/' },
    { src: '/IMCD.png', alt: 'IMCD', url: 'https://www.imcdgroup.com/worldwide/brasil-br-MCHS76PAMXYBCR7I5MBYVUJ7QGLY' },
    { src: '/Cosmoquímica.png', alt: 'Cosmoquímica', url: 'https://cosmoquimica.com.br/' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0d1f3c] to-[#0a1628] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white flex items-center gap-3 mb-2">
            <BookOpen className="text-green-400" size={32} />
            Fornecedores
          </h1>
          <p className="text-gray-400 text-lg">Clique no logo para acessar o site do fornecedor</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {fornecedores.map(({ src, alt, url }) => (
            <a
              key={alt}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <div className="w-full h-[180px] rounded-xl border border-[#1B3A6B]/60 bg-white flex items-center justify-center p-4 transition-all duration-300 hover:border-green-500/70 hover:shadow-lg hover:shadow-green-500/20 cursor-pointer"
              >
                <img src={src} alt={alt} className="max-w-full max-h-full object-contain" />
              </div>
              <p className="text-center text-gray-400 text-sm mt-2 group-hover:text-green-400 transition-colors">
                {alt}
              </p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
