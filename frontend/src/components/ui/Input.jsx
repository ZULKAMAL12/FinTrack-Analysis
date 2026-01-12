export default function Input({ className = "", ...props }) {
  return (
    <input
      className={
        "w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 " +
        "px-4 py-2 outline-none focus:ring-2 focus:ring-brand/40 " +
        className
      }
      {...props}
    />
  );
}
