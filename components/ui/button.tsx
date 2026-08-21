import { Link } from "@/i18n/navigation";

type Variant = "primary" | "ghost" | "onDark";

const variantClasses: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-accent shadow-sm",
  ghost: "border border-line bg-white text-ink hover:bg-pale",
  onDark: "bg-white text-ink hover:bg-pale shadow-sm",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none";

export function LinkButton({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <Link href={href} className={`${base} ${variantClasses[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button className={`${base} ${variantClasses[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
