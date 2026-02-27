import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://maiat-protocol.vercel.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://maiat-protocol.vercel.app/explore', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://maiat-protocol.vercel.app/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]
}
