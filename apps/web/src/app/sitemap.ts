import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://app.maiat.io', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://app.maiat.io/explore', lastModified: new Date(), changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://app.maiat.io/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
  ]
}
