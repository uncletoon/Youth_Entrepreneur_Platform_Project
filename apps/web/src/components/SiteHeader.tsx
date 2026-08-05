import { Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from '../routing/router';
import { Brand } from './Brand';

const links = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'What you get', href: '#benefits' },
  { label: 'Who it helps', href: '#who-it-helps' },
  { label: 'FAQ', href: '#faq' },
];

export const SiteHeader = () => {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="shell site-header__inner">
        <Brand />
        <button
          className="menu-button"
          type="button"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <X /> : <Menu />}
        </button>
        <nav className={`site-nav ${open ? 'site-nav--open' : ''}`} aria-label="Main navigation">
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </a>
          ))}
          <Link className="site-nav__login" to="/login">
            Log in
          </Link>
          <Link className="button button--small" to="/register">
            Start assessment
          </Link>
        </nav>
      </div>
    </header>
  );
};
