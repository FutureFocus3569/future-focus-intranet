import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home, Building2, Users, GraduationCap, FileText, ClipboardList, Sparkles,
  Inbox, Search, Bell, MessageCircle, ChevronDown, ChevronRight, CalendarDays,
  Wrench, ShieldCheck, LifeBuoy, BookOpen, Leaf, UserRound, Trophy, FolderOpen,
  Clock3, PartyPopper, HeartHandshake, LayoutDashboard, ExternalLink, Menu, X, LogOut, User, Edit2, Plus, Trash2
} from 'lucide-react';
import { supabase } from './lib/supabase.js';
import { LoginPage } from './pages/Login.jsx';
import { PasswordResetPage } from './pages/PasswordReset.jsx';
import { StaffManagementPage } from './pages/StaffManagement.jsx';
import { EventsPage } from './pages/EventsPage.jsx';
import { WhatsHappeningPage } from './pages/WhatsHappening.jsx';
import { AskFutureFocusPage } from './pages/AskFutureFocus.jsx';
import { PoliciesAdminPage } from './pages/PoliciesAdmin.jsx';
import { PoliciesForReviewPage } from './pages/PoliciesForReview.jsx';
import { OurPeoplePage } from './pages/OurPeoplePage.jsx';
import { KnowledgeCentrePage } from './pages/KnowledgeCentre.jsx';
import { CentresPage } from './pages/CentresPage.jsx';
import { isDocumentVisibleForCentre, isPolicyOpenForFeedback } from './lib/policyReview.js';
import WellbeingCheckin from './components/WellbeingCheckin.jsx';
import './styles.css';

const navItems = [
  [Home, 'Home'],
  [CalendarDays, 'Calendar'],
  [Building2, 'Centres'],
  [Users, 'Our People'],
  [GraduationCap, 'Learning'],
  [ClipboardList, 'Forms'],
  [Sparkles, 'FF AI'],
  [Inbox, 'Inbox'],
];

const quickLinks = [
  [LayoutDashboard, 'Storypark'],
  [LayoutDashboard, 'Discover'],
  [LayoutDashboard, 'Xero'],
  [ShieldCheck, 'Health & Safety'],
  [LifeBuoy, 'IT Help'],
];

const topCards = [
  { icon: Leaf, title: "WHAT'S HAPPENING", text: 'Leadership updates, celebrations and company news.', tone: 'green', link: 'View', page: "What's Happening" },
  { icon: Users, title: 'YOUR CENTRE', text: 'Occupancy, staffing, roster percentage and important actions.', tone: 'blue', link: 'View', page: null },
  { icon: BookOpen, title: 'PĀTAKA KAI', text: 'Learning, resources, PD and professional development.', tone: 'mint', link: 'View', page: null },
  { icon: MessageCircle, title: 'ASK FUTURE FOCUS', text: 'Search policies and get answers instantly.', tone: 'purple', link: 'Ask Now', page: 'FF AI' },
];

const news = [
  { image: '/news-1.jpg', date: '16 MAY 2025', title: 'Leadership Hui Recap', text: 'Key takeaways and next steps' },
  { image: '/news-2.jpg', date: '14 MAY 2025', title: 'Future Focus Week', text: 'Celebrating our amazing team' },
  { image: '/news-3.jpg', date: '12 MAY 2025', title: 'Curriculum Updates', text: 'New resources and ideas' },
];

const events = [
  ['MAY', '23', 'Leadership Hui', '9:00 AM – 3:00 PM'],
  ['MAY', '27', 'Cross Centre PD', '6:00 PM – 8:00 PM'],
  ['JUN', '5', 'Parent Evening', '6:30 PM – 8:30 PM'],
  ['JUN', '12', 'Future Focus Hui', '9:00 AM – 12:00 PM'],
];

const actions = [
  [CalendarDays, 'Leave'], [Wrench, 'Maintenance'], [ClipboardList, 'Forms'],
  [Users, 'Staff Directory'], [LifeBuoy, 'Help'],
];

const people = [
  ['Sarah Lee', 'May 23', '/avatar-1.png'],
  ['Amelia Brown', 'May 29', '/avatar-2.png'],
];

const anniversaries = [
  ['Lauren Smith', '5 Years', '/avatar-3.png'],
  ['Brooke Jones', '2 Years', '/avatar-4.png'],
];

function Logo() {
  return (
    <div className="brand-lockup">
      <img src="/logo.png" alt="Future Focus" className="sidebar-logo" />
    </div>
  );
}

