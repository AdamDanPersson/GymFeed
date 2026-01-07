import './Flow.css'

const mockPosts = [
  { id: 1, mood: 'Måndagsfokus' },
  { id: 2, mood: 'Skiss-session' },
  { id: 3, mood: 'Feedbackrunda' }
]

function FeedCard({ mood }) {
  return (
    <article className="feed-card">
      <header className="feed-card__header">
        <div className="avatar-block" aria-hidden="true" />
        <div className="meta-block">
          <span className="meta-line meta-line--bold" />
          <span className="meta-line" />
        </div>
        <span className="tag-chip">{mood}</span>
      </header>
      <div className="feed-card__body" aria-hidden="true" />
      <div className="feed-card__footer">
        <div className="footer-icon footer-icon--heart" aria-hidden="true" />
        <div className="footer-icon" aria-hidden="true" />
        <div className="footer-icon footer-icon--comment" aria-hidden="true" />
        <div className="footer-icon" aria-hidden="true" />
      </div>
    </article>
  )
}

function FlowPage() {
  return (
    <main className="flow-page" aria-labelledby="flow-heading">
      <header className="flow-page__intro">
        <p className="flow-eyebrow">Flow</p>
        <h1 id="flow-heading">Snabb överblick av feeden</h1>
        <p>
          Detta är en visuell prototyp av hur inlägg och uppdateringar kan se ut.
          Allt innehåll är placeholder tills backend kopplas på.
        </p>
      </header>

      <div className="flow-feed">
        {mockPosts.map((post) => (
          <FeedCard key={post.id} mood={post.mood} />
        ))}
      </div>
    </main>
  )
}

export default FlowPage
