export default function Button({ as = "button", className = "", ...props }) {
  const Component = as;
  return (
    <Component
      className={
        "inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium shadow-sm " +
        "bg-brand text-white hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand/40 " +
        className
      }
      {...props}
    />
  );
}
