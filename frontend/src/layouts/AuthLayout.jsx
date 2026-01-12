export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-[calc(100vh-4rem-57px)] grid place-items-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
        )}
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