function Sidebar({ open, onClose, page, setPage, canManageStaff, profile }) {
  const canViewCentres = profile?.permission === 'super_admin' || profile?.permission === 'centre_leader'
  return <>
    {open && <div className="sidebar-backdrop" onClick={onClose} />}
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <button className="sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20}/></button>
      <Logo />
      <nav className="main-nav">
        {navItems.map(([Icon, label]) => {
          if (label === 'Centres' && !canViewCentres) return null
          return (
          <button key={label} className={`nav-item ${page === label ? 'active' : ''}`}
            onClick={() => { setPage(label); onClose(); }}>
            <Icon size={19} strokeWidth={1.9} /> <span>{label}</span>
          </button>
          )
        })}
        {canManageStaff && (
          <button className={`nav-item ${page === 'Staff' ? 'active' : ''}`}
            onClick={() => { setPage('Staff'); onClose(); }}>
            <Users size={19} strokeWidth={1.9} /> <span>Staff</span>
          </button>
        )}
        {(profile?.permission === 'super_admin' || profile?.permission === 'policy_admin') && (
          <button className={`nav-item ${page === 'Knowledge Centre' ? 'active' : ''}`}
            onClick={() => { setPage('Knowledge Centre'); onClose(); }}>
            <BookOpen size={19} strokeWidth={1.9} /> <span>Knowledge Centre</span>
          </button>
        )}
      </nav>
      <div className="nav-divider" />
      <div className="quick-title">Quick Links</div>
      <div className="quick-links">
        {quickLinks.map(([Icon, label]) => <button className="quick-link" key={label}>
          <Icon size={15}/><span>{label}</span><ChevronRight size={14}/>
        </button>)}
      </div>
      <div className="sidebar-art" aria-hidden="true"><span/><span/><span/></div>
      <button className="collapse"><ChevronRight size={14}/> Collapse</button>
    </aside>
  </>
}

