import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArticleCard, Breadcrumb, DoctorCard, FurtherReading, Intro, Prose, TextLink } from '@/components/english/EnglishCommon';
import { EnglishArticlePage } from '@/components/english/EnglishArticle';
import { EnglishJournal } from '@/components/english/EnglishJournal';
import { EnglishHomepage } from '@/components/english/EnglishHomepage';
import { Arrow } from '@/components/english/EnglishSiteChrome';
import { englishArticles, englishBookingUrl, englishClinics, englishDoctors, englishPages, englishRoutes, englishServices } from '@/content/english/site';
import { ENGLISH_PUBLIC_ORIGIN, englishPublicationMetadata, englishPublicUrl, isEnglishPublished } from '@/lib/english-publication';

type PageProps = { params: { slug?: string[] } };
function routePath(slug?: string[]) { return slug?.length ? `/${slug.join('/')}/` : '/'; }
export const dynamicParams = true;
export function generateStaticParams() {
  return englishRoutes.filter(route => route.path !== '/book/').map(route => ({ slug: route.path.split('/').filter(Boolean) }));
}
export function generateMetadata({ params }: PageProps): Metadata {
  const path = routePath(params.slug);
  const route = englishRoutes.find(item => item.path === path);
  const article = englishArticles.find(item => `/journal/${item.slug}/` === path);
  const brochure = englishPages[path as keyof typeof englishPages];
  const description = article?.description || brochure?.description || 'Eden Clinic: Chinese medicine, acupuncture and care in Central, Jordan and Tsuen Wan.';
  const title = route?.title || 'Page not found';
  const imagePath = article ? `/english/assets/article-art/${article.artwork.svg.replace(/\.svg$/, '.png')}` : '/english/assets/central.jpeg';
  const imageUrl = isEnglishPublished() ? `${ENGLISH_PUBLIC_ORIGIN}${imagePath}` : imagePath;
  return {
    title,
    description,
    ...englishPublicationMetadata(route?.path, route && 'chinese' in route ? route.chinese : undefined),
    openGraph: { type: article ? 'article' : 'website', locale: 'en_HK', siteName: 'Eden Clinic', title: `${title} — Eden Clinic`, description, url: route && isEnglishPublished() ? englishPublicUrl(path) : undefined, images: [{ url: imageUrl, alt: article?.artwork.alt || 'Eden Clinic, Central' }] },
    twitter: { card: 'summary_large_image', title: `${title} — Eden Clinic`, description, images: [imageUrl] },
  };
}

