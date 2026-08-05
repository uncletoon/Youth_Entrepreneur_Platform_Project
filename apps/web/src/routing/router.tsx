import {
  createContext,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

interface NavigateOptions {
  replace?: boolean;
}
interface RouterValue {
  path: string;
  navigate(to: string, options?: NavigateOptions): void;
}
const RouterContext = createContext<RouterValue | null>(null);

export const RouterProvider = ({
  children,
  initialPath,
}: {
  children: ReactNode;
  initialPath?: string;
}) => {
  const [path, setPath] = useState(initialPath ?? window.location.pathname);
  useEffect(() => {
    if (initialPath) return;
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, [initialPath]);
  const value = useMemo<RouterValue>(
    () => ({
      path,
      navigate(to, options) {
        if (initialPath) {
          setPath(to);
          return;
        }
        window.history[options?.replace ? 'replaceState' : 'pushState']({}, '', to);
        setPath(new URL(to, window.location.origin).pathname);
        window.scrollTo({ top: 0, behavior: 'instant' });
      },
    }),
    [initialPath, path],
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
};

export const useRouter = () => {
  const value = useContext(RouterContext);
  if (!value) throw new Error('useRouter must be used inside RouterProvider.');
  return value;
};

export const useNavigate = () => useRouter().navigate;

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
}
export const Link = ({ to, onClick, children, ...props }: LinkProps) => {
  const navigate = useNavigate();
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    navigate(to);
  };
  return (
    <a href={to} onClick={handleClick} {...props}>
      {children}
    </a>
  );
};

export const Redirect = ({ to }: { to: string }) => {
  const navigate = useNavigate();
  useEffect(() => navigate(to, { replace: true }), [navigate, to]);
  return null;
};
