import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Home, Building2, Users, GraduationCap, FileText, ClipboardList, Sparkles,
  Inbox, Search, Bell, MessageCircle, ChevronDown, ChevronRight, CalendarDays,
  Wrench, ShieldCheck, LifeBuoy, BookOpen, Leaf, UserRound, Trophy, FolderOpen,
  Clock3, PartyPopper, HeartHandshake, LayoutDashboard, ExternalLink, Menu, X, LogOut
} from 'lucide-react';
import { supabase } from './lib/supabase.js';
import { LoginPage } from './pages/Login.jsx';
import { StaffManagementPage } from './pages/StaffManagement.jsx';
import './styles.css';

const navItems = [
  [Home, 'Home', true],
  [Building2, 'Centres'],
  [Users, 'Our People'],
  [GraduationCap, 'Learning'],
  [FileText, 'Policies'],
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
  { icon: Leaf, title: "WHAT'S HAPPENING", text: 'Leadership updates, celebrations and company news.', tone: 'green', link: 'View' },
  { icon: Users, title: 'YOUR CENTRE', text: 'Occupancy, staffing, roster percentage and important actions.', tone: 'blue', link: 'View' },
  { icon: BookOpen, title: 'PĀTAKA KAI', text: 'Learning, resources, PD and professional development.', tone: 'mint', link: 'View' },
  { icon: MessageCircle, title: 'ASK FUTURE FOCUS', text: 'Search policies and get answers instantly.', tone: 'purple', link: 'Ask Now' },
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
  [FileText, 'Policies'], [Users, 'Staff Directory'], [LifeBuoy, 'Help'],
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
      <div className="ff-mark">FF</div>
      <div className="brand-copy">
        <strong>FUTURE<br/>FOCUS</strong>
        <span>CREATING CURIOUS FUTURES</span>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose, page, setPage, canManageStaff }) {
  return <>
    {open && <div className="sidebar-backdrop" onClick={onClose} />}
    <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
      <button className="sidebar-close" onClick={onClose} aria-label="Close menu"><X size={20}/></button>
      <Logo />
      <nav className="main-nav">
        {navItems.map(([Icon, label]) => (
          <button key={label} className={`nav-item ${page === label ? 'active' : ''}`}
            onClick={() => { setPage(label); onClose(); }}>
            <Icon size={19} strokeWidth={1.9} /> <span>{label}</span>
          </button>
        ))}
        {canManageStaff && (
          <button className={`nav-item ${page === 'Staff' ? 'active' : ''}`}
            onClick={() => { setPage('Staff'); onClose(); }}>
            <Users size={19} strokeWidth={1.9} /> <span>Staff</span>
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

function Header({ onMenuClick, profile, onSignOut }) {
  const firstName = profile?.first_name ?? 'there';
  const roleTitle = profile?.role_title ?? '';
  return <header className="topbar">
    <button className="hamburger" onClick={onMenuClick} aria-label="Open menu"><Menu size={22}/></button>
    <div className="search-box"><Search size={19}/><input placeholder="Search people, resources, policies..."/></div>
    <div className="top-actions">
      <button className="icon-btn"><Bell size={21}/></button>
      <button className="icon-btn notification"><MessageCircle size={21}/><span>2</span></button>
      <div className="profile">
        <img src="/avatar-main.png"/>
        <div><strong>Kia ora, {firstName}</strong>{roleTitle && <small>{roleTitle}</small>}</div>
        <ChevronDown size={18}/>
      </div>
      <button className="icon-btn sign-out-btn" onClick={onSignOut} title="Sign out"><LogOut size={19}/></button>
    </div>
  </header>
}

function Hero() {
  return <section className="hero">
    <div className="hero-overlay" />
    <div className="hero-copy">
      <h1>KIA ORA,<br/>COURTNEY</h1>
      <p>Everything Future Focus.<br/>One place.</p>
      <span>A PLACE TO BELONG</span>
    </div>
  </section>
}

function TopCard({item}) {
  const Icon = item.icon;
  return <article className={`top-card ${item.tone}`}>
    <div className="circle-icon"><Icon size={28}/></div>
    <div><h3>{item.title}</h3><p>{item.text}</p><button>{item.link} <ChevronRight size={14}/></button></div>
  </article>
}

function SectionHeader({title}) {
  return <div className="section-header"><h2>{title}</h2><button>View all</button></div>
}

function NewsPanel() {
  return <section className="panel news-panel">
    <SectionHeader title="Happening across Future Focus" />
    <div className="news-grid">
      {news.map(n => <article className="news-card" key={n.title}>
        <img src={n.image}/><small>{n.date}</small><h3>{n.title}</h3><p>{n.text}</p><button>Read more <ChevronRight size={14}/></button>
      </article>)}
    </div>
  </section>
}

function EventsPanel() {
  return <section className="panel events-panel"><SectionHeader title="Coming Up" />
    <div className="event-list">{events.map(([m,d,t,time])=><div className="event" key={t}>
      <div className="date-box"><small>{m}</small><strong>{d}</strong></div>
      <div><strong>{t}</strong><span>{time}</span></div>
    </div>)}</div>
  </section>
}

function QuickActions() {
  return <section className="panel action-panel"><SectionHeader title="Quick Actions" />
    <div className="actions-grid">{actions.map(([Icon,label])=><button key={label}><span><Icon size={19}/></span><small>{label}</small></button>)}</div>
  </section>
}

function Metric({value,label,extra}) { return <div className="metric"><strong>{value}</strong><span>{label}</span>{extra && <small>{extra}</small>}</div> }

function CentreSnapshot() {
  return <section className="panel snapshot"><SectionHeader title="Centre Snapshot" />
    <div className="metric-row"><Metric value="92%" label="Occupancy"/><Metric value="28%" label="Roster"/><Metric value="86%" label="Qualified"/><Metric value="3.2%↑" label="Turnover" extra="West Dune / Our Centre"/></div>
  </section>
}

function PeoplePanel({title, rows, anniversary=false}) {
  return <section className="panel people-panel"><SectionHeader title={title}/>
    {rows.map(([name,date,img])=><div className="person-row" key={name}><img src={img}/><div><strong>{name}</strong><span>{date}</span></div>{anniversary ? <Trophy size={18}/> : <PartyPopper size={18}/>}</div>)}
    <button className="more-link">{anniversary ? '1 more today' : '3 more today'} <ChevronRight size={13}/></button>
  </section>
}

function Resources() {
  const items = [[BookOpen,'Policies & Procedures'],[Leaf,'Learning Resources'],[ClipboardList,'Forms & Templates'],[FolderOpen,'Staff Handbook']];
  return <section className="panel resources"><SectionHeader title="Resources"/>
    {items.map(([Icon,label])=><button className="resource-row" key={label}><Icon size={17}/><span>{label}</span><ChevronRight size={15}/></button>)}
  </section>
}

function App(){
  const [session, setSession] = useState(undefined); // undefined = loading
  const [profile, setProfile] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [page, setPage] = useState('Home');

  useEffect(() => {
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
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setPage('Home');
  }

  // Still checking auth
  if (session === undefined) {
    return <div className="auth-loading"><div className="ff-mark">FF</div><p>Loading…</p></div>;
  }

  // Not signed in
  if (!session) return <LoginPage />;

  const canManageStaff = profile?.permission === 'super_admin' || profile?.permission === 'centre_leader';

  return <div className="app-shell">
    <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}
      page={page} setPage={setPage} canManageStaff={canManageStaff} />
    <main className="main-area">
      <Header onMenuClick={() => setSidebarOpen(true)} profile={profile} onSignOut={handleSignOut} />
      <div className="page-content">
        {page === 'Staff' && canManageStaff ? (
          <StaffManagementPage currentProfile={profile} />
        ) : (
          <>
            <Hero />
            <section className="feature-grid">{topCards.map(item=><TopCard key={item.title} item={item}/>)}</section>
            <section className="mid-grid"><NewsPanel/><EventsPanel/><QuickActions/></section>
            <section className="bottom-grid"><CentreSnapshot/><PeoplePanel title="Birthdays" rows={people}/><PeoplePanel title="Anniversaries" rows={anniversaries} anniversary/><Resources/></section>
            <footer><span>GOOD PEOPLE. <b>CURIOUS MINDS.</b> ONE FUTURE FOCUS.</span></footer>
          </>
        )}
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />)