export default function EnglishPage({ params }: PageProps) {
  const path = routePath(params.slug);
  const article = englishArticles.find(item => `/journal/${item.slug}/` === path);
  if (article) return <EnglishArticlePage article={article} />;
  if (path === '/') return <EnglishHomepage />;
  const brochure = englishPages[path as keyof typeof englishPages];
  if (brochure) return <div dangerouslySetInnerHTML={{ __html: brochure.html }} />;
  if (path === '/journal/') return <><Intro title={<>Health, with<br /><em>something to say.</em></>} description="Chinese medicine, everyday health and the details that matter." crumb={<Breadcrumb title="Journal" />} /><EnglishJournal articles={englishArticles.map(({ id, slug, title, category, description, body, artwork }) => ({ id, slug, title, category, description, body, artwork }))} topics={englishServices.map(({ category, slug }) => ({ category, slug }))} /></>;
  if (path.startsWith('/journal/topics/')) {
    const service = englishServices.find(item => `/journal/topics/${item.slug}/` === path);
    if (!service) notFound();
    return <><Intro title={service.category} description={service.intro} crumb={<Breadcrumb title={service.category} parent="Journal" href="/en/journal" />} /><section className="wrap journal-index"><nav className="topic-navigation" aria-label="Journal topics">{englishServices.map(topic => <a key={topic.slug} href={`/en/journal/topics/${topic.slug}`} aria-current={topic.slug === service.slug ? 'page' : undefined}>{topic.category}</a>)}</nav><div className="article-grid">{englishArticles.filter(item => item.category === service.category).map(item => <ArticleCard key={item.id} article={item} />)}</div></section></>;
  }
  if (path === '/care/') return <><Intro title={<>Care, in the context<br /><em>of your life.</em></>} description="Acupuncture, herbal medicine and manual treatment, guided by an individual consultation." crumb={<Breadcrumb title="Our care" />} /><section className="service-list wrap">{englishServices.map(service => <a key={service.slug} href={`/en/care/${service.slug}`}><div><h2>{service.title}</h2><p>{service.intro}</p></div><img src={`/english/assets/${service.image}`} alt={`${service.title} at Eden Clinic`} width={1024} height={768} loading="lazy" /><Arrow /></a>)}</section></>;
  if (path.startsWith('/care/')) {
    const service = englishServices.find(item => `/care/${item.slug}/` === path);
    if (!service) notFound();
    return <><Intro title={service.title} description={service.intro} crumb={<Breadcrumb title={service.title} parent="Our care" href="/en/care" />} action={<TextLink href={englishBookingUrl()} button>Book a consultation</TextLink>} /><section className="prose-layout wrap"><aside><img src={`/english/assets/${service.image}`} alt={`${service.title} at Eden Clinic`} width={1024} height={768} loading="lazy" /><TextLink href="/en/fees">Fees &amp; payment</TextLink></aside><div className="prose"><Prose text={service.body} /></div></section><section className="section wrap"><div className="section-head"><h2>Practitioners</h2></div><div className="doctor-grid">{service.doctors.map(id => <DoctorCard key={id} id={id} />)}</div></section><FurtherReading articles={englishArticles.filter(item => item.category === service.category).slice(0, 3)} /></>;
  }
  if (path === '/practitioners/') return <><Intro title={<>A familiar face.<br /><em>An individual approach.</em></>} description="Registered Chinese medicine practitioners and collaborating chiropractic care." crumb={<Breadcrumb title="Practitioners" />} /><section className="section wrap team-list"><div className="doctor-grid">{englishDoctors.map(doctor => <DoctorCard key={doctor.id} id={doctor.id} />)}</div></section></>;
  if (path.startsWith('/practitioners/')) {
    const doctor = englishDoctors.find(item => `/practitioners/${item.id}/` === path);
    if (!doctor) notFound();
    return <><div className="wrap"><Breadcrumb title={doctor.name} parent="Practitioners" href="/en/practitioners" /></div><section className="profile wrap"><div className="profile-image"><img src={`/english/assets/${doctor.id}.webp`} alt={`${doctor.name} ${doctor.zh}`} width={512} height={512} loading="eager" /></div><div><h1>{doctor.name}<span lang="zh-Hant">{doctor.zh}</span></h1><p className="role">{doctor.role}</p><p className="lede">{doctor.intro}</p><h2>Qualifications</h2><ul>{doctor.qualifications.map(qualification => <li key={qualification}>{qualification}</li>)}</ul>{doctor.booking ? <TextLink href={englishBookingUrl(doctor.id, doctor.online ? 'online' : undefined)} button>View appointment times</TextLink> : <TextLink href={doctor.id === 'wong' ? '/en/clinics/jordan' : '/en/clinics'} button>Contact the clinic</TextLink>}</div></section>{doctor.id === 'lee' && <section className="section wrap"><div className="section-head"><h2>Related reading</h2></div><div className="article-grid">{englishArticles.filter(item => item.metadata.original_author === 'lee').map(item => <ArticleCard key={item.id} article={item} />)}</div></section>}</>;
  }
  if (path === '/clinics/') return <><Intro title={<>Three places.<br /><em>One Eden.</em></>} description="Central, Jordan and Tsuen Wan." crumb={<Breadcrumb title="Clinics" />} /><section className="wrap clinic-list">{englishClinics.map(clinic => <article key={clinic.id}><img src={`/english/assets/${clinic.id}.jpeg`} alt={`Eden ${clinic.name}`} width={1024} height={768} loading="lazy" /><div><h2>{clinic.name}</h2><p>{clinic.address}</p><TextLink href={`/en/clinics/${clinic.id}`}>Clinic details</TextLink></div></article>)}</section></>;
  if (path.startsWith('/clinics/')) {
    const clinic = englishClinics.find(item => `/clinics/${item.id}/` === path);
    if (!clinic) notFound();
    return <><Intro title={clinic.name} description={clinic.address} crumb={<Breadcrumb title={clinic.name} parent="Clinics" href="/en/clinics" />} /><section className="clinic-detail wrap"><div><img src={`/english/assets/${clinic.id}.jpeg`} alt={`Inside Eden Clinic, ${clinic.name}`} width={1024} height={768} loading="eager" /></div><div><h2>Visit us</h2><p>{clinic.address}</p>{clinic.map && <TextLink href={clinic.map}>Open map</TextLink>}<h2>Opening hours</h2>{clinic.hours.map(hours => <p key={hours}>{hours}</p>)}<h2>Contact</h2><p><a href={`tel:+852${clinic.phone.replace(/\s/g, '')}`}>+852 {clinic.phone}</a></p>{clinic.whatsappUrl && <TextLink href={clinic.whatsappUrl}>WhatsApp the clinic</TextLink>}<div className="action-row"><TextLink href={englishBookingUrl(undefined, clinic.id)} button>View appointment times</TextLink></div></div></section></>;
  }
  notFound();
}
