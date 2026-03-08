const PrepSpinner = ({ size = 16, label }: { size?: number; label?: string }) => (
  <div className="flex flex-col items-center gap-2">
    <div
      className="border-2 border-border border-t-foreground rounded-full animate-spin"
      style={{ width: size, height: size }}
    />
    {label && <p className="text-xs text-muted-foreground animate-pulse">{label}</p>}
  </div>
);

export default PrepSpinner;
