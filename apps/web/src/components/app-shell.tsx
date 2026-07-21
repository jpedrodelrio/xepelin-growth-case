export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand"><span className="brandMark" /> Growth Batch OS</div>
        <div className="topMeta">Outbound · Chile + México</div>
      </header>
      {children}
    </div>
  );
}