function ProfileModal({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    first_name: profile?.first_name ?? '',
    last_name: profile?.last_name ?? '',
    email: '',
    mobile: profile?.mobile ?? '',
    role_title: profile?.role_title ?? '',
    photo_url: profile?.photo_url ?? '',
    date_of_birth: profile?.date_of_birth ?? '',
    start_date: profile?.start_date ?? '',
    bio: profile?.bio ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function loadEmail() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setForm(f => ({ ...f, email: user.email }));
    }
    loadEmail();
  }, []);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    setError('');
    
    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const filename = `${profile.id}-${Date.now()}.${ext}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filename, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data } = supabase.storage.from('profile-photos').getPublicUrl(filename);
      set('photo_url', data.publicUrl);
    } catch (err) {
      setError('Failed to upload photo: ' + err.message);
    }
    
    setUploading(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      // Update auth email if changed
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email !== form.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: form.email });
        if (emailError) throw emailError;
      }
      
      // Update profile in database (exclude email - it's stored in auth only)
      const { email, ...profileData } = form;
      const { error } = await supabase.from('profiles').update(profileData).eq('id', profile.id);
      if (error) throw error;
      
      setSaved(true); onSaved(form); setTimeout(onClose, 1200);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>My Profile</h2>
          <button className="modal-close" onClick={onClose}><X size={20}/></button>
        </div>
        <form onSubmit={handleSubmit} className="staff-form">
          <div className="photo-upload-section">
            <div className="photo-preview">
              {form.photo_url ? (
                <img src={form.photo_url} alt="Profile photo"/>
              ) : (
                <div className="photo-placeholder"><User size={48}/></div>
              )}
            </div>
            <div className="photo-upload-controls">
              <input 
                type="file" 
                id="photo-input"
                accept="image/*" 
                onChange={handlePhotoUpload} 
                disabled={uploading} 
                style={{display: 'none'}}
              />
              <label htmlFor="photo-input" className="btn-secondary" style={{cursor: 'pointer', textAlign: 'center', display: 'block'}}>
                {uploading ? 'Uploading…' : 'Upload Photo'}
              </label>
            </div>
          </div>

          <div className="form-row">
            <label>First Name <input value={form.first_name} onChange={e => set('first_name', e.target.value)} required /></label>
            <label>Last Name <input value={form.last_name} onChange={e => set('last_name', e.target.value)} required /></label>
          </div>

          <label>Email <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required /></label>
          <label>Mobile <input value={form.mobile} onChange={e => set('mobile', e.target.value)} placeholder="+64 21 123 4567" /></label>
          <label>Role Title <input value={form.role_title} onChange={e => set('role_title', e.target.value)} placeholder="e.g. Lead Teacher" /></label>

          <label>Bio <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3} placeholder="Tell us about yourself..." style={{fontFamily: 'inherit'}} /></label>

          <div className="form-row">
            <label>Date of Birth <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} /></label>
            <label>Start Date <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} /></label>
          </div>

          <div className="profile-meta">
            <span><strong>Centre:</strong> {profile?.centre || '—'}</span>
            <span><strong>Access:</strong> {profile?.permission === 'super_admin' ? 'Super Admin' : profile?.permission === 'centre_leader' ? 'Centre Leader' : 'Staff'}</span>
          </div>
          {error && <div className="form-error">{error}</div>}
          {saved && <div className="form-success">Profile updated!</div>}
          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Header({ onMenuClick, profile, onSignOut, onProfileClick }) {
  const firstName = profile?.first_name ?? 'there';
  const roleTitle = profile?.role_title ?? '';
  return <header className="topbar">
    <button className="hamburger" onClick={onMenuClick} aria-label="Open menu"><Menu size={22}/></button>
    <div className="search-box"><Search size={19}/><input placeholder="Search people, resources, policies..."/></div>
    <div className="top-actions">
      <button className="icon-btn"><Bell size={21}/></button>
      <button className="icon-btn notification"><MessageCircle size={21}/><span>2</span></button>
      <button className="profile" onClick={onProfileClick} title="Edit your profile">
        <img src="/avatar-main.png"/>
        <div><strong>Kia ora, {firstName}</strong>{roleTitle && <small>{roleTitle}</small>}</div>
        <ChevronDown size={18}/>
      </button>
      <button className="icon-btn sign-out-btn" onClick={onSignOut} title="Sign out"><LogOut size={19}/></button>
    </div>
  </header>
}

function Hero({ profile }) {
  const firstName = profile?.first_name?.toUpperCase() || 'THERE'
  return <section className="hero">
    <div className="hero-overlay" />
    <div className="hero-copy">
      <h1>KIA ORA,<br/>{firstName}</h1>
      <p>Everything Future Focus.<br/>One place.</p>
      <span>A PLACE TO BELONG</span>
    </div>
  </section>
}

function TopCard({item, onNavigate}) {
  const Icon = item.icon;
  return <article className={`top-card ${item.tone}`}>
    {!item.page && <span className="coming-soon">Coming Soon!</span>}
    <div className="circle-icon"><Icon size={28}/></div>
    <div><h3>{item.title}</h3><p>{item.text}</p><button onClick={() => item.page && onNavigate(item.page)}>{item.link} <ChevronRight size={14}/></button></div>
  </article>
}

function SectionHeader({title, onViewAll}) {
  return <div className="section-header"><h2>{title}</h2><button onClick={onViewAll}>View all</button></div>
}

function NewsPanel() {
  return <section className="panel news-panel">
    <SectionHeader title="Helping across Future Focus" />
    <span className="coming-soon">Coming Soon!</span>
    <div className="news-grid">
      {news.map(n => <article className="news-card" key={n.title}>
        <img src={n.image}/><small>{n.date}</small><h3>{n.title}</h3><p>{n.text}</p><button>Read more <ChevronRight size={14}/></button>
      </article>)}
    </div>
  </section>
}

function EventsPanel({ onViewAll }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    supabase.from('events').select('*').gte('date', today).order('date').order('start_time').limit(5)
      .then(({ data }) => setEvents(data || []));
  }, []);
  function fmt(t) {
    if (!t) return '';
    const [h, m] = t.split(':'); const hr = parseInt(h);
    return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`;
  }
  return <section className="panel events-panel"><SectionHeader title="Coming Up" onViewAll={onViewAll} />
    <div className="event-list">{events.length === 0
      ? <p style={{color:'#8fa3ad',fontSize:13,padding:'8px 0'}}>No upcoming events.</p>
      : events.map(e => {
          const d = new Date(e.date + 'T00:00:00');
          const month = d.toLocaleString('en-NZ',{month:'short'}).toUpperCase();
          const day = d.getDate();
          return <div className="event" key={e.id}>
            <div className="date-box"><small>{month}</small><strong>{day}</strong></div>
            <div><strong>{e.title}</strong><span>{fmt(e.start_time)}{e.end_time ? ` – ${fmt(e.end_time)}` : ''}</span></div>
          </div>
        })
    }</div>
  </section>
}

