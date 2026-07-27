export default function RootTemplate({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="page-transition" data-page-transition>
      {children}
    </div>
  );
}
