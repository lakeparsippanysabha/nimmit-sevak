import { Link, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';
import { useAuth } from '../contexts/AuthContext';
import { Menu, X, LogOut, User, LogIn } from 'lucide-react';

export default function Header() {
  const { session, signOut, role } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.navigate({ to: '/login' });
  };

  const navLinks = [
    { to: '/contacts', label: 'Contacts', search: undefined },
    { to: '/attendance', label: 'Attendance', search: undefined },
    { to: '/travel', label: 'Vicharan', search: { date: new Date().toISOString().split('T')[0] } },
    { to: '/journal', label: 'Smruties', search: { stopId: undefined } },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 px-4 py-3 backdrop-blur-lg">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4">
        
        {/* Logo Left */}
        <Link to="/" className="flex items-center gap-2 group outline-none" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105 active:scale-95">
            <span className="font-bold font-serif italic text-sm tracking-tighter">N</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors font-serif">Nimmit Sevak</span>
        </Link>

        {/* Desktop Navigation Center */}
        <nav className="hidden md:flex flex-1 justify-center items-center gap-8 font-semibold text-[13px] tracking-wider uppercase font-sans">
          {navLinks.map((link) => (
            <Link 
              key={link.to} 
              to={link.to} 
              search={link.search} 
              className="text-muted-foreground hover:text-primary outline-none transition-colors"
              activeProps={{ className: 'text-primary' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Icons Right */}
        <div className="ml-auto flex items-center shrink-0 gap-2 sm:gap-3">
          <ThemeToggle />
          
          <div className="hidden sm:flex items-center gap-2 border-l border-border pl-3">
             {session ? (
               <div className="relative group/profile flex items-center justify-center">
                 <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground shadow-inner cursor-default relative z-10" title="Logged in securely">
                   <User className="h-4 w-4" />
                 </div>
                 
                 {/* Popover Dropdown */}
                 <div className="absolute right-0 top-0 pt-[48px] hidden group-hover/profile:block transition-all z-0">
                    <div className="min-w-[200px] flex-col rounded-xl border border-border bg-card p-2 shadow-xl font-sans">
                        <div className="px-3 pb-2 pt-1 border-b border-border mb-2">
                          <p className="text-[13px] font-bold tracking-tight text-foreground truncate">{session.user.email}</p>
                          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mt-1">Role: {role}</p>
                        </div>
                        <button 
                          onClick={handleSignOut}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-destructive hover:bg-destructive/10 transition-all outline-none"
                        >
                          <LogOut className="h-3.5 w-3.5" /> Sign Out
                        </button>
                    </div>
                 </div>
               </div>
             ) : (
               <Link 
                 to="/login"
                 className="flex h-9 items-center gap-2 rounded-full bg-primary/10 px-4 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary/20 transition-all outline-none font-sans"
               >
                 <LogIn className="h-4 w-4" /> Log in
               </Link>
             )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground active:scale-95 transition-all outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="absolute left-0 right-0 top-[100%] mt-px border-b border-border bg-background/95 backdrop-blur-xl px-4 py-6 md:hidden shadow-xl animate-in slide-in-from-top-2">
          <nav className="flex flex-col gap-6 font-sans">
            <div className="flex flex-col gap-4 text-lg font-bold">
              {navLinks.map((link) => (
                <Link 
                  key={link.to} 
                  to={link.to} 
                  search={link.search} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block w-full border-b border-border pb-3 text-muted-foreground transition-colors hover:text-primary"
                  activeProps={{ className: 'text-primary border-primary/50' }}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Mobile Auth Status */}
            <div className="pt-2">
              {session ? (
                <button 
                  onClick={() => { handleSignOut(); setIsMobileMenuOpen(false); }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-destructive/10 py-3 text-sm font-bold text-destructive transition-colors hover:bg-destructive/20"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              ) : (
                <Link 
                  to="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-3 text-sm font-bold text-primary transition-colors hover:bg-primary/20"
                >
                  <LogIn className="h-4 w-4" /> Log In
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
