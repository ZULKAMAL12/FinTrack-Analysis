export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-neutral-500">
        © {new Date().getFullYear()} FinTrack Analysis • Prototype ZulKamal
      </div>
    </footer>
  );
}
