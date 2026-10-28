import { englishArticles, englishClinics } from '@/content/english/site';
import { Artwork, DoctorCard, TextLink } from './EnglishCommon';
import { Arrow } from './EnglishSiteChrome';

export function EnglishHomepage() {
  const [lead, ...following] = englishArticles.slice(0, 5);
  return <>
    <section className="hero">
      <div className="hero-copy">
        <h1>Chinese medicine.<br /><em>A human<br />perspective.</em></h1>
        <p>Acupuncture, herbal medicine and hands-on care.<br />At home in Hong Kong.</p>
        <TextLink href="/en/care" button light>Explore our care</TextLink>
        <div className="hero-addresses">{englishClinics.map(clinic => <a key={clinic.id} href={`/en/clinics/${clinic.id}`}>{clinic.name}</a>)}</div>
      </div>
      <div className="hero-visual">
        <img className="hero-photo" src="/english/assets/central.jpeg" alt="The reception at Eden Clinic in Central" width={1024} height={768} loading="eager" />
        <div className="hero-inset"><img src="/english/assets/hon.webp" alt="Dr. Hon 韓曉恩" width={512} height={512} loading="eager" /><a href="/en/practitioners/hon">Dr. Hon<br /><span>Acupuncture &amp; manual care</span><Arrow /></a></div>
        <span className="photo-caption">Eden Clinic, Central</span>
      </div>
    </section>
    <section className="topic-rail wrap" aria-label="Explore care">{[
      ['pain-and-movement', 'Pain & movement'], ['womens-health', 'Women’s health'], ['sleep-and-stress', 'Sleep & stress'], ['everyday-health', 'Everyday health'],
    ].map(([slug, title]) => <a key={slug} className="topic-link" href={`/en/care/${slug}`}>{title}<Arrow /></a>)}</section>
    <section className="section wrap">
      <div className="section-head"><h2>The Eden<br /><em>journal.</em></h2><TextLink href="/en/journal">Read the journal</TextLink></div>
      <div className="home-journal"><div className="journal-lead">
        <a className="lead-photo" href={`/en/journal/${lead.slug}`} aria-label={lead.title}><Artwork article={lead} decorative /><span>{lead.category}</span></a>
        <h3><a href={`/en/journal/${lead.slug}`}>{lead.title}</a></h3><p>{lead.description}</p><TextLink href={`/en/journal/${lead.slug}`}>Read the article</TextLink>
      </div><div className="journal-stack">{following.map(article => <a key={article.id} href={`/en/journal/${article.slug}`}><Artwork article={article} decorative /><span>{article.category}</span><h3>{article.title}</h3><Arrow /></a>)}</div></div>
    </section>
    <section className="section wrap philosophy"><h2>Time for the<br /><em>whole picture.</em></h2><div><p className="large-copy">The wrist that hurts when you lift. The sleep that never quite restores you. The cycle that has changed.</p><p>Chinese medicine brings the details of your day into the consultation: how symptoms began, what changes them, and how you feel between appointments.</p><TextLink href="/en/about">About Eden</TextLink></div></section>
    <section className="team-home section"><div className="wrap"><div className="section-head"><h2>People behind<br /><em>your care.</em></h2><TextLink href="/en/practitioners">Meet the practitioners</TextLink></div><div className="doctor-grid home-doctors">{['hon', 'lee', 'chan'].map(id => <DoctorCard key={id} id={id} />)}</div></div></section>
    <section className="locations-home section wrap"><div className="section-head"><h2>Across the city.<br /><em>Near your day.</em></h2><TextLink href="/en/clinics">Our clinics</TextLink></div><div className="clinic-grid">{englishClinics.map(clinic => <a key={clinic.id} href={`/en/clinics/${clinic.id}`}><img src={`/english/assets/${clinic.id}.jpeg`} alt={`Eden Clinic in ${clinic.name}`} width={1024} height={768} loading="lazy" /><div><span>{clinic.area}</span><h3>{clinic.name}</h3><Arrow /></div></a>)}</div></section>
  </>;
}
