import './FlowNewPostsButton.css'

function FlowNewPostsButton({ count, onClick, isLoading }) {
  if (!count) {
    return null
  }

  return (
    <button
      type="button"
      className="flow-new-posts-btn"
      onClick={onClick}
      disabled={isLoading}
      aria-label={`Ladda ${count} nya inlägg`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19V5M5 12l7-7 7 7"/>
      </svg>
      {count > 0 && (
        <span className="flow-new-posts-badge">{count}</span>
      )}
    </button>
  )
}

export default FlowNewPostsButton