function QuickActions({ onNavigate, openReviewCount }) {
  return <section className="panel action-panel"><SectionHeader title="Quick Actions" />
    <div className="actions-grid">
      {actions.map(([Icon,label]) => <button key={label} onClick={() => onNavigate?.(label)}><span><Icon size={19}/></span><small>{label}</small></button>)}
      <button className="quick-action-review" onClick={() => onNavigate?.('Policies for Review')}>
        <span style={{ position: 'relative', display: 'inline-flex' }}><FileText size={19} />{openReviewCount > 0 && <span className="review-badge">{openReviewCount}</span>}</span>
        <small>Policies for Review</small>
      </button>
    </div>
  </section>
}

function Metric({value,label,extra}) { return <div className="metric"><strong>{value}</strong><span>{label}</span>{extra && <small>{extra}</small>}</div> }

function CentreSnapshot() {
  return <section className="panel snapshot">
    <SectionHeader title="Centre Snapshot" />
    <span className="coming-soon">Coming Soon!</span>
  </section>
}

function WellbeingSection({ userId, centreName }) {
  return (
    <section className="panel" style={{ marginTop: 16, marginBottom: 16 }}>
      <SectionHeader title="Daily Wellbeing Check-in" />
      <WellbeingCheckin userId={userId} centreName={centreName} />
    </section>
  )
}

function PeoplePanel({title, rows = [], anniversary=false}) {
  const safeRows = rows && Array.isArray(rows) ? rows : [];
  const moreCount = Math.max(0, safeRows.length - 2);
  return <section className="panel people-panel"><SectionHeader title={title}/>
    {safeRows.slice(0, 2).map(([name,date,img])=><div className="person-row" key={name}><img src={img} alt={name}/><div><strong>{name}</strong><span>{date}</span></div>{anniversary ? <Trophy size={18}/> : <PartyPopper size={18}/>}</div>)}
    {moreCount > 0 && <button className="more-link">{moreCount} more {anniversary ? 'this year' : 'coming up'} <ChevronRight size={13}/></button>}
  </section>
}

function Resources() {
  const items = [[BookOpen,'Policies & Procedures'],[Leaf,'Learning Resources'],[ClipboardList,'Forms & Templates'],[FolderOpen,'Staff Handbook']];
  return <section className="panel resources"><SectionHeader title="Resources"/>
    <span className="coming-soon">Coming Soon!</span>
    {items.map(([Icon,label])=><button className="resource-row" key={label}><Icon size={17}/><span>{label}</span><ChevronRight size={15}/></button>)}
  </section>
}

