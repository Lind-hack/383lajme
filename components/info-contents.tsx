import styles from "./info-pages.module.css";

export default function InfoContents({ sections }: { sections: readonly { id: string; title: string }[] }) {
  return <nav className={styles.contents} aria-label="Përmbajtja e faqes">
    <details open>
      <summary>Gjej shpejt pjesën që të duhet</summary>
      <ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
    </details>
  </nav>;
}
