import { englishHomepageHtml } from '@/content/english/homepage';
import { EnglishHomepageRuntime } from './EnglishHomepageRuntime';

/** The current Chinese homepage layout, translated without changing its composition. */
export function EnglishHomepage() {
  return <EnglishHomepageRuntime html={englishHomepageHtml} />;
}
