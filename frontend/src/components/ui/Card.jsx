export default function Card({ className = "", children }) {
  return (
    <div
      className={
        "rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/60 " +
        "backdrop-blur p-6 shadow-sm " +
        className
      }
    >
      {children}
    </div>
  );
}
