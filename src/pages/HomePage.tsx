import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <div className="page page-home">
      <div className="brand-mark" aria-hidden="true">T</div>
      <p className="eyebrow">TAB</p>
      <h1>Shared costs,<br /><span>settled.</span></h1>
      <p className="hero-copy">Create one clear payment link for a shared cost. Everyone sees exactly what they owe.</p>
      <Link className="button button-primary button-large" to="/create">Create a Tab <span aria-hidden="true">→</span></Link>
      <div className="home-note"><span className="shield-icon" aria-hidden="true">✓</span><span>Direct NIM payments. No custody.</span></div>
    </div>
  )
}
