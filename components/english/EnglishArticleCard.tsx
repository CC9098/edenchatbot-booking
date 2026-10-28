import type { EnglishArticle } from '@/content/english/site';
import { Arrow } from './EnglishSiteChrome';

export type JournalArticle = Pick<EnglishArticle, 'id' | 'slug' | 'title' | 'category' | 'description' | 'body' | 'artwork'>;

export function Artwork({ article, decorative = false, eager = false }: { article: Pick<EnglishArticle, 'artwork'>; decorative?: boolean; eager?: boolean }) {
  return <img className="theme-image" src={`/english/assets/article-art/${article.artwork.svg}`} alt={decorative ? '' : article.artwork.alt} width={1200} height={800} loading={eager ? 'eager' : 'lazy'} decoding="async" />;
}

export function ArticleCard({ article, hidden = false }: { article: JournalArticle; hidden?: boolean }) {
  const readMinutes = Math.max(2, Math.ceil(article.body.split(/\s+/).length / 200));
  return <article className="article-card" data-category={article.category} hidden={hidden}>
    <a href={`/en/journal/${article.slug}`}>
      <div className="article-cover illustrated-cover">
        <div className="article-art"><Artwork article={article} decorative /></div>
        <div className="article-card-heading"><h3>{article.title}</h3><span>{article.category}</span><Arrow /></div>
      </div>
      <div className="article-caption"><p>{article.description}</p><span>{readMinutes} min read</span></div>
    </a>
  </article>;
}
