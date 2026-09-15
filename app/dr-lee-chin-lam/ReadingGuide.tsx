"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { readingTopics } from "./reading-topics";
import styles from "./page.module.css";

export function ReadingGuide() {
  const [selected, setSelected] = useState<string>(readingTopics[0].id);

  return (
    <div className={styles.readingGuide}>
      <div className={styles.topicButtons} role="group" aria-label="選擇閱讀主題">
        {readingTopics.map((topic, index) => (
          <button
            key={topic.id}
            type="button"
            aria-pressed={selected === topic.id}
            aria-controls={`reading-${topic.id}`}
            onClick={() => setSelected(topic.id)}
          >
            <span aria-hidden="true">0{index + 1}</span>
            {topic.label}
          </button>
        ))}
      </div>
      {readingTopics.map((topic) => (
        <section
          key={topic.id}
          id={`reading-${topic.id}`}
          aria-labelledby={`reading-heading-${topic.id}`}
          hidden={selected !== topic.id}
          className={styles.readingPanel}
        >
          <h3 id={`reading-heading-${topic.id}`}>{topic.question}</h3>
          <p className={styles.panelIntro}>{topic.description}</p>
          <div className={styles.articleGrid}>
            {topic.articles.map((article) => (
              <a key={article.href} href={article.href} className={styles.articleCard}>
                <span className={styles.articleCategory}>{article.category}</span>
                <h4>{article.title}</h4>
                <p>{article.description}</p>
                <span className={styles.articleLink}>閱讀文章 <ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
