/**
 * Wellbeing Mood Faces - Maori Inspired Design
 * Cultural and artistic SVG faces with Maori design elements
 */

export const MoodFaces = {
  very_sad: ({ selected, onClick }) => (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: selected ? '3px solid #0d2b36' : 'none',
        borderRadius: '50%',
        padding: selected ? '2px' : '0',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
      }}
      title="Struggling"
    >
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        {/* Head */}
        <circle cx="35" cy="32" r="28" fill="#E8796B" />
        {/* Maori pattern on forehead */}
        <path d="M 20 18 Q 35 10 50 18" fill="none" stroke="#C85A45" strokeWidth="1.5" />
        <circle cx="25" cy="15" r="1.5" fill="#C85A45" />
        <circle cx="35" cy="12" r="1.5" fill="#C85A45" />
        <circle cx="45" cy="15" r="1.5" fill="#C85A45" />
        {/* Eyes */}
        <circle cx="27" cy="28" r="3" fill="#2D2D2D" />
        <circle cx="43" cy="28" r="3" fill="#2D2D2D" />
        {/* Tears */}
        <line x1="27" y1="32" x2="27" y2="40" stroke="#C85A45" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="43" y1="32" x2="43" y2="40" stroke="#C85A45" strokeWidth="1.5" strokeLinecap="round" />
        {/* Sad mouth */}
        <path d="M 26 48 Q 35 42 44 48" stroke="#2D2D2D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Crossed arms */}
        <path d="M 20 52 Q 18 58 22 62" stroke="#C85A45" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M 50 52 Q 52 58 48 62" stroke="#C85A45" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  ),

  sad: ({ selected, onClick }) => (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: selected ? '3px solid #0d2b36' : 'none',
        borderRadius: '50%',
        padding: selected ? '2px' : '0',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
      }}
      title="Not Great"
    >
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        {/* Head */}
        <circle cx="35" cy="32" r="28" fill="#E8A76B" />
        {/* Maori pattern */}
        <path d="M 22 16 Q 35 14 48 16" fill="none" stroke="#D48E45" strokeWidth="1" />
        <path d="M 25 18 L 23 14 L 27 16" fill="#D48E45" />
        <path d="M 45 18 L 47 14 L 43 16" fill="#D48E45" />
        {/* Eyes - worried */}
        <circle cx="27" cy="28" r="2.5" fill="#2D2D2D" />
        <circle cx="43" cy="28" r="2.5" fill="#2D2D2D" />
        <path d="M 25 25 Q 27 24 29 25" stroke="#2D2D2D" strokeWidth="1" fill="none" />
        <path d="M 41 25 Q 43 24 45 25" stroke="#2D2D2D" strokeWidth="1" fill="none" />
        {/* Hands on chest */}
        <circle cx="22" cy="48" r="5" fill="#D48E45" />
        <circle cx="48" cy="48" r="5" fill="#D48E45" />
        {/* Sad mouth */}
        <path d="M 28 50 Q 35 48 42 50" stroke="#2D2D2D" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    </button>
  ),

  neutral: ({ selected, onClick }) => (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: selected ? '3px solid #0d2b36' : 'none',
        borderRadius: '50%',
        padding: selected ? '2px' : '0',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
      }}
      title="Okay"
    >
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        {/* Head */}
        <circle cx="35" cy="32" r="28" fill="#F4D25C" />
        {/* Maori spiral pattern */}
        <path d="M 30 16 Q 28 20 32 22 Q 36 24 34 20" fill="none" stroke="#E8B71A" strokeWidth="1" />
        <path d="M 40 16 Q 42 20 38 22 Q 34 24 36 20" fill="none" stroke="#E8B71A" strokeWidth="1" />
        <circle cx="35" cy="14" r="1" fill="#E8B71A" />
        {/* Eyes - neutral */}
        <circle cx="27" cy="28" r="2.5" fill="#2D2D2D" />
        <circle cx="43" cy="28" r="2.5" fill="#2D2D2D" />
        {/* Neutral mouth */}
        <line x1="27" y1="48" x2="43" y2="48" stroke="#2D2D2D" strokeWidth="2.5" strokeLinecap="round" />
        {/* Hand with heart symbol */}
        <circle cx="22" cy="50" r="4.5" fill="#E8B71A" />
        <path d="M 20 48 Q 21 46 23 48 Q 22 50 20 48" fill="#2D2D2D" />
      </svg>
    </button>
  ),

  happy: ({ selected, onClick }) => (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: selected ? '3px solid #0d2b36' : 'none',
        borderRadius: '50%',
        padding: selected ? '2px' : '0',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
      }}
      title="Good"
    >
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        {/* Head */}
        <circle cx="35" cy="32" r="28" fill="#A8D5BA" />
        {/* Maori design elements */}
        <path d="M 28 18 L 32 16 L 30 22" fill="#6BA587" />
        <path d="M 42 18 L 38 16 L 40 22" fill="#6BA587" />
        <circle cx="35" cy="17" r="1.5" fill="#6BA587" />
        {/* Eyes - happy */}
        <circle cx="27" cy="28" r="2.5" fill="#2D2D2D" />
        <circle cx="43" cy="28" r="2.5" fill="#2D2D2D" />
        <path d="M 24 30 Q 27 32 30 30" stroke="#2D2D2D" strokeWidth="1" fill="none" />
        <path d="M 40 30 Q 43 32 46 30" stroke="#2D2D2D" strokeWidth="1" fill="none" />
        {/* Happy mouth */}
        <path d="M 26 48 Q 35 54 44 48" stroke="#2D2D2D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Hand with heart */}
        <circle cx="20" cy="50" r="4" fill="#6BA587" />
        <path d="M 20 46 L 22 44 L 24 46 L 22 48 Z" fill="#2D2D2D" />
      </svg>
    </button>
  ),

  very_happy: ({ selected, onClick }) => (
    <button
      onClick={onClick}
      style={{
        background: 'none',
        border: selected ? '3px solid #0d2b36' : 'none',
        borderRadius: '50%',
        padding: selected ? '2px' : '0',
        cursor: 'pointer',
        transition: 'all 0.2s',
        transform: selected ? 'scale(1.15)' : 'scale(1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 80,
      }}
      title="Great"
    >
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        {/* Head */}
        <circle cx="35" cy="32" r="28" fill="#7ECDC9" />
        {/* Maori patterns */}
        <circle cx="28" cy="16" r="1.5" fill="#4A9E9A" />
        <circle cx="42" cy="16" r="1.5" fill="#4A9E9A" />
        <path d="M 32 14 Q 35 12 38 14" stroke="#4A9E9A" strokeWidth="1.5" fill="none" />
        {/* Eyes - very happy */}
        <circle cx="27" cy="28" r="2.5" fill="#2D2D2D" />
        <circle cx="43" cy="28" r="2.5" fill="#2D2D2D" />
        <path d="M 24 30 Q 27 33 30 30" stroke="#2D2D2D" strokeWidth="1.2" fill="none" />
        <path d="M 40 30 Q 43 33 46 30" stroke="#2D2D2D" strokeWidth="1.2" fill="none" />
        {/* Big smile */}
        <path d="M 24 48 Q 35 56 46 48" stroke="#2D2D2D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Hand with fern */}
        <circle cx="50" cy="42" r="3.5" fill="#4A9E9A" />
        <path d="M 52 38 Q 55 30 58 22" stroke="#4A9E9A" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 54 35 L 58 28" stroke="#4A9E9A" strokeWidth="1" />
        <path d="M 55 33 L 59 25" stroke="#4A9E9A" strokeWidth="1" />
      </svg>
    </button>
  ),
}
