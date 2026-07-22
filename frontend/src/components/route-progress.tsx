"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function isInternalNavigationLink(target: EventTarget | null): target is HTMLAnchorElement {
  if (!(target instanceof Element)) return false;
  const anchor = target.closest("a");
  if (!anchor || !anchor.href) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.getAttribute("href")?.startsWith("#")) return false;

  try {
    const url = new URL(anchor.href);
    return url.origin === window.location.origin && url.pathname !== window.location.pathname;
  } catch {
    return false;
  }
}

export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      if (!isInternalNavigationLink(event.target)) return;

      setVisible(true);
      setProgress(18);

      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = window.setInterval(() => {
        setProgress((value) => {
          if (value >= 88) return value;
          return value + Math.random() * 12;
        });
      }, 180);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setVisible(true);
    setProgress(100);

    const hide = window.setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 260);

    return () => window.clearTimeout(hide);
  }, [pathname]);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="route-progress"
      role="progressbar"
      aria-hidden
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress)}
    >
      <div className="route-progress__bar" style={{ width: `${progress}%` }} />
    </div>
  );
}
