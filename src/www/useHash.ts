import React from "react";

export function useHash(): [string, (newHash: string) => void] {
  const [hash, setHash] = React.useState(() =>
    window.location.hash.replace("#", "")
  );

  React.useEffect(() => {
    const handleHashChange = () => {
      setHash(window.location.hash.replace("#", ""));
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  const setter = React.useCallback((newHash: string) => {
    window.location.hash = newHash;
  }, []);

  return [hash, setter];
}