function App(){
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState('Home');
  const [showProfile, setShowProfile] = useState(false);
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [openReviewCount, setOpenReviewCount] = useState(0);

  useEffect(() => {
    // Check if we're in invite/reset flow from email links.
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const searchParams = new URLSearchParams(window.location.search || '');
    const authType = searchParams.get('type') || hashParams.get('type');
    const hasAccessToken = hashParams.has('access_token');
    const hasAuthCode = searchParams.has('code');
    const isInviteOrRecovery = authType === 'invite' || authType === 'recovery' || authType === 'signup';

    if (hasAccessToken || hasAuthCode || isInviteOrRecovery) {
      setIsPasswordReset(true);
      // Avoid infinite loading state when arriving from invite/reset links.
      setSession(null);

      // Supabase may deliver email auth links with a short-lived `code` query param.
      // Exchange it in the background so updateUser({ password }) works immediately.
      const code = searchParams.get('code');
      if (code) {
        supabase.auth.exchangeCodeForSession(code).catch((err) => {
          console.error('Invite/recovery code exchange failed:', err);
        });
      }
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) loadProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    loadBirthdays();
  }

  async function loadBirthdays() {
    try {
      const { data: staffList, error } = await supabase.from('profiles').select('first_name, last_name, date_of_birth, photo_url');
      
      if (error) {
        console.error('Error loading birthdays:', error);
        return;
      }

      if (!staffList || staffList.length === 0) return;

      const today = new Date();
      const upcomingList = [];

      staffList.forEach(staff => {
        if (!staff.date_of_birth) return;
        
        const dob = new Date(staff.date_of_birth);
        const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
        
        // If birthday has passed this year, check next year
        if (nextBirthday < today) {
          nextBirthday.setFullYear(today.getFullYear() + 1);
        }
        
        // Calculate days until birthday
        const daysUntil = Math.floor((nextBirthday - today) / (1000 * 60 * 60 * 24));
        
        // Include if within 30 days
        if (daysUntil >= 0 && daysUntil <= 30) {
          const dateStr = nextBirthday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const fullName = `${staff.first_name} ${staff.last_name}`;
          const photoUrl = staff.photo_url || '/avatar-default.png';
          upcomingList.push([fullName, dateStr, photoUrl, nextBirthday]);
        }
      });
      
      // Sort by birthday date
      upcomingList.sort((a, b) => a[3] - b[3]);
      // Remove the date object from the array for display
      upcomingList.forEach(item => item.pop());
      
      console.log('Upcoming birthdays:', upcomingList);
      setUpcomingBirthdays(upcomingList);
    } catch (err) {
      console.error('Birthday load error:', err);
    }
  }

  async function loadOpenReviewCount() {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('documents')
        .select('id, review_feedback_opens_at, review_feedback_closes_at, is_current_version, status, is_centre_specific, centre_scope')
        .eq('status', 'published')
        .eq('is_current_version', true)

      const visibleCount = (data || []).filter(doc => {
        if (!isPolicyOpenForFeedback(doc)) return false
        return isDocumentVisibleForCentre(doc, profile?.centre)
      }).length

      setOpenReviewCount(visibleCount)
    } catch {
      setOpenReviewCount(0)
    }
  }

  useEffect(() => {
    if (profile) loadOpenReviewCount()
  }, [profile?.id, profile?.centre])

  async function handleSignOut() {
    await supabase.auth.signOut();
    setPage('Home');
  }

  // Password reset flow
  if (isPasswordReset) return <PasswordResetPage />;

  // Still checking auth
  if (session === undefined) {
    return <div className="auth-loading"><div className="ff-mark">FF</div><p>Loading…</p></div>;
  }

  // Not signed in
  if (!session) return <LoginPage />;

  const canManageStaff = profile?.permission === 'super_admin' || profile?.permission === 'centre_leader';
  const canViewCentres = profile?.permission === 'super_admin' || profile?.permission === 'centre_leader';

  return <div className="app-shell">
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
      page={page} setPage={setPage} canManageStaff={canManageStaff} profile={profile} />
    <main className="main-area">
      <Header onMenuClick={() => setSidebarOpen(true)} profile={profile} onSignOut={handleSignOut} onProfileClick={() => setShowProfile(true)} />
      {showProfile && <ProfileModal profile={profile} onClose={() => setShowProfile(false)} onSaved={updates => setProfile(p => ({ ...p, ...updates }))} />}
      <div className="page-content">
        {page === 'Staff' && canManageStaff ? (
          <StaffManagementPage currentProfile={profile} />
        ) : page === 'Centres' && canViewCentres ? (
          <CentresPage currentProfile={profile} />
        ) : page === 'Calendar' ? (
          <EventsPage currentProfile={profile} />
        ) : page === 'Our People' ? (
          <OurPeoplePage currentProfile={profile} />
        ) : page === "What's Happening" ? (
          <WhatsHappeningPage currentProfile={profile} />
        ) : page === 'FF AI' ? (
          <AskFutureFocusPage currentProfile={profile} />
        ) : page === 'Policies for Review' ? (
          <PoliciesForReviewPage currentProfile={profile} />
        ) : page === 'Knowledge Centre' && (profile?.permission === 'super_admin' || profile?.permission === 'policy_admin') ? (
          <KnowledgeCentrePage currentProfile={profile} />
        ) : (
          <>
            <Hero profile={profile} />
            <section className="feature-grid">{topCards.map(item=><TopCard key={item.title} item={item} onNavigate={setPage}/>)}</section>
            <section className="mid-grid"><NewsPanel/><EventsPanel onViewAll={() => setPage('Calendar')}/><QuickActions onNavigate={setPage} openReviewCount={openReviewCount}/></section>
            <section className="bottom-grid"><CentreSnapshot /><PeoplePanel title="Birthdays" rows={people}/><PeoplePanel title="Anniversaries" rows={anniversaries} anniversary/><Resources/></section>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr .95fr .95fr 1.2fr', gap: 16, marginTop: 16, marginBottom: 16 }}>
              <div style={{ gridColumn: 'span 2' }}>
                <WellbeingSection userId={profile?.id} centreName={profile?.centre} />
              </div>
            </div>
            <footer><span>GOOD PEOPLE. <b>CURIOUS MINDS.</b> ONE FUTURE FOCUS.</span></footer>
          </>
        )}
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
